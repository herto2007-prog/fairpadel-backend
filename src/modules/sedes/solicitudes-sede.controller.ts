import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsEmail, IsOptional, IsIn, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const ESTADOS = ['NUEVO', 'CONTACTADO', 'CONVERTIDO', 'RECHAZADO'] as const;

class CrearSolicitudSedeDto {
  @IsString() @MinLength(2) @MaxLength(120)
  nombreContacto: string;

  @IsEmail() @MaxLength(160)
  email: string;

  @IsString() @MinLength(5) @MaxLength(40)
  telefono: string;

  @IsString() @MinLength(2) @MaxLength(160)
  nombreSede: string;

  @IsString() @MinLength(2) @MaxLength(120)
  ciudad: string;

  @IsOptional() @IsString() @MaxLength(1000)
  mensaje?: string;
}

class ActualizarSolicitudSedeDto {
  @IsOptional() @IsIn(ESTADOS as unknown as string[])
  estado?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  notaAdmin?: string;
}

// Público: cualquiera puede enviar una solicitud para sumar su sede (lead).
@Controller('solicitudes-sede')
export class SolicitudesSedePublicController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async crear(@Body() dto: CrearSolicitudSedeDto) {
    await this.prisma.solicitudSede.create({
      data: {
        nombreContacto: dto.nombreContacto.trim(),
        email: dto.email.trim().toLowerCase(),
        telefono: dto.telefono.trim(),
        nombreSede: dto.nombreSede.trim(),
        ciudad: dto.ciudad.trim(),
        mensaje: dto.mensaje?.trim() || null,
      },
    });
    // No devolvemos el registro (endpoint público): solo confirmación.
    return { success: true, message: 'Solicitud recibida' };
  }
}

// Admin: bandeja de solicitudes.
@Controller('admin/solicitudes-sede')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class SolicitudesSedeAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async listar(@Query('estado') estado?: string) {
    const where = estado && ESTADOS.includes(estado as any) ? { estado } : {};
    const [solicitudes, nuevas, total] = await Promise.all([
      this.prisma.solicitudSede.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      this.prisma.solicitudSede.count({ where: { estado: 'NUEVO' } }),
      this.prisma.solicitudSede.count(),
    ]);
    return { solicitudes, nuevas, total };
  }

  @Patch(':id')
  async actualizar(@Param('id') id: string, @Body() dto: ActualizarSolicitudSedeDto) {
    return this.prisma.solicitudSede.update({
      where: { id },
      data: {
        ...(dto.estado !== undefined && { estado: dto.estado }),
        ...(dto.notaAdmin !== undefined && { notaAdmin: dto.notaAdmin }),
      },
    });
  }
}
