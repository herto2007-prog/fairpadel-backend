import { IsString, IsOptional, IsNumber, IsBoolean, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';

export class ConfigurarModoJuegoDto {
  // Tipo de inscripción
  @IsString()
  tipoInscripcion: 'individual' | 'parejasFijas';

  // Sistema de rotación
  @IsString()
  rotacion: 'automatica' | 'manual';

  // Sistema de puntos: games | sets | partido | diferencia
  @IsString()
  sistemaPuntos: 'games' | 'sets' | 'partido' | 'diferencia' | 'puntosFijos';

  // Formato de partido: tiempo | games | mejorDe3Sets
  @IsString()
  formatoPartido: 'tiempo' | 'games' | 'mejorDe3Sets' | 'puntosFijos';

  // Valor objetivo según formato (games objetivo, minutos, etc.)
  @IsNumber()
  valorObjetivo: number;

  @IsBoolean()
  @IsOptional()
  conTieBreak?: boolean;

  // Categorías
  @IsString()
  categorias: 'sin' | 'con';

  // Cantidad de rondas: número (3-6) o 'automatico'. El frontend lo manda como
  // number; lo normalizamos a string para aceptarlo igual (el servicio luego
  // hace parseInt). Así no rompe ni el wizard ni el modal de editar modo.
  @Transform(({ value }) =>
    value === undefined || value === null ? value : String(value),
  )
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

  // Configuración de formatos americanos avanzados
  @IsString()
  @IsOptional()
  formatoAmericano?: 'clasico' | 'parejasSinCat' | 'parejasConCat' | 'porCategorias' | 'sumas' | 'mixto';

  @IsArray()
  @IsOptional()
  generosHabilitados?: string[];

  @IsArray()
  @IsOptional()
  categoriasHabilitadas?: string[];

  @IsArray()
  @IsOptional()
  combinacionesSuma?: any[];

  @IsArray()
  @IsOptional()
  combinacionesMixto?: any[];
}
