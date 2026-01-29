import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BancardService } from './bancard.service';

@Injectable()
export class PagosService {
  constructor(
    private prisma: PrismaService,
    private bancardService: BancardService,
  ) {}

  async createBancardCheckout(inscripcionId: string) {
    const inscripcion = await this.prisma.inscripcion.findUnique({
      where: { id: inscripcionId },
      include: {
        pago: true,
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

    if (!inscripcion.pago) {
      throw new BadRequestException('No hay pago pendiente para esta inscripción');
    }

    if (inscripcion.pago.estado !== 'PENDIENTE') {
      throw new BadRequestException('El pago ya fue procesado');
    }

    // Generar transaction ID único
    const transactionId = `FP-${Date.now()}-${inscripcionId.substring(0, 8)}`;

    // Actualizar pago con transaction ID
    await this.prisma.pago.update({
      where: { id: inscripcion.pago.id },
      data: { transactionId },
    });

    // Crear checkout en Bancard
    const checkoutUrl = await this.bancardService.createCheckout({
      transactionId,
      amount: inscripcion.pago.monto.toNumber(),
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
        inscripcion: true,
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

      // Actualizar inscripción como confirmada
      await this.prisma.inscripcion.update({
        where: { id: pago.inscripcionId },
        data: { estado: 'CONFIRMADA' },
      });

      // TODO: Enviar notificaciones

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

      await this.prisma.inscripcion.update({
        where: { id: pago.inscripcionId },
        data: { estado: 'CONFIRMADA' },
      });
    }

    return { received: true };
  }

  async findByInscripcion(inscripcionId: string) {
    const pago = await this.prisma.pago.findFirst({
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

    if (!pago) {
      throw new NotFoundException('Pago no encontrado');
    }

    return pago;
  }

  async confirmarPagoPresencial(inscripcionId: string) {
    const inscripcion = await this.prisma.inscripcion.findUnique({
      where: { id: inscripcionId },
      include: { pago: true },
    });

    if (!inscripcion) {
      throw new NotFoundException('Inscripción no encontrada');
    }

    await this.prisma.pago.update({
      where: { id: inscripcion.pago.id },
      data: {
        estado: 'CONFIRMADO',
        fechaPago: new Date(),
        fechaConfirm: new Date(),
      },
    });

    return this.prisma.inscripcion.update({
      where: { id: inscripcionId },
      data: { estado: 'CONFIRMADA' },
    });
  }
}