import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Guard que verifica si la sede tiene suscripción activa
 * para usar el módulo de reservas
 */
@Injectable()
export class SuscripcionGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Obtener sedeId de los parámetros o query
    const sedeId = request.params.sedeId || request.query.sedeId || request.body.sedeId;
    
    if (!sedeId) {
      throw new ForbiddenException('Se requiere ID de sede');
    }

    // Verificar suscripción
    const config = await this.prisma.alquilerConfig.findUnique({
      where: { sedeId },
      select: {
        suscripcionActiva: true,
        suscripcionVenceEn: true,
      },
    });

    if (!config) {
      throw new ForbiddenException(
        'La sede no tiene configuración de alquileres. Contacte a soporte.'
      );
    }

    if (!config.suscripcionActiva) {
      throw new ForbiddenException(
        'Suscripción inactiva. Active su suscripción para usar reservas.'
      );
    }

    // Verificar si no venció
    if (config.suscripcionVenceEn) {
      const hoy = new Date().toISOString().split('T')[0];
      if (config.suscripcionVenceEn < hoy) {
        // Desactivar automáticamente
        await this.prisma.alquilerConfig.update({
          where: { sedeId },
          data: { suscripcionActiva: false },
        });
        throw new ForbiddenException(
          'Su suscripción ha vencido. Renueve para continuar.'
        );
      }
    }

    return true;
  }
}
