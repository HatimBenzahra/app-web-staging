import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Récupérer les rôles requis depuis le decorator @Roles
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si aucun rôle requis, autoriser l'accès
    if (!requiredRoles) {
      return true;
    }

    // Récupérer l'utilisateur du contexte GraphQL
    const gqlContext = GqlExecutionContext.create(context);
    const ctx = gqlContext.getContext();
    const user = ctx.req.user;

    if (!user) {
      this.logger.error('❌ Utilisateur non authentifié');
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    // Vérifier si l'utilisateur a un des rôles requis
    const hasRole = requiredRoles.some((role) => user.role === role);

    if (!hasRole) {
      this.logger.warn(
        `⛔ Accès refusé: utilisateur avec rôle "${user.role}" tente d'accéder à une ressource nécessitant ${requiredRoles.join(' ou ')}`,
      );
      throw new ForbiddenException(
        `Accès refusé. Rôle requis: ${requiredRoles.join(' ou ')}`,
      );
    }

    this.logger.debug(`✅ Accès autorisé pour ${user.email} (${user.role})`);
    return true;
  }
}
