import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Optional,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { EmailService } from '../../email/email.service';
import { ComisionService } from '../../common/services/comision.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User, InscripcionEstado, TournamentStatus, Gender } from '@prisma/client';
import { IsString, IsOptional, IsUUID, IsEmail, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// DTOs para el wizard de inscripción
class BuscarParejaDto {
  @IsString()
  @IsOptional()
  nombre?: string;

  @IsString()
  @IsOptional()
  apellido?: string;

  @IsString()
  @IsOptional()
  documento?: string;
}

class DatosJugador2NoRegistradoDto {
  @IsString()
  nombre: string;

  @IsString()
  apellido: string;

  @IsString()
  documento: string;

  @IsString()
  @IsOptional()
  telefono?: string;

  @IsEmail()
  email: string;
}

class CrearInscripcionPublicaDto {
  @IsUUID()
  tournamentId: string;

  @IsUUID()
  categoryId: string;

  @IsUUID()
  @IsOptional()
  jugador2Id?: string;

  @ValidateNested()
  @Type(() => DatosJugador2NoRegistradoDto)
  @IsOptional()
  jugador2NoRegistrado?: DatosJugador2NoRegistradoDto;

  @IsString()
  @IsOptional()
  modoPago?: 'COMPLETO' | 'INDIVIDUAL';

  @IsString()
  @IsOptional()
  notas?: string;
}

class ValidarCategoriaDto {
  @IsUUID()
  categoriaId: string;

  @IsEnum(Gender)
  jugadorGenero: Gender;

  @IsUUID()
  jugadorCategoriaId: string;
}

/**
 * Controlador PÚBLICO para inscripciones
 * Algunos endpoints requieren auth (wizard), otros son para aceptar invitaciones
 */
@Controller('inscripciones/public')
export class PublicInscripcionesController {
  constructor(
    private prisma: PrismaService,
    private notificacionesService: NotificacionesService,
    private emailService: EmailService,
    private comisionService: ComisionService,
  ) {}

  /**
   * GET /inscripciones/public/buscar-pareja
   * Buscar jugador2 por nombre, apellido o documento
   * Requiere autenticación
   */
  @Get('buscar-pareja')
  @UseGuards(JwtAuthGuard)
  async buscarPareja(
    @Query() query: BuscarParejaDto,
    @GetUser() user: User,
  ) {
    const { nombre, apellido, documento } = query;

    // Validar que al menos un filtro está presente
    if (!nombre && !apellido && !documento) {
      throw new BadRequestException('Debes proporcionar al menos un criterio de búsqueda');
    }

    // Construir where dinámico
    const where: any = {
      id: { not: user.id }, // Excluir al usuario actual
      estado: { in: ['ACTIVO', 'NO_VERIFICADO'] }, // Incluir usuarios activos y no verificados
    };

    // Si se proporciona documento explícitamente, buscar por documento
    if (documento) {
      where.documento = { contains: documento, mode: 'insensitive' };
    } else if (nombre) {
      // Detectar si el nombre parece un documento (solo números o números con guiones/puntos)
      const pareceDocumento = /^[\d\.\-]+$/.test(nombre.trim());
      
      if (pareceDocumento) {
        // Buscar por documento O nombre/apellido
        where.OR = [
          { documento: { contains: nombre, mode: 'insensitive' } },
          { nombre: { contains: nombre, mode: 'insensitive' } },
          { apellido: { contains: nombre, mode: 'insensitive' } },
        ];
      } else {
        // Búsqueda por nombre/apellido
        const OR: any[] = [];
        OR.push(
          { nombre: { contains: nombre, mode: 'insensitive' } },
          { apellido: { contains: nombre, mode: 'insensitive' } }
        );
        if (apellido) {
          OR.push(
            { nombre: { contains: apellido, mode: 'insensitive' } },
            { apellido: { contains: apellido, mode: 'insensitive' } }
          );
        }
        if (OR.length > 0) where.OR = OR;
      }
    } else if (apellido) {
      // Solo apellido proporcionado
      where.OR = [
        { nombre: { contains: apellido, mode: 'insensitive' } },
        { apellido: { contains: apellido, mode: 'insensitive' } }
      ];
    }

    const jugadores = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        nombre: true,
        apellido: true,
        documento: true,
        email: true,
        telefono: true,
        genero: true,
        fotoUrl: true,
        categoriaActual: {
          select: { id: true, nombre: true, tipo: true, orden: true },
        },
      },
      take: 10,
    });

    return {
      success: true,
      jugadores: jugadores.map((j) => ({
        id: j.id,
        nombre: j.nombre,
        apellido: j.apellido,
        documento: j.documento,
        email: j.email,
        telefono: j.telefono,
        genero: j.genero,
        fotoUrl: j.fotoUrl,
        categoria: j.categoriaActual,
      })),
    };
  }

  /**
   * POST /inscripciones/public/validar-categoria
   * Valida si un jugador puede inscribirse en una categoría específica
   * según las reglas de género y nivel
   */
  @Post('validar-categoria')
  @UseGuards(JwtAuthGuard)
  async validarCategoria(
    @Body() dto: ValidarCategoriaDto,
    @GetUser() user: User,
  ) {
    const { categoriaId, jugadorGenero, jugadorCategoriaId } = dto;

    // Obtener categorías del sistema
    const [categoriaTarget, categoriaJugador, todasCategorias] = await Promise.all([
      this.prisma.category.findUnique({ where: { id: categoriaId } }),
      this.prisma.category.findUnique({ where: { id: jugadorCategoriaId } }),
      this.prisma.category.findMany({ orderBy: { orden: 'asc' } }),
    ]);

    if (!categoriaTarget) {
      throw new NotFoundException('Categoría del torneo no encontrada');
    }

    if (!categoriaJugador) {
      throw new NotFoundException('Categoría del jugador no encontrada');
    }

    // Validar reglas
    const validacion = this.validarReglasCategoria(
      jugadorGenero,
      categoriaJugador,
      categoriaTarget,
      todasCategorias
    );

    return {
      success: true,
      permitido: validacion.permitido,
      mensaje: validacion.mensaje,
      esCategoriaInferior: validacion.esCategoriaInferior,
      advertencia: validacion.advertencia,
    };
  }

  /**
   * POST /inscripciones/public
   * Crear inscripción pública (wizard completo)
   * Casos:
   * 1. Jugador2 registrado: inscripción inmediata
   * 2. Jugador2 no registrado: crear invitación
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  async crearInscripcionPublica(
    @Body() dto: CrearInscripcionPublicaDto,
    @GetUser() user: User,
  ) {
    const { tournamentId, categoryId, jugador2Id, jugador2NoRegistrado, modoPago } = dto;

    // 1. Validar torneo existe y está abierto
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        categorias: {
          where: { categoryId },
          include: { category: true },
        },
        organizador: true,
      },
    });

    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (tournament.estado !== TournamentStatus.PUBLICADO) {
      throw new BadRequestException('El torneo no está abierto para inscripciones');
    }

    // Nota: Ya no validamos fecha límite. Las inscripciones se cierran manualmente
    // cuando el organizador cierra las categorías o realiza el sorteo.

    // 2. Validar categoría está en el torneo
    if (tournament.categorias.length === 0) {
      throw new BadRequestException('La categoría no está disponible para este torneo');
    }

    const tournamentCategory = tournament.categorias[0];
    if (!tournamentCategory.inscripcionAbierta) {
      throw new BadRequestException('Las inscripciones para esta categoría están cerradas');
    }

    // 3. Validar jugador1 no esté ya inscrito
    const inscripcionExistente = await this.prisma.inscripcion.findFirst({
      where: {
        tournamentId,
        OR: [{ jugador1Id: user.id }, { jugador2Id: user.id }],
        estado: { notIn: ['CANCELADA', 'RECHAZADA'] },
      },
    });

    if (inscripcionExistente) {
      throw new BadRequestException('Ya estás inscrito en este torneo');
    }

    // 4. Validar categoría según reglas de género/nivel
    const todasCategorias = await this.prisma.category.findMany({ orderBy: { orden: 'asc' } });
    const categoriaJugador = user.categoriaActualId
      ? todasCategorias.find((c) => c.id === user.categoriaActualId)
      : null;

    if (categoriaJugador) {
      const validacion = this.validarReglasCategoria(
        user.genero,
        categoriaJugador,
        tournamentCategory.category,
        todasCategorias
      );

      if (!validacion.permitido) {
        throw new ForbiddenException(validacion.mensaje);
      }
    }

    // 5. PROCESAR SEGÚN CASO
    let inscripcion;
    let requiereInvitacion = false;

    if (jugador2Id) {
      // CASO A: Jugador2 registrado
      const jugador2 = await this.prisma.user.findUnique({
        where: { id: jugador2Id },
      });

      if (!jugador2) {
        throw new NotFoundException('Jugador 2 no encontrado');
      }

      // Validar que jugador2 no esté ya inscrito
      const inscripcionJ2Existente = await this.prisma.inscripcion.findFirst({
        where: {
          tournamentId,
          OR: [{ jugador1Id: jugador2Id }, { jugador2Id: jugador2Id }],
          estado: { notIn: ['CANCELADA', 'RECHAZADA'] },
        },
      });

      if (inscripcionJ2Existente) {
        throw new BadRequestException('Tu pareja ya está inscrita en este torneo');
      }

      // Crear inscripción confirmada (ambos jugadores registrados)
      inscripcion = await this.prisma.inscripcion.create({
        data: {
          tournamentId,
          categoryId,
          jugador1Id: user.id,
          jugador2Id: jugador2.id,
          jugador2Documento: jugador2.documento,
          jugador2Email: jugador2.email,
          modoPago: modoPago || 'COMPLETO',
          estado: InscripcionEstado.CONFIRMADA,
        },
        include: {
          tournament: true,
          category: true,
          jugador1: {
            select: { id: true, nombre: true, apellido: true, email: true, telefono: true },
          },
          jugador2: {
            select: { id: true, nombre: true, apellido: true, email: true, telefono: true },
          },
        },
      });

      // Notificar a jugador2 que fue inscrito
      await this.notificarInscripcionPareja(inscripcion, user, jugador2);
      await this.comisionService.recalcularComision(tournamentId);

    } else if (jugador2NoRegistrado) {
      // CASO B: Jugador2 NO registrado - crear invitación
      requiereInvitacion = true;

      // Verificar si ya existe un usuario con ese email o documento
      const usuarioExistente = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: jugador2NoRegistrado.email },
            { documento: jugador2NoRegistrado.documento },
          ],
        },
      });

      if (usuarioExistente) {
        throw new BadRequestException(
          `Ya existe un usuario registrado con ${usuarioExistente.email === jugador2NoRegistrado.email ? 'ese email' : 'ese documento'}. Por favor, búscalo en la lista de jugadores.`
        );
      }

      // Crear inscripción pendiente (sin jugador2Id)
      inscripcion = await this.prisma.inscripcion.create({
        data: {
          tournamentId,
          categoryId,
          jugador1Id: user.id,
          jugador2Documento: jugador2NoRegistrado.documento,
          jugador2Email: jugador2NoRegistrado.email,
          modoPago: modoPago || 'COMPLETO',
          estado: InscripcionEstado.PENDIENTE_CONFIRMACION,
        },
        include: {
          tournament: true,
          category: true,
          jugador1: {
            select: { id: true, nombre: true, apellido: true, email: true, telefono: true },
          },
        },
      });

      // Crear invitación y enviar notificaciones
      await this.notificacionesService.notificarInvitacionJugador(
        inscripcion.id,
        jugador2NoRegistrado.nombre,
      );

      // Guardar datos del jugador2 no registrado para matchearlos después
      // (esto se podría guardar en una tabla separada o en metadata de la inscripción)
      await this.prisma.inscripcion.update({
        where: { id: inscripcion.id },
        data: {
          notas: JSON.stringify({
            jugador2Pendiente: {
              nombre: jugador2NoRegistrado.nombre,
              apellido: jugador2NoRegistrado.apellido,
              documento: jugador2NoRegistrado.documento,
              telefono: jugador2NoRegistrado.telefono,
              email: jugador2NoRegistrado.email,
            },
          }),
        },
      });

    } else {
      throw new BadRequestException('Debes seleccionar o crear un jugador 2');
    }

    // Notificar al jugador1 (quien realizó la inscripción) por email
    this.notificarInscripcionJugador1(inscripcion, user).catch(() => {
      // Silenciar errores de notificación - no fallar la inscripción
    });

    return {
      success: true,
      message: requiereInvitacion
        ? 'Inscripción creada. Tu pareja recibirá una invitación para registrarse.'
        : '¡Inscripción confirmada! Tu lugar está reservado.',
      inscripcion: {
        id: inscripcion.id,
        estado: inscripcion.estado,
        requiereInvitacion,
        tournament: {
          id: inscripcion.tournament.id,
          nombre: inscripcion.tournament.nombre,
          costoInscripcion: inscripcion.tournament.costoInscripcion,
        },
        category: inscripcion.category,
        jugador1: inscripcion.jugador1,
        jugador2: inscripcion.jugador2 || {
          nombre: jugador2NoRegistrado?.nombre,
          apellido: jugador2NoRegistrado?.apellido,
          email: jugador2NoRegistrado?.email,
          pendiente: true,
        },
      },
    };
  }

  /**
   * GET /inscripciones/public/pendientes
   * Obtener inscripciones pendientes del usuario logueado
   * (para mostrar invitaciones pendientes)
   */
  @Get('pendientes')
  @UseGuards(JwtAuthGuard)
  async getInscripcionesPendientes(@GetUser() user: User) {
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: {
        jugador2Id: user.id,
        estado: InscripcionEstado.PENDIENTE_CONFIRMACION,
      },
      include: {
        tournament: {
          select: {
            id: true,
            nombre: true,
            fechaInicio: true,
            ciudad: true,
            flyerUrl: true,
          },
        },
        category: true,
        jugador1: {
          select: { id: true, nombre: true, apellido: true, fotoUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      inscripciones: inscripciones.map((i) => ({
        id: i.id,
        tournament: i.tournament,
        category: i.category,
        invitadoPor: i.jugador1,
        createdAt: i.createdAt,
      })),
    };
  }

  /**
   * POST /inscripciones/public/:id/aceptar
   * Aceptar invitación a inscripción (como jugador2)
   */
  @Post(':id/aceptar')
  @UseGuards(JwtAuthGuard)
  async aceptarInvitacion(
    @Param('id') inscripcionId: string,
    @GetUser() user: User,
  ) {
    const inscripcion = await this.prisma.inscripcion.findUnique({
      where: { id: inscripcionId },
      include: {
        tournament: true,
      },
    });

    if (!inscripcion) {
      throw new NotFoundException('Inscripción no encontrada');
    }

    if (inscripcion.estado !== InscripcionEstado.PENDIENTE_CONFIRMACION) {
      throw new BadRequestException('Esta inscripción ya fue procesada');
    }

    // Verificar que el documento del usuario matchea con el documento esperado
    if (inscripcion.jugador2Documento !== user.documento) {
      throw new ForbiddenException('El documento no coincide con el registrado en la invitación');
    }

    // Actualizar inscripción con el jugador2 confirmado
    const inscripcionActualizada = await this.prisma.inscripcion.update({
      where: { id: inscripcionId },
      data: {
        jugador2Id: user.id,
        estado: InscripcionEstado.CONFIRMADA,
      },
      include: {
        tournament: true,
        category: true,
        jugador1: {
          select: { id: true, nombre: true, apellido: true, email: true },
        },
        jugador2: {
          select: { id: true, nombre: true, apellido: true, email: true },
        },
      },
    });

    // Notificar a jugador1 que su pareja aceptó
    await this.notificarAceptacionInvitacion(inscripcionActualizada);
    await this.comisionService.recalcularComision(inscripcionActualizada.tournamentId);

    return {
      success: true,
      message: 'Inscripción confirmada exitosamente',
      inscripcion: inscripcionActualizada,
    };
  }

  /**
   * POST /inscripciones/public/:id/rechazar
   * Rechazar invitación a inscripción
   */
  @Post(':id/rechazar')
  @UseGuards(JwtAuthGuard)
  async rechazarInvitacion(
    @Param('id') inscripcionId: string,
    @GetUser() user: User,
    @Body('motivo') motivo?: string,
  ) {
    const inscripcion = await this.prisma.inscripcion.findUnique({
      where: { id: inscripcionId },
    });

    if (!inscripcion) {
      throw new NotFoundException('Inscripción no encontrada');
    }

    if (inscripcion.estado !== InscripcionEstado.PENDIENTE_CONFIRMACION) {
      throw new BadRequestException('Esta inscripción ya fue procesada');
    }

    // Verificar que el documento del usuario matchea
    if (inscripcion.jugador2Documento !== user.documento) {
      throw new ForbiddenException('No tienes permiso para rechazar esta invitación');
    }

    // Cancelar inscripción
    await this.prisma.inscripcion.update({
      where: { id: inscripcionId },
      data: {
        estado: InscripcionEstado.CANCELADA,
        notas: motivo || 'Invitación rechazada por el jugador',
      },
    });

    // Notificar a jugador1 que su pareja rechazó
    await this.notificarRechazoInvitacion(inscripcion, user, motivo);

    return {
      success: true,
      message: 'Invitación rechazada',
    };
  }

  // ═══════════════════════════════════════════════════════════
  // MÉTODOS PRIVADOS
  // ═══════════════════════════════════════════════════════════

  /**
   * Valida las reglas de categoría según género y nivel
   */
  private validarReglasCategoria(
    jugadorGenero: Gender,
    categoriaJugador: any,
    categoriaTarget: any,
    todasCategorias: any[],
  ): { permitido: boolean; mensaje: string; esCategoriaInferior?: boolean; advertencia?: string } {
    const ordenJugador = categoriaJugador.orden;
    const ordenTarget = categoriaTarget.orden;
    const esTargetDamas = categoriaTarget.tipo === 'FEMENINO';
    const esTargetCaballeros = categoriaTarget.tipo === 'MASCULINO';

    // REGLA 1: Hombres NO pueden en categorías Damas
    if (jugadorGenero === 'MASCULINO' && esTargetDamas) {
      return {
        permitido: false,
        mensaje: 'Los jugadores masculinos no pueden inscribirse en categorías femeninas',
      };
    }

    // REGLA 2: Categoría igual o superior - permitida para todos
    if (ordenTarget <= ordenJugador) {
      return {
        permitido: true,
        mensaje: ordenTarget === ordenJugador
          ? 'Categoría de tu nivel'
          : 'Categoría superior - ¡Desafío aceptado!',
        esCategoriaInferior: false,
      };
    }

    // REGLA 3: Categorías INFERIORES (ordenTarget > ordenJugador)
    // Hombres: NO pueden bajar a inferiores (bajo ninguna circunstancia)
    if (jugadorGenero === 'MASCULINO') {
      return {
        permitido: false,
        mensaje: `No puedes inscribirte en ${categoriaTarget.nombre} siendo ${categoriaJugador.nombre}`,
        esCategoriaInferior: true,
      };
    }

    // Mujeres en categorías Damas (su género): NO pueden bajar
    if (esTargetDamas) {
      return {
        permitido: false,
        mensaje: `No puedes inscribirte en ${categoriaTarget.nombre} siendo ${categoriaJugador.nombre}`,
        esCategoriaInferior: true,
      };
    }

    // Mujeres en categorías Caballeros: SÍ pueden bajar UNA como excepción
    const diferencia = ordenTarget - ordenJugador;
    if (diferencia > 1) {
      return {
        permitido: false,
        mensaje: `Solo puedes bajar UNA categoría como máximo. ${categoriaTarget.nombre} es muy inferior a tu categoría actual.`,
        esCategoriaInferior: true,
      };
    }

    return {
      permitido: true,
      mensaje: 'Categoría permitida (excepción de una categoría inferior)',
      esCategoriaInferior: true,
      advertencia: 'Estás usando tu excepción de bajar una categoría en caballeros. Esta acción solo puede realizarse una vez.',
    };
  }

  private async notificarInscripcionPareja(inscripcion: any, jugador1: User, jugador2: User) {
    // Crear notificación en sistema para jugador2
    await this.prisma.notificacion.create({
      data: {
        userId: jugador2.id,
        tipo: 'INSCRIPCION',
        titulo: '¡Fuiste inscrito en un torneo!',
        contenido: `${jugador1.nombre} ${jugador1.apellido} te inscribió como pareja en "${inscripcion.tournament.nombre}"`,
        enlace: `/inscripciones/${inscripcion.id}`,
      },
    });

    // Aquí se agregaría el envío de email/SMS si están configurados
  }

  private async notificarAceptacionInvitacion(inscripcion: any) {
    await this.prisma.notificacion.create({
      data: {
        userId: inscripcion.jugador1.id,
        tipo: 'INSCRIPCION',
        titulo: '¡Tu pareja confirmó!',
        contenido: `${inscripcion.jugador2.nombre} ${inscripcion.jugador2.apellido} aceptó ser tu pareja en "${inscripcion.tournament.nombre}"`,
        enlace: `/inscripciones/${inscripcion.id}`,
      },
    });
  }

  private async notificarRechazoInvitacion(inscripcion: any, jugador2: User, motivo?: string) {
    await this.prisma.notificacion.create({
      data: {
        userId: inscripcion.jugador1Id,
        tipo: 'INSCRIPCION',
        titulo: 'Tu pareja rechazó la invitación',
        contenido: `${jugador2.nombre} ${jugador2.apellido} rechazó ser tu pareja en "${inscripcion.tournament.nombre}".${motivo ? ` Motivo: ${motivo}` : ''}`,
        enlace: `/inscripciones`,
      },
    });
  }

  private async notificarInscripcionJugador1(inscripcion: any, jugador1: User) {
    const estaConfirmada = inscripcion.estado === InscripcionEstado.CONFIRMADA;
    
    // Crear notificación en sistema
    await this.prisma.notificacion.create({
      data: {
        userId: jugador1.id,
        tipo: 'INSCRIPCION',
        titulo: estaConfirmada ? '¡Inscripción confirmada!' : '¡Inscripción realizada!',
        contenido: `Te inscribiste exitosamente en "${inscripcion.tournament.nombre}" - ${inscripcion.category.nombre}`,
        enlace: `/inscripciones/${inscripcion.id}`,
      },
    });

    // Enviar email según el estado
    try {
      if (estaConfirmada) {
        // Inscripción confirmada automáticamente (pareja registrada)
        await this.emailService.sendInscripcionConfirmada(
          jugador1.email,
          jugador1.nombre,
          inscripcion.tournament.nombre,
          inscripcion.category.nombre,
          inscripcion.tournament.fechaSorteo?.toString() || 'Por definir',
        );
      } else {
        // Inscripción pendiente (pareja no registrada)
        await this.emailService.sendInscripcionPendientePago(
          jugador1.email,
          jugador1.nombre,
          inscripcion.tournament.nombre,
          inscripcion.category.nombre,
          inscripcion.tournament.costoInscripcion?.toString() || '0',
        );
      }
    } catch (error) {
      // Silenciar error de email - no crítico
      console.log('Error enviando email de inscripción:', error);
    }
  }
}
