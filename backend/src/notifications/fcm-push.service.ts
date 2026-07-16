import { Injectable, Logger } from '@nestjs/common';
import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';

export type FcmPushContent = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

/**
 * Envoi de notifications push directement via Firebase Cloud Messaging
 * (Firebase Admin SDK), sans dépendre du service push Expo.
 * - init unique de l'app admin depuis `FIREBASE_SERVICE_ACCOUNT`
 *   (JSON, éventuellement encodé en base64),
 * - envoi multicast, données sérialisées en string (contrainte FCM),
 * - remonte les tokens morts via `onDeadToken` pour suppression en base.
 * Best-effort : un push désactivé ou une erreur réseau est loggé, jamais
 * propagé (les notifications in-app restent créées côté appelant).
 */
@Injectable()
export class FcmPushService {
  private readonly logger = new Logger(FcmPushService.name);
  private readonly messaging: Messaging | null;

  constructor() {
    this.messaging = this.initMessaging();
  }

  private initMessaging(): Messaging | null {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      this.logger.warn(
        'FIREBASE_SERVICE_ACCOUNT absent : push FCM désactivé (les notifications in-app restent actives).',
      );
      return null;
    }
    try {
      // Accepte le JSON brut ou une version base64 (pratique en variable d'env).
      const json = raw.trim().startsWith('{')
        ? raw
        : Buffer.from(raw, 'base64').toString('utf8');
      const serviceAccount = JSON.parse(json) as ServiceAccount;
      const app =
        getApps().length > 0
          ? getApp()
          : initializeApp({ credential: cert(serviceAccount) });
      this.logger.log('Firebase Admin initialisé : push FCM actif.');
      return getMessaging(app);
    } catch (err) {
      this.logger.error(
        'Init Firebase Admin échouée : push FCM désactivé',
        err as Error,
      );
      return null;
    }
  }

  async send(
    tokens: string[],
    content: FcmPushContent,
    onDeadToken?: (token: string) => void | Promise<void>,
  ): Promise<void> {
    if (!this.messaging) return;

    const validTokens = tokens.filter(
      (t) => typeof t === 'string' && t.length > 0,
    );
    if (validTokens.length === 0) return;

    // FCM n'accepte que des valeurs string dans `data`.
    const data: Record<string, string> = {};
    for (const [key, value] of Object.entries(content.data ?? {})) {
      data[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }

    try {
      const res = await this.messaging.sendEachForMulticast({
        tokens: validTokens,
        notification: { title: content.title, body: content.body },
        data,
        android: {
          priority: 'high',
          notification: {
            channelId: 'default',
            sound: 'default',
            icon: 'notification_icon',
            color: '#F97316',
          },
        },
      });

      // Réponses en correspondance 1:1 avec `validTokens`.
      res.responses.forEach((r, index) => {
        if (r.success) return;
        const token = validTokens[index];
        const code = r.error?.code;
        this.logger.warn(`Push FCM en erreur pour ${token}: ${code}`);
        if (
          token &&
          (code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token')
        ) {
          void onDeadToken?.(token);
        }
      });
    } catch (err) {
      this.logger.error('Envoi FCM multicast échoué', err as Error);
    }
  }
}
