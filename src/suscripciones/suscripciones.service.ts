import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSuscripcionDto } from './dto';
import { BancardService } from '../pagos/bancard.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

// Grace period: 3 days after expiration before removing premium
const GRACE_PERIOD_DAYS = 3;

@Injectable()
export class SuscripcionesService {
  private readonly logger = new Logger(SuscripcionesService.name);

  constructor(
    private prisma: PrismaService,
    private bancardService: BancardService,
    private notificacionesService: NotificacionesService,
  ) {}

  // ═══════════════════════════════════════════════════════
  // PLANES
  // ═══════════════════════════════════════════════════════

  async obtenerPlanes() {
    return this.prisma.planPremium.findMany({
      where: { activo: true },
      orderBy: { precioMensual: 'asc' },
    });
  }

  // ═══════════════════════════════════════════════════════
  // CREAR SUSCRIPCION
  // ═══════════════════════════════════════════════════════

  async crearSuscripcion(dto: CreateSuscripcionDto, userId: string) {
    const { planId, cuponCodigo } = dto;

    const plan = await this.prisma.planPremium.findUnique({
      where: { id: planId },
    });
    if (!plan) {
      throw new NotFoundException('Plan no encontrado');
    }

    // Verificar que no tiene suscripción activa
    const suscripcionActiva = await this.prisma.suscripcion.findFirst({
      where: { userId, estado: 'ACTIVA' },
    });
    if (suscripcionActiva) {
      throw new BadRequestException('Ya tienes una suscripción activa');
    }

    // Verificar que no tiene suscripción pendiente de pago
    const pendiente = await this.prisma.suscripcion.findFirst({
      where: { userId, estado: 'PENDIENTE_PAGO' },
    });
    if (pendiente) {
      // Limpiar suscripción pendiente antigua (> 1 hora)
      const unaHoraAtras = new Date(Date.now() - 60 * 60 * 1000);
      if (pendiente.createdAt < unaHoraAtras) {
        await this.prisma.suscripcion.update({
          where: { id: pendiente.id },
          data: { estado: 'CANCELADA' },
        });
      } else {
        throw new BadRequestException('Ya tienes un pago pendiente. Complétalo o espera unos minutos.');
      }
    }

    // Precio mensual
    let precio = plan.precioMensual.toNumber();

    // Aplicar cupón
    let cuponId: string | null = null;
    if (cuponCodigo) {
      const resultado = await this.validarCupon(cuponCodigo);
      if (resultado.valido && resultado.cupon) {
        precio = this.aplicarDescuento(precio, resultado.cupon);
        cuponId = resultado.cupon.id;
      }
    }

    // Calcular fechas (siempre mensual)
    const fechaInicio = new Date();
    const fechaFin = new Date();
    fechaFin.setMonth(fechaFin.getMonth() + 1);

    // Crear suscripción
    const suscripcion = await this.prisma.suscripcion.create({
      data: {
        userId,
        planId,
        periodo: 'MENSUAL',
        precio,
        estado: 'PENDIENTE_PAGO',
        fechaInicio,
        fechaFin,
        fechaRenovacion: fechaFin,
        cuponAplicado: cuponCodigo || null,
      },
    });

    // Incrementar usos del cupón
    if (cuponId) {
      await this.prisma.cupon.update({
        where: { id: cuponId },
        data: { usosActuales: { increment: 1 } },
      });
    }

    // Generar checkout de Bancard
    const transactionId = `SUB-${Date.now()}-${suscripcion.id.substring(0, 8)}`;

    let checkoutUrl: string | null = null;
    try {
      checkoutUrl = await this.bancardService.createCheckout({
        transactionId,
        amount: precio,
        description: `FairPadel Premium - Mensual`,
        returnUrl: `${process.env.FRONTEND_URL}/suscripcion/confirmacion?suscripcionId=${suscripcion.id}&transactionId=${transactionId}`,
        cancelUrl: `${process.env.FRONTEND_URL}/suscripcion/cancelado?suscripcionId=${suscripcion.id}`,
      });
    } catch {
      // Bancard not configured — allow manual confirmation
    }

    return {
      suscripcion,
      checkoutUrl,
      transactionId,
    };
  }

  // ═══════════════════════════════════════════════════════
  // CONSULTAS
  // ═══════════════════════════════════════════════════════

  async obtenerSuscripcionActiva(userId: string) {
    return this.prisma.suscripcion.findFirst({
      where: { userId, estado: 'ACTIVA' },
      include: { plan: true },
    });
  }

  async obtenerHistorialSuscripciones(userId: string) {
    return this.prisma.suscripcion.findMany({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  // ═══════════════════════════════════════════════════════
  // CANCELAR / REACTIVAR
  // ═══════════════════════════════════════════════════════

  async cancelarSuscripcion(userId: string) {
    const suscripcion = await this.obtenerSuscripcionActiva(userId);
    if (!suscripcion) {
      throw new NotFoundException('No tienes una suscripción activa');
    }

    await this.prisma.suscripcion.update({
      where: { id: suscripcion.id },
      data: { autoRenovar: false },
    });

    return {
      message: 'Suscripción cancelada. Mantendrás acceso premium hasta ' +
        suscripcion.fechaFin.toLocaleDateString('es-PY'),
      fechaFin: suscripcion.fechaFin,
    };
  }

  async reactivarSuscripcion(userId: string) {
    const suscripcion = await this.prisma.suscripcion.findFirst({
      where: { userId, estado: 'ACTIVA', autoRenovar: false },
    });
    if (!suscripcion) {
      throw new NotFoundException('No tienes una suscripción pendiente de cancelación');
    }

    await this.prisma.suscripcion.update({
      where: { id: suscripcion.id },
      data: { autoRenovar: true },
    });

    return { message: 'Renovación automática reactivada' };
  }

  // ═══════════════════════════════════════════════════════
  // CONFIRMAR PAGO
  // ═══════════════════════════════════════════════════════

  async confirmarPagoSuscripcion(suscripcionId: string, transactionId?: string) {
    const suscripcion = await this.prisma.suscripcion.findUnique({
      where: { id: suscripcionId },
    });
    if (!suscripcion) {
      throw new NotFoundException('Suscripción no encontrada');
    }

    if (suscripcion.estado === 'ACTIVA') {
      return { message: 'Suscripción ya está activa', suscripcion };
    }

    if (suscripcion.estado !== 'PENDIENTE_PAGO') {
      throw new BadRequestException('Esta suscripción no está pendiente de pago');
    }

    // Verificar pago con Bancard (si hay transactionId)
    if (transactionId) {
      try {
        const verificacion = await this.bancardService.verifyPayment(transactionId);
        if (verificacion.status !== 'success') {
          throw new BadRequestException('El pago no fue confirmado por la pasarela');
        }
      } catch (e) {
        if (e instanceof BadRequestException) throw e;
        this.logger.warn(`Bancard verification failed for ${transactionId}: ${e.message}`);
        // Continue — allow manual confirmation if Bancard is not configured
      }
    }

    // Activar suscripción
    const updated = await this.prisma.suscripcion.update({
      where: { id: suscripcionId },
      data: {
        estado: 'ACTIVA',
        metodoPagoId: transactionId || null,
      },
      include: { plan: true },
    });

    // Marcar usuario como premium
    await this.prisma.user.update({
      where: { id: suscripcion.userId },
      data: { esPremium: true },
    });

    // Notificar al usuario
    try {
      await this.notificacionesService.notificar({
        userId: suscripcion.userId,
        tipo: 'PAGO',
        titulo: 'Premium activado!',
        contenido: 'Tu suscripción Premium está activa. Disfruta de todos los beneficios.',
        enlace: '/premium',
      });
    } catch {
      // non-critical
    }

    return { message: 'Suscripción activada exitosamente', suscripcion: updated };
  }

  // ═══════════════════════════════════════════════════════
  // WEBHOOK (Bancard callback)
  // ═══════════════════════════════════════════════════════

  async procesarWebhookPago(webhookData: any) {
    const { operation } = webhookData;
    if (!operation?.shop_process_id) {
      this.logger.warn('Webhook sin shop_process_id');
      return { status: 'ignored' };
    }

    const transactionId = operation.shop_process_id;

    // Validate webhook signature
    if (!this.bancardService.validateWebhook(webhookData)) {
      this.logger.warn(`Webhook signature inválida para ${transactionId}`);
      return { status: 'invalid_signature' };
    }

    // Find subscription by transaction ID (stored in metodoPagoId or from SUB- prefix)
    if (!transactionId.startsWith('SUB-')) {
      return { status: 'not_subscription' };
    }

    // Extract suscripcion ID from transactionId: SUB-{timestamp}-{suscripcionId8chars}
    const suscripcionIdPrefix = transactionId.split('-').pop();
    const suscripcion = await this.prisma.suscripcion.findFirst({
      where: {
        id: { startsWith: suscripcionIdPrefix },
        estado: 'PENDIENTE_PAGO',
      },
    });

    if (!suscripcion) {
      this.logger.warn(`Webhook: suscripción no encontrada para ${transactionId}`);
      return { status: 'subscription_not_found' };
    }

    // Confirm payment
    await this.confirmarPagoSuscripcion(suscripcion.id, transactionId);

    return { status: 'confirmed', suscripcionId: suscripcion.id };
  }

  // ═══════════════════════════════════════════════════════
  // CUPONES
  // ═══════════════════════════════════════════════════════

  async validarCupon(codigo: string) {
    const cupon = await this.prisma.cupon.findUnique({
      where: { codigo },
    });

    if (!cupon) {
      return { valido: false, mensaje: 'Cupón no encontrado' };
    }

    const ahora = new Date();
    if (ahora < cupon.fechaInicio || ahora > cupon.fechaExpiracion) {
      return { valido: false, mensaje: 'Cupón expirado' };
    }
    if (cupon.usosActuales >= cupon.limiteUsos) {
      return { valido: false, mensaje: 'Cupón agotado' };
    }
    if (cupon.estado !== 'ACTIVO') {
      return { valido: false, mensaje: 'Cupón inactivo' };
    }

    return { valido: true, cupon, mensaje: 'Cupón válido' };
  }

  private aplicarDescuento(precio: number, cupon: any): number {
    if (cupon.tipo === 'PORCENTAJE') {
      const descuento = (precio * cupon.valor.toNumber()) / 100;
      return Math.max(0, precio - descuento);
    } else {
      return Math.max(0, precio - cupon.valor.toNumber());
    }
  }

  // ═══════════════════════════════════════════════════════
  // CRON JOBS — Renovación y vencimiento automático
  // ═══════════════════════════════════════════════════════

  /**
   * Corre cada día a las 2:00 AM.
   * 1. Notifica suscripciones que vencen en 3 días
   * 2. Notifica suscripciones que vencen hoy
   * 3. Procesa suscripciones vencidas (grace period de 3 días)
   * 4. Limpia suscripciones PENDIENTE_PAGO abandonadas (> 24h)
   */
  @Cron('0 2 * * *')
  async handleSubscriptionCron() {
    this.logger.log('Ejecutando cron de suscripciones...');

    try {
      await this.notificarProximoVencimiento();
      await this.procesarSuscripcionesVencidas();
      await this.limpiarPendientesAbandonados();
    } catch (e) {
      this.logger.error(`Cron de suscripciones falló: ${e.message}`);
    }
  }

  /**
   * Notifica a usuarios cuya suscripción vence en 3 días o hoy.
   */
  private async notificarProximoVencimiento() {
    const ahora = new Date();

    // Vence en 3 días
    const en3Dias = new Date(ahora);
    en3Dias.setDate(en3Dias.getDate() + 3);
    const inicioDelDia3 = new Date(en3Dias.getFullYear(), en3Dias.getMonth(), en3Dias.getDate());
    const finDelDia3 = new Date(inicioDelDia3);
    finDelDia3.setDate(finDelDia3.getDate() + 1);

    const vencenEn3Dias = await this.prisma.suscripcion.findMany({
      where: {
        estado: 'ACTIVA',
        fechaFin: { gte: inicioDelDia3, lt: finDelDia3 },
      },
      include: { user: true },
    });

    for (const sub of vencenEn3Dias) {
      try {
        await this.notificacionesService.notificar({
          userId: sub.userId,
          tipo: 'PAGO',
          titulo: 'Tu Premium vence pronto',
          contenido: sub.autoRenovar
            ? `Tu suscripción se renovará automáticamente el ${sub.fechaFin.toLocaleDateString('es-PY')}.`
            : `Tu suscripción vence el ${sub.fechaFin.toLocaleDateString('es-PY')}. Reactiva la renovación para no perder tus beneficios.`,
          enlace: '/premium',
        });
      } catch {
        // non-critical
      }
    }

    // Vence hoy
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const finHoy = new Date(inicioHoy);
    finHoy.setDate(finHoy.getDate() + 1);

    const vencenHoy = await this.prisma.suscripcion.findMany({
      where: {
        estado: 'ACTIVA',
        fechaFin: { gte: inicioHoy, lt: finHoy },
      },
    });

    for (const sub of vencenHoy) {
      try {
        await this.notificacionesService.notificar({
          userId: sub.userId,
          tipo: 'PAGO',
          titulo: 'Tu Premium vence hoy',
          contenido: sub.autoRenovar
            ? 'Tu suscripción se renueva hoy automáticamente.'
            : 'Tu suscripción Premium vence hoy. Después del período de gracia (3 días) perderás los beneficios.',
          enlace: '/premium',
        });
      } catch {
        // non-critical
      }
    }

    if (vencenEn3Dias.length > 0 || vencenHoy.length > 0) {
      this.logger.log(`Notificaciones de vencimiento: ${vencenEn3Dias.length} en 3 días, ${vencenHoy.length} hoy`);
    }
  }

  /**
   * Procesa suscripciones vencidas:
   * - Si autoRenovar=true: intenta cobrar con Bancard. Si falla, espera grace period.
   * - Si autoRenovar=false: espera grace period y luego expira.
   * - Grace period = 3 días después de fechaFin.
   */
  private async procesarSuscripcionesVencidas() {
    const ahora = new Date();

    // Suscripciones con fechaFin pasada que siguen ACTIVA
    const suscripcionesVencidas = await this.prisma.suscripcion.findMany({
      where: {
        estado: 'ACTIVA',
        fechaFin: { lt: ahora },
      },
      include: { plan: true, user: true },
    });

    for (const sub of suscripcionesVencidas) {
      const diasDesdeFin = Math.floor(
        (ahora.getTime() - sub.fechaFin.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (sub.autoRenovar) {
        // Intentar cobrar automáticamente
        const renovada = await this.intentarRenovacion(sub);
        if (renovada) continue;

        // Si no se pudo cobrar, verificar grace period
        if (diasDesdeFin >= GRACE_PERIOD_DAYS) {
          await this.expirarSuscripcion(sub.id, sub.userId);
          this.logger.log(`Suscripción ${sub.id} expirada (fallo de cobro + grace period)`);
        } else {
          // Aún en grace period — notificar
          try {
            await this.notificacionesService.notificar({
              userId: sub.userId,
              tipo: 'PAGO',
              titulo: 'Problema con tu renovación',
              contenido: `No pudimos procesar tu pago. Tienes ${GRACE_PERIOD_DAYS - diasDesdeFin} día(s) para actualizar tu método de pago.`,
              enlace: '/premium',
            });
          } catch {
            // non-critical
          }
        }
      } else {
        // No autoRenovar — grace period y luego expirar
        if (diasDesdeFin >= GRACE_PERIOD_DAYS) {
          await this.expirarSuscripcion(sub.id, sub.userId);
          this.logger.log(`Suscripción ${sub.id} expirada (cancelada por usuario + grace period)`);
        }
        // Si aún está en grace period, mantener ACTIVA para que disfrute los últimos días
      }
    }
  }

  /**
   * Intenta renovar una suscripción cobrando al usuario.
   * Retorna true si se renovó exitosamente.
   */
  private async intentarRenovacion(suscripcion: any): Promise<boolean> {
    try {
      // Intentar cobro con Bancard
      const transactionId = `REN-${Date.now()}-${suscripcion.id.substring(0, 8)}`;
      const precio = suscripcion.plan.precioMensual.toNumber();

      // TODO: Cuando Bancard tenga cobro recurrente real, usar:
      // const resultado = await this.bancardService.chargeRecurring(suscripcion.metodoPagoId, precio);
      // Por ahora, simulamos el intento de cobro
      const resultado = await this.bancardService.verifyPayment(transactionId);

      if (resultado.status === 'success') {
        // Extender suscripción por 1 mes
        const nuevaFechaFin = new Date(suscripcion.fechaFin);
        nuevaFechaFin.setMonth(nuevaFechaFin.getMonth() + 1);

        await this.prisma.suscripcion.update({
          where: { id: suscripcion.id },
          data: {
            fechaFin: nuevaFechaFin,
            fechaRenovacion: nuevaFechaFin,
            metodoPagoId: transactionId,
          },
        });

        // Notificar renovación exitosa
        try {
          await this.notificacionesService.notificar({
            userId: suscripcion.userId,
            tipo: 'PAGO',
            titulo: 'Premium renovado',
            contenido: `Tu suscripción fue renovada hasta el ${nuevaFechaFin.toLocaleDateString('es-PY')}.`,
            enlace: '/premium',
          });
        } catch {
          // non-critical
        }

        this.logger.log(`Suscripción ${suscripcion.id} renovada hasta ${nuevaFechaFin.toISOString()}`);
        return true;
      }
    } catch (e) {
      this.logger.error(`Renovación falló para ${suscripcion.id}: ${e.message}`);
    }

    return false;
  }

  /**
   * Expira una suscripción y quita premium al usuario.
   */
  private async expirarSuscripcion(suscripcionId: string, userId: string) {
    await this.prisma.suscripcion.update({
      where: { id: suscripcionId },
      data: { estado: 'VENCIDA' },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { esPremium: false },
    });

    // Notificar
    try {
      await this.notificacionesService.notificar({
        userId,
        tipo: 'PAGO',
        titulo: 'Tu Premium ha vencido',
        contenido: 'Tu suscripción Premium expiró. Suscríbete de nuevo para recuperar los beneficios.',
        enlace: '/premium',
      });
    } catch {
      // non-critical
    }
  }

  /**
   * Limpia suscripciones PENDIENTE_PAGO que tienen más de 24 horas (abandonadas).
   */
  private async limpiarPendientesAbandonados() {
    const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await this.prisma.suscripcion.updateMany({
      where: {
        estado: 'PENDIENTE_PAGO',
        createdAt: { lt: hace24h },
      },
      data: { estado: 'CANCELADA' },
    });

    if (result.count > 0) {
      this.logger.log(`${result.count} suscripciones pendientes abandonadas limpiadas`);
    }
  }
}
