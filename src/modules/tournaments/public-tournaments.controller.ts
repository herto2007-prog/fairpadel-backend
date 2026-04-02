import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TournamentStatus } from '@prisma/client';

/**
 * Controlador PÚBLICO para torneos
 * No requiere autenticación - accesible desde el sitio público
 * Ruta base: /t (para URLs cortas tipo /t/slug-del-torneo)
 */
@Controller('t')
export class PublicTournamentsController {
  constructor(private prisma: PrismaService) {}

  /**
   * GET /t/public
   * Lista de torneos públicos con filtros de búsqueda
   */
  @Get('public')
  async findAllPublic(
    @Query('q') searchQuery?: string,
    @Query('ciudad') ciudad?: string,
    @Query('categoria') categoriaId?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('estado') estado?: string, // proximos | en-curso | finalizados | todos
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = Math.min(parseInt(limit || '12', 10), 50);
    const skip = (pageNum - 1) * limitNum;

    // Construir where dinámico
    const where: any = {
      estado: TournamentStatus.PUBLICADO,
    };

    // Filtro de estado - fechas son String YYYY-MM-DD
    const hoy = new Date().toISOString().split('T')[0];
    if (estado === 'proximos') {
      where.fechaInicio = { gte: hoy };
    } else if (estado === 'en-curso') {
      where.fechaInicio = { lte: hoy };
      where.fechaFin = { gte: hoy };
    } else if (estado === 'finalizados') {
      where.fechaFin = { lt: hoy };
    }

    // Filtro de ciudad
    if (ciudad) {
      where.ciudad = { contains: ciudad, mode: 'insensitive' };
    }

    // Filtro de categoría
    if (categoriaId) {
      where.categorias = {
        some: {
          categoryId: categoriaId,
          inscripcionAbierta: true,
        },
      };
    }

    // Filtro de fechas
    if (fechaDesde || fechaHasta) {
      where.fechaInicio = {};
      // FIX: fechas son String YYYY-MM-DD, comparar directamente
      if (fechaDesde) where.fechaInicio.gte = fechaDesde;
      if (fechaHasta) where.fechaInicio.lte = fechaHasta;
    }

    // Búsqueda por texto (nombre o descripción)
    if (searchQuery) {
      where.OR = [
        { nombre: { contains: searchQuery, mode: 'insensitive' } },
        { descripcion: { contains: searchQuery, mode: 'insensitive' } },
        { ciudad: { contains: searchQuery, mode: 'insensitive' } },
      ];
    }

    const [torneos, total] = await Promise.all([
      this.prisma.tournament.findMany({
        where,
        include: {
          organizador: {
            select: { id: true, nombre: true, apellido: true },
          },
          categorias: {
            where: { inscripcionAbierta: true },
            include: { category: true },
          },
          sedePrincipal: {
            select: { id: true, nombre: true, ciudad: true },
          },
          _count: {
            select: { inscripciones: true },
          },
        },
        orderBy: { fechaInicio: 'asc' },
        skip,
        take: limitNum,
      }),
      this.prisma.tournament.count({ where }),
    ]);

    // Transformar respuesta para el frontend
    const torneosFormateados = torneos.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      slug: t.slug,
      descripcion: t.descripcion,
      fechaInicio: t.fechaInicio,
      fechaFin: t.fechaFin,
      fechaLimiteInscr: t.fechaLimiteInscr,
      ciudad: t.ciudad,
      flyerUrl: t.flyerUrl,
      costoInscripcion: t.costoInscripcion,
      organizador: t.organizador,
      sede: t.sedePrincipal,
      categorias: t.categorias.map((c) => ({
        id: c.categoryId,
        nombre: c.category.nombre,
        tipo: c.category.tipo,
        orden: c.category.orden,
        inscripcionAbierta: c.inscripcionAbierta,
      })),
      totalInscritos: t._count.inscripciones,
    }));

    return {
      success: true,
      torneos: torneosFormateados,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * GET /t/:slug
   * Detalle de un torneo por slug (URL amigable)
   */
  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { slug },
      include: {
        organizador: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            telefono: true,
            email: true,
          },
        },
        categorias: {
          include: { category: true },
          orderBy: { category: { orden: 'asc' } },
        },
        modalidades: {
          include: { modalidadConfig: true },
        },
        sedePrincipal: {
          include: {
            canchas: { where: { activa: true } },
          },
        },
        torneoSedes: {
          include: { sede: true },
        },
        premios: {
          orderBy: { puesto: 'asc' },
        },
        sponsors: {
          orderBy: [{ nivel: 'asc' }, { orden: 'asc' }],
        },
        _count: {
          select: { inscripciones: true },
        },
      },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (torneo.estado !== TournamentStatus.PUBLICADO) {
      throw new BadRequestException('Este torneo no está disponible públicamente');
    }

    // Verificar si las inscripciones están abiertas
    // FIX: fechas son String YYYY-MM-DD, comparar directamente
    const hoy = new Date().toISOString().split('T')[0];
    const inscripcionesAbiertas =
      torneo.fechaLimiteInscr && hoy <= ((torneo.fechaLimiteInscr as unknown) as string) &&
      torneo.categorias.some((c) => c.inscripcionAbierta);

    return {
      success: true,
      torneo: {
        id: torneo.id,
        nombre: torneo.nombre,
        slug: torneo.slug,
        descripcion: torneo.descripcion,
        fechaInicio: torneo.fechaInicio,
        fechaFin: torneo.fechaFin,
        fechaLimiteInscr: torneo.fechaLimiteInscr,
        ciudad: torneo.ciudad,
        region: torneo.region,
        pais: torneo.pais,
        flyerUrl: torneo.flyerUrl,
        costoInscripcion: torneo.costoInscripcion,
        minutosPorPartido: torneo.minutosPorPartido,
        inscripcionesAbiertas,
        organizador: torneo.organizador,
        sedePrincipal: torneo.sedePrincipal,
        sedes: torneo.torneoSedes.map((s) => s.sede),
        categorias: torneo.categorias.map((c) => ({
          id: c.categoryId,
          tournamentCategoryId: c.id,
          nombre: c.category.nombre,
          tipo: c.category.tipo,
          orden: c.category.orden,
          inscripcionAbierta: c.inscripcionAbierta,
          estado: c.estado,
        })),
        modalidades: torneo.modalidades.map((m) => ({
          id: m.modalidadConfigId,
          nombre: m.modalidadConfig.nombre,
          descripcion: m.modalidadConfig.descripcion,
        })),
        premios: torneo.premios,
        sponsors: torneo.sponsors,
        totalInscritos: torneo._count.inscripciones,
      },
    };
  }

  /**
   * GET /t/:slug/categorias
   * Categorías disponibles para inscripción con validaciones
   */
  @Get(':slug/categorias')
  async getCategoriasInscripcion(
    @Param('slug') slug: string,
    @Query('jugadorGenero') jugadorGenero?: string, // MASCULINO | FEMENINO
    @Query('jugadorCategoriaId') jugadorCategoriaId?: string,
  ) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { slug },
      include: {
        categorias: {
          where: { inscripcionAbierta: true },
          include: { category: true },
        },
      },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    // Obtener todas las categorías del sistema para calcular jerarquía
    const todasCategorias = await this.prisma.category.findMany({
      orderBy: { orden: 'asc' },
    });

    // Calcular categorías permitidas según género y nivel
    let categoriasPermitidas = torneo.categorias;

    if (jugadorGenero && jugadorCategoriaId) {
      const categoriaJugador = todasCategorias.find(
        (c) => c.id === jugadorCategoriaId
      );

      if (categoriaJugador) {
        categoriasPermitidas = this.filtrarCategoriasPorReglas(
          torneo.categorias,
          jugadorGenero as 'MASCULINO' | 'FEMENINO',
          categoriaJugador,
          todasCategorias
        );
      }
    }

    return {
      success: true,
      categorias: categoriasPermitidas.map((c) => ({
        id: c.categoryId,
        tournamentCategoryId: c.id,
        nombre: c.category.nombre,
        tipo: c.category.tipo,
        orden: c.category.orden,
        permitida: true,
        mensaje: this.getMensajeCategoria(
          c.category.tipo,
          jugadorGenero as 'MASCULINO' | 'FEMENINO'
        ),
      })),
    };
  }

  /**
   * GET /t/datos/filtros
   * Datos para los filtros del menú de torneos
   */
  @Get('datos/filtros')
  async getDatosFiltros() {
    const [ciudades, categorias] = await Promise.all([
      this.prisma.tournament.findMany({
        where: { estado: TournamentStatus.PUBLICADO },
        select: { ciudad: true },
        distinct: ['ciudad'],
        orderBy: { ciudad: 'asc' },
      }),
      this.prisma.category.findMany({
        orderBy: { orden: 'asc' },
        select: { id: true, nombre: true, tipo: true },
      }),
    ]);

    return {
      success: true,
      ciudades: ciudades.map((c) => c.ciudad),
      categorias,
    };
  }

  /**
   * Filtra categorías según las reglas de negocio:
   * 
   * REGLAS PARA HOMBRES:
   * - NO pueden inscribirse en categorías inferiores a la suya
   * - SÍ pueden inscribirse en categorías superiores (no frenamos progreso)
   * - NO pueden inscribirse en categorías Damas (bajo ninguna circunstancia)
   * 
   * REGLAS PARA MUJERES EN CATEGORÍAS DAMAS (su género):
   * - NO pueden inscribirse en categorías inferiores a la suya
   * - SÍ pueden inscribirse en categorías superiores
   * - NO aplica excepción de bajar (solo en Caballeros)
   * 
   * REGLAS PARA MUJERES EN CATEGORÍAS CABALLEROS:
   * - SÍ pueden inscribirse (probar su capacidad)
   * - Como EXCEPCIÓN pueden bajar UNA categoría inferior a la suya
   * - SÍ pueden inscribirse en categorías superiores
   */
  private filtrarCategoriasPorReglas(
    categoriasTorneo: any[],
    jugadorGenero: 'MASCULINO' | 'FEMENINO',
    categoriaJugador: any,
    todasCategorias: any[]
  ) {
    const ordenJugador = categoriaJugador.orden;
    const esCategoriaMasculina = (tipo: string) => tipo === 'MASCULINO';
    const esCategoriaFemenina = (tipo: string) => tipo === 'FEMENINO';

    return categoriasTorneo.filter((cat) => {
      const categoria = cat.category;
      const ordenCategoria = categoria.orden;

      // REGLA 1: Hombres NO pueden en categorías Damas
      if (jugadorGenero === 'MASCULINO' && esCategoriaFemenina(categoria.tipo)) {
        return false;
      }

      // REGLA 2: Categoría igual o superior - permitida para todos
      if (ordenCategoria >= ordenJugador) {
        return true;
      }

      // REGLA 3: Categorías INFERIORES (ordenCategoria < ordenJugador)
      // Hombres: NO pueden en inferiores (bajo ninguna circunstancia)
      if (jugadorGenero === 'MASCULINO') {
        return false;
      }

      // Mujeres en categorías Damas (su género): NO pueden bajar
      if (esCategoriaFemenina(categoria.tipo)) {
        return false;
      }

      // Mujeres en categorías Caballeros: SÍ pueden bajar UNA como excepción
      // Aquí deberíamos verificar si ya usó su excepción
      return true;
    });
  }

  private getMensajeCategoria(
    tipoCategoria: string,
    jugadorGenero?: 'MASCULINO' | 'FEMENINO'
  ): string | null {
    if (!jugadorGenero) return null;

    if (jugadorGenero === 'MASCULINO' && tipoCategoria === 'FEMENINO') {
      return 'No disponible para categoría masculina';
    }

    return null;
  }
}
