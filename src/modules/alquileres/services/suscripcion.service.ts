import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { BancardService } from './bancard.service';

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
  private readonly PRECIO_MENSUAL_CENTAVOS = 1000; // 10.00 USD en centavos

  constructor(
    private prisma: PrismaService,
    private bancardService: BancardService,
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
    const montoCentavos = tipo === 'ANUAL' 
      ? this.PRECIO_MENSUAL_CENTAVOS * 12 * 0.9 // 10% descuento anual
      : this.PRECIO_MENSUAL_CENTAVOS;

    const montoFormateado = (montoCentavos / 100).toFixed(2);
    this.logger.log(`Monto calculado: ${montoCentavos} centavos -> ${montoFormateado} USD (tipo: ${tipo})`);

    // Calcular período
    const hoy = new Date();
    const meses = tipo === 'ANUAL' ? 12 : 1;
    const fechaHasta = new Date();
    fechaHasta.setMonth(fechaHasta.getMonth() + meses);

    // Crear registro de pago pendiente
    const pago = await this.prisma.alquilerPago.create({
      data: {
        sedeId: String(sedeId),
        sedeConfigId: String(config.id),
        monto: montoCentavos,
        moneda: 'USD',
        estado: 'PENDIENTE',
        metodo: 'BANCARD',
        periodoDesde: hoy,        // Date object
        periodoHasta: fechaHasta, // Date object
      },
    });

    // Usar el ID del pago como shop_process_id para Bancard
    // Bancard requiere un número, así que convertimos el UUID a un número único
    const shopProcessId = this.generarShopProcessId(pago.id);

    // Actualizar el pago con la referencia
    await this.prisma.alquilerPago.update({
      where: { id: pago.id },
      data: { referencia: shopProcessId.toString() },
    });

    // Iniciar pago en Bancard
    try {
      const bancardResponse = await this.bancardService.iniciarPago(
        shopProcessId,
        montoFormateado,
        'USD',
        `Suscripcion ${tipo} FairPadel`,
      );

      return {
        pagoId: pago.id,
        processId: bancardResponse.processId,
        monto: montoCentavos,
        montoFormateado: `$${montoFormateado} USD`,
        tipo,
        periodoDesde: hoy.toISOString().split('T')[0],
        periodoHasta: fechaHasta.toISOString().split('T')[0],
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

    if (aprobado) {
      // Actualizar pago como completado
      await this.prisma.alquilerPago.update({
        where: { id: pago.id },
        data: {
          estado: 'COMPLETADO',
          fechaPago: new Date(),
        },
      });

      // Activar suscripción
      await this.activarSuscripcion(pago.sedeId, pago.periodoHasta);

      this.logger.log(`Suscripción activada para sede ${pago.sedeId}`);
    } else {
      // Marcar como fallido
      await this.prisma.alquilerPago.update({
        where: { id: pago.id },
        data: { estado: 'FALLIDO' },
      });

      this.logger.warn(`Pago fallido: ${operation.response_description}`);
    }

    return {
      success: true,
      pagoId: pago.id,
      aprobado,
      mensaje: operation.response_description,
    };
  }

  /**
   * Activa la suscripción de una sede
   */
  private async activarSuscripcion(sedeId: string, venceEn: Date) {
    return this.prisma.alquilerConfig.update({
      where: { sedeId },
      data: {
        suscripcionActiva: true,
        suscripcionVenceEn: venceEn,
        habilitado: true,
      },
    });
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

    // Calcular días restantes
    const hoy = new Date();
    const vence = config.suscripcionVenceEn;
    const diasRestantes = Math.ceil(
      (vence.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
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
      venceEn: vence.toISOString().split('T')[0],
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
   * Genera un shop_process_id único numérico a partir del UUID del pago
   * Bancard requiere un número entero de máximo 15 dígitos
   */
  private generarShopProcessId(uuid: string): number {
    // Tomar solo los dígitos del UUID y convertir a número
    const digits = uuid.replace(/\D/g, '').substring(0, 15);
    // Asegurar que no exceda 15 dígitos y sea positivo
    return parseInt(digits.substring(0, 14) || '1', 10);
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
        monto: tipo === 'ANUAL' ? this.PRECIO_MENSUAL_CENTAVOS * 12 : this.PRECIO_MENSUAL_CENTAVOS,
        moneda: 'USD',
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
   * Cancela suscripción (no reembolsa, solo desactiva al vencer)
   */
  async cancelarSuscripcion(sedeId: string) {
    return this.prisma.alquilerConfig.update({
      where: { sedeId },
      data: { suscripcionActiva: false },
    });
  }
}
