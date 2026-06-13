import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

// GESTIÓN DE SEDES DEL TORNEO (extraido verbatim de admin-torneos.controller).
// Asignar/quitar/cambiar/reordenar sedes de un torneo y sincronizar sus canchas
// (TorneoCancha) en consecuencia. Distinto de AdminSedesController (admin/sedes),
// que administra el catálogo global de sedes.
// Mismo base path admin/torneos + guards + @Roles → URLs sin cambios.
@Controller('admin/torneos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'organizador')
export class AdminTorneoSedesController {
  constructor(private prisma: PrismaService) {}

  /**
   * GET /admin/torneos/:id/sedes
   * Obtener sedes asignadas al torneo (con conteo de canchas activas del torneo)
   */
  @Get(':id/sedes')
  async obtenerSedes(@Param('id') tournamentId: string) {
    try {
      // Obtener sedes del torneo
      const torneoSedes = await this.prisma.torneoSede.findMany({
        where: { tournamentId },
        include: {
          sede: true,
        },
      });

      // Contar canchas activas del torneo (TorneoCancha)
      const canchasCount = await this.prisma.torneoCancha.count({
        where: { tournamentId, activa: true },
      });

      return {
        success: true,
        sedes: torneoSedes.map((ts) => ({
          id: ts.sede.id,
          nombre: ts.sede.nombre,
          ciudad: ts.sede.ciudad,
          direccion: ts.sede.direccion,
          canchas: canchasCount, // IMPORTANTE: Canchas activas del torneo, no de la sede
        })),
      };
    } catch (error: any) {
      throw new BadRequestException({
        success: false,
        message: 'Error obteniendo sedes',
        error: error.message,
      });
    }
  }

  /**
   * POST /admin/torneos/:id/sedes
   * Agregar/Actualizar sede del torneo (MVP: UNA sola sede por torneo)
   */
  @Post(':id/sedes')
  async agregarSede(@Param('id') tournamentId: string, @Body() dto: { sedeId: string }) {
    try {
      // Verificar que la sede existe
      const sede = await this.prisma.sede.findUnique({
        where: { id: dto.sedeId },
        include: {
          canchas: {
            where: { activa: true },
          },
        },
      });
      if (!sede) {
        throw new NotFoundException('Sede no encontrada');
      }

      // Verificar si la sede ya está agregada
      const sedeExistente = await this.prisma.torneoSede.findUnique({
        where: {
          tournamentId_sedeId: {
            tournamentId,
            sedeId: dto.sedeId,
          },
        },
      });

      if (sedeExistente) {
        return {
          success: false,
          message: 'La sede ya está agregada al torneo',
        };
      }

      // Calcular el orden (siguiente número disponible)
      const sedesActuales = await this.prisma.torneoSede.count({
        where: { tournamentId },
      });
      const nuevoOrden = sedesActuales;

      // Crear la nueva relación torneo-sede con orden
      const torneoSede = await this.prisma.torneoSede.create({
        data: {
          tournamentId,
          sedeId: dto.sedeId,
          orden: nuevoOrden,
        },
        include: {
          sede: true,
        },
      });
      console.log(`[agregarSede] Creada nueva relación con sede ${sede.nombre} (orden: ${nuevoOrden})`);

      // Agregar automáticamente todas las canchas activas de la sede al torneo
      const canchasCreadas = [];
      for (const cancha of sede.canchas) {
        try {
          // Intentar crear nueva cancha
          const torneoCancha = await this.prisma.torneoCancha.create({
            data: {
              tournamentId,
              sedeCanchaId: cancha.id,
              activa: true,
            },
          });
          canchasCreadas.push(torneoCancha);
        } catch (canchaError) {
          // Si ya existe, activarla
          console.log(`[agregarSede] Cancha ${cancha.id} ya existe, activando...`);
          const updated = await this.prisma.torneoCancha.updateMany({
            where: {
              tournamentId,
              sedeCanchaId: cancha.id,
            },
            data: { activa: true },
          });
          if (updated.count > 0) {
            canchasCreadas.push({ id: cancha.id, reactivada: true });
          }
        }
      }

      return {
        success: true,
        message: `Sede agregada con ${canchasCreadas.length} canchas`,
        sede: torneoSede.sede,
        canchasAgregadas: canchasCreadas.length,
      };
    } catch (error: any) {
      throw new BadRequestException({
        success: false,
        message: 'Error agregando sede',
        error: error.message,
      });
    }
  }

  /**
   * DELETE /admin/torneos/:id/sedes/:sedeId
   * Quitar una sede del torneo y desactivar sus canchas
   */
  @Delete(':id/sedes/:sedeId')
  async quitarSede(@Param('id') tournamentId: string, @Param('sedeId') sedeId: string) {
    try {
      // 1. Desactivar todas las canchas de esta sede en el torneo
      const canchasDesactivadas = await this.prisma.torneoCancha.updateMany({
        where: {
          tournamentId,
          sedeCancha: {
            sedeId: sedeId,
          },
        },
        data: { activa: false },
      });

      // 2. Eliminar la relación torneo-sede
      await this.prisma.torneoSede.delete({
        where: {
          tournamentId_sedeId: {
            tournamentId,
            sedeId,
          },
        },
      });

      // 3. Reordenar las sedes restantes (para mantener secuencia 0,1,2...)
      const sedesRestantes = await this.prisma.torneoSede.findMany({
        where: { tournamentId },
        orderBy: { orden: 'asc' },
      });

      for (let i = 0; i < sedesRestantes.length; i++) {
        await this.prisma.torneoSede.update({
          where: { id: sedesRestantes[i].id },
          data: { orden: i },
        });
      }

      return {
        success: true,
        message: `Sede removida. ${canchasDesactivadas.count} canchas desactivadas.`,
        canchasDesactivadas: canchasDesactivadas.count,
      };
    } catch (error: any) {
      throw new BadRequestException({
        success: false,
        message: 'Error removiendo sede',
        error: error.message,
      });
    }
  }

  /**
   * PUT /admin/torneos/:id/sedes/:sedeId/cambiar
   * Cambiar una sede por otra (mantiene el orden)
   */
  @Put(':id/sedes/:sedeId/cambiar')
  async cambiarSede(
    @Param('id') tournamentId: string,
    @Param('sedeId') sedeIdActual: string,
    @Body() dto: { nuevaSedeId: string },
  ) {
    try {
      // 1. Obtener el orden de la sede actual
      const sedeActual = await this.prisma.torneoSede.findUnique({
        where: {
          tournamentId_sedeId: {
            tournamentId,
            sedeId: sedeIdActual,
          },
        },
      });

      if (!sedeActual) {
        throw new NotFoundException('Sede actual no encontrada');
      }

      const ordenActual = sedeActual.orden;

      // 2. Verificar que la nueva sede existe
      const nuevaSede = await this.prisma.sede.findUnique({
        where: { id: dto.nuevaSedeId },
        include: {
          canchas: { where: { activa: true } },
        },
      });

      if (!nuevaSede) {
        throw new NotFoundException('Nueva sede no encontrada');
      }

      // 3. Verificar que la nueva sede no esté ya asignada
      const sedeYaAsignada = await this.prisma.torneoSede.findUnique({
        where: {
          tournamentId_sedeId: {
            tournamentId,
            sedeId: dto.nuevaSedeId,
          },
        },
      });

      if (sedeYaAsignada) {
        return {
          success: false,
          message: 'La nueva sede ya está agregada al torneo',
        };
      }

      // 4. Desactivar canchas de la sede vieja
      await this.prisma.torneoCancha.updateMany({
        where: {
          tournamentId,
          sedeCancha: {
            sedeId: sedeIdActual,
          },
        },
        data: { activa: false },
      });

      // 5. Eliminar relación vieja
      await this.prisma.torneoSede.delete({
        where: {
          tournamentId_sedeId: {
            tournamentId,
            sedeId: sedeIdActual,
          },
        },
      });

      // 6. Crear relación nueva con el mismo orden
      await this.prisma.torneoSede.create({
        data: {
          tournamentId,
          sedeId: dto.nuevaSedeId,
          orden: ordenActual,
        },
      });

      // 7. Agregar canchas de la nueva sede
      const canchasAgregadas = [];
      for (const cancha of nuevaSede.canchas) {
        try {
          const torneoCancha = await this.prisma.torneoCancha.create({
            data: {
              tournamentId,
              sedeCanchaId: cancha.id,
              activa: true,
            },
          });
          canchasAgregadas.push(torneoCancha);
        } catch (canchaError) {
          // Si ya existe, activarla
          const updated = await this.prisma.torneoCancha.updateMany({
            where: {
              tournamentId,
              sedeCanchaId: cancha.id,
            },
            data: { activa: true },
          });
          if (updated.count > 0) {
            canchasAgregadas.push({ id: cancha.id, reactivada: true });
          }
        }
      }

      return {
        success: true,
        message: `Sede cambiada. ${canchasAgregadas.length} canchas agregadas.`,
        sede: {
          id: nuevaSede.id,
          nombre: nuevaSede.nombre,
          ciudad: nuevaSede.ciudad,
        },
        canchasAgregadas: canchasAgregadas.length,
      };
    } catch (error: any) {
      throw new BadRequestException({
        success: false,
        message: 'Error cambiando sede',
        error: error.message,
      });
    }
  }

  /**
   * PUT /admin/torneos/:id/sedes/reordenar
   * Reordenar sedes del torneo
   * Body: { ordenSedes: [{ sedeId: string, orden: number }] }
   */
  @Put(':id/sedes/reordenar')
  async reordenarSedes(
    @Param('id') tournamentId: string,
    @Body() dto: { ordenSedes: { sedeId: string; orden: number }[] },
  ) {
    try {
      // Validar que hay datos
      if (!dto.ordenSedes || !Array.isArray(dto.ordenSedes) || dto.ordenSedes.length === 0) {
        throw new BadRequestException('ordenSedes debe ser un array no vacío');
      }

      // Actualizar el orden de cada sede
      const updates = dto.ordenSedes.map(async (item) => {
        return this.prisma.torneoSede.update({
          where: {
            tournamentId_sedeId: {
              tournamentId,
              sedeId: item.sedeId,
            },
          },
          data: {
            orden: item.orden,
          },
        });
      });

      await Promise.all(updates);

      // Retornar sedes actualizadas
      const sedesActualizadas = await this.prisma.torneoSede.findMany({
        where: { tournamentId },
        include: { sede: { select: { id: true, nombre: true, ciudad: true } } },
        orderBy: { orden: 'asc' },
      });

      return {
        success: true,
        message: 'Sedes reordenadas correctamente',
        sedes: sedesActualizadas.map((s) => ({
          id: s.sede.id,
          nombre: s.sede.nombre,
          ciudad: s.sede.ciudad,
          orden: s.orden,
        })),
      };
    } catch (error: any) {
      throw new BadRequestException({
        success: false,
        message: 'Error reordenando sedes',
        error: error.message,
      });
    }
  }
}
