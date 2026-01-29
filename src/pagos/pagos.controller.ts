import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  UseGuards,
} from '@nestjs/common';
import { PagosService } from './pagos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('pagos')
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  @Post('bancard/checkout')
  @UseGuards(JwtAuthGuard)
  createCheckout(@Body() body: { inscripcionId: string }) {
    return this.pagosService.createBancardCheckout(body.inscripcionId);
  }

  @Post('bancard/confirm')
  confirmPayment(@Body() body: { transactionId: string }) {
    return this.pagosService.confirmBancardPayment(body.transactionId);
  }

  @Post('webhooks/bancard')
  handleWebhook(@Body() body: any) {
    return this.pagosService.handleBancardWebhook(body);
  }

  @Get('inscripcion/:inscripcionId')
  @UseGuards(JwtAuthGuard)
  findByInscripcion(@Param('inscripcionId') inscripcionId: string) {
    return this.pagosService.findByInscripcion(inscripcionId);
  }
}