import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BancardService } from './bancard.service';

@Injectable()
export class PagosService {
  constructor(
    private prisma: PrismaService,
    private bancardService: BancardService,
  ) {}

  async createBancardCheckout(inscripcionId: string, pagoId?: string) {
    const inscripcion = await this.prisma.inscripcion.findUnique({
      where: { id: inscripcionId },
      include: {
        pagos: true,
        tournament: true,
        pareja: {
          include: {
            jugador1: true,
          },
        },
      },
    });

    if (!inscripcion) {
      throw new NotFoundException('Inscripción no encontrada');
    }

    const pagos = inscripcion.pagos || [];
    if (pagos.length === 0) {
      throw new BadRequestException('No hay pago pendiente para esta inscripción');
    }

    // If pagoId provided, find that specific pago; otherwise use first pending
    const pago = pagoId
      ? pagos.find((p) => p.id === pagoId)
      : pagos.find((p) => p.estado === 'PENDIENTE');

    if (!pago) {
      throw new BadRequestException('No hay pago pendiente para esta inscripción');
    }

    if (pago.estado !== 'PENDIENTE') {
      throw new BadRequestException('El pago ya fue procesado');
    }

    // Generar transaction ID único
    const transactionId = `FP-${Date.now()}-${inscripcionId.substring(0, 8)}`;

    // Actualizar pago con transaction ID
    await this.prisma.pago.update({
      where: { id: pago.id },
      data: { transactionId },
    });

    // Crear checkout en Bancard
    const checkoutUrl = await this.bancardService.createCheckout({
      transactionId,
      amount: pago.monto.toNumber(),
      description: `Inscripción ${inscripcion.tournament.nombre}`,
      returnUrl: `${process.env.FRONTEND_URL}/pago/confirmacion`,
      cancelUrl: `${process.env.FRONTEND_URL}/pago/cancelado`,
    });

    return {
      checkoutUrl,
      transactionId,
    };
  }

  async confirmBancardPayment(transactionId: string) {
    const pago = await this.prisma.pago.findFirst({
      where: { transactionId },
      include: {
        inscripcion: {
          include: { pagos: true },
        },
      },
    });

    if (!pago) {
      throw new NotFoundException('Pago no encontrado');
    }

    // Verificar estado en Bancard
    const paymentStatus = await this.bancardService.verifyPayment(transactionId);

    if (paymentStatus.status === 'success') {
      // Actualizar pago como confirmado
      await this.prisma.pago.update({
        where: { id: pago.id },
        data: {
          estado: 'CONFIRMADO',
          fechaPago: new Date(),
          fechaConfirm: new Date(),
        },
      });

      // Check if ALL pagos for this inscription are now confirmed
      const allPagos = pago.inscripcion.pagos || [];
      const othersPending = allPagos.some(
        (p) => p.id !== pago.id && p.estado !== 'CONFIRMADO',
      );

      if (!othersPending) {
        await this.prisma.inscripcion.update({
          where: { id: pago.inscripcionId },
          data: { estado: 'CONFIRMADA' },
        });
      }

      return {
        success: true,
        message: 'Pago confirmado exitosamente',
      };
    }

    return {
      success: false,
      message: 'Pago no confirmado',
    };
  }

  async handleBancardWebhook(webhookData: any) {
    // Validar webhook signature
    const isValid = this.bancardService.validateWebhook(webhookData);

    if (!isValid) {
      throw new BadRequestException('Webhook inválido');
    }

    const { transactionId, status } = webhookData;

    const pago = await this.prisma.pago.findFirst({
      where: { transactionId },
      include: {
        inscripcion: {
          include: { pagos: true },
        },
      },
    });

    if (!pago) {
      throw new NotFoundException('Pago no encontrado');
    }

    if (status === 'success') {
      await this.prisma.pago.update({
        where: { id: pago.id },
        data: {
          estado: 'CONFIRMADO',
          fechaPago: new Date(),
          fechaConfirm: new Date(),
        },
      });

      // Check if ALL pagos confirmed
      const allPagos = pago.inscripcion.pagos || [];
      const othersPending = allPagos.some(
        (p) => p.id !== pago.id && p.estado !== 'CONFIRMADO',
      );

      if (!othersPending) {
        await this.prisma.inscripcion.update({
          where: { id: pago.inscripcionId },
          data: { estado: 'CONFIRMADA' },
        });
      }
    }

    return { received: true };
  }

  async findByInscripcion(inscripcionId: string) {
    const pagos = await this.prisma.pago.findMany({
      where: { inscripcionId },
      include: {
        inscripcion: {
          include: {
            tournament: true,
            pareja: {
              include: {
                jugador1: true,
                jugador2: true,
              },
            },
          },
        },
      },
    });

    if (pagos.length === 0) {
      throw new NotFoundException('Pagos no encontrados');
    }

    return pagos;
  }

  async confirmarPagoPresencial(inscripcionId: string) {
    const inscripcion = await this.prisma.inscripcion.findUnique({
      where: { id: inscripcionId },
      include: { pagos: true },
    });

    if (!inscripcion) {
      throw new NotFoundException('Inscripción no encontrada');
    }

    const pagos = inscripcion.pagos || [];
    if (pagos.length === 0) {
      throw new BadRequestException('No hay pagos para esta inscripción');
    }

    // Confirm all pending pagos
    for (const pago of pagos) {
      if (pago.estado === 'PENDIENTE') {
        await this.prisma.pago.update({
          where: { id: pago.id },
          data: {
            estado: 'CONFIRMADO',
            fechaPago: new Date(),
            fechaConfirm: new Date(),
          },
        });
      }
    }

    return this.prisma.inscripcion.update({
      where: { id: inscripcionId },
      data: { estado: 'CONFIRMADA' },
    });
  }
}
