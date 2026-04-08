import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { BancardService } from './bancard.service';
import { EmailService } from '../../../email/email.service';

interface CrearPagoDto {
  sedeId: string;
  monto: number; // en centavos (ej: 999 = 9.99 USD)
  moneda?: string;
  periodoDesde: string; // YYYY-MM-DD
  periodoHasta: string; // YYYY-MM-DD
  metodo?: string;
  referencia?: string;
}

@Injectable()
export class SuscripcionService {
  private readonly logger = new Logger(SuscripcionService.name);
  private readonly PRECIO_MENSUAL = 1000; // Gs. 1.000 por mes (precio simbólico para testing)

  constructor(
    private prisma: PrismaService,
    private bancardService: BancardService,
    private emailService: EmailService,
  ) {}

  /**
   * Inicia el proceso de pago de suscripción
   * Crea un registro de pago pendiente y obtiene process_id de Bancard
   */
  async iniciarPagoSuscripcion(
    sedeId: string,
    tipo: 'MENSUAL' | 'ANUAL' = 'MENSUAL',
  ) {
    // Buscar o crear configuración automáticamente
    let config = await this.prisma.alquilerConfig.findUnique({
      where: { sedeId },
    });

    // Si no existe config, crear una por defecto
    if (!config) {
      this.logger.log(`Creando configuración de alquiler automática para sede ${sedeId}`);
      config = await this.prisma.alquilerConfig.create({
        data: {
          sedeId,
          habilitado: false, // Se habilitará al pagar
          requiereAprobacion: true,
          duracionSlotMinutos: 90,
          anticipacionMaxDias: 14,
          cancelacionMinHoras: 4,
        },
      });
    }

    // Calcular monto según tipo
    const monto = tipo === 'ANUAL' 
      ? 10000 // Gs. 10.000 anual (precio simbólico - 10 meses por el precio de 10)
      : this.PRECIO_MENSUAL;

    const montoFormateado = monto.toFixed(2);
    this.logger.log(`Monto calculado: ${monto} -> ${montoFormateado} PYG (tipo: ${tipo})`);

    // Calcular período usando strings YYYY-MM-DD (evita problemas de zona horaria)
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0]; // YYYY-MM-DD
    
    const meses = tipo === 'ANUAL' ? 12 : 1;
    const fechaHasta = new Date();
    fechaHasta.setMonth(fechaHasta.getMonth() + meses);
    const fechaHastaStr = fechaHasta.toISOString().split('T')[0]; // YYYY-MM-DD

    // Crear registro de pago pendiente
    const pago = await this.prisma.alquilerPago.create({
      data: {
        sedeId: String(sedeId),
        sedeConfigId: String(config.id),
        monto: monto,
        moneda: 'PYG',
        estado: 'PENDIENTE',
        metodo: 'BANCARD',
        periodoDesde: hoyStr,        // String YYYY-MM-DD
        periodoHasta: fechaHastaStr, // String YYYY-MM-DD
      },
    });
    this.logger.log(`[DEBUG] Pago creado en BD: id=${pago.id}, estado=PENDIENTE, monto=${monto}`);

    // Generar shop_process_id único para Bancard
    // Bancard requiere un número de máximo 15 dígitos
    const shopProcessId = this.generarShopProcessId();

    // Actualizar el pago con la referencia
    await this.prisma.alquilerPago.update({
      where: { id: pago.id },
      data: { referencia: shopProcessId.toString() },
    });
    this.logger.log(`[DEBUG] Pago actualizado con referencia: ${shopProcessId}`);

    // Iniciar pago en Bancard
    try {
      const bancardResponse = await this.bancardService.iniciarPago(
        shopProcessId,
        montoFormateado,
        'PYG',
        `Suscripcion ${tipo} FairPadel`,
      );

      return {
        pagoId: pago.id,
        processId: bancardResponse.processId,
        monto: monto,
        montoFormateado: `Gs. ${monto.toLocaleString('es-PY')}`,
        tipo,
        periodoDesde: hoyStr,
        periodoHasta: fechaHastaStr,
      };
    } catch (error) {
      // Si falla Bancard, marcar pago como fallido
      await this.prisma.alquilerPago.update({
        where: { id: pago.id },
        data: { estado: 'FALLIDO' },
      });
      throw error;
    }
  }

  /**
   * Procesa la confirmación del webhook de Bancard
   * Activa la suscripción si el pago fue exitoso
   */
  async procesarConfirmacionPago(payload: {
    operation: {
      token: string;
      shop_process_id: number;
      response: string; // 'S' o 'N'
      response_details: string;
      amount: string;
      currency: string;
      authorization_number?: string;
      ticket_number?: string;
      response_code: string;
      response_description: string;
    };
  }) {
    const { operation } = payload;
    const shopProcessId = operation.shop_process_id.toString();

    this.logger.log(`Procesando confirmación Bancard: shop_process_id=${shopProcessId}`);

    // Buscar el pago por referencia
    const pago = await this.prisma.alquilerPago.findFirst({
      where: { referencia: shopProcessId },
      include: { sedeConfig: true },
    });

    if (!pago) {
      this.logger.error(`Pago no encontrado para shop_process_id: ${shopProcessId}`);
      throw new NotFoundException('Pago no encontrado');
    }

    // Verificar token de confirmación
    const tokenValido = this.bancardService.verificarTokenConfirmacion(
      operation.shop_process_id,
      operation.amount,
      operation.currency,
      operation.token,
    );

    if (!tokenValido) {
      this.logger.error(`Token inválido para pago ${pago.id}`);
      throw new BadRequestException('Token de confirmación inválido');
    }

    // Verificar si el pago fue aprobado
    const aprobado = operation.response === 'S' && operation.response_code === '00';
    this.logger.log(`[DEBUG] Verificación pago: response=${operation.response}, code=${operation.response_code}, aprobado=${aprobado}`);

    // Buscar info del dueño de la sede para enviar email
    const sedeInfo = await this.prisma.sede.findUnique({
      where: { id: pago.sedeId },
      include: {
        dueno: {
          select: { email: true, nombre: true, apellido: true },
        },
      },
    });

    const dueñoEmail = sedeInfo?.dueno?.email;
    const dueñoNombre = `${sedeInfo?.dueno?.nombre || ''} ${sedeInfo?.dueno?.apellido || ''}`.trim() || 'Usuario';
    const sedeNombre = sedeInfo?.nombre || 'Tu Sede';
    // Calcular si es anual o mensual basado en la diferencia de fechas
    const mesesDiferencia = this.calcularMesesDiferencia(String(pago.periodoDesde), String(pago.periodoHasta));
    const planNombre = mesesDiferencia >= 11 ? 'Anual' : 'Mensual';
    const monto = pago.monto / 100; // Convertir de centavos

    if (aprobado) {
      // Actualizar pago como completado
      const hoyPago = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      await this.prisma.alquilerPago.update({
        where: { id: pago.id },
        data: {
          estado: 'COMPLETADO',
          fechaPago: hoyPago,
        },
      });

      // Activar suscripción (periodoHasta es string YYYY-MM-DD)
      await this.activarSuscripcion(pago.sedeId, String(pago.periodoHasta));

      this.logger.log(`Suscripción activada para sede ${pago.sedeId}`);

      // Enviar email de confirmación (no bloqueante)
      if (dueñoEmail) {
        this.emailService.sendPagoExitoso(
          dueñoEmail,
          dueñoNombre,
          sedeNombre,
          planNombre,
          monto,
          pago.moneda,
          hoyPago.split('-').reverse().join('/'), // Formato DD/MM/YYYY
          String(pago.periodoHasta).split('-').reverse().join('/'),
        ).catch(err => this.logger.error('Error enviando email de pago exitoso:', err));
      }
    } else {
      // Marcar como fallido
      await this.prisma.alquilerPago.update({
        where: { id: pago.id },
        data: { estado: 'FALLIDO' },
      });

      this.logger.warn(`Pago fallido: ${operation.response_description}`);

      // Enviar email de error (no bloqueante)
      if (dueñoEmail) {
        this.emailService.sendPagoError(
          dueñoEmail,
          dueñoNombre,
          sedeNombre,
          planNombre,
          monto,
          pago.moneda,
          operation.response_description,
        ).catch(err => this.logger.error('Error enviando email de error:', err));
      }
    }

    return {
      success: true,
      pagoId: pago.id,
      aprobado,
      mensaje: operation.response_description,
    };
  }

  /**
   * Cancela la suscripción de una sede (por solicitud del usuario)
   */
  async cancelarSuscripcion(sedeId: string, userId: string): Promise<{
    success: boolean;
    mensaje: string;
    diasRestantes: number;
  }> {
    this.logger.log(`[DEBUG] Cancelando suscripción para sede ${sedeId} por usuario ${userId}`);
    
    // Verificar que la sede existe y pertenece al usuario
    const sede = await this.prisma.sede.findUnique({
      where: { id: sedeId },
      include: {
        dueno: {
          select: { id: true, email: true, nombre: true, apellido: true },
        },
      },
    });

    if (!sede) {
      throw new NotFoundException('Sede no encontrada');
    }

    if (sede.duenoId !== userId) {
      throw new BadRequestException('No eres el dueño de esta sede');
    }

    // Verificar estado actual de la suscripción
    const config = await this.prisma.alquilerConfig.findUnique({
      where: { sedeId },
    });

    if (!config?.suscripcionActiva) {
      return {
        success: false,
        mensaje: 'La sede no tiene una suscripción activa',
        diasRestantes: 0,
      };
    }

    // Calcular días restantes
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0];
    const venceStr = String(config.suscripcionVenceEn);
    const hoyDate = new Date(hoyStr + 'T00:00:00');
    const venceDate = new Date(venceStr + 'T00:00:00');
    const diasRestantes = Math.ceil(
      (venceDate.getTime() - hoyDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Desactivar suscripción
    await this.prisma.alquilerConfig.update({
      where: { sedeId },
      data: {
        suscripcionActiva: false,
        habilitado: false,
      },
    });

    this.logger.log(`[DEBUG] Suscripción cancelada: sedeId=${sedeId}, diasRestantes=${diasRestantes}`);

    // Enviar email de confirmación de cancelación
    if (sede.dueno?.email) {
      const dueñoNombre = `${sede.dueno.nombre || ''} ${sede.dueno.apellido || ''}`.trim() || 'Usuario';
      this.emailService.sendSuscripcionCancelada(
        sede.dueno.email,
        dueñoNombre,
        sede.nombre,
        diasRestantes,
        config.suscripcionVenceEn?.split('-').reverse().join('/'),
      ).catch(err => this.logger.error('Error enviando email de cancelación:', err));
    }

    return {
      success: true,
      mensaje: 'Suscripción cancelada exitosamente',
      diasRestantes: diasRestantes > 0 ? diasRestantes : 0,
    };
  }

  /**
   * Activa la suscripción de una sede
   */
  private async activarSuscripcion(sedeId: string, venceEn: string) {
    this.logger.log(`[DEBUG] Activando suscripción para sede ${sedeId}, venceEn: ${venceEn}`);
    const result = await this.prisma.alquilerConfig.update({
      where: { sedeId },
      data: {
        suscripcionActiva: true,
        suscripcionVenceEn: venceEn, // String YYYY-MM-DD
        habilitado: true,
      },
    });
    this.logger.log(`[DEBUG] Suscripción activada: sedeId=${sedeId}, suscripcionActiva=${result.suscripcionActiva}`);
    return result;
  }

  /**
   * Verifica si una sede tiene suscripción activa
   */
  async verificarSuscripcion(sedeId: string): Promise<{
    activa: boolean;
    venceEn?: string;
    diasRestantes: number;
  }> {
    const config = await this.prisma.alquilerConfig.findUnique({
      where: { sedeId },
      select: {
        suscripcionActiva: true,
        suscripcionVenceEn: true,
      },
    });

    if (!config || !config.suscripcionActiva || !config.suscripcionVenceEn) {
      return { activa: false, diasRestantes: 0 };
    }

    // Calcular días restantes usando strings YYYY-MM-DD
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0]; // YYYY-MM-DD
    const venceStr = String(config.suscripcionVenceEn); // String YYYY-MM-DD
    
    const hoyDate = new Date(hoyStr + 'T00:00:00');
    const venceDate = new Date(venceStr + 'T00:00:00');
    const diasRestantes = Math.ceil(
      (venceDate.getTime() - hoyDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Si ya venció, desactivar automáticamente
    if (diasRestantes < 0) {
      await this.prisma.alquilerConfig.update({
        where: { sedeId },
        data: { suscripcionActiva: false },
      });
      return { activa: false, diasRestantes: 0 };
    }

    return {
      activa: true,
      venceEn: venceStr,
      diasRestantes,
    };
  }

  /**
   * Alias para verificarSuscripcion - usado por el guard
   */
  async verificarSuscripcionActiva(sedeId: string): Promise<boolean> {
    const result = await this.verificarSuscripcion(sedeId);
    return result.activa;
  }

  /**
   * Obtiene la configuración de suscripción de una sede
   */
  async obtenerConfig(sedeId: string) {
    return this.prisma.alquilerConfig.findUnique({
      where: { sedeId },
      select: {
        suscripcionActiva: true,
        suscripcionVenceEn: true,
        tipoSuscripcion: true,
        habilitado: true,
      },
    });
  }

  /**
   * Obtiene historial de pagos de una sede
   */
  async obtenerHistorialPagos(sedeId: string) {
    return this.prisma.alquilerPago.findMany({
      where: { sedeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Obtiene un pago por su ID
   */
  async obtenerPagoPorId(pagoId: string) {
    return this.prisma.alquilerPago.findUnique({
      where: { id: pagoId },
    });
  }

  /**
   * Obtiene un pago por su referencia (shop_process_id)
   */
  async obtenerPagoPorReferencia(referencia: string) {
    return this.prisma.alquilerPago.findFirst({
      where: { referencia },
    });
  }

  /**
   * Completa un pago manualmente (usado cuando el webhook falla)
   */
  async completarPagoManual(pagoId: string) {
    const hoy = new Date().toISOString().split('T')[0];
    
    const pago = await this.prisma.alquilerPago.update({
      where: { id: pagoId },
      data: {
        estado: 'COMPLETADO',
        fechaPago: hoy,
      },
    });

    // Activar la suscripción
    await this.activarSuscripcion(pago.sedeId, String(pago.periodoHasta));

    return pago;
  }

  /**
   * Genera un shop_process_id único numérico
   * Bancard requiere un número entero de máximo 15 dígitos
   * 
   * Usamos timestamp (13 dígitos) + 2 dígitos aleatorios para garantizar unicidad
   * Ejemplo: 1712415600000 + 42 = 1712415600042 (13 dígitos)
   */
  private generarShopProcessId(): number {
    const timestamp = Date.now(); // 13 dígitos
    const random = Math.floor(Math.random() * 100); // 0-99
    // Combinar: timestamp * 100 + random = máximo 15 dígitos
    const shopProcessId = timestamp * 100 + random;
    
    this.logger.log(`[DEBUG] ShopProcessId generado: ${shopProcessId} (timestamp: ${timestamp}, random: ${random})`);
    
    return shopProcessId;
  }

  /**
   * Para testing/demo: Activa suscripción sin pasar por Bancard
   */
  async activarSuscripcionManual(
    sedeId: string,
    tipo: 'MENSUAL' | 'ANUAL' = 'MENSUAL',
  ) {
    const config = await this.prisma.alquilerConfig.findUnique({
      where: { sedeId },
    });

    if (!config) {
      throw new NotFoundException('Configuración no encontrada');
    }

    // Calcular fecha de vencimiento
    const hoy = new Date();
    const meses = tipo === 'ANUAL' ? 12 : 1;
    const venceEn = new Date(hoy.getFullYear(), hoy.getMonth() + meses, hoy.getDate())
      .toISOString()
      .split('T')[0];

    // Crear pago de prueba
    await this.prisma.alquilerPago.create({
      data: {
        sedeId,
        sedeConfigId: config.id,
        monto: tipo === 'ANUAL' ? 10000 : this.PRECIO_MENSUAL,
        moneda: 'PYG',
        estado: 'COMPLETADO',
        metodo: 'MANUAL',
        fechaPago: new Date().toISOString().split('T')[0],
        periodoDesde: new Date().toISOString().split('T')[0],
        periodoHasta: venceEn,
      },
    });

    return this.prisma.alquilerConfig.update({
      where: { sedeId },
      data: {
        suscripcionActiva: true,
        suscripcionVenceEn: venceEn,
        tipoSuscripcion: tipo,
        habilitado: true,
      },
    });
  }

  /**
   * Desactiva suscripción inmediatamente (uso interno/admin)
   */
  async desactivarSuscripcion(sedeId: string) {
    return this.prisma.alquilerConfig.update({
      where: { sedeId },
      data: { suscripcionActiva: false },
    });
  }

  /**
   * Cancela un pago (marca como FALLIDO)
   * Usado después de un rollback exitoso en Bancard
   */
  async cancelarPago(pagoId: string) {
    return this.prisma.alquilerPago.update({
      where: { id: pagoId },
      data: { estado: 'FALLIDO' },
    });
  }

  /**
   * Obtiene TODOS los pagos pendientes (de todas las sedes)
   * Usado para debug de webhooks
   */
  async obtenerTodosPagosPendientes() {
    return this.prisma.alquilerPago.findMany({
      where: { estado: 'PENDIENTE' },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limitar a los últimos 50 para no sobrecargar
    });
  }

  /**
   * Helper: Calcula la diferencia en meses entre dos fechas (YYYY-MM-DD)
   */
  private calcularMesesDiferencia(desde: string, hasta: string): number {
    const [yearDesde, monthDesde] = desde.split('-').map(Number);
    const [yearHasta, monthHasta] = hasta.split('-').map(Number);
    return (yearHasta - yearDesde) * 12 + (monthHasta - monthDesde);
  }
}
