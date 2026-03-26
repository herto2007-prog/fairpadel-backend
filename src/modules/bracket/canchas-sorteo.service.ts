import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DateService } from '../../common/services/date.service';
import { BracketService } from './bracket.service';
import { DescansoCalculatorService } from '../programacion/descanso-calculator.service';
import { isDescansoV2Enabled, FEATURES } from '../../config/features';
import {
  ConfigurarFinalesDto,
  ConfigurarDiaJuegoDto,
  CerrarInscripcionesSortearDto,
  CalculoSlotsResponse,
  SorteoMasivoResponse,
} from './dto/canchas-sorteo.dto';
import { FaseBracket } from './dto/generate-bracket.dto';

interface SlotReserva {
  fecha: string;
  horaInicio: string;
  horaFin: string;
  torneoCanchaId: string;
  categoriaId: string;
  fase: FaseBracket;
  ordenPartido: number;
}

@Injectable()
export class CanchasSorteoService {
  constructor(
    private prisma: PrismaService,
    private dateService: DateService,
    private bracketService: BracketService,
    private descansoCalculator: DescansoCalculatorService,
  ) {}

  /**
   * NUEVO: Determina qué fases pueden jugarse en un día según su fecha
   * Lógica paraguaya estándar: Jueves/Viernes=Zona/Repechaje, Sábado=Octavos/Cuartos, Domingo=Semis/Final
   */
  private obtenerFasesParaDia(fecha: string): FaseBracket[] {
    // FIX: Usar UTC para calcular día de semana, evitando problemas de timezone
    // El string YYYY-MM-DD se interpreta como UTC mediodía (12:00)
    const [year, month, day] = fecha.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const diaSemana = date.getUTCDay();
    
    switch (diaSemana) {
      case 4: // Jueves
      case 5: // Viernes
        return [FaseBracket.ZONA, FaseBracket.REPECHAJE];
      case 6: // Sábado
        return [FaseBracket.OCTAVOS, FaseBracket.CUARTOS];
      case 0: // Domingo
        return [FaseBracket.SEMIS, FaseBracket.FINAL];
      default:
        return [FaseBracket.ZONA]; // Lunes, Martes, Miércoles por defecto solo Zona
    }
  }

  /**
   * NUEVO: Calcula la hora mínima de inicio considerando el descanso.
   * Usa DescansoCalculatorService cuando FEATURE_DESCANSO_V2 está activo.
   * 
   * @param tournamentId - ID del torneo (para feature flag por torneo)
   * @param ultimoPartidoFecha - Fecha del último partido
   * @param ultimoPartidoHoraFin - Hora fin del último partido
   * @param faseOrigen - Fase del último partido
   * @param faseDestino - Fase del siguiente partido
   * @returns Hora mínima en formato "HH:mm" (legacy) o objeto con fecha/hora (nuevo)
   */
  private calcularHoraMinimaConDescanso(
    tournamentId: string,
    ultimoPartidoFecha: string,
    ultimoPartidoHoraFin: string,
    faseOrigen?: string,
    faseDestino?: string,
  ): { hora: string; cambioDia: boolean; fechaDestino?: string } {
    // Verificar si el nuevo algoritmo está activo
    if (isDescansoV2Enabled(tournamentId)) {
      // NUEVO ALGORITMO: Usar DescansoCalculatorService
      const descansoMinutos = this.descansoCalculator.getDescansoEntreFases(
        faseOrigen || '',
        faseDestino || '',
      );
      
      const resultado = this.descansoCalculator.calcularHoraMinimaDescanso(
        ultimoPartidoFecha,
        ultimoPartidoHoraFin,
        descansoMinutos,
      );

      console.log(`[DescansoV2] ${ultimoPartidoFecha} ${ultimoPartidoHoraFin} + ${descansoMinutos}min = ${resultado.fecha} ${resultado.hora}`);

      return {
        hora: resultado.hora,
        cambioDia: resultado.fecha !== ultimoPartidoFecha,
        fechaDestino: resultado.fecha,
      };
    }

    // LEGACY: Usar lógica anterior (sumarHoras)
    const horaMinima = this.sumarHoras(ultimoPartidoHoraFin, 4);
    
    // Si la hora supera las 24:00, reiniciar a 00:00 (cambio de día)
    if (horaMinima >= '24:00') {
      return { hora: '00:00', cambioDia: true };
    }

    return { hora: horaMinima, cambioDia: false };
  }

  /**
   * Helper: Sumar horas a una hora "HH:mm"
   */
  private sumarHoras(hora: string, horasASumar: number): string {
    const [h, m] = hora.split(':').map(Number);
    const totalMinutos = h * 60 + m + horasASumar * 60;
    const nuevaH = Math.floor(totalMinutos / 60);
    const nuevoM = totalMinutos % 60;
    return `${nuevaH.toString().padStart(2, '0')}:${nuevoM.toString().padStart(2, '0')}`;
  }

  /**
   * PASO 1.a: Configurar horarios de semifinales y finales
   * Crea automáticamente el día de finales con slots para ambas fases
   */
  async configurarFinales(dto: ConfigurarFinalesDto) {
    // Obtener el torneo para conocer su fecha de finales
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: dto.tournamentId },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (!torneo.fechaFinales) {
      throw new BadRequestException('El torneo no tiene fecha de finales configurada');
    }

    // Validar que los horarios no se solapen (comparación directa de strings HH:mm)
    if (dto.horaFinSemifinales > dto.horaInicioFinales) {
      throw new BadRequestException('El horario de semifinales no puede terminar después de que empiecen las finales');
    }

    // Actualizar configuración de finales en el torneo
    await this.prisma.tournament.update({
      where: { id: dto.tournamentId },
      data: {
        horaInicioFinales: dto.horaInicioFinales,
        horaFinFinales: dto.horaFinFinales,
        canchasFinales: dto.canchasFinalesIds,
      },
    });

    // Crear o actualizar el día de finales automáticamente
    // Nueva clave compuesta permite múltiples franjas por día
    const fechaFinales = torneo.fechaFinales;
    
    // El horario total es desde el inicio de semifinales hasta el fin de finales
    const disponibilidad = await this.prisma.torneoDisponibilidadDia.upsert({
      where: {
        tournamentId_fecha_horaInicio: {
          tournamentId: dto.tournamentId,
          fecha: torneo.fechaFinales,
          horaInicio: dto.horaInicioSemifinales,
        },
      },
      update: {
        horaFin: dto.horaFinFinales,
        minutosSlot: 90,
      },
      create: {
        tournamentId: dto.tournamentId,
        fecha: torneo.fechaFinales,
        horaInicio: dto.horaInicioSemifinales,
        horaFin: dto.horaFinFinales,
        minutosSlot: 90,
      },
    });

    // Generar slots para semifinales
    const slotsSemifinales = await this.generarSlotsParaDiaConFase(
      disponibilidad.id,
      dto.canchasSemifinalesIds,
      dto.horaInicioSemifinales,
      dto.horaFinSemifinales,
      90,
      'SEMIFINAL',
    );

    // Generar slots para finales
    const slotsFinales = await this.generarSlotsParaDiaConFase(
      disponibilidad.id,
      dto.canchasFinalesIds,
      dto.horaInicioFinales,
      dto.horaFinFinales,
      90,
      'FINAL',
    );

    return {
      success: true,
      message: 'Configuración guardada',
      data: {
        semifinales: {
          horaInicio: dto.horaInicioSemifinales,
          horaFin: dto.horaFinSemifinales,
          canchas: dto.canchasSemifinalesIds,
          slotsGenerados: slotsSemifinales,
        },
        finales: {
          horaInicio: dto.horaInicioFinales,
          horaFin: dto.horaFinFinales,
          canchas: dto.canchasFinalesIds,
          slotsGenerados: slotsFinales,
        },
        fechaFinales,
        diaId: disponibilidad.id,
        totalSlots: slotsSemifinales + slotsFinales,
      },
    };
  }

  /**
   * PASO 1.b: Configurar días de juego
   * Crea los slots (TorneoSlot) para el día configurado
   */
  async configurarDiaJuego(dto: ConfigurarDiaJuegoDto) {
    // Verificar que el torneo existe
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: dto.tournamentId },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    // Crear o actualizar disponibilidad del día
    // DEBUG: Log detallado para trackear problema de fechas
    console.log('[DEBUG configurarDiaJuego] ======================================');
    console.log('[DEBUG] VERSION: 2026.03.22 - Soporte multi-franja');
    console.log('[DEBUG] dto.fecha recibida:', dto.fecha);
    console.log('[DEBUG] dto.horaInicio recibida:', dto.horaInicio);
    console.log('[DEBUG] dto.fecha tipo:', typeof dto.fecha);
    console.log('[DEBUG] dto.fecha length:', dto.fecha?.length);
    console.log('[DEBUG] dto.fecha char codes:', [...(dto.fecha || '')].map(c => c.charCodeAt(0)));
    
    // NOTA: La fecha ya viene validada y transformada por el DTO (formato YYYY-MM-DD)
    // FIX: Usar clave compuesta tournamentId_fecha_horaInicio para soportar múltiples franjas por día
    const fecha = dto.fecha;
    
    // NUEVO: Determinar fases permitidas automáticamente si no se especifican
    const fasesPermitidas = dto.fasesPermitidas?.join(',') || 
      this.obtenerFasesParaDia(fecha).join(',');
    
    console.log('[DEBUG] fecha a guardar:', fecha);
    console.log('[DEBUG] fasesPermitidas:', fasesPermitidas);
    console.log('[DEBUG] ======================================');
    
    const disponibilidad = await this.prisma.torneoDisponibilidadDia.upsert({
      where: {
        // Nueva clave compuesta: permite múltiples franjas por día (misma fecha, diferente hora)
        tournamentId_fecha_horaInicio: {
          tournamentId: dto.tournamentId,
          fecha: fecha,
          horaInicio: dto.horaInicio,
        },
      },
      update: {
        horaFin: dto.horaFin,
        minutosSlot: dto.minutosSlot,
        fasesPermitidas, // NUEVO
      },
      create: {
        tournamentId: dto.tournamentId,
        fecha: fecha,
        horaInicio: dto.horaInicio,
        horaFin: dto.horaFin,
        minutosSlot: dto.minutosSlot,
        fasesPermitidas, // NUEVO
      },
    });
    
    console.log('[DEBUG] Disponibilidad guardada:', {
      id: disponibilidad.id,
      fecha: disponibilidad.fecha,
      fechaType: typeof disponibilidad.fecha,
    });

    // Generar slots para cada cancha
    const slotsGenerados = await this.generarSlotsParaDia(
      disponibilidad.id,
      dto.canchasIds,
      dto.horaInicio,
      dto.horaFin,
      dto.minutosSlot,
    );

    return {
      success: true,
      message: `Día configurado con ${slotsGenerados} slots`,
      data: {
        disponibilidadId: disponibilidad.id,
        fecha: dto.fecha,
        horaInicio: dto.horaInicio,
        horaFin: dto.horaFin,
        minutosSlot: dto.minutosSlot,
        fasesPermitidas, // NUEVO
        slotsGenerados,
        canchas: dto.canchasIds.length,
      },
    };
  }

  /**
   * Genera slots (TorneoSlot) para un día específico
   * El último slot puede extenderse más allá de horaFin (flexibilidad inteligente)
   */
  private async generarSlotsParaDia(
    disponibilidadId: string,
    canchasIds: string[],
    horaInicio: string,
    horaFin: string,
    minutosSlot: number,
  ): Promise<number> {
    // FIX: Usar strings directamente sin convertir a Date
    const [iniHora, iniMin] = horaInicio.split(':').map(Number);
    const [finHora, finMin] = horaFin.split(':').map(Number);
    const minutosTotales = (finHora * 60 + finMin) - (iniHora * 60 + iniMin);
    
    // Math.ceil para incluir el último slot aunque se extienda más allá del horario
    const slotsPorCancha = Math.ceil(minutosTotales / minutosSlot);

    let slotsGenerados = 0;

    for (const canchaId of canchasIds) {
      for (let i = 0; i < slotsPorCancha; i++) {
        const minutosInicio = (iniHora * 60 + iniMin) + (i * minutosSlot);
        const minutosFin = minutosInicio + minutosSlot;
        
        const slotInicio = `${String(Math.floor(minutosInicio / 60)).padStart(2, '0')}:${String(minutosInicio % 60).padStart(2, '0')}`;
        const slotFin = `${String(Math.floor(minutosFin / 60)).padStart(2, '0')}:${String(minutosFin % 60).padStart(2, '0')}`;

        // FIX: Usar upsert para evitar error de unique constraint
        await this.prisma.torneoSlot.upsert({
          where: {
            disponibilidadId_torneoCanchaId_horaInicio: {
              disponibilidadId,
              torneoCanchaId: canchaId,
              horaInicio: slotInicio,
            },
          },
          update: {
            horaFin: slotFin,
            estado: 'LIBRE',
          },
          create: {
            disponibilidadId,
            torneoCanchaId: canchaId,
            horaInicio: slotInicio,
            horaFin: slotFin,
            estado: 'LIBRE',
          },
        });
        slotsGenerados++;
      }
    }

    return slotsGenerados;
  }

  /**
   * Genera slots marcados con una fase específica (SEMIFINAL, FINAL, etc.)
   */
  private async generarSlotsParaDiaConFase(
    disponibilidadId: string,
    canchasIds: string[],
    horaInicio: string,
    horaFin: string,
    minutosSlot: number,
    fase: string,
  ): Promise<number> {
    // FIX: Usar strings directamente sin convertir a Date
    const [iniHora, iniMin] = horaInicio.split(':').map(Number);
    const [finHora, finMin] = horaFin.split(':').map(Number);
    const minutosTotales = (finHora * 60 + finMin) - (iniHora * 60 + iniMin);
    const slotsPorCancha = Math.ceil(minutosTotales / minutosSlot);

    let slotsGenerados = 0;

    for (const canchaId of canchasIds) {
      for (let i = 0; i < slotsPorCancha; i++) {
        const minutosInicio = (iniHora * 60 + iniMin) + (i * minutosSlot);
        const minutosFin = minutosInicio + minutosSlot;
        
        const slotInicio = `${String(Math.floor(minutosInicio / 60)).padStart(2, '0')}:${String(minutosInicio % 60).padStart(2, '0')}`;
        const slotFin = `${String(Math.floor(minutosFin / 60)).padStart(2, '0')}:${String(minutosFin % 60).padStart(2, '0')}`;

        // FIX: Usar upsert para evitar error de unique constraint
        await this.prisma.torneoSlot.upsert({
          where: {
            disponibilidadId_torneoCanchaId_horaInicio: {
              disponibilidadId,
              torneoCanchaId: canchaId,
              horaInicio: slotInicio,
            },
          },
          update: {
            horaFin: slotFin,
            estado: 'LIBRE',
            fase,
          },
          create: {
            disponibilidadId,
            torneoCanchaId: canchaId,
            horaInicio: slotInicio,
            horaFin: slotFin,
            estado: 'LIBRE',
            fase,
          },
        });
        slotsGenerados++;
      }
    }

    return slotsGenerados;
  }

  /**
   * PASO 2: Calcular slots necesarios para cerrar inscripciones
   */
  async calcularSlotsNecesarios(
    tournamentId: string,
    categoriasIds: string[],
  ): Promise<CalculoSlotsResponse> {
    // Obtener información de las categorías
    const categorias = await this.prisma.tournamentCategory.findMany({
      where: {
        id: { in: categoriasIds },
        tournamentId,
      },
    });
    
    // Obtener inscripciones confirmadas para estas categorías
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: {
        tournamentId,
        estado: 'CONFIRMADA',
        categoryId: { in: categorias.map(c => c.categoryId) },
      },
    });
    
    // Agrupar inscripciones por categoryId
    const inscripcionesPorCategoria = new Map<string, typeof inscripciones>();
    for (const cat of categorias) {
      inscripcionesPorCategoria.set(
        cat.id,
        inscripciones.filter(i => i.categoryId === cat.categoryId)
      );
    }

    // Obtener información de las categorías base
    const categoriasBase = await this.prisma.category.findMany({
      where: {
        id: { in: categorias.map(c => c.categoryId) },
      },
    });
    
    const categoriaMap = new Map(categoriasBase.map(c => [c.id, c]));
    
    // Calcular slots necesarios por categoría
    const detallePorCategoria = categorias.map((cat) => {
      const inscripcionesCat = inscripcionesPorCategoria.get(cat.id) || [];
      const parejas = inscripcionesCat.length;
      const calculo = this.bracketService.calcularSlotsNecesarios(parejas);
      const categoriaBase = categoriaMap.get(cat.categoryId);
      
      return {
        categoriaId: cat.id,
        nombre: categoriaBase?.nombre || 'Categoría',
        parejas,
        slotsNecesarios: calculo.totalPartidos,
        partidosPorFase: calculo.detallePorFase,
      };
    });

    const totalSlotsNecesarios = detallePorCategoria.reduce(
      (sum, cat) => sum + cat.slotsNecesarios,
      0,
    );

    // Obtener slots disponibles (libres) del torneo
    const slotsLibres = await this.prisma.torneoSlot.findMany({
      where: {
        disponibilidad: {
          tournamentId,
        },
        estado: 'LIBRE',
      },
      include: {
        disponibilidad: true,
      },
    });

    const slotsDisponibles = slotsLibres.length;
    const slotsFaltantes = Math.max(0, totalSlotsNecesarios - slotsDisponibles);

    // Calcular duración promedio y horas (sin usar Date, solo strings)
    let minutosTotales = 0;
    for (const slot of slotsLibres) {
      const [iniHora, iniMin] = slot.horaInicio.split(':').map(Number);
      const [finHora, finMin] = slot.horaFin.split(':').map(Number);
      minutosTotales += (finHora * 60 + finMin) - (iniHora * 60 + iniMin);
    }
    
    const duracionPromedioMinutos = slotsDisponibles > 0 
      ? Math.round(minutosTotales / slotsDisponibles)
      : 90;

    const horasNecesarias = Math.ceil((totalSlotsNecesarios * duracionPromedioMinutos) / 60);
    const horasDisponibles = Math.ceil((slotsDisponibles * duracionPromedioMinutos) / 60);

    return {
      totalSlotsNecesarios,
      slotsDisponibles,
      slotsFaltantes,
      horasNecesarias,
      horasDisponibles,
      duracionPromedioMinutos,
      detallePorCategoria,
      valido: slotsFaltantes === 0,
      mensaje: slotsFaltantes > 0
        ? `Faltan ${slotsFaltantes} slots (${Math.ceil((slotsFaltantes * duracionPromedioMinutos) / 60)}h). Necesitas ${totalSlotsNecesarios} slots (${horasNecesarias}h) pero tienes ${slotsDisponibles} slots (${horasDisponibles}h) disponibles.`
        : undefined,
    };
  }

  /**
   * NUEVO: Valida que la configuración de días pueda albergar todas las fases del torneo
   * Retorna error detallado si falta configuración, o null si todo está OK
   */
  private async validarConfiguracionDias(
    tournamentId: string,
    calculo: CalculoSlotsResponse,
  ): Promise<{ valido: boolean; mensaje?: string; detalle?: any }> {
    console.log('[ValidacionDebug] ================================================');
    console.log('[ValidacionDebug] INICIANDO validarConfiguracionDias');
    console.log('[ValidacionDebug] tournamentId:', tournamentId);
    console.log('[ValidacionDebug] totalSlotsNecesarios:', calculo.totalSlotsNecesarios);
    console.log('[ValidacionDebug] detallePorCategoria:', JSON.stringify(calculo.detallePorCategoria, null, 2));

    // Obtener todos los días configurados con sus fases
    const diasConfig = await this.prisma.torneoDisponibilidadDia.findMany({
      where: { tournamentId },
      orderBy: { fecha: 'asc' },
    });

    console.log('[ValidacionDebug] Días configurados encontrados:', diasConfig.length);
    console.log('[ValidacionDebug] DiasConfig:', JSON.stringify(diasConfig.map(d => ({ id: d.id, fecha: d.fecha, fasesPermitidas: d.fasesPermitidas })), null, 2));

    if (diasConfig.length === 0) {
      console.log('[ValidacionDebug] ERROR: No hay días configurados');
      return {
        valido: false,
        mensaje: 'No hay días configurados para el torneo',
        detalle: { diasConfigurados: 0 },
      };
    }

    // Calcular slots totales por tipo de fase requeridos
    const fasesRequeridas = new Map<FaseBracket, { partidos: number; diasNecesarios: number }>();
    
    for (const catInfo of calculo.detallePorCategoria) {
      console.log(`[ValidacionDebug] Procesando categoría: ${catInfo.nombre} (${catInfo.categoriaId})`);
      console.log(`[ValidacionDebug]   - parejas: ${catInfo.parejas}`);
      console.log(`[ValidacionDebug]   - slotsNecesarios: ${catInfo.slotsNecesarios}`);
      console.log(`[ValidacionDebug]   - partidosPorFase:`, JSON.stringify(catInfo.partidosPorFase, null, 2));
      
      for (const faseInfo of catInfo.partidosPorFase) {
        const fase = faseInfo.fase as FaseBracket;
        const actual = fasesRequeridas.get(fase) || { partidos: 0, diasNecesarios: 0 };
        actual.partidos += faseInfo.partidos;
        // Estimamos 15 partidos por día (aproximado)
        actual.diasNecesarios = Math.ceil(actual.partidos / 15);
        fasesRequeridas.set(fase, actual);
        console.log(`[ValidacionDebug]   - Fase ${fase}: +${faseInfo.partidos} partidos (total acumulado: ${actual.partidos})`);
      }
    }

    console.log('[ValidacionDebug] Fases requeridas totales:', JSON.stringify(Array.from(fasesRequeridas.entries()), null, 2));

    // Contar slots disponibles por tipo de día (según día de semana)
    const slotsPorTipoDia = {
      juevesViernes: 0, // ZONA, REPECHAJE
      sabado: 0,        // OCTAVOS, CUARTOS
      domingo: 0,       // SEMIS, FINAL
    };

    const diasDetalle: Array<{ fecha: string; tipo: string; slots: number; fasesPermitidas: string[] }> = [];

    console.log('[ValidacionDebug] --- Procesando días configurados ---');
    for (const dia of diasConfig) {
      // Contar slots libres del día
      const slotsLibres = await this.prisma.torneoSlot.count({
        where: {
          disponibilidadId: dia.id,
          estado: 'LIBRE',
        },
      });

      // Determinar tipo de día según fecha
      const [year, month, day] = dia.fecha.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      const diaSemana = date.getUTCDay();

      let tipo = 'otro';
      let fasesPermitidas: string[] = [];

      console.log(`[ValidacionDebug] Día ${dia.fecha}: diaSemana=${diaSemana} (0=Dom, 4=Jue, 5=Vie, 6=Sab)`);

      if (diaSemana === 4 || diaSemana === 5) { // Jueves o Viernes
        tipo = 'juevesViernes';
        slotsPorTipoDia.juevesViernes += slotsLibres;
        fasesPermitidas = ['ZONA', 'REPECHAJE'];
        console.log(`[ValidacionDebug]   -> Tipo: Jueves/Viernes, slots libres: ${slotsLibres}, acumulado juevesViernes: ${slotsPorTipoDia.juevesViernes}`);
      } else if (diaSemana === 6) { // Sábado
        tipo = 'sabado';
        slotsPorTipoDia.sabado += slotsLibres;
        fasesPermitidas = ['OCTAVOS', 'CUARTOS'];
        console.log(`[ValidacionDebug]   -> Tipo: Sábado, slots libres: ${slotsLibres}, acumulado sabado: ${slotsPorTipoDia.sabado}`);
      } else if (diaSemana === 0) { // Domingo
        tipo = 'domingo';
        slotsPorTipoDia.domingo += slotsLibres;
        fasesPermitidas = ['SEMIS', 'FINAL'];
        console.log(`[ValidacionDebug]   -> Tipo: Domingo, slots libres: ${slotsLibres}, acumulado domingo: ${slotsPorTipoDia.domingo}`);
      } else {
        console.log(`[ValidacionDebug]   -> Tipo: OTRO (diaSemana=${diaSemana}), slots libres: ${slotsLibres}`);
      }

      diasDetalle.push({ fecha: dia.fecha, tipo, slots: slotsLibres, fasesPermitidas });
    }

    console.log('[ValidacionDebug] --- Resumen slots por tipo de día ---');
    console.log('[ValidacionDebug] slotsPorTipoDia:', JSON.stringify(slotsPorTipoDia, null, 2));

    // Verificar que hay suficientes días de cada tipo
    const errores: string[] = [];

    // ZONA y REPECHAJE necesitan días Jueves/Viernes
    const zonaRepechaje = fasesRequeridas.get(FaseBracket.ZONA)?.partidos || 0;
    const repechajePartidos = fasesRequeridas.get(FaseBracket.REPECHAJE)?.partidos || 0;
    const totalZonaRepechaje = zonaRepechaje + repechajePartidos;
    
    console.log('[ValidacionDebug] --- Validación ZONA/REPECHAJE ---');
    console.log(`[ValidacionDebug] ZONA partidos: ${zonaRepechaje}`);
    console.log(`[ValidacionDebug] REPECHAJE partidos: ${repechajePartidos}`);
    console.log(`[ValidacionDebug] Total Zona+Repechaje: ${totalZonaRepechaje}`);
    console.log(`[ValidacionDebug] Slots Jueves/Viernes disponibles: ${slotsPorTipoDia.juevesViernes}`);
    console.log(`[ValidacionDebug] Condición: ${totalZonaRepechaje} > 0 && ${slotsPorTipoDia.juevesViernes} < ${totalZonaRepechaje} = ${totalZonaRepechaje > 0 && slotsPorTipoDia.juevesViernes < totalZonaRepechaje}`);
    
    if (totalZonaRepechaje > 0 && slotsPorTipoDia.juevesViernes < totalZonaRepechaje) {
      const error = `Faltan días Jueves/Viernes: ${totalZonaRepechaje} partidos de Zona/Repechaje pero solo ${slotsPorTipoDia.juevesViernes} slots disponibles`;
      console.log(`[ValidacionDebug] ERROR: ${error}`);
      errores.push(error);
    } else {
      console.log('[ValidacionDebug] ZONA/REPECHAJE: OK');
    }

    // OCTAVOS y CUARTOS necesitan día Sábado
    const octavos = fasesRequeridas.get(FaseBracket.OCTAVOS)?.partidos || 0;
    const cuartos = fasesRequeridas.get(FaseBracket.CUARTOS)?.partidos || 0;
    const totalOctavosCuartos = octavos + cuartos;
    
    console.log('[ValidacionDebug] --- Validación OCTAVOS/CUARTOS ---');
    console.log(`[ValidacionDebug] OCTAVOS partidos: ${octavos}`);
    console.log(`[ValidacionDebug] CUARTOS partidos: ${cuartos}`);
    console.log(`[ValidacionDebug] Total Octavos+Cuartos: ${totalOctavosCuartos}`);
    console.log(`[ValidacionDebug] Slots Sábado disponibles: ${slotsPorTipoDia.sabado}`);
    console.log(`[ValidacionDebug] Condición: ${totalOctavosCuartos} > 0 && ${slotsPorTipoDia.sabado} < ${totalOctavosCuartos} = ${totalOctavosCuartos > 0 && slotsPorTipoDia.sabado < totalOctavosCuartos}`);
    
    if (totalOctavosCuartos > 0 && slotsPorTipoDia.sabado < totalOctavosCuartos) {
      const error = `Faltan días Sábado: ${totalOctavosCuartos} partidos de Octavos/Cuartos pero solo ${slotsPorTipoDia.sabado} slots disponibles`;
      console.log(`[ValidacionDebug] ERROR: ${error}`);
      errores.push(error);
    } else {
      console.log('[ValidacionDebug] OCTAVOS/CUARTOS: OK');
    }

    // SEMIS y FINAL necesitan día Domingo
    const semis = fasesRequeridas.get(FaseBracket.SEMIS)?.partidos || 0;
    const final = fasesRequeridas.get(FaseBracket.FINAL)?.partidos || 0;
    const totalSemisFinal = semis + final;
    
    console.log('[ValidacionDebug] --- Validación SEMIS/FINAL ---');
    console.log(`[ValidacionDebug] SEMIS partidos: ${semis}`);
    console.log(`[ValidacionDebug] FINAL partidos: ${final}`);
    console.log(`[ValidacionDebug] Total Semis+Final: ${totalSemisFinal}`);
    console.log(`[ValidacionDebug] Slots Domingo disponibles: ${slotsPorTipoDia.domingo}`);
    console.log(`[ValidacionDebug] Condición: ${totalSemisFinal} > 0 && ${slotsPorTipoDia.domingo} < ${totalSemisFinal} = ${totalSemisFinal > 0 && slotsPorTipoDia.domingo < totalSemisFinal}`);
    
    if (totalSemisFinal > 0 && slotsPorTipoDia.domingo < totalSemisFinal) {
      const error = `Faltan días Domingo: ${totalSemisFinal} partidos de Semis/Final pero solo ${slotsPorTipoDia.domingo} slots disponibles`;
      console.log(`[ValidacionDebug] ERROR: ${error}`);
      errores.push(error);
    } else {
      console.log('[ValidacionDebug] SEMIS/FINAL: OK');
    }

    if (errores.length > 0) {
      console.log('[ValidacionDebug] ================================================');
      console.log('[ValidacionDebug] RESULTADO: INVALIDO - Errores encontrados:', errores.length);
      console.log('[ValidacionDebug] Errores:', JSON.stringify(errores, null, 2));
      console.log('[ValidacionDebug] ================================================');
      return {
        valido: false,
        mensaje: 'Configuración de días insuficiente para el torneo',
        detalle: {
          errores,
          fasesRequeridas: Array.from(fasesRequeridas.entries()).map(([fase, info]) => ({ fase, ...info })),
          diasConfigurados: diasDetalle,
          slotsPorTipoDia,
        },
      };
    }

    console.log('[ValidacionDebug] ================================================');
    console.log('[ValidacionDebug] RESULTADO: VALIDO = true');
    console.log('[ValidacionDebug] ================================================');
    return { valido: true };
  }

  /**
   * PASO 2: Cerrar inscripciones y sortear múltiples categorías
   * NUEVO: Usa estrategia de fases por día si los días tienen fases configuradas
   */
  async cerrarInscripcionesYsortear(
    dto: CerrarInscripcionesSortearDto,
  ): Promise<SorteoMasivoResponse> {
    const { tournamentId, categoriasIds } = dto;

    // 0. NUEVO: Verificar qué categorías ya están sorteadas y filtrarlas
    const categoriasInfo = await this.prisma.tournamentCategory.findMany({
      where: {
        id: { in: categoriasIds },
      },
      include: {
        category: true,
      },
    });

    const categoriasYaSorteadas = categoriasInfo.filter(c => c.fixtureVersionId !== null);
    const categoriasNuevas = categoriasInfo.filter(c => c.fixtureVersionId === null);
    const categoriasNuevasIds = categoriasNuevas.map(c => c.id);

    console.log('[SorteoIncremental] ================================================');
    console.log(`[SorteoIncremental] Total categorías seleccionadas: ${categoriasIds.length}`);
    console.log(`[SorteoIncremental] Categorías ya sorteadas: ${categoriasYaSorteadas.length}`);
    console.log(`[SorteoIncremental] Categorías nuevas a sortear: ${categoriasNuevasIds.length}`);
    
    if (categoriasYaSorteadas.length > 0) {
      console.log('[SorteoIncremental] Categorías ignoradas (ya sorteadas):', 
        categoriasYaSorteadas.map(c => `${c.category?.nombre} (${c.id})`).join(', '));
    }
    console.log('[SorteoIncremental] =================================================');

    // Si no hay categorías nuevas para sortear, retornar error
    if (categoriasNuevasIds.length === 0) {
      const nombresSorteadas = categoriasYaSorteadas.map(c => c.category?.nombre).join(', ');
      throw new BadRequestException({
        success: false,
        message: `Todas las categorías seleccionadas ya fueron sorteadas: ${nombresSorteadas}`,
        detalle: {
          categoriasYaSorteadas: categoriasYaSorteadas.map(c => ({
            id: c.id,
            nombre: c.category?.nombre,
            fixtureVersionId: c.fixtureVersionId,
          })),
        },
      });
    }

    // 1. Verificar que hay suficientes slots (solo para categorías nuevas)
    const calculo = await this.calcularSlotsNecesarios(tournamentId, categoriasNuevasIds);
    
    if (!calculo.valido) {
      throw new BadRequestException({
        success: false,
        message: calculo.mensaje,
        detalle: calculo,
      });
    }

    // 2. NUEVO: Validar configuración de días vs fases requeridas
    console.log('[ValidacionDebug] Llamando a validarConfiguracionDias desde cerrarInscripcionesYsortear...');
    const validacionDias = await this.validarConfiguracionDias(tournamentId, calculo);
    console.log('[ValidacionDebug] Resultado de validarConfiguracionDias:', JSON.stringify(validacionDias, null, 2));
    
    if (!validacionDias.valido) {
      console.log('[ValidacionDebug] Validación de días falló, lanzando BadRequestException');
      throw new BadRequestException({
        success: false,
        message: validacionDias.mensaje,
        detalle: validacionDias.detalle,
      });
    }
    console.log('[ValidacionDebug] Validación de días exitosa, continuando...');

    // 3. NUEVO: Verificar si hay días con fases configuradas
    const diasConFases = await this.prisma.torneoDisponibilidadDia.findMany({
      where: { 
        tournamentId,
        fasesPermitidas: { not: null }
      },
      orderBy: { fecha: 'asc' },
    });

    // 3. Decidir estrategia basada en la configuración
    const categoriasIgnoradasInfo = categoriasYaSorteadas.map(c => ({
      categoriaId: c.id,
      nombre: c.category?.nombre,
      fixtureVersionId: c.fixtureVersionId,
    }));

    if (diasConFases.length >= 2) {
      // NUEVA LÓGICA: Procesar por día respetando fases con Round-Robin
      console.log('[Sorteo] Usando estrategia NUEVA: Fases por día con Round-Robin');
      return this.sortearConFasesPorDia(tournamentId, categoriasNuevasIds, calculo, diasConFases, categoriasIgnoradasInfo);
    } else {
      // FALLBACK: Usar lógica secuencial original (backward compatibility)
      console.log('[Sorteo] Usando estrategia ORIGINAL: Secuencial');
      return this.sortearSecuencialOriginal(tournamentId, categoriasNuevasIds, calculo, categoriasIgnoradasInfo);
    }
  }

  /**
   * NUEVO: Sorteo respetando fases por día con Round-Robin entre categorías
   * Procesa los días cronológicamente, asignando partidos de las fases permitidas
   */
  private async sortearConFasesPorDia(
    tournamentId: string,
    categoriasIds: string[],
    calculo: CalculoSlotsResponse,
    diasConfig: any[],
    categoriasIgnoradas?: Array<{ categoriaId: string; nombre?: string; fixtureVersionId: string | null }>,
  ): Promise<SorteoMasivoResponse> {
    // [SorteoDebug] Log inicial: días recibidos con sus fechas y fasesPermitidas
    console.log('[SorteoDebug] ================================================');
    console.log('[SorteoDebug] INICIO sortearConFasesPorDia');
    console.log('[SorteoDebug] tournamentId:', tournamentId);
    console.log('[SorteoDebug] Total días recibidos:', diasConfig.length);
    console.log('[SorteoDebug] Días configurados:');
    diasConfig.forEach((dia, idx) => {
      console.log(`[SorteoDebug]   Día ${idx + 1}: fecha=${dia.fecha}, fasesPermitidas=${dia.fasesPermitidas}, id=${dia.id}`);
    });
    console.log('[SorteoDebug] ================================================');

    // Preparar datos de categorías
    const categoriasData = [];
    const todasInscripciones = await this.prisma.inscripcion.findMany({
      where: {
        tournamentId,
        estado: 'CONFIRMADA',
      },
    });
    
    for (const categoriaInfo of calculo.detallePorCategoria) {
      const categoria = await this.prisma.tournamentCategory.findUnique({
        where: { id: categoriaInfo.categoriaId },
      });

      if (!categoria) continue;

      const inscripcionesCategoria = todasInscripciones.filter(
        i => i.categoryId === categoria.categoryId
      );

      categoriasData.push({
        categoria,
        inscripciones: inscripcionesCategoria,
        nombre: categoriaInfo.nombre,
        slotsNecesarios: categoriaInfo.slotsNecesarios,
        detallePorFase: categoriaInfo.partidosPorFase,
      });
    }

    // Mapa para acumular asignaciones por categoría
    const asignacionesPorCategoria = new Map<string, SlotReserva[]>();
    const distribucionPorDia: Record<string, { slots: number; categorias: Set<string> }> = {};
    
    // Track: última hora de finalización de cada fase por categoría y día (para descanso)
    const ultimaHoraFinPorCategoriaFase: Record<string, string> = {};
    
    // Helper: Sumar horas a una hora "HH:mm"
    const sumarHoras = (hora: string, horasASumar: number): string => {
      const [h, m] = hora.split(':').map(Number);
      const totalMinutos = h * 60 + m + horasASumar * 60;
      const nuevaH = Math.floor(totalMinutos / 60);
      const nuevaM = totalMinutos % 60;
      return `${String(nuevaH).padStart(2, '0')}:${String(nuevaM).padStart(2, '0')}`;
    };
    
    // Orden de fases (para determinar la fase anterior)
    const ordenFases = [
      FaseBracket.ZONA,
      FaseBracket.REPECHAJE,
      FaseBracket.OCTAVOS,
      FaseBracket.CUARTOS,
      FaseBracket.SEMIS,
      FaseBracket.FINAL,
    ];

    // PROCESAR POR DÍA (cronológicamente)
    for (const dia of diasConfig) {
      // [SorteoDebug] Log del día actual
      console.log('[SorteoDebug] ------------------------------------------------');
      console.log('[SorteoDebug] PROCESANDO DÍA:', dia.fecha);
      
      // Obtener fases permitidas para este día
      const fasesPermitidas = (dia.fasesPermitidas as string)
        ?.split(',') as FaseBracket[] || 
        this.obtenerFasesParaDia(dia.fecha);
      
      console.log('[SorteoDebug]   Fases permitidas (raw):', dia.fasesPermitidas);
      console.log('[SorteoDebug]   Fases permitidas (calculadas):', fasesPermitidas);

      if (fasesPermitidas.length === 0) {
        console.log('[SorteoDebug]   >>> SKIP: No hay fases permitidas para este día');
        continue;
      }

      // Obtener slots libres del día
      const slotsDelDia = await this.prisma.torneoSlot.findMany({
        where: {
          disponibilidadId: dia.id,
          estado: 'LIBRE',
        },
        orderBy: { horaInicio: 'asc' },
      });
      
      console.log('[SorteoDebug]   Slots libres encontrados:', slotsDelDia.length);
      if (slotsDelDia.length > 0) {
        console.log('[SorteoDebug]   Primer slot:', slotsDelDia[0].horaInicio, '-', slotsDelDia[0].horaFin);
        console.log('[SorteoDebug]   Último slot:', slotsDelDia[slotsDelDia.length - 1].horaInicio, '-', slotsDelDia[slotsDelDia.length - 1].horaFin);
      }

      if (slotsDelDia.length === 0) {
        console.log('[SorteoDebug]   >>> SKIP: No hay slots libres para este día');
        continue;
      }

      // [SorteoDebug] Log de búsqueda de partidos pendientes
      console.log('[SorteoDebug]   Buscando partidos pendientes para fases:', fasesPermitidas);
      
      // Obtener partidos pendientes de TODAS las categorías para estas fases
      const partidosPorCategoria = new Map<string, Array<{ fase: FaseBracket; orden: number }>>();
      
      for (const catData of categoriasData) {
        const partidosPendientes: Array<{ fase: FaseBracket; orden: number }> = [];
        
        // Calcular partidos por fase para esta categoría
        const numParejas = catData.inscripciones.length;
        const calculoCat = this.bracketService.calcularSlotsNecesarios(numParejas);
        
        console.log(`[SorteoDebug]     Categoría ${catData.nombre} (${catData.categoria.id}):`);
        console.log(`[SorteoDebug]       Parejas inscritas: ${numParejas}`);
        
        for (const faseInfo of calculoCat.detallePorFase) {
          const fase = faseInfo.fase as FaseBracket;
          console.log(`[SorteoDebug]       Fase ${fase}: ${faseInfo.partidos} partidos totales`);
          
          if (fasesPermitidas.includes(fase)) {
            // Verificar cuántos slots ya están asignados para esta fase
            const asignacionesExistentes = asignacionesPorCategoria.get(catData.categoria.id) || [];
            const asignadosEnEstaFase = asignacionesExistentes.filter(s => s.fase === fase).length;
            const pendientes = faseInfo.partidos - asignadosEnEstaFase;
            
            console.log(`[SorteoDebug]         >> Fase ${fase} PERMITIDA: ${asignadosEnEstaFase} asignados, ${pendientes} pendientes`);
            
            for (let i = 0; i < pendientes; i++) {
              partidosPendientes.push({
                fase,
                orden: asignadosEnEstaFase + i + 1,
              });
            }
          } else {
            console.log(`[SorteoDebug]         >> Fase ${fase} NO permitida en este día`);
          }
        }
        
        if (partidosPendientes.length > 0) {
          partidosPorCategoria.set(catData.categoria.id, partidosPendientes);
          console.log(`[SorteoDebug]       Total pendientes para esta categoría: ${partidosPendientes.length}`);
        }
      }

      console.log('[SorteoDebug]   Total categorías con partidos pendientes:', partidosPorCategoria.size);
      if (partidosPorCategoria.size === 0) {
        console.log('[SorteoDebug]   >>> SKIP: No hay partidos pendientes para las fases permitidas');
        continue;
      }

      // Ordenar con Round-Robin entre categorías
      const partidosOrdenados = this.ordenarRoundRobin(
        partidosPorCategoria, 
        categoriasData.map(c => c.categoria.id)
      );

      // [SorteoDebug] Log de asignación de slots
      console.log('[SorteoDebug]   ASIGNANDO partidos a slots:');
      console.log(`[SorteoDebug]     Partidos ordenados: ${partidosOrdenados.length}, Slots disponibles: ${slotsDelDia.length}`);
      
      // Asignar partidos a slots del día con descanso de 4 horas entre fases
      let slotIdx = 0;
      for (let i = 0; i < partidosOrdenados.length; i++) {
        const partido = partidosOrdenados[i];
        const catNombre = categoriasData.find(c => c.categoria.id === partido.categoriaId)?.nombre;
        
        // Calcular hora mínima para esta fase (descanso de 4 horas desde fase anterior)
        const idxFaseActual = ordenFases.indexOf(partido.fase);
        let horaMinimaInicio = '00:00';
        let faseAnteriorMismoDia = false;
        
        if (idxFaseActual > 0) {
          // Buscar la fase anterior que se jugó en este mismo día para esta categoría
          for (let j = idxFaseActual - 1; j >= 0; j--) {
            const faseAnterior = ordenFases[j];
            const key = `${partido.categoriaId}-${dia.fecha}-${faseAnterior}`;
            if (ultimaHoraFinPorCategoriaFase[key]) {
              // NUEVO: Usar DescansoCalculatorService si está activo
              const resultadoDescanso = this.calcularHoraMinimaConDescanso(
                tournamentId,
                dia.fecha,
                ultimaHoraFinPorCategoriaFase[key],
                faseAnterior,
                partido.fase,
              );
              
              horaMinimaInicio = resultadoDescanso.hora;
              faseAnteriorMismoDia = true;
              
              // DEBUG: Comparación legacy vs nuevo (solo en desarrollo)
              if (process.env.NODE_ENV === 'development') {
                const legacyHora = this.sumarHoras(ultimaHoraFinPorCategoriaFase[key], 4);
                const nuevaHora = resultadoDescanso.hora;
                if (legacyHora !== nuevaHora || resultadoDescanso.cambioDia) {
                  console.log(`[DescansoCompare] Cat ${catNombre} | ${faseAnterior}→${partido.fase} | Legacy: ${legacyHora} | Nuevo: ${nuevaHora} | CambioDía: ${resultadoDescanso.cambioDia}`);
                }
              }
              
              console.log(`[SorteoDebug]     [Descanso] Cat ${catNombre} | Fase ${partido.fase} debe ser >= ${horaMinimaInicio} (último de ${faseAnterior}: ${ultimaHoraFinPorCategoriaFase[key]})`);
              break;
            }
          }
        }
        
        // Si la fase anterior fue en este día pero el descanso empuja fuera del horario,
        // saltar este día para esta fase (se asignará en el siguiente día)
        if (faseAnteriorMismoDia && slotsDelDia.length > 0) {
          const ultimoSlotDelDia = slotsDelDia[slotsDelDia.length - 1].horaInicio;
          if (horaMinimaInicio > ultimoSlotDelDia) {
            console.log(`[SorteoDebug]     [Descanso] Cat ${catNombre} | Fase ${partido.fase} NO cabe en día ${dia.fecha} (necesita >= ${horaMinimaInicio}, último slot: ${ultimoSlotDelDia}). Pasando al siguiente día.`);
            // No incrementar i, este partido se reintentará en el siguiente día
            continue;
          }
        }
        
        // FIX: Si la hora mínima supera las 24:00 (ej: 28:00 = 4am), reiniciar a 00:00
        // porque el descanso de 4 horas ya se cumplió durante la noche
        // NOTA: Con el nuevo algoritmo esto ya no debería pasar porque se maneja el cambio de día
        if (horaMinimaInicio >= '24:00') {
          console.log(`[SorteoDebug]     [Descanso FIX] Hora ${horaMinimaInicio} >= 24:00, reiniciando a 00:00`);
          horaMinimaInicio = '00:00';
        }
        
        // Buscar un slot que cumpla con el descanso
        let slotEncontrado = false;
        while (slotIdx < slotsDelDia.length && !slotEncontrado) {
          const slot = slotsDelDia[slotIdx];
          
          // Verificar si el slot cumple con el descanso
          if (slot.horaInicio < horaMinimaInicio) {
            console.log(`[SorteoDebug]     [Descanso] Slot ${slot.horaInicio} rechazado (necesita >= ${horaMinimaInicio})`);
            slotIdx++;
            continue;
          }
          
          // Slot válido encontrado
          slotEncontrado = true;
          
          const slotReserva: SlotReserva = {
            fecha: dia.fecha,
            horaInicio: slot.horaInicio,
            horaFin: slot.horaFin,
            torneoCanchaId: slot.torneoCanchaId,
            categoriaId: partido.categoriaId,
            fase: partido.fase,
            ordenPartido: partido.orden,
          };

          console.log(`[SorteoDebug]     [${i + 1}] Asignando: ${catNombre} | Fase=${partido.fase} | Orden=${partido.orden} -> Día=${dia.fecha} | Hora=${slot.horaInicio}-${slot.horaFin}`);

          // Agregar a las asignaciones de la categoría
          if (!asignacionesPorCategoria.has(partido.categoriaId)) {
            asignacionesPorCategoria.set(partido.categoriaId, []);
          }
          asignacionesPorCategoria.get(partido.categoriaId)!.push(slotReserva);

          // Registrar última hora de finalización de esta fase para esta categoría
          const key = `${partido.categoriaId}-${dia.fecha}-${partido.fase}`;
          ultimaHoraFinPorCategoriaFase[key] = slot.horaFin;

          // Marcar slot como reservado
          await this.prisma.torneoSlot.update({
            where: { id: slot.id },
            data: { estado: 'RESERVADO' },
          });

          // Actualizar distribución por día
          if (!distribucionPorDia[dia.fecha]) {
            distribucionPorDia[dia.fecha] = { slots: 0, categorias: new Set() };
          }
          distribucionPorDia[dia.fecha].slots++;
          
          if (catNombre) {
            distribucionPorDia[dia.fecha].categorias.add(catNombre);
          }
          
          slotIdx++;
        }
        
        if (!slotEncontrado) {
          console.warn(`[SorteoDebug]     [FALLO] No se encontró slot para ${catNombre} | Fase ${partido.fase} #${partido.orden}`);
          console.warn(`[SorteoDebug]            Hora mínima requerida: ${horaMinimaInicio}, Slots revisados: ${slotIdx}/${slotsDelDia.length}`);
          if (slotIdx >= slotsDelDia.length) {
            console.warn(`[SorteoDebug]            RAZÓN: Se agotaron los slots del día`);
          }
        }
      }
      
      const asignadosEnEsteDia = Object.values(distribucionPorDia).reduce((sum, d) => sum + d.slots, 0);
      console.log(`[SorteoDebug]   >>> DÍA COMPLETADO: ${asignadosEnEsteDia} partidos asignados`);
    }

    // NUEVO: Verificar que TODAS las categorías tienen TODOS sus slots asignados
    // y recolectar información detallada de qué fases faltan
    interface InfoFaltante {
      categoriaId: string;
      categoriaNombre: string;
      slotsFaltantes: number;
      slotsAsignados: number;
      slotsNecesarios: number;
      fasesFaltantes: string[];
    }
    const infoCategoriasFaltantes: InfoFaltante[] = [];
    
    for (const catData of categoriasData) {
      const slotsAsignados = asignacionesPorCategoria.get(catData.categoria.id) || [];
      const slotsNecesarios = catData.slotsNecesarios;
      
      if (slotsAsignados.length < slotsNecesarios) {
        const slotsFaltantes = slotsNecesarios - slotsAsignados.length;
        
        // Calcular qué fases no se completaron
        const fasesAsignadas = new Map<string, number>();
        slotsAsignados.forEach(s => {
          fasesAsignadas.set(s.fase, (fasesAsignadas.get(s.fase) || 0) + 1);
        });
        
        const fasesFaltantes: string[] = [];
        for (const faseInfo of catData.detallePorFase) {
          const asignados = fasesAsignadas.get(faseInfo.fase) || 0;
          if (asignados < faseInfo.partidos) {
            fasesFaltantes.push(`${faseInfo.fase} (${faseInfo.partidos - asignados} de ${faseInfo.partidos})`);
          }
        }
        
        console.error(`[Sorteo ERROR] Categoría ${catData.nombre}: solo ${slotsAsignados.length}/${slotsNecesarios} slots asignados (${slotsFaltantes} faltantes)`);
        console.error(`[Sorteo ERROR]   Fases incompletas: ${fasesFaltantes.join(', ')}`);
        
        infoCategoriasFaltantes.push({
          categoriaId: catData.categoria.id,
          categoriaNombre: catData.nombre,
          slotsFaltantes,
          slotsAsignados: slotsAsignados.length,
          slotsNecesarios,
          fasesFaltantes,
        });
      }
    }
    
    if (infoCategoriasFaltantes.length > 0) {
      // NUEVO: Liberar los slots que se marcaron como RESERVADO durante este proceso
      const slotsReservadosEnProceso = await this.prisma.torneoSlot.findMany({
        where: {
          disponibilidad: { tournamentId },
          estado: 'RESERVADO',
          matchId: null,
        },
      });
      
      if (slotsReservadosEnProceso.length > 0) {
        console.log(`[Sorteo Rollback] Liberando ${slotsReservadosEnProceso.length} slots marcados como RESERVADO`);
        await this.prisma.torneoSlot.updateMany({
          where: { id: { in: slotsReservadosEnProceso.map(s => s.id) } },
          data: { estado: 'LIBRE' },
        });
      }
      
      // Construir mensaje detallado
      const mensajesCategoria = infoCategoriasFaltantes.map(c => {
        return `${c.categoriaNombre}: faltan ${c.slotsFaltantes} slots (${c.fasesFaltantes.join(', ')})`;
      });
      
      // Identificar en qué días faltaron slots (basado en las fases)
      const fasesAfectadas = new Set<string>();
      infoCategoriasFaltantes.forEach(c => {
        c.fasesFaltantes.forEach(f => {
          const faseNombre = f.split(' ')[0];
          fasesAfectadas.add(faseNombre);
        });
      });
      
      // Mapear fases a días típicos para dar contexto
      const diasSugeridos: string[] = [];
      if ([...fasesAfectadas].some(f => ['ZONA', 'REPECHAJE'].includes(f))) {
        diasSugeridos.push('Jueves/Viernes (Zona/Repechaje)');
      }
      if ([...fasesAfectadas].some(f => ['OCTAVOS', 'CUARTOS'].includes(f))) {
        diasSugeridos.push('Sábado (Octavos/Cuartos)');
      }
      if ([...fasesAfectadas].some(f => ['SEMIS', 'FINAL'].includes(f))) {
        diasSugeridos.push('Domingo (Semifinales/Finales)');
      }
      
      throw new BadRequestException({
        success: false,
        message: `Faltan slots para completar el sorteo:\n${mensajesCategoria.join('\n')}`,
        detalle: {
          categoriasAfectadas: infoCategoriasFaltantes.map(c => ({
            nombre: c.categoriaNombre,
            slotsFaltantes: c.slotsFaltantes,
            fasesFaltantes: c.fasesFaltantes,
          })),
          fasesAfectadas: [...fasesAfectadas],
          sugerencia: `Agrega más slots en: ${diasSugeridos.join(', ')}, o extiende los horarios existentes. Recuerda que entre fases se necesitan 4 horas de descanso.`,
        },
      });
    }

    // Generar brackets y guardar con las asignaciones
    const categoriasSorteadas = [];
    let totalSlotsReservados = 0;
    
    for (const catData of categoriasData) {
      const slotsCategoria = asignacionesPorCategoria.get(catData.categoria.id) || [];
      totalSlotsReservados += slotsCategoria.length;
      
      // Cerrar inscripciones
      await this.prisma.tournamentCategory.update({
        where: { id: catData.categoria.id },
        data: { estado: 'INSCRIPCIONES_CERRADAS' },
      });

      // Generar bracket
      const numParejas = catData.inscripciones.length;
      const config = this.bracketService.calcularConfiguracion(numParejas);
      const { partidos } = await this.bracketService.generarBracket({
        tournamentCategoryId: catData.categoria.id,
        totalParejas: numParejas,
      });
      
      // Archivar versión anterior si existe
      if (catData.categoria.fixtureVersionId) {
        await this.prisma.fixtureVersion.update({
          where: { id: catData.categoria.fixtureVersionId },
          data: { estado: 'ARCHIVADO', archivadoAt: new Date() },
        });
      }
      
      // Ordenar inscripciones aleatoriamente
      const inscripcionesOrdenadas = [...catData.inscripciones]
        .sort(() => Math.random() - 0.5);
      
      // Guardar bracket con slots asignados
      const fixtureVersionId = await this.bracketService.guardarBracket(
        catData.categoria.id,
        config,
        partidos,
        inscripcionesOrdenadas,
        slotsCategoria,
      );

      // Actualizar categoría
      await this.prisma.tournamentCategory.update({
        where: { id: catData.categoria.id },
        data: {
          estado: 'INSCRIPCIONES_CERRADAS',
          fixtureVersionId,
        },
      });

      categoriasSorteadas.push({
        categoriaId: catData.categoria.id,
        nombre: catData.nombre,
        fixtureVersionId,
        totalPartidos: catData.slotsNecesarios,
        slotsReservados: slotsCategoria.length,
      });
    }

    // Generar distribución por día para la respuesta
    const distribucionResponse = Object.entries(distribucionPorDia).map(
      ([fecha, info]) => ({
        fecha,
        slotsReservados: info.slots,
        categorias: Array.from(info.categorias),
      }),
    );

    return {
      success: true,
      message: `Se sortearon ${categoriasSorteadas.length} categorías con ${totalSlotsReservados} slots reservados (con fases por día)`,
      categoriasSorteadas,
      categoriasIgnoradas: categoriasIgnoradas && categoriasIgnoradas.length > 0 ? categoriasIgnoradas : undefined,
      slotsTotalesReservados: totalSlotsReservados,
      distribucionPorDia: distribucionResponse,
    };
  }

  /**
   * NUEVO: Ordena partidos con Round-Robin entre categorías
   * Ej: CatA-1, CatB-1, CatC-1, CatA-2, CatB-2, CatC-2...
   */
  private ordenarRoundRobin(
    partidosPorCategoria: Map<string, Array<{ fase: FaseBracket; orden: number }>>,
    categoriasIds: string[],
  ): Array<{ categoriaId: string; fase: FaseBracket; orden: number }> {
    const resultado: Array<{ categoriaId: string; fase: FaseBracket; orden: number }> = [];
    const indices = new Map<string, number>();

    let hayMas = true;
    while (hayMas) {
      hayMas = false;
      
      for (const catId of categoriasIds) {
        const partidos = partidosPorCategoria.get(catId) || [];
        const idx = indices.get(catId) || 0;
        
        if (idx < partidos.length) {
          resultado.push({
            categoriaId: catId,
            fase: partidos[idx].fase,
            orden: partidos[idx].orden,
          });
          indices.set(catId, idx + 1);
          hayMas = true;
        }
      }
    }

    return resultado;
  }

  /**
   * LÓGICA ORIGINAL: Sorteo secuencial (mantenida para compatibilidad)
   * Esta es la lógica original que asigna slots secuencialmente sin filtrar por fase
   */
  private async sortearSecuencialOriginal(
    tournamentId: string,
    categoriasIds: string[],
    calculo: CalculoSlotsResponse,
    categoriasIgnoradas?: Array<{ categoriaId: string; nombre?: string; fixtureVersionId: string | null }>,
  ): Promise<SorteoMasivoResponse> {
    // Obtener slots disponibles ordenados por fecha/hora
    const slotsDisponibles = await this.obtenerSlotsDisponiblesOrdenados(tournamentId);

    // Procesar cada categoría
    const categoriasSorteadas = [];
    const distribucionPorDia: Record<string, { slots: number; categorias: Set<string> }> = {};
    let slotIndex = 0;

    // Obtener todas las inscripciones confirmadas para todas las categorías
    const todasInscripciones = await this.prisma.inscripcion.findMany({
      where: {
        tournamentId,
        estado: 'CONFIRMADA',
      },
    });
    
    for (const categoriaInfo of calculo.detallePorCategoria) {
      const categoria = await this.prisma.tournamentCategory.findUnique({
        where: { id: categoriaInfo.categoriaId },
      });

      if (!categoria) continue;
      
      // Obtener inscripciones para esta categoría
      const inscripcionesCategoria = todasInscripciones.filter(
        i => i.categoryId === categoria.categoryId
      );

      // Cerrar inscripciones de la categoría
      await this.prisma.tournamentCategory.update({
        where: { id: categoria.id },
        data: { estado: 'INSCRIPCIONES_CERRADAS' },
      });

      // Crear objeto con inscripciones para compatibilidad
      const categoriaConInscripciones = {
        ...categoria,
        inscripciones: inscripcionesCategoria,
      };
      
      // Reservar slots para esta categoría
      const slotsReservados = await this.reservarSlotsParaCategoria(
        categoriaConInscripciones,
        categoriaInfo.nombre,
        slotsDisponibles,
        slotIndex,
        distribucionPorDia,
      );

      slotIndex += slotsReservados.length;

      // Generar bracket real usando bracketService
      const numParejas = inscripcionesCategoria.length;
      const config = this.bracketService.calcularConfiguracion(numParejas);
      
      // Generar partidos del bracket
      const { partidos } = await this.bracketService.generarBracket({
        tournamentCategoryId: categoria.id,
        totalParejas: numParejas,
      });
      
      // Archivar versión anterior si existe
      if (categoria.fixtureVersionId) {
        await this.prisma.fixtureVersion.update({
          where: { id: categoria.fixtureVersionId },
          data: { estado: 'ARCHIVADO', archivadoAt: new Date() },
        });
      }
      
      // Ordenar inscripciones aleatoriamente para el sorteo
      const inscripcionesOrdenadas = [...inscripcionesCategoria]
        .sort(() => Math.random() - 0.5);
      
      const fixtureVersionId = await this.bracketService.guardarBracket(
        categoria.id,
        config,
        partidos,
        inscripcionesOrdenadas,
        slotsReservados,
      );

      // Actualizar categoría con el fixture
      await this.prisma.tournamentCategory.update({
        where: { id: categoria.id },
        data: {
          estado: 'INSCRIPCIONES_CERRADAS',
          fixtureVersionId,
        },
      });

      categoriasSorteadas.push({
        categoriaId: categoria.id,
        nombre: categoriaInfo.nombre,
        fixtureVersionId,
        totalPartidos: categoriaInfo.slotsNecesarios,
        slotsReservados: slotsReservados.length,
      });
    }

    // Generar distribución por día para la respuesta
    const distribucionResponse = Object.entries(distribucionPorDia).map(
      ([fecha, info]) => ({
        fecha,
        slotsReservados: info.slots,
        categorias: Array.from(info.categorias),
      }),
    );

    return {
      success: true,
      message: `Se sortearon ${categoriasSorteadas.length} categorías con ${slotIndex} slots reservados`,
      categoriasSorteadas,
      categoriasIgnoradas: categoriasIgnoradas && categoriasIgnoradas.length > 0 ? categoriasIgnoradas : undefined,
      slotsTotalesReservados: slotIndex,
      distribucionPorDia: distribucionResponse,
    };
  }

  /**
   * Obtiene slots disponibles ordenados por fecha y hora
   */
  private async obtenerSlotsDisponiblesOrdenados(tournamentId: string) {
    // Obtener slots con información de sede para ordenar por prioridad
    const slotsConSede = await this.prisma.torneoSlot.findMany({
      where: {
        disponibilidad: {
          tournamentId,
        },
        estado: 'LIBRE',
      },
      include: {
        disponibilidad: true,
        torneoCancha: {
          include: {
            sedeCancha: {
              include: {
                sede: {
                  include: {
                    torneoSedes: {
                      where: { tournamentId },
                      select: { orden: true }
                    }
                  }
                }
              }
            }
          }
        },
      },
    });

    // Ordenar: primero por orden de sede (prioridad), luego por fecha/hora
    return slotsConSede.sort((a, b) => {
      const ordenA = a.torneoCancha?.sedeCancha?.sede?.torneoSedes?.[0]?.orden ?? 999;
      const ordenB = b.torneoCancha?.sedeCancha?.sede?.torneoSedes?.[0]?.orden ?? 999;
      
      if (ordenA !== ordenB) return ordenA - ordenB;
      if (a.disponibilidad.fecha !== b.disponibilidad.fecha) {
        return a.disponibilidad.fecha.localeCompare(b.disponibilidad.fecha);
      }
      return a.horaInicio.localeCompare(b.horaInicio);
    });
  }

  /**
   * Reserva slots para una categoría específica
   */
  private async reservarSlotsParaCategoria(
    categoria: { id: string; tournamentId: string; categoryId: string; inscripciones: any[] },
    nombreCategoria: string,
    slotsDisponibles: any[],
    startIndex: number,
    distribucionPorDia: Record<string, { slots: number; categorias: Set<string> }>,
  ): Promise<SlotReserva[]> {
    const parejas = categoria.inscripciones.length;
    const calculo = this.bracketService.calcularSlotsNecesarios(parejas);
    
    const slotsReservados: SlotReserva[] = [];
    let slotIndex = startIndex;

    // Reservar slots para cada fase
    for (const faseInfo of calculo.detallePorFase) {
      for (let i = 0; i < faseInfo.partidos; i++) {
        if (slotIndex >= slotsDisponibles.length) {
          throw new BadRequestException('No hay suficientes slots disponibles');
        }

        const slot = slotsDisponibles[slotIndex];
        // FIX: fecha ahora es String YYYY-MM-DD directamente
        const fecha = slot.disponibilidad.fecha;

        slotsReservados.push({
          fecha,
          horaInicio: slot.horaInicio,
          horaFin: slot.horaFin,
          torneoCanchaId: slot.torneoCanchaId,
          categoriaId: categoria.id,
          fase: faseInfo.fase as FaseBracket,
          ordenPartido: i + 1,
        });

        // Marcar slot como reservado
        await this.prisma.torneoSlot.update({
          where: { id: slot.id },
          data: { estado: 'RESERVADO' },
        });

        // Actualizar distribución por día
        if (!distribucionPorDia[fecha]) {
          distribucionPorDia[fecha] = { slots: 0, categorias: new Set() };
        }
        distribucionPorDia[fecha].slots++;
        distribucionPorDia[fecha].categorias.add(nombreCategoria);

        slotIndex++;
      }
    }

    return slotsReservados;
  }

  /**
   * Obtiene las canchas asignadas a un torneo
   */
  async obtenerCanchas(tournamentId: string) {
    const torneoCanchas = await this.prisma.torneoCancha.findMany({
      where: { tournamentId, activa: true },
      include: {
        sedeCancha: {
          include: { sede: { select: { id: true, nombre: true } } },
        },
      },
      orderBy: { orden: 'asc' },
    });

    return {
      success: true,
      canchas: torneoCanchas.map((tc) => ({
        id: tc.id, // ID de TorneoCancha (usado para asignación)
        nombre: tc.sedeCancha.nombre,
        tipo: tc.sedeCancha.tipo,
        iluminacion: tc.sedeCancha.tieneLuz,
        sede: tc.sedeCancha.sede,
      })),
    };
  }

  /**
   * Obtiene la configuración completa de canchas y sorteo de un torneo
   */
  async obtenerConfiguracion(tournamentId: string) {
    const [dias, torneo] = await Promise.all([
      this.prisma.torneoDisponibilidadDia.findMany({
        where: { tournamentId },
        include: {
          _count: { select: { slots: { where: { estado: 'LIBRE' } } } },
          slots: {
            select: { torneoCanchaId: true },
            distinct: ['torneoCanchaId'],
            where: { estado: 'LIBRE' },
          },
        },
        orderBy: { fecha: 'asc' },
      }),
      this.prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: {
          horaInicioFinales: true,
          horaFinFinales: true,
          canchasFinales: true,
        },
      }),
    ]);

    return {
      success: true,
      data: {
        dias: dias.map((d) => ({
          id: d.id,
          fecha: d.fecha,
          horaInicio: d.horaInicio,
          horaFin: d.horaFin,
          minutosSlot: d.minutosSlot,
          slotsLibres: d._count.slots,
          canchas: d.slots.length,
          canchasIds: d.slots.map((s) => s.torneoCanchaId),
        })),
        finales: torneo?.horaInicioFinales
          ? {
              horaInicio: torneo.horaInicioFinales,
              horaFin: torneo.horaFinFinales,
              canchasIds: torneo.canchasFinales || [],
            }
          : null,
      },
    };
  }

  /**
   * Elimina un día de juego y todos sus slots asociados
   */
  async eliminarDia(diaId: string) {
    // Verificar que el día existe
    const dia = await this.prisma.torneoDisponibilidadDia.findUnique({
      where: { id: diaId },
      include: {
        slots: {
          where: { estado: 'OCUPADO' },
        },
      },
    });

    if (!dia) {
      throw new NotFoundException('Día no encontrado');
    }

    // Verificar que no hay slots ocupados
    if (dia.slots.length > 0) {
      throw new BadRequestException(
        `No se puede eliminar el día porque tiene ${dia.slots.length} slot(s) ocupado(s) con partidos programados`
      );
    }

    // Eliminar el día (cascada eliminará los slots libres)
    await this.prisma.torneoDisponibilidadDia.delete({
      where: { id: diaId },
    });

    return {
      success: true,
      message: 'Día eliminado correctamente',
    };
  }

  /**
   * RE-SORTEAR: Re-sortea una categoría individual usando la misma lógica de distribución por fases
   * que el sorteo masivo desde "Canchas y Sorteo"
   */
  async reSortearCategoria(
    tournamentCategoryId: string,
    usarSemillas?: boolean,
  ) {
    console.log('[Re-Sortear] Iniciando re-sorteo con distribución por fases para categoría:', tournamentCategoryId);

    // 1. Obtener la categoría con su torneo
    const categoria = await this.prisma.tournamentCategory.findUnique({
      where: { id: tournamentCategoryId },
      include: {
        tournament: true,
        category: true,
      },
    });

    if (!categoria) {
      throw new NotFoundException('Categoría no encontrada');
    }

    if (categoria.estado === 'SORTEO_REALIZADO') {
      throw new BadRequestException('No se puede re-sortear un bracket ya publicado');
    }

    const fixtureVersionId = categoria.fixtureVersionId;
    if (!fixtureVersionId) {
      throw new BadRequestException('La categoría no tiene un bracket para re-sortear');
    }

    // 2. Obtener partidos del fixture actual
    const partidosActuales = await this.prisma.match.findMany({
      where: { fixtureVersionId },
      select: {
        id: true,
        estado: true,
        torneoCanchaId: true,
        fechaProgramada: true,
        horaProgramada: true,
        set1Pareja1: true,
      },
    });

    const partidosConResultado = partidosActuales.filter(p => p.set1Pareja1 !== null);
    const partidosSinResultado = partidosActuales.filter(p => p.set1Pareja1 === null);

    console.log(`[Re-Sortear] Partidos con resultado: ${partidosConResultado.length}, sin resultado: ${partidosSinResultado.length}`);

    // 3. Liberar slots de partidos SIN resultado
    for (const partido of partidosSinResultado) {
      if (partido.torneoCanchaId && partido.fechaProgramada && partido.horaProgramada) {
        await this.prisma.torneoSlot.updateMany({
          where: {
            torneoCanchaId: partido.torneoCanchaId,
            disponibilidad: { fecha: partido.fechaProgramada },
            horaInicio: partido.horaProgramada,
            estado: 'OCUPADO',
            matchId: partido.id,
          },
          data: { estado: 'LIBRE', matchId: null },
        });
        console.log(`[Re-Sortear] Slot liberado para partido ${partido.id}`);
      }
    }

    // 4. Eliminar partidos SIN resultado
    if (partidosSinResultado.length > 0) {
      await this.prisma.match.deleteMany({
        where: { id: { in: partidosSinResultado.map(p => p.id) } },
      });
      console.log(`[Re-Sortear] Eliminados ${partidosSinResultado.length} partidos sin resultado`);
    }

    if (partidosSinResultado.length === 0 && partidosConResultado.length > 0) {
      throw new BadRequestException('No hay partidos pendientes para re-sortear. Todos tienen resultado.');
    }

    // 5. Archivar o eliminar el fixture anterior
    if (partidosConResultado.length > 0) {
      await this.prisma.fixtureVersion.update({
        where: { id: fixtureVersionId },
        data: { estado: 'ARCHIVADO', archivadoAt: new Date() },
      });
      console.log(`[Re-Sortear] Fixture anterior archivado`);
    } else {
      await this.prisma.fixtureVersion.delete({ where: { id: fixtureVersionId } });
      console.log(`[Re-Sortear] Fixture anterior eliminado`);
    }

    // 6. Obtener inscripciones confirmadas
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: {
        tournamentId: categoria.tournamentId,
        categoryId: categoria.categoryId,
        estado: 'CONFIRMADA',
      },
      include: {
        jugador1: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
        jugador2: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
      },
    });

    if (inscripciones.length < 3) {
      throw new BadRequestException(`Se necesitan al menos 3 parejas. Actual: ${inscripciones.length}`);
    }

    // 7. Obtener días configurados del torneo con sus fases permitidas
    const diasConfig = await this.prisma.torneoDisponibilidadDia.findMany({
      where: {
        tournamentId: categoria.tournamentId,
        activo: true,
      },
      include: {
        slots: {
          where: { estado: 'LIBRE' },
        },
      },
      orderBy: { fecha: 'asc' },
    });

    if (diasConfig.length === 0) {
      throw new BadRequestException('No hay días configurados para el sorteo');
    }

    // 8. Calcular partidos por fase para esta categoría
    const numParejas = inscripciones.length;
    const config = this.bracketService.calcularConfiguracion(numParejas);
    const { partidos } = await this.bracketService.generarBracket({
      tournamentCategoryId,
      totalParejas: numParejas,
    });

    // 9. Usar la MISMA lógica de distribución por fases que el sorteo masivo
    const slotsAsignados = await this.asignarSlotsPorFase(
      categoria.tournamentId,
      tournamentCategoryId,
      diasConfig,
      partidos,
    );

    console.log(`[Re-Sortear] Slots asignados: ${slotsAsignados.length}`);

    // 10. Generar orden de sorteo (aleatorio o con semillas)
    let inscripcionesOrdenadas;
    if (usarSemillas) {
      inscripcionesOrdenadas = await this.ordenarConSemillas(inscripciones, categoria);
    } else {
      inscripcionesOrdenadas = [...inscripciones].sort(() => Math.random() - 0.5);
    }

    // 11. Guardar bracket con los slots asignados
    const nuevoFixtureVersionId = await this.bracketService.guardarBracket(
      tournamentCategoryId,
      config,
      partidos,
      inscripcionesOrdenadas,
      slotsAsignados,
    );

    // 12. Actualizar categoría
    await this.prisma.tournamentCategory.update({
      where: { id: tournamentCategoryId },
      data: {
        estado: 'FIXTURE_BORRADOR',
        fixtureVersionId: nuevoFixtureVersionId,
      },
    });

    console.log(`[Re-Sortear] Re-sorteo completado. Nuevo fixture: ${nuevoFixtureVersionId}`);

    return {
      success: true,
      message: 'Re-sorteo completado exitosamente',
      fixtureVersionId: nuevoFixtureVersionId,
      totalPartidos: partidos.length,
      slotsAsignados: slotsAsignados.length,
    };
  }

  /**
   * Helper: Asigna slots a partidos respetando fases por día (misma lógica que sorteo masivo)
   * CON DESCANSO OBLIGATORIO: Mínimo 4 horas entre fases del mismo día
   */
  private async asignarSlotsPorFase(
    tournamentId: string,
    categoriaId: string,
    diasConfig: any[],
    partidos: any[],
  ): Promise<SlotReserva[]> {
    const slotsAsignados: SlotReserva[] = [];
    const slotsUsados = new Set<string>();
    
    // Track: última hora de finalización de cada fase por día (para descanso)
    const ultimaHoraFinPorFase: Record<string, string> = {};
    
    // Helper: Sumar horas a una hora "HH:mm"
    const sumarHoras = (hora: string, horasASumar: number): string => {
      const [h, m] = hora.split(':').map(Number);
      const totalMinutos = h * 60 + m + horasASumar * 60;
      const nuevaH = Math.floor(totalMinutos / 60);
      const nuevaM = totalMinutos % 60;
      return `${String(nuevaH).padStart(2, '0')}:${String(nuevaM).padStart(2, '0')}`;
    };
    
    // Helper: Comparar horas (retorna true si horaA >= horaB)
    const horaEsMayorOIgual = (horaA: string, horaB: string): boolean => {
      return horaA >= horaB;
    };

    // Agrupar partidos por fase
    const partidosPorFase: Record<string, any[]> = {
      [FaseBracket.ZONA]: partidos.filter(p => p.fase === FaseBracket.ZONA),
      [FaseBracket.REPECHAJE]: partidos.filter(p => p.fase === FaseBracket.REPECHAJE),
      [FaseBracket.OCTAVOS]: partidos.filter(p => p.fase === FaseBracket.OCTAVOS),
      [FaseBracket.CUARTOS]: partidos.filter(p => p.fase === FaseBracket.CUARTOS),
      [FaseBracket.SEMIS]: partidos.filter(p => p.fase === FaseBracket.SEMIS),
      [FaseBracket.FINAL]: partidos.filter(p => p.fase === FaseBracket.FINAL),
    };

    // Orden de fases (para determinar la fase anterior)
    const ordenFases = [
      FaseBracket.ZONA,
      FaseBracket.REPECHAJE,
      FaseBracket.OCTAVOS,
      FaseBracket.CUARTOS,
      FaseBracket.SEMIS,
      FaseBracket.FINAL,
    ];

    // Procesar cada día en orden cronológico
    for (const dia of diasConfig) {
      // Determinar fases permitidas para este día
      const fasesPermitidas = dia.fasesPermitidas
        ? (dia.fasesPermitidas as string).split(',') as FaseBracket[]
        : this.obtenerFasesParaDia(dia.fecha);

      if (fasesPermitidas.length === 0) continue;

      // Obtener slots libres del día
      const slotsLibres = await this.prisma.torneoSlot.findMany({
        where: {
          disponibilidadId: dia.id,
          estado: 'LIBRE',
        },
        orderBy: { horaInicio: 'asc' },
      });

      if (slotsLibres.length === 0) continue;

      // Para cada fase permitida, asignar sus partidos pendientes
      let slotIdx = 0;
      for (const fase of fasesPermitidas) {
        const partidosFase = partidosPorFase[fase] || [];
        const partidosPendientes = partidosFase.filter(p => 
          !slotsAsignados.some(s => s.fase === fase && s.ordenPartido === p.orden)
        );

        if (partidosPendientes.length === 0) continue;

        // Calcular hora mínima para esta fase (descanso de 4 horas desde fase anterior)
        const idxFaseActual = ordenFases.indexOf(fase);
        let horaMinimaInicio = '00:00';
        let faseAnteriorMismoDia = false;
        
        if (idxFaseActual > 0) {
          // Buscar la fase anterior que se jugó en este mismo día
          for (let i = idxFaseActual - 1; i >= 0; i--) {
            const faseAnterior = ordenFases[i];
            const key = `${dia.fecha}-${faseAnterior}`;
            if (ultimaHoraFinPorFase[key]) {
              // 4 horas de descanso obligatorio
              horaMinimaInicio = sumarHoras(ultimaHoraFinPorFase[key], 4);
              faseAnteriorMismoDia = true;
              console.log(`[Descanso] Fase ${fase} debe empezar después de ${horaMinimaInicio} (último partido de ${faseAnterior} terminó a ${ultimaHoraFinPorFase[key]})`);
              break;
            }
          }
        }
        
        // Si la fase anterior fue en este día pero el descanso empuja fuera del horario,
        // saltar este día para esta fase (se asignará en el siguiente día)
        if (faseAnteriorMismoDia && slotsLibres.length > 0) {
          const ultimoSlotDelDia = slotsLibres[slotsLibres.length - 1].horaInicio;
          if (horaMinimaInicio > ultimoSlotDelDia) {
            console.log(`[Descanso] Fase ${fase} NO cabe en día ${dia.fecha} (necesita >= ${horaMinimaInicio}, último slot: ${ultimoSlotDelDia}). Pasando al siguiente día.`);
            continue; // Saltar al siguiente día
          }
        }

        let ultimoSlotUsado: SlotReserva | null = null;

        for (const partido of partidosPendientes) {
          // Buscar el siguiente slot disponible que cumpla con el descanso
          let slotEncontrado = false;
          
          while (slotIdx < slotsLibres.length && !slotEncontrado) {
            const slot = slotsLibres[slotIdx];
            const slotKey = `${dia.fecha}-${slot.horaInicio}-${slot.torneoCanchaId}`;

            // Verificar si el slot está disponible
            if (slotsUsados.has(slotKey)) {
              slotIdx++;
              continue;
            }

            // Verificar descanso de 4 horas desde fase anterior
            if (!horaEsMayorOIgual(slot.horaInicio, horaMinimaInicio)) {
              console.log(`[Descanso] Slot ${slot.horaInicio} rechazado (necesita ser >= ${horaMinimaInicio})`);
              slotIdx++;
              continue;
            }

            // Asignar slot al partido
            const slotReserva: SlotReserva = {
              fecha: dia.fecha,
              horaInicio: slot.horaInicio,
              horaFin: slot.horaFin,
              torneoCanchaId: slot.torneoCanchaId,
              categoriaId,
              fase,
              ordenPartido: partido.orden,
            };

            slotsAsignados.push(slotReserva);
            slotsUsados.add(slotKey);
            ultimoSlotUsado = slotReserva;
            slotEncontrado = true;
            slotIdx++;

            // Marcar slot como reservado
            await this.prisma.torneoSlot.update({
              where: { id: slot.id },
              data: { estado: 'RESERVADO' },
            });
          }

          if (!slotEncontrado) {
            console.warn(`[Descanso] No se encontró slot para partido ${fase} #${partido.orden} con descanso de 4h`);
          }
        }

        // Registrar la última hora de finalización de esta fase
        if (ultimoSlotUsado) {
          const key = `${dia.fecha}-${fase}`;
          ultimaHoraFinPorFase[key] = ultimoSlotUsado.horaFin;
        }
      }
    }

    return slotsAsignados.sort((a, b) => {
      if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
      return a.horaInicio.localeCompare(b.horaInicio);
    });
  }

  /**
   * Helper: Ordena inscripciones por semillas (ranking)
   */
  private async ordenarConSemillas(
    inscripciones: any[],
    categoria: any,
  ): Promise<any[]> {
    const jugadorIds = [...new Set(inscripciones.flatMap(i => [i.jugador1Id, i.jugador2Id].filter(Boolean)))];

    const rankings = await this.prisma.ranking.findMany({
      where: {
        jugadorId: { in: jugadorIds },
        tipoRanking: 'CATEGORIA',
        alcance: categoria.categoryId,
        temporada: new Date().getFullYear().toString(),
      },
    });

    const rankingMap = new Map(rankings.map(r => [r.jugadorId, r]));

    const inscripcionesConRanking = inscripciones.map(i => {
      const r1 = rankingMap.get(i.jugador1Id);
      const r2 = rankingMap.get(i.jugador2Id);
      const puntos1 = r1?.puntosTotales || 0;
      const puntos2 = r2?.puntosTotales || 0;
      const posicion1 = r1?.posicion || 9999;
      const posicion2 = r2?.posicion || 9999;

      return {
        ...i,
        puntosTotal: puntos1 + puntos2,
        mejorPosicion: Math.min(posicion1, posicion2),
      };
    });

    return inscripcionesConRanking
      .sort((a, b) => {
        if (b.puntosTotal !== a.puntosTotal) return b.puntosTotal - a.puntosTotal;
        return a.mejorPosicion - b.mejorPosicion;
      })
      .map(({ puntosTotal, mejorPosicion, ...rest }) => rest);
  }

  /**
   * TEST: Probar el DescansoCalculatorService
   * 
   * Este método compara el algoritmo legacy vs el nuevo y retorna ambos resultados
   * para validar que el nuevo algoritmo funciona correctamente.
   */
  async testDescansoCalculator(body: {
    tournamentId?: string;
    ultimoPartidoFecha: string;
    ultimoPartidoHoraFin: string;
    faseOrigen: string;
    faseDestino: string;
  }): Promise<{
    input: {
      fecha: string;
      horaFin: string;
      faseOrigen: string;
      faseDestino: string;
    };
    legacy: {
      horaMinima: string;
      cambioDia: boolean;
    };
    nuevo: {
      horaMinima: string;
      fechaDestino: string;
      cambioDia: boolean;
      descansoMinutos: number;
    };
    comparacion: {
      horasDiferentes: boolean;
      recomendacion: string;
    };
  }> {
    const { tournamentId, ultimoPartidoFecha, ultimoPartidoHoraFin, faseOrigen, faseDestino } = body;

    // Calcular usando algoritmo LEGACY
    const legacyHoraMinima = this.sumarHoras(ultimoPartidoHoraFin, 4);
    const legacyCambioDia = legacyHoraMinima >= '24:00';
    const legacyHoraNormalizada = legacyCambioDia ? '00:00' : legacyHoraMinima;

    // Calcular usando NUEVO algoritmo
    const descansoMinutos = this.descansoCalculator.getDescansoEntreFases(faseOrigen, faseDestino);
    const nuevoResultado = this.descansoCalculator.calcularHoraMinimaDescanso(
      ultimoPartidoFecha,
      ultimoPartidoHoraFin,
      descansoMinutos,
    );

    // Comparar
    const horasDiferentes = legacyHoraNormalizada !== nuevoResultado.hora;
    const fechasDiferentes = legacyCambioDia !== (nuevoResultado.fecha !== ultimoPartidoFecha);

    let recomendacion = 'Ambos algoritmos producen el mismo resultado.';
    if (horasDiferentes || fechasDiferentes) {
      recomendacion = 'DIFERENCIA DETECTADA: Revisar cuál es el comportamiento esperado.';
    }

    return {
      input: {
        fecha: ultimoPartidoFecha,
        horaFin: ultimoPartidoHoraFin,
        faseOrigen,
        faseDestino,
      },
      legacy: {
        horaMinima: legacyHoraNormalizada,
        cambioDia: legacyCambioDia,
      },
      nuevo: {
        horaMinima: nuevoResultado.hora,
        fechaDestino: nuevoResultado.fecha,
        cambioDia: nuevoResultado.fecha !== ultimoPartidoFecha,
        descansoMinutos,
      },
      comparacion: {
        horasDiferentes: horasDiferentes || fechasDiferentes,
        recomendacion,
      },
    };
  }

  /**
   * Obtiene el estado de los feature flags
   */
  async getFeaturesStatus(tournamentId?: string): Promise<{
    features: {
      descansoCalculatorV2: {
        enabled: boolean;
        torneoEspecifico: string | null;
        activoParaTorneo: boolean;
      };
    };
    environment: string;
    timestamp: string;
  }> {
    return {
      features: {
        descansoCalculatorV2: {
          enabled: FEATURES.DESCANSO_CALCULATOR_V2,
          torneoEspecifico: FEATURES.DESCANSO_CALCULATOR_V2_TORNEO_ID,
          activoParaTorneo: tournamentId ? isDescansoV2Enabled(tournamentId) : false,
        },
      },
      environment: process.env.NODE_ENV || 'unknown',
      timestamp: new Date().toISOString(),
    };
  }
}
