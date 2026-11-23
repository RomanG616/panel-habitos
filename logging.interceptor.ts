import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpCtx = context.switchToHttp();
    const request = httpCtx.getRequest<Request>();
    const response = httpCtx.getResponse<Response>();

    const { method, originalUrl } = request;
    const userHeader = request.headers['x-user-id'] || 'Anónimo';
    const startTime = performance.now();

    this.logger.log(
      `[ENTRADA] --> ${method} ${originalUrl} | Usuario: ${userHeader}`,
    );

    return next.handle().pipe(
      tap(() => {
        const durationMs = (performance.now() - startTime).toFixed(2);
        response.setHeader('X-Response-Time-Ms', durationMs);
        this.logger.log(
          `[SALIDA]  <-- ${method} ${originalUrl} | Estado: ${response.statusCode} | Tiempo: ${durationMs} ms`,
        );
      }),
      catchError((err) => {
        const durationMs = (performance.now() - startTime).toFixed(2);
        this.logger.error(
          `[ERROR]   <-- ${method} ${originalUrl} | Falló en ${durationMs} ms | Motivo: ${err.message}`,
        );
        return throwError(() => err);
      }),
    );
  }
}