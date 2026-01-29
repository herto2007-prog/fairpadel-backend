import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BancardService } from '../pagos/bancard.service';
import { CreateSuscripcionDto } from './dto';

@Injectable()
export class SuscripcionesService {
  constructor(
    private prisma: PrismaService,
    private bancardService: BancardService,
  ) {}

  async obtenerPlanes() {
    const planes = await this.prisma.planPremium.findMany({
      where: { activo: true },
      orderBy: {
        precioMensual: 'asc',
      },
    });

    return planes;
  }

  async crearSuscripcion(dto: CreateSuscripcionDto, userId: string) {
    const { planId, periodo, cuponCodigo } = dto;

    // Verificar que el plan existe
    const plan = await this.prisma.planPremium.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException('Plan no encontrado');
    }

    // Verificar que el usuario no tiene suscripción activa
    const suscripcionActiva = await this.prisma.suscripcion.findFirst({
      where: {
        userId,
        estado: 'ACTIVA',
      },
    });

    if (suscripcionActiva) {
      throw new BadRequestException('Ya tienes una suscripción activa');
    }

    // Calcular precio según período
    let precio = periodo === 'MENSUAL' ? plan.precioMensual : plan.precioAnual;

    // Aplicar cupón si existe
    if (cuponCodigo) {
      const cupon = await this.validarCupon(cuponCodigo);
      if (cupon.valido) {
        const precioConDescuento = this.aplicarDescuento(precio.toNumber(), cupon);
      }
    }

    // Calcular fechas
    const fechaInicio = new Date();
    const fechaFin = new Date();
    if (periodo === 'MENSUAL') {
      fechaFin.setMonth(fechaFin.getMonth() + 1);
    } else {
      fechaFin.setFullYear(fechaFin.getFullYear() + 1);
    }

    // Crear suscripción
    const suscripcion = await this.prisma.suscripcion.create({
      data: {
        userId,
        planId,
        periodo: periodo as any,
        precio,
        estado: 'PENDIENTE_PAGO',
        fechaInicio,
        fechaFin,
        fechaRenovacion: fechaFin,
        cuponAplicado: cuponCodigo || null,
      },
    });

    // Generar checkout de Bancard para el pago
    const transactionId = `SUB-${Date.now()}-${suscripcion.id.substring(0, 8)}`;

    const checkoutUrl = await this.bancardService.createCheckout({
      transactionId,
      amount: precio.toNumber(),
      description: `Suscripción ${plan.nombre} - ${periodo}`,
      returnUrl: `${process.env.FRONTEND_URL}/suscripcion/confirmacion`,
      cancelUrl: `${process.env.FRONTEND_URL}/suscripcion/cancelado`,
    });

    return {
      suscripcion,
      checkoutUrl,
      transactionId,
    };
  }

  async obtenerSuscripcionActiva(userId: string) {
    const suscripcion = await this.prisma.suscripcion.findFirst({
      where: {
        userId,
        estado: 'ACTIVA',
      },
      include: {
        plan: true,
      },
    });

    return suscripcion;
  }

  async cancelarSuscripcion(userId: string) {
    const suscripcion = await this.obtenerSuscripcionActiva(userId);

    if (!suscripcion) {
      throw new NotFoundException('No tienes una suscripción activa');
    }

    // Desactivar renovación automática
    await this.prisma.suscripcion.update({
      where: { id: suscripcion.id },
      data: {
        autoRenovar: false,
        estado: 'CANCELADA',
      },
    });

    // Actualizar usuario
    await this.prisma.user.update({
      where: { id: userId },
      data: { esPremium: false },
    });

    return { message: 'Suscripción cancelada' };
  }

  async reactivarSuscripcion(userId: string) {
    const suscripcion = await this.prisma.suscripcion.findFirst({
      where: {
        userId,
        estado: 'CANCELADA',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!suscripcion) {
      throw new NotFoundException('No tienes una suscripción cancelada');
    }

    await this.prisma.suscripcion.update({
      where: { id: suscripcion.id },
      data: {
        autoRenovar: true,
        estado: 'ACTIVA',
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { esPremium: true },
    });

    return { message: 'Suscripción reactivada' };
  }

  async confirmarPagoSuscripcion(suscripcionId: string) {
    const suscripcion = await this.prisma.suscripcion.findUnique({
      where: { id: suscripcionId },
    });

    if (!suscripcion) {
      throw new NotFoundException('Suscripción no encontrada');
    }

    // Actualizar suscripción
    await this.prisma.suscripcion.update({
      where: { id: suscripcionId },
      data: { estado: 'ACTIVA' },
    });

    // Actualizar usuario a Premium
    await this.prisma.user.update({
      where: { id: suscripcion.userId },
      data: { esPremium: true },
    });

    return { message: 'Suscripción activada' };
  }

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

    return {
      valido: true,
      cupon,
      mensaje: 'Cupón válido',
    };
  }

  private aplicarDescuento(precio: number, cupon: any): number {
    if (cupon.tipo === 'PORCENTAJE') {
      const descuento = (precio * cupon.valor.toNumber()) / 100;
      return precio - descuento;
    } else {
      return precio - cupon.valor.toNumber();
    }
  }

  async renovarSuscripcionesVencidas() {
    // Este método se ejecutará diariamente via cron job
    const ahora = new Date();

    const suscripcionesVencidas = await this.prisma.suscripcion.findMany({
      where: {
        estado: 'ACTIVA',
        fechaFin: {
          lte: ahora,
        },
        autoRenovar: true,
      },
      include: {
        plan: true,
        user: true,
      },
    });

    for (const suscripcion of suscripcionesVencidas) {
      // TODO: Intentar cobro automático con Bancard
      // Por ahora, solo marcar como vencida
      await this.prisma.suscripcion.update({
        where: { id: suscripcion.id },
        data: { estado: 'VENCIDA' },
      });

      await this.prisma.user.update({
        where: { id: suscripcion.userId },
        data: { esPremium: false },
      });
    }

    return { procesadas: suscripcionesVencidas.length };
  }
}