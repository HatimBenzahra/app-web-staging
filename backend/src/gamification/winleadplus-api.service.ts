import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { WinleadPlusUser } from './gamification.dto';

const WINLEADPLUS_API_BASE = 'https://www.winleadplus.com/api';
const DEFAULT_PAGE_SIZE = 50;

@Injectable()
export class WinleadPlusApiService {
  private readonly logger = new Logger(WinleadPlusApiService.name);

  // ============================================================================
  // USERS — Récupérer les users WinLead+ (COMMERCIAL + MANAGER uniquement)
  // ============================================================================

  async getUsers(token: string): Promise<WinleadPlusUser[]> {
    try {
      const items = await this.fetchPaginatedResource(token, '/users', 1000);

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

      return this.extractCollectionItems(response.data);
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
      return this.fetchPaginatedResource(token, '/prospects', DEFAULT_PAGE_SIZE);
    } catch (error: any) {
      this.logger.error(`Erreur synchro prospects WinLead+: ${error.message}`);
      this.handleApiError(error, 'prospects');
    }
  }

  private async fetchPaginatedResource(
    token: string,
    resourcePath: string,
    limit: number,
  ): Promise<any[]> {
    const headers = { Authorization: `Bearer ${token}` };
    const collectedItems: any[] = [];

    let currentPage = 1;
    let totalPages = 1;

    do {
      const response = await axios.get(`${WINLEADPLUS_API_BASE}${resourcePath}`, {
        headers,
        params: {
          page: currentPage,
          limit,
        },
      });

      const pageItems = this.extractCollectionItems(response.data);
      collectedItems.push(...pageItems);

      const responseTotalPages = Number(response.data?.totalPages);
      totalPages = Number.isFinite(responseTotalPages) && responseTotalPages > 0
        ? responseTotalPages
        : 1;

      currentPage += 1;
    } while (currentPage <= totalPages);

    this.logger.log(
      `WinLead+ ${resourcePath}: ${collectedItems.length} élément(s) récupéré(s) sur ${totalPages} page(s)`,
    );

    return collectedItems;
  }

  private extractCollectionItems(data: any): any[] {
    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.data)) {
      return data.data;
    }

    if (Array.isArray(data?.items)) {
      return data.items;
    }

    return [];
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
