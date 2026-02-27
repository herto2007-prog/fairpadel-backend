import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { InstructoresService } from './instructores.service';
import { SolicitarInstructorDto } from './dto/solicitar-instructor.dto';
import { ActualizarInstructorDto, ActualizarUbicacionesDto } from './dto/actualizar-instructor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('instructores')
export class InstructoresController {
  constructor(private readonly instructoresService: InstructoresService) {}

  // ── Public: list ──────────────────────────────────────

  @Get()
  buscarInstructores(
    @Query('ciudad') ciudad?: string,
    @Query('especialidad') especialidad?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.instructoresService.buscarInstructores({
      ciudad,
      especialidad,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  // ── Protected: any logged-in user ─────────────────────

  @Post('solicitar')
  @UseGuards(JwtAuthGuard)
  solicitarSerInstructor(
    @Request() req,
    @Body() dto: SolicitarInstructorDto,
  ) {
    return this.instructoresService.solicitarSerInstructor(req.user.id, dto);
  }

  @Get('mi-solicitud')
  @UseGuards(JwtAuthGuard)
  obtenerMiSolicitud(@Request() req) {
    return this.instructoresService.obtenerMiSolicitud(req.user.id);
  }

  // ── Protected: instructor role ────────────────────────

  @Get('mi-perfil')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  obtenerMiPerfil(@Request() req) {
    return this.instructoresService.obtenerMiPerfil(req.user.id);
  }

  @Put('mi-perfil')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  actualizarPerfil(
    @Request() req,
    @Body() dto: ActualizarInstructorDto,
  ) {
    return this.instructoresService.actualizarPerfil(req.user.id, dto);
  }

  @Put('ubicaciones')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  actualizarUbicaciones(
    @Request() req,
    @Body() dto: ActualizarUbicacionesDto,
  ) {
    return this.instructoresService.actualizarUbicaciones(req.user.id, dto);
  }

  // ── Public: detail (MUST be LAST — :id catches everything) ──

  @Get(':id')
  obtenerInstructorPublico(@Param('id') id: string) {
    return this.instructoresService.obtenerInstructorPublico(id);
  }
}
