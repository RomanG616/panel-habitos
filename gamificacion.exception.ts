import { HttpException, HttpStatus } from '@nestjs/common';

export class GamificacionDomainException extends HttpException {
  constructor(
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly errorCode: string = 'GAMIFICACION_ERROR',
  ) {
    super({ message, errorCode }, status);
  }
}

export class ParametroInvalidoPipeException extends GamificacionDomainException {
  constructor(paramName: string, receivedValue: unknown, detail?: string) {
    super(
      detail ||
        `El parámetro '${paramName}' es inválido. Valor recibido: '${String(receivedValue)}'.`,
      HttpStatus.BAD_REQUEST,
      'PIPE_VALIDATION_ERROR',
    );
  }
}

export class AccesoNoAutorizadoGuardException extends GamificacionDomainException {
  constructor(
    message = 'Acceso denegado por GamificacionAuthGuard: Se requiere la cabecera X-User-Id o un token válido.',
  ) {
    super(message, HttpStatus.UNAUTHORIZED, 'GUARD_UNAUTHORIZED_ERROR');
  }
}

export class UsuarioNoEncontradoException extends GamificacionDomainException {
  constructor(userId: number) {
    super(
      `No existe ningún usuario con el ID ${userId} en la base de datos HabitosDB_Roman.`,
      HttpStatus.NOT_FOUND,
      'USER_NOT_FOUND_ERROR',
    );
  }
}