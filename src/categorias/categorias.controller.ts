import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CategoriasService } from './categorias.service';
import { CreateReglaAscensoDto } from './dto/create-regla-ascenso.dto';
import { UpdateReglaAscensoDto } from './dto/update-regla-ascenso.dto';
import { CambiarCategoriaDto } from './dto/cambiar-categoria.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin/categorias')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  // ═══════════════════════════════════════════
  // REGLAS DE ASCENSO
  // ═══════════════════════════════════════════

  @Get('reglas')
  obtenerReglasAscenso(@Query('genero') genero?: string) {
    return this.categoriasService.obtenerReglasAscenso(genero);
  }

  @Post('reglas')
  crearReglaAscenso(@Body() dto: CreateReglaAscensoDto) {
    return this.categoriasService.crearReglaAscenso(dto);
  }

  @Put('reglas/:id')
  actualizarReglaAscenso(@Param('id') id: string, @Body() dto: UpdateReglaAscensoDto) {
    return this.categoriasService.actualizarReglaAscenso(id, dto);
  }

  @Delete('reglas/:id')
  eliminarReglaAscenso(@Param('id') id: string) {
    return this.categoriasService.eliminarReglaAscenso(id);
  }

  // ═══════════════════════════════════════════
  // GESTIÓN DE JUGADORES
  // ═══════════════════════════════════════════

  @Get('jugadores')
  buscarJugadores(@Query('search') search: string) {
    return this.categoriasService.buscarJugadores(search);
  }

  @Get('jugadores/:id')
  obtenerCategoriaJugador(@Param('id') id: string) {
    return this.categoriasService.obtenerCategoriaJugador(id);
  }

  @Put('jugadores/:id/cambiar')
  cambiarCategoriaManual(
    @Param('id') id: string,
    @Body() dto: CambiarCategoriaDto,
    @Request() req,
  ) {
    return this.categoriasService.cambiarCategoriaManual(id, dto, req.user.id);
  }

  // ═══════════════════════════════════════════
  // HISTORIAL DE MOVIMIENTOS
  // ═══════════════════════════════════════════

  @Get('historial')
  obtenerHistorialMovimientos(
    @Query('userId') userId?: string,
    @Query('tipo') tipo?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.categoriasService.obtenerHistorialMovimientos({ userId, tipo, desde, hasta });
  }
}
