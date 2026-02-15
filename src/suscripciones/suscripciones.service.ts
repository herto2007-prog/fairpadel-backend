import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSuscripcionDto } from './dto';
import { BancardService } from '../pagos/bancard.service';

@Injectable()
export class SuscripcionesService {
  constructor(
    private prisma: PrismaService,
    private bancardService: BancardService,
  ) {}

  async obtenerPlanes() {
    const planes = await this.prisma.planPremium.findMany({
      where: { activo: true },
      orderBy: { precioMensual: 'asc' },
    });
    return planes;
  }

  async crearSuscripcion(dto: CreateSuscripcionDto, userId: string) {
    const { planId, cuponCodigo } = dto;

    const plan = await this.prisma.planPremium.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException('Plan no encontrado');
    }

    // Verificar que el usuario no tiene suscripción activa
    const suscripcionActiva = await this.prisma.suscripcion.findFirst({
      where: { userId, estado: 'ACTIVA' },
    });

    if (suscripcionActiva) {
      throw new BadRequestException('Ya tienes una suscripción activa');
    }

    // Precio mensual (único período disponible)
    let precio = plan.precioMensual.toNumber();

    // Aplicar cupón si existe
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

    // Generar checkout de Bancard para el pago
    const transactionId = `SUB-${Date.now()}-${suscripcion.id.substring(0, 8)}`;

    let checkoutUrl: string | null = null;
    try {
      checkoutUrl = await this.bancardService.createCheckout({
        transactionId,
        amount: precio,
        description: `FairPadel Premium - Mensual`,
        returnUrl: `${process.env.FRONTEND_URL}/suscripcion/confirmacion`,
        cancelUrl: `${process.env.FRONTEND_URL}/suscripcion/cancelado`,
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

  async obtenerSuscripcionActiva(userId: string) {
    const suscripcion = await this.prisma.suscripcion.findFirst({
      where: { userId, estado: 'ACTIVA' },
      include: { plan: true },
    });
    return suscripcion;
  }

  async obtenerHistorialSuscripciones(userId: string) {
    return this.prisma.suscripcion.findMany({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  async cancelarSuscripcion(userId: string) {
    const suscripcion = await this.obtenerSuscripcionActiva(userId);

    if (!suscripcion) {
      throw new NotFoundException('No tienes una suscripción activa');
    }

    // Cancelar pero mantener acceso hasta fechaFin
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

  async confirmarPagoSuscripcion(suscripcionId: string) {
    const suscripcion = await this.prisma.suscripcion.findUnique({
      where: { id: suscripcionId },
    });

    if (!suscripcion) {
      throw new NotFoundException('Suscripción no encontrada');
    }

    await this.prisma.suscripcion.update({
      where: { id: suscripcionId },
      data: { estado: 'ACTIVA' },
    });

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

  async renovarSuscripcionesVencidas() {
    const ahora = new Date();

    // Find subscriptions that have expired
    const suscripcionesVencidas = await this.prisma.suscripcion.findMany({
      where: {
        estado: 'ACTIVA',
        fechaFin: { lte: ahora },
      },
      include: { plan: true, user: true },
    });

    for (const suscripcion of suscripcionesVencidas) {
      if (!suscripcion.autoRenovar) {
        // User cancelled — expire
        await this.prisma.suscripcion.update({
          where: { id: suscripcion.id },
          data: { estado: 'VENCIDA' },
        });
        await this.prisma.user.update({
          where: { id: suscripcion.userId },
          data: { esPremium: false },
        });
      } else {
        // TODO: Attempt Bancard auto-charge
        // For now, mark as expired
        await this.prisma.suscripcion.update({
          where: { id: suscripcion.id },
          data: { estado: 'VENCIDA' },
        });
        await this.prisma.user.update({
          where: { id: suscripcion.userId },
          data: { esPremium: false },
        });
      }
    }

    return { procesadas: suscripcionesVencidas.length };
  }
}
