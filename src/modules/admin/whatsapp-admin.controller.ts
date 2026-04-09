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
import { ConfigService } from '@nestjs/config';
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
    private configService: ConfigService,
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

    // Guardar mensaje en la base de datos
    await this.prisma.whatsappMensaje.create({
      data: {
        conversationId,
        userId: conversacion.userId || null,
        waMessageId: messageId,
        direccion: 'SALIENTE',
        tipo: 'TEXT',
        contenido: mensaje,
        estado: 'ENVIADO',
        enviadoAt: new Date(),
      },
    });

    // Actualizar la fecha del último mensaje en la conversación
    await this.prisma.whatsappConversation.update({
      where: { id: conversationId },
      data: { 
        ultimoMensajeAt: new Date(),
        iniciadaPor: conversacion.iniciadaPor || 'SISTEMA',
      },
    });

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

  /**
   * Crear una plantilla de WhatsApp en Meta
   * Requiere ejemplos para todas las variables
   */
  @Post('templates')
  async crearTemplate(
    @Body() body: {
      nombre: string;
      categoria: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
      lenguaje?: string;
      contenido: string;
      variables?: string[];
      ejemplosVariables?: Record<string, string>;
      header?: { type: 'TEXT'; text: string };
      footer?: string;
      buttons?: any[];
    },
  ) {
    const {
      nombre,
      categoria,
      lenguaje = 'es',
      contenido,
      variables = [],
      ejemplosVariables = {},
      header,
      footer,
      buttons,
    } = body;

    if (!nombre || !contenido) {
      throw new BadRequestException('nombre y contenido son requeridos');
    }

    // Verificar que todas las variables tengan ejemplos
    const variablesSinEjemplo = variables.filter(v => !ejemplosVariables[v]);
    if (variablesSinEjemplo.length > 0) {
      throw new BadRequestException(
        `Las siguientes variables no tienen ejemplos: ${variablesSinEjemplo.join(', ')}`
      );
    }

    const accessToken = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN');
    const businessAccountId = this.configService.get<string>('WHATSAPP_BUSINESS_ACCOUNT_ID');
    const apiVersion = this.configService.get<string>('WHATSAPP_API_VERSION') || 'v17.0';

    if (!accessToken || !businessAccountId) {
      throw new BadRequestException('Faltan credenciales de WhatsApp Business API');
    }

    // Construir componentes
    const components: any[] = [];

    // Header (opcional)
    if (header?.type === 'TEXT' && header.text) {
      components.push({
        type: 'HEADER',
        format: 'TEXT',
        text: header.text,
      });
    }

    // Body con ejemplos
    const bodyComponent: any = {
      type: 'BODY',
      text: contenido,
    };

    // Agregar ejemplos si hay variables
    if (variables.length > 0) {
      const examples = variables.map(v => ejemplosVariables[v]);
      bodyComponent.example = {
        body_text: [examples],
      };
    }

    components.push(bodyComponent);

    // Footer (opcional)
    if (footer) {
      components.push({
        type: 'FOOTER',
        text: footer,
      });
    }

    // Buttons (opcional)
    if (buttons && buttons.length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons,
      });
    }

    // Payload para Meta API
    const payload = {
      name: nombre.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      category: categoria,
      language: lenguaje,
      components,
    };

    try {
      // Crear plantilla en Meta
      const response = await fetch(
        `https://graph.facebook.com/${apiVersion}/${businessAccountId}/message_templates`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new BadRequestException(
          `Error de Meta API: ${data.error?.message || JSON.stringify(data)}`
        );
      }

      // Guardar en nuestra base de datos
      const template = await this.prisma.whatsappTemplate.create({
        data: {
          nombre: payload.name,
          categoria: 'SISTEMA',
          lenguaje,
          contenido,
          variables,
          ejemplosVariables: ejemplosVariables as any,
          waTemplateId: data.id,
          waTemplateName: payload.name,
          aprobado: false, // Pendiente de aprobación de Meta
          activo: true,
          descripcion: `Template creado vía API - Estado: ${data.status}`,
        },
      });

      return {
        success: true,
        template: {
          id: template.id,
          nombre: template.nombre,
          waTemplateId: data.id,
          status: data.status,
        },
        metaResponse: data,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error creando template: ${error.message}`
      );
    }
  }

  /**
   * Listar plantillas desde Meta API
   */
  @Get('templates/meta')
  async listarTemplatesMeta() {
    const accessToken = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN');
    const businessAccountId = this.configService.get<string>('WHATSAPP_BUSINESS_ACCOUNT_ID');
    const apiVersion = this.configService.get<string>('WHATSAPP_API_VERSION') || 'v17.0';

    if (!accessToken || !businessAccountId) {
      throw new BadRequestException('Faltan credenciales de WhatsApp Business API');
    }

    try {
      const response = await fetch(
        `https://graph.facebook.com/${apiVersion}/${businessAccountId}/message_templates?limit=100`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new BadRequestException(
          `Error de Meta API: ${data.error?.message || JSON.stringify(data)}`
        );
      }

      return {
        success: true,
        templates: data.data || [],
        total: data.data?.length || 0,
      };
    } catch (error) {
      throw new BadRequestException(
        `Error listando templates: ${error.message}`
      );
    }
  }

  /**
   * Sincronizar estado de plantillas desde Meta
   */
  @Post('templates/sync')
  async sincronizarTemplates() {
    const accessToken = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN');
    const businessAccountId = this.configService.get<string>('WHATSAPP_BUSINESS_ACCOUNT_ID');
    const apiVersion = this.configService.get<string>('WHATSAPP_API_VERSION') || 'v17.0';

    if (!accessToken || !businessAccountId) {
      throw new BadRequestException('Faltan credenciales de WhatsApp Business API');
    }

    try {
      const response = await fetch(
        `https://graph.facebook.com/${apiVersion}/${businessAccountId}/message_templates?limit=100`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new BadRequestException(
          `Error de Meta API: ${data.error?.message || JSON.stringify(data)}`
        );
      }

      const templates = data.data || [];
      const resultados = {
        actualizados: 0,
        creados: 0,
        errores: [] as string[],
      };

      for (const metaTemplate of templates) {
        try {
          // Buscar si existe en nuestra BD
          const existing = await this.prisma.whatsappTemplate.findFirst({
            where: {
              OR: [
                { waTemplateId: metaTemplate.id },
                { waTemplateName: metaTemplate.name },
              ],
            },
          });

          const isApproved = metaTemplate.status === 'APPROVED';

          if (existing) {
            // Actualizar estado
            await this.prisma.whatsappTemplate.update({
              where: { id: existing.id },
              data: {
                aprobado: isApproved,
                waTemplateId: metaTemplate.id,
                descripcion: `Estado: ${metaTemplate.status}`,
              },
            });
            resultados.actualizados++;
          } else {
            // Crear nuevo
            await this.prisma.whatsappTemplate.create({
              data: {
                nombre: metaTemplate.name,
                categoria: 'SISTEMA',
                lenguaje: metaTemplate.language || 'es',
                contenido: metaTemplate.components?.find((c: any) => c.type === 'BODY')?.text || '',
                variables: [],
                waTemplateId: metaTemplate.id,
                waTemplateName: metaTemplate.name,
                aprobado: isApproved,
                activo: true,
                descripcion: `Template sincronizado desde Meta - Estado: ${metaTemplate.status}`,
              },
            });
            resultados.creados++;
          }
        } catch (err) {
          resultados.errores.push(`${metaTemplate.name}: ${err.message}`);
        }
      }

      return {
        success: true,
        resultados,
        totalMeta: templates.length,
      };
    } catch (error) {
      throw new BadRequestException(
        `Error sincronizando templates: ${error.message}`
      );
    }
  }
}
