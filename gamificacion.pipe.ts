import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import { SimularXpRequestDto } from '../dto/gamificacion.dto';
import { ParametroInvalidoPipeException } from '../exceptions/gamificacion.exception';

@Injectable()
export class ParsePositiveIntPipe implements PipeTransform<string, number> {
  transform(value: string, metadata: ArgumentMetadata): number {
    const paramName = metadata.data || 'id';
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new ParametroInvalidoPipeException(
        paramName,
        value,
        `El parámetro '${paramName}' debe ser un número entero positivo mayor a 0. Recibido: '${value}'.`,
      );
    }
    return parsed;
  }
}

@Injectable()
export class ValidateSimularXpDtoPipe
  implements PipeTransform<any, SimularXpRequestDto>
{
  transform(value: any): SimularXpRequestDto {
    if (!value || typeof value !== 'object') {
      throw new ParametroInvalidoPipeException(
        'body',
        value,
        'El cuerpo de la petición debe ser un JSON válido.',
      );
    }

    const userId = Number(value.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new ParametroInvalidoPipeException(
        'userId',
        value.userId,
        "El campo 'userId' debe ser un entero positivo.",
      );
    }

    const extraDays = Number(value.extraDays);
    if (!Number.isInteger(extraDays) || extraDays <= 0 || extraDays > 365) {
      throw new ParametroInvalidoPipeException(
        'extraDays',
        value.extraDays,
        "El campo 'extraDays' debe ser un entero entre 1 y 365.",
      );
    }

    const reason = String(value.reason || '').trim();
    if (reason.length < 3) {
      throw new ParametroInvalidoPipeException(
        'reason',
        value.reason,
        "El campo 'reason' debe contener al menos 3 caracteres.",
      );
    }

    return { userId, extraDays, reason };
  }
}