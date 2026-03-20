import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { LiveKitService } from './livekit.service';
import {
  MonitoringSession,
  MonitoringStatus,
  StartMonitoringInput,
  LiveKitConnectionDetails,
  ActiveRoom,
} from './audio-monitoring.dto';

type TargetMeta = {
  id: number;
  type: 'COMMERCIAL' | 'MANAGER';
  managerId?: number | null;
  directeurId?: number | null;
};

const GHOST_GRACE_PERIOD_MS = 30_000;

@Injectable()
export class AudioMonitoringService {
  private readonly logger = new Logger(AudioMonitoringService.name);
  private activeSessions: Map<string, MonitoringSession> = new Map();
  private ghostFirstSeen: Map<string, number> = new Map();

  constructor(
    private prisma: PrismaService, // prêt si tu veux persister plus tard
    private liveKit: LiveKitService,
  ) {}

  private roomNameFor(userId: number, userType: string) {
    return `room:${userType.toLowerCase()}:${userId}`;
  }

  private normalizeUserType(userType: string): TargetMeta['type'] {
    const normalized = userType?.toUpperCase();
    if (normalized === 'COMMERCIAL' || normalized === 'MANAGER') {
      return normalized;
    }
    throw new ForbiddenException(`Unsupported user type`);
  }

  private async getTargetMeta(
    userId: number,
    rawUserType: string,
  ): Promise<TargetMeta> {
    const type = this.normalizeUserType(rawUserType);

    switch (type) {
      case 'COMMERCIAL': {
        const commercial = await this.prisma.commercial.findUnique({
          where: { id: userId },
          select: { id: true, managerId: true, directeurId: true },
        });
        if (!commercial) {
          throw new NotFoundException('Commercial not found');
        }
        return {
          id: commercial.id,
          type,
          managerId: commercial.managerId,
          directeurId: commercial.directeurId,
        };
      }

      case 'MANAGER': {
        const manager = await this.prisma.manager.findUnique({
          where: { id: userId },
          select: { id: true, directeurId: true },
        });
        if (!manager) {
          throw new NotFoundException('Manager not found');
        }
        return {
          id: manager.id,
          type,
          directeurId: manager.directeurId,
        };
      }
    }
  }

  private async getTargetFromRoomName(
    roomName: string,
  ): Promise<TargetMeta | null> {
    const parts = roomName.split(':');
    if (parts.length !== 3 || parts[0] !== 'room') {
      return null;
    }

    const [, userType, userIdStr] = parts;
    const userId = Number(userIdStr);
    if (!Number.isFinite(userId)) {
      return null;
    }

    try {
      return await this.getTargetMeta(userId, userType);
    } catch (error) {
      this.logger.debug(
        `Unable to resolve target for room ${roomName}: ${error.message}`,
      );
      return null;
    }
  }

  private canViewRoom(
    target: TargetMeta,
    viewerId: number,
    viewerRole: string,
  ): boolean {
    if (viewerRole === 'admin') {
      return true;
    }

    if (viewerRole === 'directeur') {
      if (target.type === 'MANAGER') {
        return target.directeurId === viewerId;
      }
      if (target.type === 'COMMERCIAL') {
        return target.directeurId === viewerId;
      }
    }

    if (viewerRole === 'manager') {
      if (target.type === 'MANAGER') {
        return target.id === viewerId;
      }
      if (target.type === 'COMMERCIAL') {
        return target.managerId === viewerId;
      }
    }

    if (viewerRole === 'commercial') {
      return target.type === 'COMMERCIAL' && target.id === viewerId;
    }

    return false;
  }

  private ensureMonitoringPermission(
    target: TargetMeta,
    supervisorId: number,
    supervisorRole: string,
  ) {
    // Admin peut tout monitorer
    if (supervisorRole === 'admin') {
      return;
    }

    // Seuls admin et directeur peuvent monitorer
    if (supervisorRole !== 'directeur') {
      throw new ForbiddenException(
        'Only admins and directeurs can monitor users',
      );
    }

    // Directeur peut monitorer ses commerciaux
    if (target.type === 'COMMERCIAL') {
      if (target.directeurId === supervisorId) {
        return;
      }
      throw new ForbiddenException('Cannot monitor this commercial');
    }

    // Directeur peut monitorer ses managers
    if (target.type === 'MANAGER') {
      if (target.directeurId === supervisorId) {
        return;
      }
      throw new ForbiddenException('Cannot monitor this manager');
    }
  }

  private validateRoomName(roomName: string | undefined, target: TargetMeta) {
    const expected = this.roomNameFor(target.id, target.type);
    if (roomName && roomName !== expected) {
      throw new ForbiddenException('Invalid room name for this user');
    }
    return expected;
  }

  /**
   * Démarre une session d'écoute : retourne un token SUBSCRIBER (superviseur).
   */
  async startMonitoring(
    input: StartMonitoringInput,
    currentUser: { id: number; role: string },
  ): Promise<LiveKitConnectionDetails> {
    const supervisorId = currentUser.id;

    this.logger.log(
      `[START-MONITORING] Requête de ${currentUser.role}-${supervisorId} pour écouter ${input.userType}-${input.userId} (roomName demandé: ${input.roomName || 'auto'})`,
    );

    const target = await this.getTargetMeta(input.userId, input.userType);
    this.logger.debug(
      `[START-MONITORING] Target résolu: type=${target.type}, id=${target.id}, managerId=${target.managerId ?? 'N/A'}, directeurId=${target.directeurId ?? 'N/A'}`,
    );

    this.ensureMonitoringPermission(target, supervisorId, currentUser.role);
    this.logger.debug(
      `[START-MONITORING] Permission OK pour ${currentUser.role}-${supervisorId} → ${target.type}-${target.id}`,
    );

    const finalRoomName = this.validateRoomName(input.roomName, target);
    this.logger.debug(
      `[START-MONITORING] Room finale: ${finalRoomName}`,
    );

    const existingSessions = Array.from(this.activeSessions.values()).filter(
      (s) =>
        s.userId === target.id &&
        s.userType === target.type &&
        s.supervisorId === supervisorId,
    );

    if (existingSessions.length > 0) {
      this.logger.warn(
        `[START-MONITORING] ${existingSessions.length} session(s) dupliquée(s) trouvée(s) pour supervisor-${supervisorId} → ${target.type}-${target.id}. Nettoyage...`,
      );
      for (const session of existingSessions) {
        this.logger.warn(
          `[START-MONITORING] Suppression session dupliquée: ${session.id} (créée à ${session.startedAt.toISOString()})`,
        );
        this.activeSessions.delete(session.id);
        this.ghostFirstSeen.delete(session.id);
      }
    }

    this.logger.debug(
      `[START-MONITORING] Création/join room LiveKit: ${finalRoomName}`,
    );
    await this.liveKit.createOrJoinRoom(finalRoomName);

    this.logger.debug(
      `[START-MONITORING] Génération token SUBSCRIBER pour supervisor-${supervisorId} dans ${finalRoomName}`,
    );
    const supConn = await this.liveKit.generateConnectionDetails(
      finalRoomName,
      `supervisor-${supervisorId}`,
      'subscriber',
    );

    const session: MonitoringSession = {
      id: `session-${Date.now()}`,
      userId: target.id,
      userType: target.type,
      roomName: finalRoomName,
      status: MonitoringStatus.ACTIVE,
      startedAt: new Date(),
      supervisorId,
      participantToken: supConn.participantToken,
    };

    this.activeSessions.set(session.id, session);
    this.logger.log(
      `[START-MONITORING] Session créée: ${session.id} | supervisor-${supervisorId} écoute ${target.type}-${target.id} dans ${finalRoomName} | serverUrl: ${supConn.serverUrl} | Total sessions actives: ${this.activeSessions.size}`,
    );

    return supConn;
  }

  /**
   * Stoppe une session d'écoute; éjecte le superviseur (optionnel).
   */
  async stopMonitoring(
    sessionId: string,
    currentUser: { id: number; role: string },
  ): Promise<boolean> {
    this.logger.log(
      `[STOP-MONITORING] Requête de ${currentUser.role}-${currentUser.id} pour arrêter session ${sessionId}`,
    );

    const session = this.activeSessions.get(sessionId);
    if (!session) {
      this.logger.warn(
        `[STOP-MONITORING] Session ${sessionId} introuvable ou déjà arrêtée — retour succès`,
      );
      return true;
    }

    this.logger.debug(
      `[STOP-MONITORING] Session trouvée: ${sessionId} | supervisor-${session.supervisorId} → ${session.userType}-${session.userId} | room: ${session.roomName} | démarrée: ${session.startedAt.toISOString()}`,
    );

    if (
      currentUser.role !== 'admin' &&
      session.supervisorId !== currentUser.id
    ) {
      this.logger.warn(
        `[STOP-MONITORING] Permission refusée: ${currentUser.role}-${currentUser.id} ne peut pas arrêter session de supervisor-${session.supervisorId}`,
      );
      throw new ForbiddenException('Cannot stop this monitoring session');
    }

    session.status = MonitoringStatus.STOPPED;
    session.endedAt = new Date();
    const durationMs = session.endedAt.getTime() - session.startedAt.getTime();

    try {
      this.logger.debug(
        `[STOP-MONITORING] Déconnexion supervisor-${session.supervisorId} de ${session.roomName}`,
      );
      await this.liveKit.disconnectParticipant(
        session.roomName,
        `supervisor-${session.supervisorId}`,
      );
    } catch (error) {
      this.logger.debug(
        `[STOP-MONITORING] Participant déjà déconnecté ou erreur: ${error.message}`,
      );
    }

    this.activeSessions.delete(sessionId);
    this.ghostFirstSeen.delete(sessionId);
    this.logger.log(
      `[STOP-MONITORING] Session ${sessionId} arrêtée | Durée: ${Math.round(durationMs / 1000)}s | ${session.userType}-${session.userId} | Sessions restantes: ${this.activeSessions.size}`,
    );
    return true;
  }

  async getActiveSessions(currentUser: {
    id: number;
    role: string;
  }): Promise<MonitoringSession[]> {
    this.logger.debug(
      `[GET-SESSIONS] Requête de ${currentUser.role}-${currentUser.id} | Sessions en mémoire: ${this.activeSessions.size} | En grace period: ${this.ghostFirstSeen.size}`,
    );

    await this.cleanupGhostSessions();
    const sessions = Array.from(this.activeSessions.values());

    this.logger.debug(
      `[GET-SESSIONS] Après cleanup: ${sessions.length} session(s) | IDs: [${sessions.map((s) => `${s.id}(${s.userType}-${s.userId})`).join(', ')}]`,
    );

    if (currentUser.role === 'admin') {
      this.logger.debug(
        `[GET-SESSIONS] Admin → retourne toutes les ${sessions.length} session(s)`,
      );
      return sessions;
    }

    const visibleSessions: MonitoringSession[] = [];

    for (const session of sessions) {
      if (session.supervisorId === currentUser.id) {
        visibleSessions.push(session);
        continue;
      }

      try {
        const target = await this.getTargetMeta(
          session.userId,
          session.userType,
        );
        if (this.canViewRoom(target, currentUser.id, currentUser.role)) {
          visibleSessions.push(session);
        }
      } catch {
        this.logger.debug(
          `[GET-SESSIONS] Cible introuvable pour session ${session.id} (${session.userType}-${session.userId}) — ignorée`,
        );
      }
    }

    this.logger.debug(
      `[GET-SESSIONS] ${currentUser.role}-${currentUser.id} voit ${visibleSessions.length}/${sessions.length} session(s)`,
    );
    return visibleSessions;
  }

  /**
   * Nettoie les sessions où l'utilisateur cible n'est plus dans la room.
   * Utilise un grace period de 30s pour éviter de tuer les sessions lors
   * de déconnexions brèves du commercial.
   */
  private async cleanupGhostSessions(): Promise<void> {
    const now = Date.now();
    let rooms: Awaited<ReturnType<typeof this.liveKit.listRoomsWithParticipants>>;

    try {
      rooms = await this.liveKit.listRoomsWithParticipants();
    } catch (error) {
      this.logger.error(
        `[GHOST-CLEANUP] Erreur lors de la récupération des rooms LiveKit: ${error.message}`,
      );
      return;
    }

    const sessionsToDelete: string[] = [];
    const roomNames = rooms.map((r) => r.roomName);

    this.logger.debug(
      `[GHOST-CHECK] Début vérification — ${this.activeSessions.size} session(s) active(s), ${rooms.length} room(s) LiveKit: [${roomNames.join(', ')}], ghostFirstSeen entries: ${this.ghostFirstSeen.size}`,
    );

    for (const [sessionId, session] of this.activeSessions.entries()) {
      const expectedParticipant = `${session.userType.toLowerCase()}-${session.userId}`;
      const room = rooms.find((r) => r.roomName === session.roomName);

      // --- Room n'existe plus du tout ---
      if (!room) {
        const firstSeen = this.ghostFirstSeen.get(sessionId);

        if (!firstSeen) {
              this.ghostFirstSeen.set(sessionId, now);
          this.logger.warn(
            `[GHOST-CHECK] Room ${session.roomName} n'existe plus — démarrage grace period 30s pour session ${sessionId} (${expectedParticipant})`,
          );
          continue;
        }

        const elapsed = now - firstSeen;
        if (elapsed < GHOST_GRACE_PERIOD_MS) {
          this.logger.debug(
            `[GHOST-CHECK] Grace period en cours pour ${sessionId} (${expectedParticipant}) — room absente depuis ${Math.round(elapsed / 1000)}s / ${GHOST_GRACE_PERIOD_MS / 1000}s`,
          );
          continue;
        }

        this.logger.warn(
          `[GHOST-DELETE] Grace period expiré (${Math.round(elapsed / 1000)}s) — suppression session ${sessionId} (${expectedParticipant}, room: ${session.roomName})`,
        );
        sessionsToDelete.push(sessionId);
        continue;
      }

      // --- Room existe, vérifier le participant ---
      const userIsPresent = room.participants.some(
        (p) => p === expectedParticipant,
      );

      if (userIsPresent) {
          if (this.ghostFirstSeen.has(sessionId)) {
          const recoveredAfter = now - this.ghostFirstSeen.get(sessionId)!;
          this.logger.log(
            `[GHOST-RECOVERED] ${expectedParticipant} est revenu dans ${session.roomName} après ${Math.round(recoveredAfter / 1000)}s — session ${sessionId} conservée`,
          );
          this.ghostFirstSeen.delete(sessionId);
        } else {
          this.logger.debug(
            `[GHOST-CHECK] OK: ${expectedParticipant} présent dans ${session.roomName} — participants: [${room.participants.join(', ')}]`,
          );
        }
        continue;
      }

      // --- Participant absent mais room existe ---
      const firstSeen = this.ghostFirstSeen.get(sessionId);

      if (!firstSeen) {
          this.ghostFirstSeen.set(sessionId, now);
        this.logger.warn(
          `[GHOST-CHECK] ${expectedParticipant} ABSENT de ${session.roomName} — démarrage grace period 30s (session ${sessionId}). Participants actuels: [${room.participants.join(', ')}]`,
        );
        continue;
      }

      const elapsed = now - firstSeen;
      if (elapsed < GHOST_GRACE_PERIOD_MS) {
        this.logger.debug(
          `[GHOST-CHECK] Grace period en cours pour ${sessionId} (${expectedParticipant}) — absent depuis ${Math.round(elapsed / 1000)}s / ${GHOST_GRACE_PERIOD_MS / 1000}s. Participants actuels: [${room.participants.join(', ')}]`,
        );
        continue;
      }

      this.logger.warn(
        `[GHOST-DELETE] Grace period expiré (${Math.round(elapsed / 1000)}s) — suppression session ${sessionId} (${expectedParticipant}). Room ${session.roomName} existe mais participant absent. Participants: [${room.participants.join(', ')}]`,
      );
      sessionsToDelete.push(sessionId);
    }

    // --- Supprimer les sessions expirées ---
    if (sessionsToDelete.length > 0) {
      this.logger.log(
        `[GHOST-CLEANUP] Suppression de ${sessionsToDelete.length} session(s) fantôme(s) après grace period`,
      );
      for (const sessionId of sessionsToDelete) {
        const session = this.activeSessions.get(sessionId);
        this.activeSessions.delete(sessionId);
        this.ghostFirstSeen.delete(sessionId);
        this.logger.log(
          `[GHOST-CLEANUP] Session ${sessionId} supprimée (${session?.userType}-${session?.userId}, room: ${session?.roomName})`,
        );
      }
    }

    // --- Nettoyer les entrées ghostFirstSeen orphelines (session déjà supprimée par ailleurs) ---
    for (const sessionId of this.ghostFirstSeen.keys()) {
      if (!this.activeSessions.has(sessionId)) {
        this.ghostFirstSeen.delete(sessionId);
        this.logger.debug(
          `[GHOST-CLEANUP] Nettoyage entrée ghostFirstSeen orpheline: ${sessionId}`,
        );
      }
    }

    this.logger.debug(
      `[GHOST-CHECK] Fin vérification — ${this.activeSessions.size} session(s) restante(s), ${this.ghostFirstSeen.size} en grace period`,
    );
  }

  /**
   * Liste fiable des rooms "actives" depuis LiveKit (pas une Map mémoire).
   */
  async getActiveRooms(currentUser: {
    id: number;
    role: string;
  }): Promise<ActiveRoom[]> {
    this.logger.debug(
      `[GET-ROOMS] Requête de ${currentUser.role}-${currentUser.id}`,
    );

    const rooms = await this.liveKit.listRoomsWithParticipants();
    this.logger.debug(
      `[GET-ROOMS] LiveKit retourne ${rooms.length} room(s): [${rooms.map((r) => `${r.roomName}(${r.participants.length}p: ${r.participants.join('+')})`).join(', ')}]`,
    );

    const active: ActiveRoom[] = [];

    for (const r of rooms) {
      if (currentUser.role !== 'admin') {
        const target = await this.getTargetFromRoomName(r.roomName);
        if (!target) {
          this.logger.debug(
            `[GET-ROOMS] Room ${r.roomName} ignorée — impossible de résoudre la cible`,
          );
          continue;
        }
        if (!this.canViewRoom(target, currentUser.id, currentUser.role)) {
          this.logger.debug(
            `[GET-ROOMS] Room ${r.roomName} masquée pour ${currentUser.role}-${currentUser.id}`,
          );
          continue;
        }
      }

      active.push({
        roomName: r.roomName,
        numParticipants: r.participants.length,
        createdAt: r.createdAt,
        participantNames: r.participants,
      });
    }

    active.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    this.logger.debug(
      `[GET-ROOMS] Retourne ${active.length} room(s) visibles pour ${currentUser.role}-${currentUser.id}`,
    );
    return active;
  }

  /**
   * Génère un token PUBLISHER pour le commercial (micro ON côté client).
   */
  async generateCommercialToken(
    requestedCommercialId: number | undefined,
    roomName: string | undefined,
    currentUser?: { id: number; role: string },
  ): Promise<LiveKitConnectionDetails> {
    this.logger.log(
      `[COMMERCIAL-TOKEN] Requête — requestedId: ${requestedCommercialId}, roomName: ${roomName || 'auto'}, currentUser: ${currentUser?.role}-${currentUser?.id}`,
    );

    if (!currentUser) {
      this.logger.error(`[COMMERCIAL-TOKEN] Rejeté — pas d'authentification`);
      throw new ForbiddenException('Authentication required');
    }

    if (currentUser.role !== 'commercial') {
      this.logger.error(
        `[COMMERCIAL-TOKEN] Rejeté — rôle ${currentUser.role} interdit (seul commercial autorisé)`,
      );
      throw new ForbiddenException('Only commercials can generate this token');
    }

    if (requestedCommercialId && requestedCommercialId !== currentUser.id) {
      this.logger.warn(
        `[COMMERCIAL-TOKEN] Commercial ${currentUser.id} a demandé un token pour ${requestedCommercialId} — utilisation de son propre ID`,
      );
    }

    const target: TargetMeta = {
      id: currentUser.id,
      type: 'COMMERCIAL',
    };

    const finalRoomName = this.validateRoomName(roomName, target);

    this.logger.debug(
      `[COMMERCIAL-TOKEN] Création/join room: ${finalRoomName}`,
    );
    await this.liveKit.createOrJoinRoom(finalRoomName);

    this.logger.debug(
      `[COMMERCIAL-TOKEN] Génération token PUBLISHER pour commercial-${currentUser.id} dans ${finalRoomName}`,
    );
    const conn = await this.liveKit.generateConnectionDetails(
      finalRoomName,
      `commercial-${currentUser.id}`,
      'publisher',
    );

    this.logger.log(
      `[COMMERCIAL-TOKEN] Token généré pour commercial-${currentUser.id} | room: ${finalRoomName} | serverUrl: ${conn.serverUrl}`,
    );
    return conn;
  }

  /**
   * Génère un token PUBLISHER pour le manager (micro ON côté client).
   */
  async generateManagerToken(
    requestedManagerId: number | undefined,
    roomName: string | undefined,
    currentUser?: { id: number; role: string },
  ): Promise<LiveKitConnectionDetails> {
    this.logger.log(
      `[MANAGER-TOKEN] Requête — requestedId: ${requestedManagerId}, roomName: ${roomName || 'auto'}, currentUser: ${currentUser?.role}-${currentUser?.id}`,
    );

    if (!currentUser) {
      this.logger.error(`[MANAGER-TOKEN] Rejeté — pas d'authentification`);
      throw new ForbiddenException('Authentication required');
    }

    if (currentUser.role !== 'manager') {
      this.logger.error(
        `[MANAGER-TOKEN] Rejeté — rôle ${currentUser.role} interdit (seul manager autorisé)`,
      );
      throw new ForbiddenException('Only managers can generate this token');
    }

    if (requestedManagerId && requestedManagerId !== currentUser.id) {
      this.logger.warn(
        `[MANAGER-TOKEN] Manager ${currentUser.id} a demandé un token pour ${requestedManagerId} — utilisation de son propre ID`,
      );
    }

    const target: TargetMeta = {
      id: currentUser.id,
      type: 'MANAGER',
    };

    const finalRoomName = this.validateRoomName(roomName, target);

    this.logger.debug(
      `[MANAGER-TOKEN] Création/join room: ${finalRoomName}`,
    );
    await this.liveKit.createOrJoinRoom(finalRoomName);

    this.logger.debug(
      `[MANAGER-TOKEN] Génération token PUBLISHER pour manager-${currentUser.id} dans ${finalRoomName}`,
    );
    const conn = await this.liveKit.generateConnectionDetails(
      finalRoomName,
      `manager-${currentUser.id}`,
      'publisher',
    );

    this.logger.log(
      `[MANAGER-TOKEN] Token généré pour manager-${currentUser.id} | room: ${finalRoomName} | serverUrl: ${conn.serverUrl}`,
    );
    return conn;
  }

  /**
   * Log les événements audio du frontend (microphone coupé, erreurs, etc.)
   */
  async logAudioEvent(
    eventType: string,
    message: string,
    details: string | undefined,
    currentUser?: { id: number; role: string },
  ): Promise<boolean> {
    if (!currentUser) {
      return false;
    }

    const userInfo = `[${currentUser.role.toUpperCase()}-${currentUser.id}]`;

    switch (eventType) {
      case 'MICROPHONE_MUTED':
        this.logger.warn(`🔇 ${userInfo} MICROPHONE MUTED: ${message}`);
        break;
      case 'MICROPHONE_UNMUTED':
        this.logger.log(`🔊 ${userInfo} MICROPHONE UNMUTED: ${message}`);
        break;
      case 'MICROPHONE_ENDED':
        this.logger.error(`❌ ${userInfo} MICROPHONE ENDED: ${message}`);
        break;
      case 'TRACK_UNPUBLISHED':
        this.logger.warn(`📤 ${userInfo} TRACK UNPUBLISHED: ${message}`);
        break;
      case 'CONNECTION_ERROR':
        this.logger.error(`❌ ${userInfo} CONNECTION ERROR: ${message}`);
        if (details) {
          this.logger.error(`   Details: ${details}`);
        }
        break;
      case 'WEBSOCKET_FAILED':
        this.logger.error(`🔌 ${userInfo} WEBSOCKET FAILED: ${message}`);
        if (details) {
          this.logger.error(`   Details: ${details}`);
        }
        break;
      default:
        this.logger.debug(`📊 ${userInfo} ${eventType}: ${message}`);
        if (details) {
          this.logger.debug(`   Details: ${details}`);
        }
    }

    return true;
  }
}
