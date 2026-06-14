import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsOptional, IsNumber, IsArray, IsDateString } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertasService } from '../alertas/alertas.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TorneoGestionGuard } from '../../common/guards/torneo-gestion.guard';

class AsignarModalidadesDto {
  @IsArray()
  modalidadIds: string[];
}

class AsignarCategoriasDto {
  @IsArray()
  categoriaIds: string[];
}

class CompletarChecklistDto {
  @IsString()
  @IsOptional()
  notas?: string;

  @IsNumber()
  @IsOptional()
  valorReal?: number;
}

class ConfigurarRecordatorioDto {
  @IsDateString()
  fechaRecordatorio: string;
}

// WIZARD DE CREACIÓN + CHECKLIST DEL TORNEO (extraido verbatim de
// admin-torneos.controller). Datos auxiliares del wizard, asignación de
// modalidades/categorías, publicación, y gestión del checklist.
// Mismo base path admin/torneos + guards + @Roles → URLs sin cambios.
// TorneoGestionGuard se aplica POR MÉTODO (no a nivel controller) porque
// GET datos/wizard no opera sobre un torneo (es catálogo global) y quedaría
// bloqueado por el fail-closed del guard. El resto de rutas tienen :id.
@Controller('admin/torneos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'organizador')
export class AdminTorneoWizardController {
  constructor(
    private prisma: PrismaService,
    private alertasService: AlertasService,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // DATOS AUXILIARES
  // ═══════════════════════════════════════════════════════════

  @Get('datos/wizard')
  async getDatosWizard() {
    try {
      const [sedes, modalidades, categorias] = await Promise.all([
        this.prisma.sede.findMany({
          where: { activa: true },
          select: { id: true, nombre: true, ciudad: true },
          orderBy: { nombre: 'asc' },
        }),
        this.prisma.modalidadConfig.findMany({
          where: { activa: true },
          orderBy: { nombre: 'asc' },
        }),
        this.prisma.category.findMany({
          orderBy: { orden: 'asc' },
        }),
      ]);

      return {
        success: true,
        sedes,
        modalidades,
        categorias,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error cargando datos',
        error: error.message,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // MODALIDADES Y CATEGORÍAS
  // ═══════════════════════════════════════════════════════════

  @UseGuards(TorneoGestionGuard)
  @Post(':id/modalidades')
  async asignarModalidades(
    @Param('id') torneoId: string,
    @Body() dto: AsignarModalidadesDto,
  ) {
    try {
      await this.prisma.tournamentModalidad.deleteMany({
        where: { tournamentId: torneoId },
      });

      for (const modalidadId of dto.modalidadIds) {
        await this.prisma.tournamentModalidad.create({
          data: {
            tournamentId: torneoId,
            modalidadConfigId: modalidadId,
          },
        });
      }

      const modalidades = await this.prisma.tournamentModalidad.findMany({
        where: { tournamentId: torneoId },
        include: { modalidadConfig: true },
      });

      return {
        success: true,
        message: 'Modalidades asignadas correctamente',
        modalidades,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error asignando modalidades',
        error: error.message,
      };
    }
  }

  @UseGuards(TorneoGestionGuard)
  @Post(':id/categorias')
  async asignarCategorias(
    @Param('id') torneoId: string,
    @Body() dto: AsignarCategoriasDto,
  ) {
    try {
      await this.prisma.tournamentCategory.deleteMany({
        where: { tournamentId: torneoId },
      });

      for (const categoriaId of dto.categoriaIds) {
        await this.prisma.tournamentCategory.create({
          data: {
            tournamentId: torneoId,
            categoryId: categoriaId,
          },
        });
      }

      const categorias = await this.prisma.tournamentCategory.findMany({
        where: { tournamentId: torneoId },
        include: { category: true },
      });

      return {
        success: true,
        message: 'Categorías asignadas correctamente',
        categorias,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error asignando categorías',
        error: error.message,
      };
    }
  }

  @UseGuards(TorneoGestionGuard)
  @Put(':id/publicar')
  async publicar(@Param('id') torneoId: string) {
    try {
      const torneo = await this.prisma.tournament.update({
        where: { id: torneoId },
        data: { estado: 'PUBLICADO' },
      });

      // Avisar a los suscritos a "torneos en mi ciudad" (best-effort)
      await this.alertasService.notificarNuevoTorneo(torneo.id);

      return {
        success: true,
        message: 'Torneo publicado correctamente',
        torneo,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error publicando torneo',
        error: error.message,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CHECKLIST
  // ═══════════════════════════════════════════════════════════

  @UseGuards(TorneoGestionGuard)
  @Get(':id/checklist')
  async getChecklist(@Param('id') tournamentId: string) {
    const items = await this.prisma.checklistItem.findMany({
      where: { tournamentId },
      orderBy: { orden: 'asc' },
    });

    return {
      success: true,
      items,
      progreso: {
        total: items.length,
        completados: items.filter(i => i.completado).length,
        porcentaje: Math.round((items.filter(i => i.completado).length / items.length) * 100) || 0,
      },
    };
  }

  @UseGuards(TorneoGestionGuard)
  @Put(':id/checklist/:itemId')
  async completarChecklistItem(
    @Param('id') tournamentId: string,
    @Param('itemId') itemId: string,
    @Body() dto: CompletarChecklistDto,
  ) {
    const item = await this.prisma.checklistItem.update({
      where: { id: itemId, tournamentId },
      data: {
        completado: true,
        completadoAt: new Date(),
        notas: dto.notas,
        valorReal: dto.valorReal,
      },
    });

    return {
      success: true,
      message: 'Ítem completado',
      item,
    };
  }

  @UseGuards(TorneoGestionGuard)
  @Put(':id/checklist/:itemId/recordatorio')
  async configurarRecordatorio(
    @Param('id') tournamentId: string,
    @Param('itemId') itemId: string,
    @Body() dto: ConfigurarRecordatorioDto,
  ) {
    const item = await this.prisma.checklistItem.update({
      where: { id: itemId, tournamentId },
      data: {
        fechaRecordatorio: new Date(dto.fechaRecordatorio + 'T03:00:00.000Z'),
        recordatorioEnviado: false,
      },
    });

    return {
      success: true,
      message: 'Recordatorio configurado',
      item,
    };
  }
}
