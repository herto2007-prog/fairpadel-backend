import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppMessagingService } from '../whatsapp/services/whatsapp-messaging.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * Controller para administrar conversaciones de WhatsApp
 * Solo accesible por admins
 */
@Controller('admin/whatsapp')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class WhatsAppAdminController {
  constructor(
    private prisma: PrismaService,
    private messagingService: WhatsAppMessagingService,
  ) {}

  /**
   * Listar todas las conversaciones de WhatsApp
   * Incluye leads (sin userId) y usuarios registrados
   */
  @Get('conversaciones')
  async listarConversaciones(
    @Query('estado') estado?: string,
    @Query('categoria') categoria?: string,
    @Query('limit') limit: string = '50',
  ) {
    const where: any = {};
    
    if (estado) where.estado = estado;
    if (categoria) where.categoria = categoria;

    const conversaciones = await this.prisma.whatsappConversation.findMany({
      where,
      take: parseInt(limit),
      orderBy: { ultimoMensajeAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            telefono: true,
          },
        },
        _count: {
          select: { mensajes: true },
        },
      },
    });

    return {
      total: conversaciones.length,
      conversaciones: conversaciones.map(c => ({
        id: c.id,
        waId: c.waId,
        estado: c.estado,
        categoria: c.categoria,
        iniciadaPor: c.iniciadaPor,
        fechaInicio: c.fechaInicio,
        fechaExpiracion: c.fechaExpiracion,
        ultimoMensajeAt: c.ultimoMensajeAt,
        totalMensajes: c._count.mensajes,
        user: c.user,
        esLead: !c.userId, // true si no tiene usuario registrado
      })),
    };
  }

  /**
   * Ver mensajes de una conversación específica
   */
  @Get('conversaciones/:id/mensajes')
  async verMensajes(@Param('id') conversationId: string) {
    const conversacion = await this.prisma.whatsappConversation.findUnique({
      where: { id: conversationId },
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            telefono: true,
          },
        },
      },
    });

    if (!conversacion) {
      throw new BadRequestException('Conversación no encontrada');
    }

    const mensajes = await this.prisma.whatsappMensaje.findMany({
      where: { conversationId },
      orderBy: { enviadoAt: 'asc' },
    });

    return {
      conversacion: {
        id: conversacion.id,
        waId: conversacion.waId,
        estado: conversacion.estado,
        categoria: conversacion.categoria,
        user: conversacion.user,
        esLead: !conversacion.userId,
      },
      mensajes: mensajes.map(m => ({
        id: m.id,
        direccion: m.direccion, // ENTRANTE o SALIENTE
        tipo: m.tipo,
        contenido: m.contenido,
        estado: m.estado,
        errorMsg: m.errorMsg,
        enviadoAt: m.enviadoAt,
        esNuestro: m.direccion === 'SALIENTE',
      })),
    };
  }

  /**
   * Responder a una conversación de WhatsApp
   * Solo funciona dentro de la ventana de 24h (Customer Service Window)
   */
  @Post('responder')
  async responder(
    @Body() body: { conversationId: string; mensaje: string },
  ) {
    const { conversationId, mensaje } = body;

    if (!conversationId || !mensaje?.trim()) {
      throw new BadRequestException('conversationId y mensaje son requeridos');
    }

    // Buscar la conversación
    const conversacion = await this.prisma.whatsappConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversacion) {
      throw new BadRequestException('Conversación no encontrada');
    }

    // Verificar que estamos dentro de la ventana de 24h
    const ahora = new Date();
    const ultimoMensaje = conversacion.ultimoMensajeAt || conversacion.fechaInicio;
    const horasDesdeUltimoMensaje = (ahora.getTime() - new Date(ultimoMensaje).getTime()) / (1000 * 60 * 60);

    if (horasDesdeUltimoMensaje > 24) {
      throw new BadRequestException(
        'La ventana de 24 horas ha expirado. Solo puedes enviar templates aprobados.',
      );
    }

    // Enviar mensaje
    const messageId = await this.messagingService.sendTextMessage(
      conversacion.waId,
      mensaje,
      conversacion.userId || undefined,
    );

    if (!messageId) {
      throw new BadRequestException('No se pudo enviar el mensaje. Verifica que WHATSAPP_ENABLED=true.');
    }

    return {
      success: true,
      messageId,
      mensaje,
      destinatario: conversacion.waId,
    };
  }

  /**
   * Estadísticas de WhatsApp
   */
  @Get('estadisticas')
  async getEstadisticas() {
    const [
      totalConversaciones,
      conversacionesActivas,
      totalMensajes,
      mensajesEntrantes,
      mensajesSalientes,
      leads, // conversaciones sin userId
    ] = await Promise.all([
      this.prisma.whatsappConversation.count(),
      this.prisma.whatsappConversation.count({ where: { estado: 'ACTIVA' } }),
      this.prisma.whatsappMensaje.count(),
      this.prisma.whatsappMensaje.count({ where: { direccion: 'ENTRANTE' } }),
      this.prisma.whatsappMensaje.count({ where: { direccion: 'SALIENTE' } }),
      this.prisma.whatsappConversation.count({ where: { userId: null } }),
    ]);

    return {
      totalConversaciones,
      conversacionesActivas,
      totalMensajes,
      mensajesEntrantes,
      mensajesSalientes,
      leads,
      porcentajeLeads: totalConversaciones > 0 
        ? Math.round((leads / totalConversaciones) * 100) 
        : 0,
    };
  }
}
