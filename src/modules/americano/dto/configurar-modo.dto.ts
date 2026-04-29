import { IsString, IsOptional, IsNumber, IsBoolean, IsArray } from 'class-validator';

export class ConfigurarModoJuegoDto {
  // Tipo de inscripción
  @IsString()
  tipoInscripcion: 'individual' | 'parejasFijas';

  // Sistema de rotación
  @IsString()
  rotacion: 'automatica' | 'manual';

  // Sistema de puntos: games | sets | partido | diferencia
  @IsString()
  sistemaPuntos: 'games' | 'sets' | 'partido' | 'diferencia';

  // Formato de partido: tiempo | games | mejorDe3Sets
  @IsString()
  formatoPartido: 'tiempo' | 'games' | 'mejorDe3Sets';

  // Valor objetivo según formato (games objetivo, minutos, etc.)
  @IsNumber()
  valorObjetivo: number;

  @IsBoolean()
  @IsOptional()
  conTieBreak?: boolean;

  // Categorías
  @IsString()
  categorias: 'sin' | 'con';

  // Cantidad de rondas: número o 'automatico'
  @IsString()
  numRondas: string;

  // Canchas simultáneas
  @IsNumber()
  @IsOptional()
  canchasSimultaneas?: number;

  // Premios configurables
  @IsArray()
  @IsOptional()
  premios?: { puesto: string; descripcion: string }[];
}
