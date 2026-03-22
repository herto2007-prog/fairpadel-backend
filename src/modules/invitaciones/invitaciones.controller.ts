import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { InscripcionEstado } from '@prisma/client';

/**
 * Controlador para manejar invitaciones a jugadores no registrados
 * Ruta: /invitacion (URLs públicas para emails/SMS)
 */
@Controller('invitacion')
export class InvitacionesController {
  constructor(
    private prisma: PrismaService,
    private notificacionesService: NotificacionesService,
  ) {}

  /**
   * GET /invitacion/:token
   * Verificar validez de una invitación
   * Usado cuando el jugador2 abre el link del email/SMS
   */
  @Get(':token')
  async verificarInvitacion(@Param('token') token: string) {
    const invitacion = await this.prisma.invitacionJugador.findUnique({
      where: { token },
      include: {
        inscripcion: {
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
              select: {
                id: true,
                nombre: true,
                apellido: true,
                fotoUrl: true,
              },
            },
          },
        },
      },
    });

    if (!invitacion) {
      throw new NotFoundException('Invitación no encontrada');
    }

    // Verificar si expiró
    const ahora = new Date();
    const expirada = ahora > invitacion.expiraAt;
    const aceptada = invitacion.estado === 'ACEPTADA';
    const rechazada = invitacion.estado === 'RECHAZADA';

    if (expirada && invitacion.estado === 'PENDIENTE') {
      await this.prisma.invitacionJugador.update({
        where: { id: invitacion.id },
        data: { estado: 'EXPIRADA' },
      });
    }

    return {
      success: true,
      valida: !expirada && !aceptada && !rechazada,
      expirada,
      aceptada,
      rechazada,
      expiraAt: invitacion.expiraAt,
      invitacion: {
        id: invitacion.id,
        email: invitacion.email,
        torneo: invitacion.inscripcion.tournament,
        categoria: invitacion.inscripcion.category,
        invitadoPor: invitacion.inscripcion.jugador1,
      },
    };
  }

  /**
   * POST /invitacion/:token/registrar
   * Registrar nuevo usuario desde invitación
   * Esto vincula automáticamente la inscripción
   */
  @Post(':token/registrar')
  async registrarDesdeInvitacion(
    @Param('token') token: string,
    @Body() datosRegistro: {
      password: string;
      telefono?: string;
      fechaNacimiento?: string;
      ciudad?: string;
      genero: 'MASCULINO' | 'FEMENINO';
    },
  ) {
    const invitacion = await this.prisma.invitacionJugador.findUnique({
      where: { token },
      include: {
        inscripcion: {
          include: {
            tournament: true,
          },
        },
      },
    });

    if (!invitacion) {
      throw new NotFoundException('Invitación no encontrada');
    }

    if (invitacion.estado !== 'PENDIENTE') {
      throw new BadRequestException(`La invitación ya fue ${invitacion.estado.toLowerCase()}`);
    }

    if (new Date() > invitacion.expiraAt) {
      throw new BadRequestException('La invitación ha expirado');
    }

    // Extraer datos del jugador2 guardados en la inscripción
    const notas = JSON.parse(invitacion.inscripcion.notas || '{}');
    const datosPendientes = notas.jugador2Pendiente;

    if (!datosPendientes) {
      throw new BadRequestException('Datos de invitación incompletos');
    }

    // Verificar que no existe usuario con ese email o documento
    const existente = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: invitacion.email },
          { documento: datosPendientes.documento },
        ],
      },
    });

    if (existente) {
      throw new BadRequestException('Ya existe una cuenta con este email o documento');
    }

    // Crear usuario
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(datosRegistro.password, 10);

    const nuevoUsuario = await this.prisma.user.create({
      data: {
        email: invitacion.email,
        password: hashedPassword,
        nombre: datosPendientes.nombre,
        apellido: datosPendientes.apellido,
        documento: datosPendientes.documento,
        telefono: datosRegistro.telefono || datosPendientes.telefono,
        // FIX: fechaNacimiento es String YYYY-MM-DD
        fechaNacimiento: datosRegistro.fechaNacimiento || null,
        ciudad: datosRegistro.ciudad,
        genero: datosRegistro.genero,
        pais: 'Paraguay',
        estado: 'ACTIVO',
      },
    });

    // Actualizar invitación
    await this.prisma.invitacionJugador.update({
      where: { id: invitacion.id },
      data: {
        estado: 'ACEPTADA',
        respondedAt: new Date(),
      },
    });

    // Actualizar inscripción con el nuevo usuario como jugador2
    const inscripcionActualizada = await this.prisma.inscripcion.update({
      where: { id: invitacion.inscripcionId },
      data: {
        jugador2Id: nuevoUsuario.id,
        estado: InscripcionEstado.PENDIENTE_PAGO,
        notas: JSON.stringify({
          ...notas,
          jugador2Registrado: {
            userId: nuevoUsuario.id,
            fechaRegistro: new Date(),
          },
        }),
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

    // Notificar a jugador1
    await this.notificarRegistroExitoso(inscripcionActualizada);

    // Crear notificación de bienvenida para nuevo usuario
    await this.prisma.notificacion.create({
      data: {
        userId: nuevoUsuario.id,
        tipo: 'SISTEMA',
        titulo: '¡Bienvenido a FairPadel!',
        contenido: `Tu cuenta fue creada y ya estás inscrito en "${inscripcionActualizada.tournament.nombre}". Completa el pago para confirmar tu lugar.`,
        enlace: `/inscripciones/${inscripcionActualizada.id}`,
      },
    });

    return {
      success: true,
      message: 'Cuenta creada e inscripción confirmada exitosamente',
      usuario: {
        id: nuevoUsuario.id,
        email: nuevoUsuario.email,
        nombre: nuevoUsuario.nombre,
        apellido: nuevoUsuario.apellido,
      },
      inscripcion: {
        id: inscripcionActualizada.id,
        estado: inscripcionActualizada.estado,
        torneo: inscripcionActualizada.tournament,
        categoria: inscripcionActualizada.category,
      },
    };
  }

  private async notificarRegistroExitoso(inscripcion: any) {
    await this.prisma.notificacion.create({
      data: {
        userId: inscripcion.jugador1.id,
        tipo: 'INSCRIPCION',
        titulo: '¡Tu pareja se registró!',
        contenido: `${inscripcion.jugador2.nombre} ${inscripcion.jugador2.apellido} creó su cuenta y confirmó ser tu pareja en "${inscripcion.tournament.nombre}"`,
        enlace: `/inscripciones/${inscripcion.id}`,
      },
    });
  }
}
