export class UsuarioGamificacionEntity {
  idUsuario!: number;
  nombreUsuario!: string;
  totalHabitos!: number;
  diasCumplidosTotal!: number;
  diasCumplidosSemana!: number;
  amigosAgregados!: number;

  constructor(partial: Partial<UsuarioGamificacionEntity>) {
    Object.assign(this, partial);
  }
}

export type RequisitoLogroType =
  | 'checks_total'
  | 'habitos_creados'
  | 'checks_semana'
  | 'amigos';

export class LogroEntity {
  idLogro!: string;
  titulo!: string;
  descripcion!: string;
  icono!: string;
  xpRecompensa!: number;
  tipoRequisito!: RequisitoLogroType;
  valorObjetivo!: number;

  constructor(partial: Partial<LogroEntity>) {
    Object.assign(this, partial);
  }
}