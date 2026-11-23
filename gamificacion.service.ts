import { Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import {
  UsuarioGamificacionEntity,
  LogroEntity,
} from '../entities/gamificacion.entity';
import {
  PerfilGamificacionResponseDto,
  LogroResponseDto,
  RankingItemDto,
} from '../dto/gamificacion.dto';
import { UsuarioNoEncontradoException } from '../exceptions/gamificacion.exception';

@Injectable()
export class GamificacionService {
  // Configuración directa a tu base de datos SQL Server en Somee
  private readonly sqlConfig: sql.config = {
    user: 'romang616_SQLLogin_1',
    password: '9ywhzt92pi',
    database: 'HabitosDB_Roman',
    server: 'HabitosDB_Roman.mssql.somee.com',
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
  };

  private readonly catalogoLogros: LogroEntity[] = [
    new LogroEntity({
      idLogro: 'primer_paso',
      titulo: 'Primer Paso',
      descripcion: 'Completa tu primer día de cualquier hábito.',
      icono: '🌱',
      xpRecompensa: 50,
      tipoRequisito: 'checks_total',
      valorObjetivo: 1,
    }),
    new LogroEntity({
      idLogro: 'constancia_7',
      titulo: 'Semana de Acero',
      descripcion: 'Acumula 7 días cumplidos en total.',
      icono: '🔥',
      xpRecompensa: 100,
      tipoRequisito: 'checks_total',
      valorObjetivo: 7,
    }),
    new LogroEntity({
      idLogro: 'constancia_30',
      titulo: 'Maestro Mensual',
      descripcion: 'Acumula 30 días cumplidos en tu historial.',
      icono: '🏅',
      xpRecompensa: 250,
      tipoRequisito: 'checks_total',
      valorObjetivo: 30,
    }),
    new LogroEntity({
      idLogro: 'arquitecto_metas',
      titulo: 'Arquitecto de Metas',
      descripcion: 'Ten al menos 5 hábitos activos definidos.',
      icono: '🎯',
      xpRecompensa: 80,
      tipoRequisito: 'habitos_creados',
      valorObjetivo: 5,
    }),
    new LogroEntity({
      idLogro: 'semana_activa',
      titulo: 'Imparable Semanal',
      descripcion: 'Logra 10 check-ins dentro de la semana actual (Dom - Sáb).',
      icono: '⚡',
      xpRecompensa: 120,
      tipoRequisito: 'checks_semana',
      valorObjetivo: 10,
    }),
    new LogroEntity({
      idLogro: 'comunidad_social',
      titulo: 'Espíritu de Equipo',
      descripcion: 'Agrega al menos a 1 amigo en la plataforma.',
      icono: '🤝',
      xpRecompensa: 100,
      tipoRequisito: 'amigos',
      valorObjetivo: 1,
    }),
  ];

  private readonly rangos = [
    { level: 1, title: 'Novato de Hábitos', icon: '🥉' },
    { level: 2, title: 'Aprendiz Constante', icon: '🥈' },
    { level: 3, title: 'Guerrero de la Disciplina', icon: '🥇' },
    { level: 4, title: 'Maestro del Enfoque', icon: '💎' },
    { level: 5, title: 'Leyenda Imparable', icon: '👑' },
  ];

  private obtenerRangoSemanaActual(): { domingo: string; sabado: string } {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const diaSemana = hoy.getDay(); // 0 = Domingo ... 6 = Sábado
    const domingo = new Date(hoy);
    domingo.setDate(hoy.getDate() - diaSemana);

    const sabado = new Date(domingo);
    sabado.setDate(domingo.getDate() + 6);

    const format = (d: Date) => d.toISOString().split('T')[0];
    return { domingo: format(domingo), sabado: format(sabado) };
  }

  async obtenerEntidadUsuario(userId: number): Promise<UsuarioGamificacionEntity> {
    const pool = await sql.connect(this.sqlConfig);
    const { domingo, sabado } = this.obtenerRangoSemanaActual();

    const userResult = await pool
      .request()
      .input('userId', sql.Int, userId)
      .query(
        'SELECT IdUsuario, NombreUsuario FROM Usuarios WHERE IdUsuario = @userId',
      );

    if (userResult.recordset.length === 0) {
      throw new UsuarioNoEncontradoException(userId);
    }

    const userRow = userResult.recordset[0];

    const statsResult = await pool
      .request()
      .input('userId', sql.Int, userId)
      .input('domingo', sql.Date, domingo)
      .input('sabado', sql.Date, sabado)
      .query(`
        SELECT
          (SELECT COUNT(*) FROM Habitos WHERE IdUsuario = @userId AND Activo = 1) AS TotalHabitos,
          (SELECT COUNT(*) FROM RegistrosDiarios r INNER JOIN Habitos h ON r.IdHabito = h.IdHabito WHERE h.IdUsuario = @userId AND r.Completado = 1) AS DiasTotal,
          (SELECT COUNT(*) FROM RegistrosDiarios r INNER JOIN Habitos h ON r.IdHabito = h.IdHabito WHERE h.IdUsuario = @userId AND r.Completado = 1 AND r.Fecha BETWEEN @domingo AND @sabado) AS DiasSemana,
          (SELECT COUNT(*) FROM Amistades WHERE (IdSolicitante = @userId OR IdReceptor = @userId) AND Estado = 'Aceptada') AS Amigos
      `);

    const stats = statsResult.recordset[0];

    return new UsuarioGamificacionEntity({
      idUsuario: userRow.IdUsuario,
      nombreUsuario: userRow.NombreUsuario,
      totalHabitos: stats.TotalHabitos || 0,
      diasCumplidosTotal: stats.DiasTotal || 0,
      diasCumplidosSemana: stats.DiasSemana || 0,
      amigosAgregados: stats.Amigos || 0,
    });
  }

  construirPerfilDto(
    entity: UsuarioGamificacionEntity,
    xpExtra = 0,
  ): PerfilGamificacionResponseDto {
    const mapaMetricas: Record<string, number> = {
      checks_total: entity.diasCumplidosTotal,
      habitos_creados: entity.totalHabitos,
      checks_semana: entity.diasCumplidosSemana,
      amigos: entity.amigosAgregados,
    };

    let xpLogros = 0;
    let desbloqueados = 0;

    const achievements: LogroResponseDto[] = this.catalogoLogros.map((logro) => {
      const progresoActual = mapaMetricas[logro.tipoRequisito] || 0;
      const unlocked = progresoActual >= logro.valorObjetivo;

      if (unlocked) {
        desbloqueados++;
        xpLogros += logro.xpRecompensa;
      }

      return {
        id: logro.idLogro,
        title: logro.titulo,
        description: logro.descripcion,
        icon: logro.icono,
        xpReward: logro.xpRecompensa,
        currentProgress: Math.min(progresoActual, logro.valorObjetivo),
        targetValue: logro.valorObjetivo,
        unlocked,
      };
    });

    const totalXp =
      entity.diasCumplidosTotal * 25 +
      entity.totalHabitos * 15 +
      xpLogros +
      xpExtra;

    const xpPorNivel = 250;
    const level = Math.floor(totalXp / xpPorNivel) + 1;
    const currentLevelXp = totalXp % xpPorNivel;
    const progressPercent = Math.round((currentLevelXp / xpPorNivel) * 100);

    const rangoEncontrado =
      this.rangos.find((r) => r.level === level) ||
      this.rangos[this.rangos.length - 1];

    return {
      userId: entity.idUsuario,
      username: entity.nombreUsuario,
      totalXp,
      level,
      rankTitle: rangoEncontrado.title,
      rankIcon: rangoEncontrado.icon,
      currentLevelXp,
      nextLevelXp: xpPorNivel,
      progressPercent,
      unlockedCount: desbloqueados,
      totalAchievements: this.catalogoLogros.length,
      achievements,
    };
  }

  async obtenerRankingAmigos(userId: number): Promise<RankingItemDto[]> {
    const pool = await sql.connect(this.sqlConfig);
    const friendsResult = await pool
      .request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT u.IdUsuario
        FROM Amistades a
        INNER JOIN Usuarios u
          ON (a.IdSolicitante = @userId AND a.IdReceptor = u.IdUsuario)
          OR (a.IdReceptor = @userId AND a.IdSolicitante = u.IdUsuario)
        WHERE a.Estado = 'Aceptada'
      `);

    const idsAmigos: number[] = friendsResult.recordset.map((r) => r.IdUsuario);
    const participantes = Array.from(new Set([userId, ...idsAmigos]));

    const ranking: RankingItemDto[] = [];
    for (const uid of participantes) {
      const entity = await this.obtenerEntidadUsuario(uid);
      const dto = this.construirPerfilDto(entity);
      ranking.push({
        position: 0,
        userId: dto.userId,
        username: dto.username,
        level: dto.level,
        rankTitle: dto.rankTitle,
        rankIcon: dto.rankIcon,
        totalXp: dto.totalXp,
        unlockedCount: dto.unlockedCount,
        isCurrentUser: uid === userId,
      });
    }

    ranking.sort((a, b) => b.totalXp - a.totalXp);
    ranking.forEach((item, index) => {
      item.position = index + 1;
    });

    return ranking;
  }
}