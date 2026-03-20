import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import axios from 'axios';

@Injectable()
export class CreationCompteGuard implements CanActivate {
  private readonly logger = new Logger(CreationCompteGuard.name);
  private readonly KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL;
  private readonly REALM = process.env.KEYCLOAK_REALM;
  private readonly CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID!;
  private readonly CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET!;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const gqlContext = GqlExecutionContext.create(context);
    const ctx = gqlContext.getContext();
    const request = ctx.req;

    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException('Token manquant');
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      throw new UnauthorizedException('Token invalide');
    }

    try {
      const decodedToken = await this.validateTokenWithKeycloak(token);

      request.user = {
        sub: decodedToken.sub,
        email: decodedToken.email || decodedToken.preferred_username,
        token,
      };

      this.logger.debug(`✅ Utilisateur authentifié: ${request.user.email}`);

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('❌ Erreur validation token:', error.message);
      throw new UnauthorizedException('Token invalide ou expiré');
    }
  }

  private async validateTokenWithKeycloak(token: string): Promise<any> {
    const params = new URLSearchParams();
    params.append('client_id', this.CLIENT_ID);
    params.append('client_secret', this.CLIENT_SECRET);
    params.append('token', token);

    try {
      const response = await axios.post(
        `${this.KEYCLOAK_BASE_URL}/realms/${this.REALM}/protocol/openid-connect/token/introspect`,
        params.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );

      if (!response.data.active) {
        throw new UnauthorizedException('Token expiré');
      }

      return response.data;
    } catch (error) {
      throw new UnauthorizedException('Impossible de valider le token');
    }
  }

}
