import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UseFilters,
} from '@nestjs/common';
import { GamificacionService } from '../services/gamificacion.service';
import {
  ParsePositiveIntPipe,
  ValidateSimularXpDtoPipe,
} from '../pipes/gamificacion.pipe';
import { GamificacionAuthGuard } from '../guards/gamificacion-auth.guard';
import { LoggingInterceptor } from '../interceptors/logging.interceptor';
import { GamificacionExceptionFilter } from '../filters/gamificacion-exception.filter';
import { SimularXpRequestDto } from '../dto/gamificacion.dto';

@Controller('api/v1/gamificacion')
@UseFilters(GamificacionExceptionFilter)
@UseInterceptors(LoggingInterceptor)
@UseGuards(GamificacionAuthGuard)
export class GamificacionController {
  constructor(private readonly gamificacionService: GamificacionService) {}

  @Get('perfil/:userId')
  async obtenerPerfil(
    @Param('userId', ParsePositiveIntPipe) userId: number,
  ) {
    const entity = await this.gamificacionService.obtenerEntidadUsuario(userId);
    return this.gamificacionService.construirPerfilDto(entity);
  }

  @Get('logros/:userId')
  async obtenerLogros(
    @Param('userId', ParsePositiveIntPipe) userId: number,
  ) {
    const entity = await this.gamificacionService.obtenerEntidadUsuario(userId);
    const perfil = this.gamificacionService.construirPerfilDto(entity);
    return {
      userId: perfil.userId,
      unlockedCount: perfil.unlockedCount,
      totalAchievements: perfil.totalAchievements,
      achievements: perfil.achievements,
    };
  }

  @Get('ranking/:userId')
  async obtenerRanking(
    @Param('userId', ParsePositiveIntPipe) userId: number,
  ) {
    const leaderboard =
      await this.gamificacionService.obtenerRankingAmigos(userId);
    return { leaderboard };
  }

  @Post('simular-xp')
  async simularExperiencia(
    @Body(ValidateSimularXpDtoPipe) dto: SimularXpRequestDto,
  ) {
    const entity = await this.gamificacionService.obtenerEntidadUsuario(
      dto.userId,
    );
    const bonusXp = dto.extraDays * 25;
    const projectedProfile = this.gamificacionService.construirPerfilDto(
      entity,
      bonusXp,
    );

    return {
      simulationReason: dto.reason,
      simulatedExtraDays: dto.extraDays,
      simulatedBonusXp: bonusXp,
      projectedProfile,
    };
  }
}