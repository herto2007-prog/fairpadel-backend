import { FaseBracket } from './dto/generate-bracket.dto';

/**
 * Determina qué fases pueden jugarse en un día según su fecha.
 * Lógica paraguaya estándar: Jueves/Viernes=Zona/Repechaje, Sábado=Octavos/Cuartos, Domingo=Semis/Final.
 * Extraído tal cual de CanchasSorteoService (era un método privado sin estado).
 */
export function obtenerFasesParaDia(fecha: string): FaseBracket[] {
    // Usar UTC para calcular d├¡a de semana, evitando problemas de timezone
    const [year, month, day] = fecha.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const diaSemana = date.getUTCDay();
    
    switch (diaSemana) {
      case 4: // Jueves
      case 5: // Viernes
        return [FaseBracket.ZONA, FaseBracket.REPECHAJE];
      case 6: // S├íbado
        return [FaseBracket.OCTAVOS, FaseBracket.CUARTOS];
      case 0: // Domingo
        return [FaseBracket.SEMIS, FaseBracket.FINAL];
      default:
        return [FaseBracket.ZONA];
    }
  }
