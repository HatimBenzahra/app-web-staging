import { Injectable, Logger } from '@nestjs/common';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { LiveKitConnectionDetails } from './audio-monitoring.dto';

type Role = 'publisher' | 'subscriber';

@Injectable()
export class LiveKitService {
  private readonly logger = new Logger(LiveKitService.name);

  // Ex: LK_HOST=https://<project>.livekit.cloud
  private readonly host = process.env.LK_HOST!;
  private readonly apiKey = process.env.LK_API_KEY!;
  private readonly apiSecret = process.env.LK_API_SECRET!;

  // RoomServiceClient needs HTTP(S) URL, convert if WS(S) provided
  private readonly rsc = new RoomServiceClient(
    this.host.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://'),
    this.apiKey,
    this.apiSecret,
  );

  /**
   * Génère { serverUrl, participantToken, roomName, participantName } avec des permissions strictes.
   */
  async generateConnectionDetails(
    roomName: string,
    identity: string,
    role: Role,
  ): Promise<LiveKitConnectionDetails> {
    const at = new AccessToken(this.apiKey, this.apiSecret, { identity });
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: role === 'publisher', // commercial publie
      canSubscribe: true, // superviseur écoute
    });
    // TTL long pour éviter les déconnexions sur les tablettes commerciales
    at.ttl = '30d';

    // toJwt() est SYNCHRONE → surtout pas de "await" ici
    const token = await at.toJwt();
    
    // ✅ Utilisation du proxy WebSocket via le backend NestJS
    // Cela permet de convertir WSS (Front) -> WS (LiveKit) et éviter les erreurs Mixed Content
    // Utilise PUBLIC_URL de l'env ou fallback sur localhost:3000
    // Si nous sommes en HTTPS (production/dev sécurisé), on utilise wss://
    const publicHost = process.env.PUBLIC_HOST || 'localhost:3000';
    const serverUrl = `wss://${publicHost}/livekit-proxy`;

    return {
      serverUrl,
      participantToken: token,
      roomName,
      participantName: identity,
    };
  }

  /**
   * Optionnel : crée la room (sinon elle sera auto-créée à la première connexion).
   */
  async createOrJoinRoom(roomName: string) {
    try {
      this.logger.log(`📝 Création/Jointure room: ${roomName}`);
      await this.rsc.createRoom({ name: roomName });
      this.logger.log(`✅ Room créée: ${roomName}`);
    } catch (e: any) {
      // 409 = room déjà existante
      if (e?.response?.status !== 409) {
        this.logger.warn(`⚠️ Erreur createRoom(${roomName}): ${e.message}`);
      } else {
        this.logger.debug(`ℹ️ Room existe déjà: ${roomName}`);
      }
    }
  }

  async disconnectParticipant(roomName: string, identity: string) {
    try {
      await this.rsc.removeParticipant(roomName, identity);
    } catch (e: any) {
      this.logger.warn(
        `removeParticipant(${roomName}, ${identity}): ${e.message}`,
      );
    }
  }

  async listRoomsWithParticipants(): Promise<
    { roomName: string; createdAt: Date; participants: string[] }[]
  > {
    try {
      const rooms = await this.rsc.listRooms();
      const out: {
        roomName: string;
        createdAt: Date;
        participants: string[];
      }[] = [];

      this.logger.debug(`📊 Listage de ${rooms.length} room(s) LiveKit`);

      for (const r of rooms) {
        try {
          const parts = await this.rsc.listParticipants(r.name);
          const participantIdentities = parts.map((p) => p.identity);

          this.logger.debug(
            `📍 Room ${r.name}: ${participantIdentities.length} participant(s) - [${participantIdentities.join(', ')}]`
          );

          out.push({
            roomName: r.name,
            createdAt: new Date(
              (r as any).creationTime
                ? Number((r as any).creationTime) * 1000
                : Date.now(),
            ),
            participants: participantIdentities,
          });
        } catch (e: any) {
          // La room a pu disparaître entre les 2 appels
          if (
            e?.response?.status === 404 ||
            e?.message?.includes('not exist')
          ) {
            this.logger.debug(`⚠️ Room ${r.name} n'existe plus, ignorée`);
            continue;
          }
          throw e;
        }
      }
      return out;
    } catch (e: any) {
      this.logger.error(`❌ Erreur listing rooms: ${e.message}`);
      return [];
    }
  }
}
