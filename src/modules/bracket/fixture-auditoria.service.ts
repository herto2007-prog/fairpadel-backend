import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { horaAMinutos } from '../../common/utils/time-helpers';

/**
 * Auditoría de integridad del fixture.
 * Extraído tal cual de CanchasSorteoService (refactor de archivos monstruo);
 * la lógica no cambió.
 */
@Injectable()
export class FixtureAuditoriaService {
  constructor(private prisma: PrismaService) {}

  /**
   * AUDITORÍA: Valida la integridad del fixture completo
   * Detecta problemas como partidos sin fecha, orígenes rotos, violaciones de descanso, etc.
   */
  async auditarFixture(tournamentId: string) {
    const problemas: Array<{
      id: string;
      tipo: 'CRITICO' | 'ADVERTENCIA' | 'INFO';
      categoria: string;
      categoriaId: string;
      mensaje: string;
      detalle: string;
      accionRecomendada: string;
      partidoId?: string;
      datos?: any;
    }> = [];

    // Obtener todas las categorías y días del torneo
    const categorias = await this.prisma.tournamentCategory.findMany({
      where: { tournamentId },
      include: { category: true },
    });

    const diasConfig = await this.prisma.torneoDisponibilidadDia.findMany({
      where: { tournamentId },
    });

    for (const cat of categorias) {
      const categoriaNombre = cat.category.nombre;
      const categoriaId = cat.categoryId;

      // Obtener todos los partidos de la categoría
      const partidos = await this.prisma.match.findMany({
        where: {
          tournamentId,
          categoryId: categoriaId,
        },
        include: {
          inscripcion1: { select: { id: true, jugador1Id: true, jugador2Id: true } },
          inscripcion2: { select: { id: true, jugador1Id: true, jugador2Id: true } },
          torneoCancha: { include: { sedeCancha: true } },
        },
      });

      // 1. Partidos sin fecha (no BYE)
      const partidosSinFecha = partidos.filter(p => !p.fechaProgramada && !p.esBye);
      if (partidosSinFecha.length > 0) {
        problemas.push({
          id: `sin-fecha-${categoriaId}`,
          tipo: 'CRITICO',
          categoria: categoriaNombre,
          categoriaId,
          mensaje: `${partidosSinFecha.length} partidos sin fecha asignada`,
          detalle: `Partidos: ${partidosSinFecha.map(p => `${p.ronda} (${p.id.slice(0, 8)}...)`).join(', ')}`,
          accionRecomendada: 'Re-sortear categoría',
          datos: { cantidad: partidosSinFecha.length, partidos: partidosSinFecha.map(p => ({ id: p.id, ronda: p.ronda })) },
        });
      }

      // 2. BYE sin fecha que afectan descanso (tienen partido siguiente)
      const byeSinFecha = partidos.filter(p => p.esBye && !p.fechaProgramada);
      for (const bye of byeSinFecha) {
        const partidosConEsteByeComoOrigen = await this.prisma.match.findMany({
          where: {
            OR: [
              { partidoOrigen1Id: bye.id },
              { partidoOrigen2Id: bye.id },
            ],
          },
        });

        if (partidosConEsteByeComoOrigen.length > 0) {
          problemas.push({
            id: `bye-afecta-${bye.id}`,
            tipo: 'ADVERTENCIA',
            categoria: categoriaNombre,
            categoriaId,
            mensaje: `BYE sin fecha afecta ${partidosConEsteByeComoOrigen.length} partido(s)`,
            detalle: `El BYE en ${bye.ronda} no tiene fecha pero es origen de otros partidos`,
            accionRecomendada: 'Ignorar (el sistema ya maneja esto) o asignar slot fantasma',
            partidoId: bye.id,
            datos: { partidosAfectados: partidosConEsteByeComoOrigen.map(p => p.id) },
          });
        }
      }

      // 3. Orígenes rotos (partidoOrigenXId apunta a null o partido inexistente)
      for (const partido of partidos) {
        if (partido.partidoOrigen1Id) {
          const origen1Existe = await this.prisma.match.findUnique({
            where: { id: partido.partidoOrigen1Id },
            select: { id: true },
          });
          if (!origen1Existe) {
            problemas.push({
              id: `origen-roto-${partido.id}-1`,
              tipo: 'CRITICO',
              categoria: categoriaNombre,
              categoriaId,
              mensaje: `Origen 1 roto en ${partido.ronda}`,
              detalle: `El partido origen ${partido.partidoOrigen1Id.slice(0, 8)}... no existe`,
              accionRecomendada: 'Re-generar bracket de la categoría',
              partidoId: partido.id,
            });
          }
        }
        if (partido.partidoOrigen2Id) {
          const origen2Existe = await this.prisma.match.findUnique({
            where: { id: partido.partidoOrigen2Id },
            select: { id: true },
          });
          if (!origen2Existe) {
            problemas.push({
              id: `origen-roto-${partido.id}-2`,
              tipo: 'CRITICO',
              categoria: categoriaNombre,
              categoriaId,
              mensaje: `Origen 2 roto en ${partido.ronda}`,
              detalle: `El partido origen ${partido.partidoOrigen2Id.slice(0, 8)}... no existe`,
              accionRecomendada: 'Re-generar bracket de la categoría',
              partidoId: partido.id,
            });
          }
        }
      }

      // 4. Violaciones de descanso (mismo día, diferencia < 2h + 70min)
      for (const partido of partidos.filter(p => p.fechaProgramada && !p.esBye)) {
        for (const origenId of [partido.partidoOrigen1Id, partido.partidoOrigen2Id].filter(Boolean)) {
          const origen = await this.prisma.match.findUnique({
            where: { id: origenId! },
          });

          if (origen?.fechaProgramada === partido.fechaProgramada && origen.horaProgramada && partido.horaProgramada) {
            const horaOrigenFin = horaAMinutos(origen.horaProgramada) + 70;
            const horaPartidoInicio = horaAMinutos(partido.horaProgramada);
            const diferenciaMin = horaPartidoInicio - horaOrigenFin;

            if (diferenciaMin < 120) {
              problemas.push({
                id: `descanso-${partido.id}-${origen.id}`,
                tipo: 'CRITICO',
                categoria: categoriaNombre,
                categoriaId,
                mensaje: `Violación de descanso en ${partido.ronda}`,
                detalle: `Origen termina ${origen.horaProgramada}, partido empieza ${partido.horaProgramada} (descanso: ${diferenciaMin}min, mínimo: 120min)`,
                accionRecomendada: 'Mover partido a slot posterior o día siguiente',
                partidoId: partido.id,
                datos: { horaOrigen: origen.horaProgramada, horaPartido: partido.horaProgramada, diferenciaMin },
              });
            }
          }
        }
      }

      // 5. Fase en día no permitido
      for (const partido of partidos.filter(p => p.fechaProgramada)) {
        const diaConfig = diasConfig.find(d => d.fecha === partido.fechaProgramada);
        if (diaConfig?.fasesPermitidas) {
          const fasesPermitidas = (diaConfig.fasesPermitidas as string).split(',');
          if (!fasesPermitidas.includes(partido.ronda)) {
            problemas.push({
              id: `fase-no-permitida-${partido.id}`,
              tipo: 'ADVERTENCIA',
              categoria: categoriaNombre,
              categoriaId,
              mensaje: `${partido.ronda} en día no permitido`,
              detalle: `El día ${partido.fechaProgramada} solo permite: ${fasesPermitidas.join(', ')}`,
              accionRecomendada: 'Re-sortear para mover al día correcto',
              partidoId: partido.id,
              datos: { fasesPermitidas },
            });
          }
        }
      }
    }

    // 6. Slots duplicados (verificar si un slot tiene más de un partido)
    const diasIds = diasConfig.map(d => d.id);
    const slotsOcupados = await this.prisma.torneoSlot.findMany({
      where: {
        disponibilidadId: { in: diasIds },
        estado: 'OCUPADO'
      },
      select: { id: true, disponibilidadId: true, horaInicio: true, torneoCanchaId: true, matchId: true },
    });

    const slotsPorClave = new Map<string, typeof slotsOcupados>();
    for (const slot of slotsOcupados) {
      const clave = `${slot.disponibilidadId}-${slot.horaInicio}-${slot.torneoCanchaId}`;
      if (!slotsPorClave.has(clave)) {
        slotsPorClave.set(clave, []);
      }
      slotsPorClave.get(clave)!.push(slot);
    }

    const slotsDuplicados = Array.from(slotsPorClave.values()).filter(slots => slots.length > 1);

    if (slotsDuplicados.length > 0) {
      problemas.push({
        id: 'slots-duplicados',
        tipo: 'CRITICO',
        categoria: 'Todas',
        categoriaId: 'all',
        mensaje: `${slotsDuplicados.length} slots con múltiples partidos`,
        detalle: 'Hay slots que tienen más de un partido asignado',
        accionRecomendada: 'Re-sortear todo el torneo',
        datos: { slotsDuplicados: slotsDuplicados.map(s => s.map(x => x.id)) },
      });
    }

    // Resumen
    const resumen = {
      totalCategorias: categorias.length,
      totalProblemas: problemas.length,
      criticos: problemas.filter(p => p.tipo === 'CRITICO').length,
      advertencias: problemas.filter(p => p.tipo === 'ADVERTENCIA').length,
      info: problemas.filter(p => p.tipo === 'INFO').length,
    };

    return {
      success: true,
      data: {
        resumen,
        problemas,
      },
    };
  }
}
