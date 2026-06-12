import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Verifica que el usuario autenticado pueda gestionar la sede sobre la que
 * opera la request. Permite: admin global, el dueño de la sede y su
 * encargado. Cualquier otro usuario -> 403.
 *
 * Resuelve la sede desde (en orden):
 *  - params.sedeId
 *  - params.canchaId          (busca la cancha y usa su sede)
 *  - params.reservaId         (reserva -> cancha -> sede)
 *  - params.disponibilidadId  (disponibilidad -> cancha -> sede)
 *  - params.bloqueoId         (bloqueo -> sede)
 *  - body.sedeId
 *  - body.sedeCanchaId        (cancha -> sede)
 *
 * Si no puede resolver una sede, NIEGA el acceso (fail-closed): toda ruta
 * protegida por este guard debe tener la sede identificable.
 */
@Injectable()
export class SedeGestionGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    // Admin global puede gestionar cualquier sede.
    if (Array.isArray(user.roles) && user.roles.includes('admin')) {
      return true;
    }

    const userId = user.userId ?? user.id;
    const sedeId = await this.resolverSedeId(req);

    if (!sedeId) {
      throw new ForbiddenException('No se pudo determinar la sede de la operación');
    }

    const sede = await this.prisma.sede.findUnique({
      where: { id: sedeId },
      select: { duenoId: true, encargadoId: true },
    });

    if (!sede) {
      throw new NotFoundException('Sede no encontrada');
    }

    const esDueno = sede.duenoId === userId;
    const esEncargado = sede.encargadoId === userId;

    if (!esDueno && !esEncargado) {
      throw new ForbiddenException('No tienes permiso para gestionar esta sede');
    }

    return true;
  }

  private async resolverSedeId(req: any): Promise<string | null> {
    const params = req.params ?? {};
    const body = req.body ?? {};

    if (params.sedeId) return params.sedeId;

    if (params.canchaId) {
      const cancha = await this.prisma.sedeCancha.findUnique({
        where: { id: params.canchaId },
        select: { sedeId: true },
      });
      if (!cancha) {
        throw new NotFoundException('Cancha no encontrada');
      }
      return cancha.sedeId;
    }

    if (params.reservaId) {
      const reserva = await this.prisma.reservaCancha.findUnique({
        where: { id: params.reservaId },
        select: { sedeCancha: { select: { sedeId: true } } },
      });
      if (!reserva) {
        throw new NotFoundException('Reserva no encontrada');
      }
      return reserva.sedeCancha.sedeId;
    }

    if (params.disponibilidadId) {
      const disponibilidad = await this.prisma.alquilerDisponibilidad.findUnique({
        where: { id: params.disponibilidadId },
        select: { sedeCancha: { select: { sedeId: true } } },
      });
      if (!disponibilidad) {
        throw new NotFoundException('Disponibilidad no encontrada');
      }
      return disponibilidad.sedeCancha.sedeId;
    }

    if (params.bloqueoId) {
      const bloqueo = await this.prisma.alquilerBloqueo.findUnique({
        where: { id: params.bloqueoId },
        select: { sedeId: true },
      });
      if (!bloqueo) {
        throw new NotFoundException('Bloqueo no encontrado');
      }
      return bloqueo.sedeId;
    }

    if (body.sedeId) return body.sedeId;

    if (body.sedeCanchaId) {
      const cancha = await this.prisma.sedeCancha.findUnique({
        where: { id: body.sedeCanchaId },
        select: { sedeId: true },
      });
      if (!cancha) {
        throw new NotFoundException('Cancha no encontrada');
      }
      return cancha.sedeId;
    }

    return null;
  }
}
