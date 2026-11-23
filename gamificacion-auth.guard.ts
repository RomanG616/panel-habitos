import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AccesoNoAutorizadoGuardException } from '../exceptions/gamificacion.exception';

@Injectable()
export class GamificacionAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const headerUserId = request.headers['x-user-id'];
    const queryUserId = request.query?.userId;

    const candidate = headerUserId || queryUserId;

    if (!candidate || String(candidate).trim() === '') {
      throw new AccesoNoAutorizadoGuardException(
        "Acceso bloqueado por GamificacionAuthGuard: Debes enviar la cabecera 'X-User-Id' o el query param 'userId'.",
      );
    }

    const numericId = Number(candidate);
    if (Number.isNaN(numericId) || numericId <= 0) {
      throw new AccesoNoAutorizadoGuardException(
        `Credencial de usuario inválida en GamificacionAuthGuard: '${String(candidate)}'.`,
      );
    }

    // Adjuntamos el usuario validado al request
    (request as any).authenticatedUserId = numericId;
    return true;
  }
}