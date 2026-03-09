import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('admin')
export class AdminController {
  constructor(private prisma: PrismaService) {}

  /**
   * Endpoint temporal para asignar roles de admin y organizador
   * SOLO USAR EN SETUP INICIAL - Documento hardcodeado para seguridad
   */
  @Post('setup-user')
  async setupUser(@Body('secret') secret: string) {
    // Clave secreta simple para evitar accesos no autorizados
    // En producción real esto no existiría
    if (secret !== 'fairpadel-setup-2026') {
      throw new UnauthorizedException('Invalid secret');
    }

    const documento = '3439737';

    // Buscar usuario
    const user = await this.prisma.user.findUnique({
      where: { documento },
      include: { roles: { include: { role: true } } },
    });

    if (!user) {
      return { 
        success: false, 
        message: `Usuario con documento ${documento} no encontrado. Debes registrarte primero.` 
      };
    }

    // Verificar si ya tiene los roles
    const currentRoles = user.roles.map(r => r.role.nombre);
    const rolesToAdd = [];

    if (!currentRoles.includes('admin')) {
      rolesToAdd.push('admin');
    }
    if (!currentRoles.includes('organizador')) {
      rolesToAdd.push('organizador');
    }

    if (rolesToAdd.length === 0) {
      return { 
        success: true, 
        message: 'Usuario ya tiene roles admin y organizador',
        user: {
          id: user.id,
          nombre: user.nombre,
          email: user.email,
          roles: currentRoles,
        }
      };
    }

    // Agregar roles faltantes
    for (const roleName of rolesToAdd) {
      const role = await this.prisma.role.findUnique({
        where: { nombre: roleName },
      });

      if (role) {
        await this.prisma.userRole.create({
          data: {
            userId: user.id,
            roleId: role.id,
          },
        });
      }
    }

    // Obtener usuario actualizado
    const updatedUser = await this.prisma.user.findUnique({
      where: { documento },
      include: { roles: { include: { role: true } } },
    });

    return {
      success: true,
      message: `Roles asignados exitosamente: ${rolesToAdd.join(', ')}`,
      user: {
        id: updatedUser.id,
        nombre: updatedUser.nombre,
        email: updatedUser.email,
        roles: updatedUser.roles.map(r => r.role.nombre),
      },
    };
  }
}
