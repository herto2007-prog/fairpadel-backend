import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DateService } from '../../common/services/date.service';
import { BracketService } from './bracket.service';
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
    // Obtener todos los días configurados con sus fases
    const diasConfig = await this.prisma.torneoDisponibilidadDia.findMany({
      where: { tournamentId },
      orderBy: { fecha: 'asc' },
    });

    if (diasConfig.length === 0) {
      return {
        valido: false,
        mensaje: 'No hay días configurados para el torneo',
        detalle: { diasConfigurados: 0 },
      };
    }

    // Calcular slots totales por tipo de fase requeridos
    const fasesRequeridas = new Map<FaseBracket, { partidos: number; diasNecesarios: number }>();
    
    for (const catInfo of calculo.detallePorCategoria) {
      for (const faseInfo of catInfo.partidosPorFase) {
        const fase = faseInfo.fase as FaseBracket;
        const actual = fasesRequeridas.get(fase) || { partidos: 0, diasNecesarios: 0 };
        actual.partidos += faseInfo.partidos;
        // Estimamos 15 partidos por día (aproximado)
        actual.diasNecesarios = Math.ceil(actual.partidos / 15);
        fasesRequeridas.set(fase, actual);
      }
    }

    // Contar slots disponibles por tipo de día (según día de semana)
    const slotsPorTipoDia = {
      juevesViernes: 0, // ZONA, REPECHAJE
      sabado: 0,        // OCTAVOS, CUARTOS
      domingo: 0,       // SEMIS, FINAL
    };

    const diasDetalle: Array<{ fecha: string; tipo: string; slots: number; fasesPermitidas: string[] }> = [];

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

      if (diaSemana === 4 || diaSemana === 5) { // Jueves o Viernes
        tipo = 'juevesViernes';
        slotsPorTipoDia.juevesViernes += slotsLibres;
        fasesPermitidas = ['ZONA', 'REPECHAJE'];
      } else if (diaSemana === 6) { // Sábado
        tipo = 'sabado';
        slotsPorTipoDia.sabado += slotsLibres;
        fasesPermitidas = ['OCTAVOS', 'CUARTOS'];
      } else if (diaSemana === 0) { // Domingo
        tipo = 'domingo';
        slotsPorTipoDia.domingo += slotsLibres;
        fasesPermitidas = ['SEMIS', 'FINAL'];
      }

      diasDetalle.push({ fecha: dia.fecha, tipo, slots: slotsLibres, fasesPermitidas });
    }

    // Verificar que hay suficientes días de cada tipo
    const errores: string[] = [];

    // ZONA y REPECHAJE necesitan días Jueves/Viernes
    const zonaRepechaje = fasesRequeridas.get(FaseBracket.ZONA)?.partidos || 0;
    const repechajePartidos = fasesRequeridas.get(FaseBracket.REPECHAJE)?.partidos || 0;
    const totalZonaRepechaje = zonaRepechaje + repechajePartidos;
    
    if (totalZonaRepechaje > 0 && slotsPorTipoDia.juevesViernes < totalZonaRepechaje) {
      errores.push(`Faltan días Jueves/Viernes: ${totalZonaRepechaje} partidos de Zona/Repechaje pero solo ${slotsPorTipoDia.juevesViernes} slots disponibles`);
    }

    // OCTAVOS y CUARTOS necesitan día Sábado
    const octavos = fasesRequeridas.get(FaseBracket.OCTAVOS)?.partidos || 0;
    const cuartos = fasesRequeridas.get(FaseBracket.CUARTOS)?.partidos || 0;
    const totalOctavosCuartos = octavos + cuartos;
    
    if (totalOctavosCuartos > 0 && slotsPorTipoDia.sabado < totalOctavosCuartos) {
      errores.push(`Faltan días Sábado: ${totalOctavosCuartos} partidos de Octavos/Cuartos pero solo ${slotsPorTipoDia.sabado} slots disponibles`);
    }

    // SEMIS y FINAL necesitan día Domingo
    const semis = fasesRequeridas.get(FaseBracket.SEMIS)?.partidos || 0;
    const final = fasesRequeridas.get(FaseBracket.FINAL)?.partidos || 0;
    const totalSemisFinal = semis + final;
    
    if (totalSemisFinal > 0 && slotsPorTipoDia.domingo < totalSemisFinal) {
      errores.push(`Faltan días Domingo: ${totalSemisFinal} partidos de Semis/Final pero solo ${slotsPorTipoDia.domingo} slots disponibles`);
    }

    if (errores.length > 0) {
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

    // 1. Verificar que hay suficientes slots
    const calculo = await this.calcularSlotsNecesarios(tournamentId, categoriasIds);
    
    if (!calculo.valido) {
      throw new BadRequestException({
        success: false,
        message: calculo.mensaje,
        detalle: calculo,
      });
    }

    // 2. NUEVO: Validar configuración de días vs fases requeridas
    const validacionDias = await this.validarConfiguracionDias(tournamentId, calculo);
    if (!validacionDias.valido) {
      throw new BadRequestException({
        success: false,
        message: validacionDias.mensaje,
        detalle: validacionDias.detalle,
      });
    }

    // 3. NUEVO: Verificar si hay días con fases configuradas
    const diasConFases = await this.prisma.torneoDisponibilidadDia.findMany({
      where: { 
        tournamentId,
        fasesPermitidas: { not: null }
      },
      orderBy: { fecha: 'asc' },
    });

    // 3. Decidir estrategia basada en la configuración
    if (diasConFases.length >= 2) {
      // NUEVA LÓGICA: Procesar por día respetando fases con Round-Robin
      console.log('[Sorteo] Usando estrategia NUEVA: Fases por día con Round-Robin');
      return this.sortearConFasesPorDia(tournamentId, categoriasIds, calculo, diasConFases);
    } else {
      // FALLBACK: Usar lógica secuencial original (backward compatibility)
      console.log('[Sorteo] Usando estrategia ORIGINAL: Secuencial');
      return this.sortearSecuencialOriginal(tournamentId, categoriasIds, calculo);
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
  ): Promise<SorteoMasivoResponse> {
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

    // PROCESAR POR DÍA (cronológicamente)
    for (const dia of diasConfig) {
      // Obtener fases permitidas para este día
      const fasesPermitidas = (dia.fasesPermitidas as string)
        ?.split(',') as FaseBracket[] || 
        this.obtenerFasesParaDia(dia.fecha);

      if (fasesPermitidas.length === 0) continue;

      // Obtener slots libres del día
      const slotsDelDia = await this.prisma.torneoSlot.findMany({
        where: {
          disponibilidadId: dia.id,
          estado: 'LIBRE',
        },
        orderBy: { horaInicio: 'asc' },
      });

      if (slotsDelDia.length === 0) continue;

      // Obtener partidos pendientes de TODAS las categorías para estas fases
      const partidosPorCategoria = new Map<string, Array<{ fase: FaseBracket; orden: number }>>();
      
      for (const catData of categoriasData) {
        const partidosPendientes: Array<{ fase: FaseBracket; orden: number }> = [];
        
        // Calcular partidos por fase para esta categoría
        const numParejas = catData.inscripciones.length;
        const calculoCat = this.bracketService.calcularSlotsNecesarios(numParejas);
        
        for (const faseInfo of calculoCat.detallePorFase) {
          const fase = faseInfo.fase as FaseBracket;
          if (fasesPermitidas.includes(fase)) {
            // Verificar cuántos slots ya están asignados para esta fase
            const asignacionesExistentes = asignacionesPorCategoria.get(catData.categoria.id) || [];
            const asignadosEnEstaFase = asignacionesExistentes.filter(s => s.fase === fase).length;
            const pendientes = faseInfo.partidos - asignadosEnEstaFase;
            
            for (let i = 0; i < pendientes; i++) {
              partidosPendientes.push({
                fase,
                orden: asignadosEnEstaFase + i + 1,
              });
            }
          }
        }
        
        if (partidosPendientes.length > 0) {
          partidosPorCategoria.set(catData.categoria.id, partidosPendientes);
        }
      }

      if (partidosPorCategoria.size === 0) continue;

      // Ordenar con Round-Robin entre categorías
      const partidosOrdenados = this.ordenarRoundRobin(
        partidosPorCategoria, 
        categoriasData.map(c => c.categoria.id)
      );

      // Asignar partidos a slots del día
      for (let i = 0; i < partidosOrdenados.length && i < slotsDelDia.length; i++) {
        const partido = partidosOrdenados[i];
        const slot = slotsDelDia[i];
        
        const slotReserva: SlotReserva = {
          fecha: dia.fecha,
          horaInicio: slot.horaInicio,
          horaFin: slot.horaFin,
          torneoCanchaId: slot.torneoCanchaId,
          categoriaId: partido.categoriaId,
          fase: partido.fase,
          ordenPartido: partido.orden,
        };

        // Agregar a las asignaciones de la categoría
        if (!asignacionesPorCategoria.has(partido.categoriaId)) {
          asignacionesPorCategoria.set(partido.categoriaId, []);
        }
        asignacionesPorCategoria.get(partido.categoriaId)!.push(slotReserva);

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
        
        const catNombre = categoriasData.find(c => c.categoria.id === partido.categoriaId)?.nombre;
        if (catNombre) {
          distribucionPorDia[dia.fecha].categorias.add(catNombre);
        }
      }
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
      slotsTotalesReservados: slotIndex,
      distribucionPorDia: distribucionResponse,
    };
  }

  /**
   * Obtiene slots disponibles ordenados por fecha y hora
   */
  private async obtenerSlotsDisponiblesOrdenados(tournamentId: string) {
    return this.prisma.torneoSlot.findMany({
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
            sedeCancha: true,
          },
        },
      },
      orderBy: [
        { disponibilidad: { fecha: 'asc' } },
        { horaInicio: 'asc' },
      ],
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
}
