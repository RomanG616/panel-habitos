import { Module } from '@nestjs/common';
import { GamificacionController } from './gamificacion/controllers/gamificacion.controller';
import { GamificacionService } from './gamificacion/services/gamificacion.service';

@Module({
  imports: [],
  controllers: [GamificacionController],
  providers: [GamificacionService],
})
export class AppModule {}