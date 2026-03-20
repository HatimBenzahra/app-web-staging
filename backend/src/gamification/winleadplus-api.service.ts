import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { WinleadPlusUser } from './gamification.dto';

const WINLEADPLUS_API_BASE = 'https://www.winleadplus.com/api';

@Injectable()
export class WinleadPlusApiService {
  private readonly logger = new Logger(WinleadPlusApiService.name);

  // ============================================================================
  // USERS — Récupérer les users WinLead+ (COMMERCIAL + MANAGER uniquement)
  // ============================================================================

  async getUsers(token: string): Promise<WinleadPlusUser[]> {
    try {
      const response = await axios.get(
        `${WINLEADPLUS_API_BASE}/users?page=1&limit=1000`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const items: any[] = response.data?.items || [];

      return items
        .filter(
          (u) =>
            ['COMMERCIAL', 'MANAGER'].includes(u.role) && u.isActive === true,
        )
        .map((u) => ({
          id: u.id,
          nom: (u.nom || '').trim(),
          prenom: (u.prenom || '').trim(),
          username: u.username,
          email: u.email,
          role: u.role,
          isActive: u.isActive,
          managerId: u.managerId,
        }));
    } catch (error: any) {
      this.logger.error(`Erreur appel WinLead+ /api/users: ${error.message}`);
      this.handleApiError(error, 'utilisateurs');
    }
  }

  // ============================================================================
  // OFFRES — Récupérer les offres WinLead+
  // ============================================================================

  async getOffres(token: string): Promise<any[]> {
    try {
      const response = await axios.get(
        `${WINLEADPLUS_API_BASE}/offres`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      // L'API retourne directement un array (pas paginé)
      return Array.isArray(response.data)
        ? response.data
        : response.data?.items || [];
    } catch (error: any) {
      this.logger.error(`Erreur synchro offres WinLead+: ${error.message}`);
      this.handleApiError(error, 'offres');
    }
  }

  // ============================================================================
  // PROSPECTS — Récupérer les prospects WinLead+ (avec souscriptions et contrats)
  // ============================================================================

  async getProspects(token: string): Promise<any[]> {
    try {
      const response = await axios.get(
        `${WINLEADPLUS_API_BASE}/prospects`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      // L'API retourne directement un array (pas paginé)
      return Array.isArray(response.data)
        ? response.data
        : response.data?.items || [];
    } catch (error: any) {
      this.logger.error(`Erreur synchro prospects WinLead+: ${error.message}`);
      this.handleApiError(error, 'prospects');
    }
  }

  // ============================================================================
  // HELPER — Gestion centralisée des erreurs API
  // ============================================================================

  private handleApiError(error: any, resource: string): never {
    if (error.response?.status === 401) {
      throw new BadRequestException(
        'Token invalide ou expiré pour WinLead+',
      );
    }
    throw new BadRequestException(
      `Impossible de récupérer les ${resource} WinLead+`,
    );
  }
}
