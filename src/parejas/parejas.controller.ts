import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ParejasService } from './parejas.service';
import { CreateParejaDto } from './dto/create-pareja.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('parejas')
@UseGuards(JwtAuthGuard)
export class ParejasController {
  constructor(private readonly parejasService: ParejasService) {}

  @Post()
  create(@Body() createParejaDto: CreateParejaDto, @Request() req) {
    return this.parejasService.create(createParejaDto, req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.parejasService.findOne(id);
  }

  @Get('user/:userId')
  findByUser(@Param('userId') userId: string) {
    return this.parejasService.findByUser(userId);
  }

  @Post('buscar-jugador')
  buscarJugador(@Body() body: { documento: string }) {
    return this.parejasService.buscarJugadorPorDocumento(body.documento);
  }
}