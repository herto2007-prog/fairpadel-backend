import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { horaAMinutos } from '../../common/utils/time-helpers';
import { esTerminal } from './match-estados';

/**
 * MOTOR DE AGENDA (reescrito 2026-06-15 — "agenda predictiva honesta")
 *
 * Reemplaza el motor viejo (heurística por día de la semana + comodín 23:00).
 * Ahora:
 *  - Agenda TODAS las posiciones del cuadro, incluidas las rondas futuras
 *    (el slot es determinístico aunque el ocupante no se conozca todavía).
 *  - Maneja por CONFIGURACIÓN, no por día de la semana: las semis/finales van
 *    al ÚLTIMO día configurado; el resto llena lo más temprano posible.
 *  - Respeta dependencias (un partido no arranca hasta que sus dos orígenes
 *    terminan + descanso) y el descanso entre partidos de un mismo jugador.
 *  - NO inventa: lo que no entra queda SIN horario (fechaProgramada null) y se
 *    reporta; nunca se estampa a las 23:00.
 *
 * Reglas (acordadas con Héctor 2026-06-15):
 *  - Hasta 3 partidos por día por jugador.
 *  - Descanso mínimo 90 min (1h30) entre partidos de un mismo jugador.
 *  - Llenar lo más temprano posible (que terminen antes).
 *  - Día de finales = último día configurado (automático).
 */

// Orden cronológico de fases (las tempranas primero).
const ORDEN_FASES: string[] = [
  'ZONA', 'REPECHAJE', 'TREINTAYDOSAVOS', 'DIECISEISAVOS',
  'OCTAVOS', 'CUARTOS', 'SEMIS', 'FINAL',
];
// Fases que van obligatoriamente al día de finales.
const FASES_FINALES: string[] = ['SEMIS', 'FINAL'];

const DESCANSO_MIN = 90; // 1h30 entre partidos de un mismo jugador
const MAX_POR_DIA = 3;   // máximo de partidos por día por jugador

interface SlotGrid {
  id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  torneoCanchaId: string;
}

interface PartidoSorteo {
  id: string;
  ronda: string;
  numeroRonda: number | null;
  fixtureVersionId: string | null;
  inscripcion1Id: string | null;
  inscripcion2Id: string | null;
  partidoOrigen1Id: string | null;
  partidoOrigen2Id: string | null;
  estado: string;
  fechaProgramada: string | null;
  horaProgramada: string | null;
}

@Injectable()
export class AsignacionSlotsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Asigna fecha/hora/cancha a los partidos de las categorías sorteadas.
   * Mantiene la firma y el retorno del motor anterior para no tocar el caller.
   */
  async asignarSlots(
    _tournamentId: string,
    categoriasData: Array<{ categoria: any; nombre: string; inscripciones: any[] }>,
    diasConfig: any[],
  ): Promise<{ totalPartidosAsignados: number; distribucionPorDia: Record<string, number>; partidosSinSlot: number }> {
    const distribucionPorDia: Record<string, number> = {};

    // 1. Grilla global de slots LIBRES, ordenada cronológicamente (fecha, hora).
    const diaPorId = new Map<string, any>(diasConfig.map((d) => [d.id, d]));
    const fechasOrdenadas = [...new Set(diasConfig.map((d) => d.fecha as string))].sort();
    const ultimaFecha = fechasOrdenadas[fechasOrdenadas.length - 1];

    const slotsRaw = await this.prisma.torneoSlot.findMany({
      where: { disponibilidadId: { in: diasConfig.map((d) => d.id) }, estado: 'LIBRE' },
    });
    const slots: SlotGrid[] = slotsRaw
      .map((s) => ({
        id: s.id,
        fecha: diaPorId.get(s.disponibilidadId)?.fecha as string,
        horaInicio: s.horaInicio,
        horaFin: s.horaFin,
        torneoCanchaId: s.torneoCanchaId,
      }))
      .filter((s) => !!s.fecha)
      .sort((a, b) =>
        a.fecha !== b.fecha ? a.fecha.localeCompare(b.fecha) : a.horaInicio.localeCompare(b.horaInicio),
      );
    const slotUsado = new Set<string>();

    // 2. Partidos (no BYE) de las categorías a sortear.
    const fixtureIds = categoriasData
      .map((c) => c.categoria.fixtureVersionId)
      .filter((id): id is string => !!id);

    const partidos = (await this.prisma.match.findMany({
      where: { fixtureVersionId: { in: fixtureIds }, esBye: false },
      select: {
        id: true, ronda: true, numeroRonda: true, fixtureVersionId: true,
        inscripcion1Id: true, inscripcion2Id: true,
        partidoOrigen1Id: true, partidoOrigen2Id: true,
        estado: true, fechaProgramada: true, horaProgramada: true,
      },
    })) as PartidoSorteo[];

    const idsNoBye = new Set(partidos.map((p) => p.id));

    // FIJOS = partidos ya jugados: son anclas, no se mueven. Su franja sigue OCUPADA
    // y su hora real alimenta las dependencias/descanso de los que vienen después.
    // (Para el sorteo inicial no hay jugados → fijos vacío → comportamiento idéntico.)
    const estaJugado = (p: PartidoSorteo) =>
      esTerminal(p.estado) && !!p.fechaProgramada && !!p.horaProgramada;
    const fijos = partidos.filter(estaJugado);
    const aProgramar = partidos.filter((p) => !estaJugado(p));

    // 3. Orden topológico: por ronda (temprana primero), luego categoría, luego número.
    const ordenFase = (r: string) => {
      const i = ORDEN_FASES.indexOf(r);
      return i < 0 ? 99 : i;
    };
    const ordenCat = new Map<string, number>(
      categoriasData.map((c, i) => [c.categoria.fixtureVersionId as string, i]),
    );
    aProgramar.sort(
      (a, b) =>
        ordenFase(a.ronda) - ordenFase(b.ronda) ||
        (ordenCat.get(a.fixtureVersionId || '') ?? 99) - (ordenCat.get(b.fixtureVersionId || '') ?? 99) ||
        (a.numeroRonda || 0) - (b.numeroRonda || 0),
    );

    // 4. Estado de asignación (en memoria; se persiste a medida que asignamos).
    const finPorPartido = new Map<string, { fecha: string; finMin: number }>();
    const porJugador = new Map<string, Array<{ fecha: string; ini: number; fin: number }>>();
    let total = 0;
    const sinSlot: string[] = [];

    // Sembrar las anclas (partidos ya jugados): fijan su fin para las dependencias
    // y la ocupación de sus jugadores para el descanso.
    if (fijos.length > 0) {
      const slotsFijos = await this.prisma.torneoSlot.findMany({
        where: { matchId: { in: fijos.map((f) => f.id) } },
        select: { matchId: true, horaFin: true },
      });
      const finPorMatch = new Map<string, number>(
        slotsFijos
          .filter((s) => !!s.matchId)
          .map((s) => [s.matchId as string, horaAMinutos(s.horaFin)]),
      );
      for (const f of fijos) {
        const finMin = finPorMatch.get(f.id) ?? horaAMinutos(f.horaProgramada!) + DESCANSO_MIN;
        finPorPartido.set(f.id, { fecha: f.fechaProgramada!, finMin });
        const jugadores = [f.inscripcion1Id, f.inscripcion2Id].filter((x): x is string => !!x);
        for (const j of jugadores) {
          const lst = porJugador.get(j) || [];
          lst.push({ fecha: f.fechaProgramada!, ini: horaAMinutos(f.horaProgramada!), fin: finMin });
          porJugador.set(j, lst);
        }
      }
    }

    for (const p of aProgramar) {
      const esFinal = FASES_FINALES.includes(p.ronda);
      const jugadores = [p.inscripcion1Id, p.inscripcion2Id].filter((x): x is string => !!x);

      // 4a. Dependencias: ambos orígenes (reales) deben estar agendados.
      let okDeps = true;
      let depFechaMin: string | null = null;
      const depFinSameDay = new Map<string, number>();
      for (const oid of [p.partidoOrigen1Id, p.partidoOrigen2Id].filter((x): x is string => !!x)) {
        const fin = finPorPartido.get(oid);
        if (!fin) {
          // Si el origen no es un partido real (BYE → no está en la lista), no bloquea.
          if (idsNoBye.has(oid)) { okDeps = false; break; }
          continue;
        }
        if (!depFechaMin || fin.fecha > depFechaMin) depFechaMin = fin.fecha;
        const prev = depFinSameDay.get(fin.fecha) ?? 0;
        if (fin.finMin > prev) depFinSameDay.set(fin.fecha, fin.finMin);
      }
      if (!okDeps) { sinSlot.push(p.id); continue; }

      // 4b. Buscar el primer slot válido (la grilla ya está ordenada = "lo más temprano").
      let elegido: SlotGrid | null = null;
      for (const s of slots) {
        if (slotUsado.has(s.id)) continue;
        if (esFinal && s.fecha !== ultimaFecha) continue;          // finales solo el último día
        if (depFechaMin && s.fecha < depFechaMin) continue;        // no antes del día del origen
        const ini = horaAMinutos(s.horaInicio);
        const sFin = horaAMinutos(s.horaFin);

        // descanso del ganador respecto al origen (mismo día)
        const depFin = depFinSameDay.get(s.fecha);
        if (depFin != null && ini < depFin + DESCANSO_MIN) continue;

        // restricciones por jugador conocido: tope/día + descanso
        let okJug = true;
        for (const j of jugadores) {
          const delDia = (porJugador.get(j) || []).filter((m) => m.fecha === s.fecha);
          if (delDia.length >= MAX_POR_DIA) { okJug = false; break; }
          for (const m of delDia) {
            const okGap = ini >= m.fin + DESCANSO_MIN || sFin + DESCANSO_MIN <= m.ini;
            if (!okGap) { okJug = false; break; }
          }
          if (!okJug) break;
        }
        if (!okJug) continue;

        elegido = s;
        break;
      }

      if (!elegido) { sinSlot.push(p.id); continue; }

      // 4c. Persistir la asignación.
      slotUsado.add(elegido.id);
      await this.prisma.torneoSlot.update({
        where: { id: elegido.id },
        data: { estado: 'OCUPADO', matchId: p.id },
      });
      await this.prisma.match.update({
        where: { id: p.id },
        data: {
          fechaProgramada: elegido.fecha,
          horaProgramada: elegido.horaInicio,
          torneoCanchaId: elegido.torneoCanchaId,
        },
      });

      const iniMin = horaAMinutos(elegido.horaInicio);
      const finMin = horaAMinutos(elegido.horaFin);
      finPorPartido.set(p.id, { fecha: elegido.fecha, finMin });
      for (const j of jugadores) {
        const lst = porJugador.get(j) || [];
        lst.push({ fecha: elegido.fecha, ini: iniMin, fin: finMin });
        porJugador.set(j, lst);
      }
      total++;
      distribucionPorDia[elegido.fecha] = (distribucionPorDia[elegido.fecha] || 0) + 1;
    }

    if (sinSlot.length > 0) {
      console.log(
        `[asignarSlots] ${sinSlot.length} partido(s) sin slot: no hay franjas/canchas suficientes. ` +
          `Quedan SIN horario (sin comodín). Agregá más franjas o canchas.`,
      );
    }

    return { totalPartidosAsignados: total, distribucionPorDia, partidosSinSlot: sinSlot.length };
  }
}
