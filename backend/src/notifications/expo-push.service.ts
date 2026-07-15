import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

export type ExpoPushContent = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

/**
 * Envoi de notifications push via l'API Expo (expo-server-sdk).
 * - filtre les tokens invalides,
 * - découpe en chunks (limite Expo),
 * - remonte les tokens morts (`DeviceNotRegistered`) via `onDeadToken` pour
 *   qu'ils soient supprimés en base.
 * Best-effort : un échec réseau est loggé, jamais propagé (ne casse pas l'appelant).
 */
@Injectable()
export class ExpoPushService {
  private readonly logger = new Logger(ExpoPushService.name);
  // Le accessToken n'est requis que si le projet Expo active l'« Enhanced
  // security for push notifications ». Optionnel sinon.
  private readonly expo = new Expo({
    accessToken: process.env.EXPO_ACCESS_TOKEN,
  });

  async send(
    tokens: string[],
    content: ExpoPushContent,
    onDeadToken?: (token: string) => void | Promise<void>,
  ): Promise<void> {
    const validTokens = tokens.filter((t) => Expo.isExpoPushToken(t));
    if (validTokens.length === 0) return;

    const messages: ExpoPushMessage[] = validTokens.map((to) => ({
      to,
      sound: 'default',
      title: content.title,
      body: content.body,
      data: content.data ?? {},
      channelId: 'default',
    }));

    const chunks = this.expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      let tickets: ExpoPushTicket[] = [];
      try {
        tickets = await this.expo.sendPushNotificationsAsync(chunk);
      } catch (err) {
        this.logger.error('Envoi d\'un chunk push Expo échoué', err as Error);
        continue;
      }
      // Les tickets sont en correspondance 1:1 avec les messages du chunk.
      tickets.forEach((ticket, index) => {
        if (ticket.status === 'error') {
          const to = chunk[index]?.to;
          const token = Array.isArray(to) ? to[0] : to;
          this.logger.warn(
            `Push en erreur pour ${token ?? '?'}: ${ticket.message}`,
          );
          if (ticket.details?.error === 'DeviceNotRegistered' && token) {
            void onDeadToken?.(token);
          }
        }
      });
    }
  }
}
