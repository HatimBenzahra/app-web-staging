import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';

/** Ce que le service rend à la création d'une analyse. */
export interface AcceptedAnalysis {
  id: number;
  status: string;
}

/**
 * Client du service de coaching. ProWin ne traite plus les audios lui-même : il
 * décide qu'un échange mérite une analyse, puis délègue.
 */
@Injectable()
export class CoachingApiClient {
  private readonly logger = new Logger(CoachingApiClient.name);
  private readonly baseUrl = (process.env.COACHING_API_URL ?? '').replace(/\/+$/, '');
  private readonly apiKey = process.env.COACHING_API_KEY ?? '';

  isConfigured(): boolean {
    return this.baseUrl.length > 0;
  }

  async createAnalysis(input: {
    s3Key: string;
    userId?: number | null;
    managerId?: number | null;
    porteId?: number | null;
    statutPorte?: string | null;
  }): Promise<AcceptedAnalysis> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('COACHING_API_URL absent');
    }
    try {
      const resp = await axios.post<AcceptedAnalysis>(
        `${this.baseUrl}/coaching/analyses`,
        input,
        { headers: { 'x-api-key': this.apiKey }, timeout: 15_000 },
      );
      return resp.data;
    } catch (error) {
      const message = (error as Error).message;
      this.logger.error(`Création d'analyse refusée pour ${input.s3Key}: ${message}`);
      throw new ServiceUnavailableException(`Service coaching injoignable: ${message}`);
    }
  }
}
