import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RankingsService } from '../rankings/rankings.service';
import { CrearMiRankingDto, EditarMiRankingDto } from './dto/mis-rankings.dto';

/**
 * RANKINGS DEL ORGANIZADOR (autoservicio, gratis — aprobado 2026-07-02).
 * El ranking ES un Circuito con dueño (organizadorId). El dueño lo crea, lo
 * edita y le suma/quita SUS torneos; torneos de terceros los vincula el admin
 * por el camino existente. La tabla de puntos es la única de la plataforma.
 */
@Injectable()
export class MisRankingsService {
  private readonly logger = new Logger(MisRankingsService.name);

  constructor(
    private prisma: PrismaService,
    private rankingsService: RankingsService,
  ) {}

  // ── Guard de dueño: el circuito existe y es MÍO ──
  private async circuitoPropio(circuitoId: string, userId: string) {
    const circuito = await this.prisma.circuito.findUnique({ where: { id: circuitoId } });
    if (!circuito) throw new NotFoundException('Ranking no encontrado');
    if (circuito.organizadorId !== userId) {
      throw new ForbiddenException('Este ranking no es tuyo');
    }
    return circuito;
  }

  /** Valida el nombre y propone la URL. Para el ✓ en vivo del modal. */
  async validarNombre(nombre: string) {
    const limpio = (nombre || '').trim();
    if (limpio.length < 3) {
      return { disponible: false, motivo: 'Muy corto (mínimo 3 letras)' };
    }
    if (limpio.length > 60) {
      return { disponible: false, motivo: 'Muy largo (máximo 60 letras)' };
    }
    const existente = await this.prisma.circuito.findUnique({ where: { nombre: limpio } });
    if (existente) {
      return { disponible: false, motivo: 'Ya existe un ranking con ese nombre' };
    }
    return { disponible: true, slug: await this.slugLibre(limpio) };
  }

  async listar(userId: string) {
    const circuitos = await this.prisma.circuito.findMany({
      where: { organizadorId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        torneos: {
          where: { estado: 'APROBADO' },
          select: {
            torneoId: true,
            torneo: { select: { id: true, nombre: true, estado: true, fechaInicio: true } },
          },
        },
      },
    });

    // Jugadores con puntos por circuito (tabla LIGA)
    const data = await Promise.all(
      circuitos.map(async (c) => {
        const jugadores = await this.prisma.ranking.count({
          where: { tipoRanking: 'LIGA', alcance: c.id },
        });
        return {
          id: c.id,
          nombre: c.nombre,
          slug: c.slug,
          descripcion: c.descripcion,
          logoUrl: c.logoUrl,
          estado: c.estado,
          temporada: c.temporada,
          torneos: c.torneos.map((t) => t.torneo),
          jugadoresConPuntos: jugadores,
        };
      }),
    );

    return { success: true, data };
  }

  async crear(userId: string, dto: CrearMiRankingDto) {
    const validacion = await this.validarNombre(dto.nombre);
    if (!validacion.disponible) {
      throw new BadRequestException(validacion.motivo || 'Nombre no disponible');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { nombre: true, apellido: true, ciudad: true },
    });

    const circuito = await this.prisma.circuito.create({
      data: {
        nombre: dto.nombre.trim(),
        descripcion: dto.descripcion?.trim() || null,
        logoUrl: dto.logoUrl || null,
        slug: validacion.slug!,
        ciudad: dto.ciudad?.trim() || user?.ciudad || 'Paraguay',
        temporada: new Date().getFullYear().toString(),
        organizadorId: userId,
      },
    });

    // Oversight suave: avisar a los admins (best-effort, no rompe la creación)
    try {
      const nombreOrg = [user?.nombre, user?.apellido].filter(Boolean).join(' ') || 'Un organizador';
      const admins = await this.prisma.user.findMany({
        where: { roles: { some: { role: { nombre: 'admin' } } } },
        select: { id: true },
      });
      await Promise.all(
        admins.map((a) =>
          this.prisma.notificacion.create({
            data: {
              userId: a.id,
              tipo: 'SISTEMA',
              titulo: 'Nuevo ranking creado',
              contenido: `${nombreOrg} creó el ranking "${circuito.nombre}".`,
              enlace: `/circuitos/${circuito.slug}`,
            },
          }),
        ),
      );
    } catch (e) {
      this.logger.warn(`No se pudo avisar a admins del ranking nuevo: ${e.message}`);
    }

    return { success: true, data: circuito };
  }

  async editar(userId: string, circuitoId: string, dto: EditarMiRankingDto) {
    const circuito = await this.circuitoPropio(circuitoId, userId);

    const data: any = {};
    if (dto.nombre !== undefined && dto.nombre.trim() !== circuito.nombre) {
      const validacion = await this.validarNombre(dto.nombre);
      if (!validacion.disponible) {
        throw new BadRequestException(validacion.motivo || 'Nombre no disponible');
      }
      data.nombre = dto.nombre.trim();
      // El slug NO cambia: los links compartidos siguen funcionando.
    }
    if (dto.descripcion !== undefined) data.descripcion = dto.descripcion?.trim() || null;
    if (dto.logoUrl !== undefined) data.logoUrl = dto.logoUrl || null;
    if (dto.estado !== undefined) {
      if (!['ACTIVO', 'FINALIZADO'].includes(dto.estado)) {
        throw new BadRequestException('Estado inválido (ACTIVO o FINALIZADO)');
      }
      data.estado = dto.estado;
    }

    const actualizado = await this.prisma.circuito.update({ where: { id: circuitoId }, data });
    return { success: true, data: actualizado };
  }

  async borrar(userId: string, circuitoId: string) {
    await this.circuitoPropio(circuitoId, userId);

    const torneos = await this.prisma.torneoCircuito.count({ where: { circuitoId } });
    if (torneos > 0) {
      throw new BadRequestException(
        'El ranking tiene torneos que suman puntos. Cerrá la temporada (FINALIZADO) en vez de borrarlo, o quitá los torneos primero.',
      );
    }

    await this.prisma.ranking.deleteMany({ where: { tipoRanking: 'LIGA', alcance: circuitoId } });
    await this.prisma.circuito.delete({ where: { id: circuitoId } });
    return { success: true, message: 'Ranking borrado' };
  }

  /** Suma un torneo MÍO al ranking. Si ya tiene resultados, calcula al toque. */
  async sumarTorneo(userId: string, circuitoId: string, torneoId: string) {
    const circuito = await this.circuitoPropio(circuitoId, userId);
    if (circuito.estado !== 'ACTIVO') {
      throw new BadRequestException('El ranking está cerrado; reactivalo para sumar torneos.');
    }

    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
      select: { id: true, nombre: true, organizadorId: true },
    });
    if (!torneo) throw new NotFoundException('Torneo no encontrado');
    if (torneo.organizadorId !== userId) {
      throw new ForbiddenException(
        'Solo podés sumar torneos tuyos. Para torneos de otro organizador, pedile al admin.',
      );
    }

    const ultimo = await this.prisma.torneoCircuito.findFirst({
      where: { circuitoId },
      orderBy: { orden: 'desc' },
    });

    await this.prisma.torneoCircuito.upsert({
      where: { circuitoId_torneoId: { circuitoId, torneoId } },
      update: { estado: 'APROBADO', puntosValidos: true },
      create: {
        circuitoId,
        torneoId,
        estado: 'APROBADO',
        puntosValidos: true,
        multiplicador: 1,
        orden: (ultimo?.orden ?? 0) + 1,
        solicitadoPorId: userId,
        aprobadoPorId: userId,
        fechaAprobacion: new Date().toISOString().slice(0, 10),
      },
    });

    // Si el torneo ya tiene categorías con resultados, que sume YA
    // (recalcularCircuito es idempotente y no re-notifica).
    const recalculo = await this.rankingsService
      .recalcularCircuito(circuitoId)
      .catch((e) => {
        this.logger.warn(`Recalculo tras sumar torneo falló: ${e.message}`);
        return null;
      });

    return {
      success: true,
      message: `"${torneo.nombre}" ahora suma en "${circuito.nombre}".`,
      recalculo: recalculo?.data ?? null,
    };
  }

  /** Quita un torneo del ranking y recalcula la tabla. Los otros rankings no se tocan. */
  async quitarTorneo(userId: string, circuitoId: string, torneoId: string) {
    const circuito = await this.circuitoPropio(circuitoId, userId);

    const vinculo = await this.prisma.torneoCircuito.findUnique({
      where: { circuitoId_torneoId: { circuitoId, torneoId } },
    });
    if (!vinculo) throw new NotFoundException('Ese torneo no está en este ranking');

    await this.prisma.torneoCircuito.delete({ where: { id: vinculo.id } });

    await this.rankingsService
      .recalcularCircuito(circuitoId)
      .catch((e) => this.logger.warn(`Recalculo tras quitar torneo falló: ${e.message}`));

    return { success: true, message: `Torneo quitado de "${circuito.nombre}". Tabla recalculada.` };
  }

  /** Mis torneos disponibles para sumar (excluye los que ya están en el ranking). */
  async torneosDisponibles(userId: string, circuitoId: string) {
    await this.circuitoPropio(circuitoId, userId);
    const yaVinculados = await this.prisma.torneoCircuito.findMany({
      where: { circuitoId },
      select: { torneoId: true },
    });
    const torneos = await this.prisma.tournament.findMany({
      where: {
        organizadorId: userId,
        id: { notIn: yaVinculados.map((t) => t.torneoId) },
        estado: { notIn: ['BORRADOR', 'RECHAZADO'] },
      },
      select: { id: true, nombre: true, estado: true, fechaInicio: true, ciudad: true },
      orderBy: { fechaInicio: 'desc' },
    });
    return { success: true, data: torneos };
  }

  // Slug legible: el nombre limpio; si está tomado, sufijo corto.
  private async slugLibre(nombre: string): Promise<string> {
    const base = nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .substring(0, 60);
    const existente = await this.prisma.circuito.findUnique({ where: { slug: base } });
    if (!existente) return base;
    return `${base}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
