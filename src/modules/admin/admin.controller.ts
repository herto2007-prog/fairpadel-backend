import { Controller, Post, Get, Body, UnauthorizedException, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin')
export class AdminController {
  constructor(private prisma: PrismaService) {}

  /**
   * Endpoint de diagnóstico para verificar la conexión a la base de datos
   */
  @Get('db-info')
  async getDbInfo() {
    try {
      // Contar usuarios
      const userCount = await this.prisma.user.count();
      
      // Obtener info de conexión (sin exponer credenciales sensibles)
      const dbUrl = process.env.DATABASE_URL || 'no-configurada';
      const dbHost = dbUrl.includes('@') ? dbUrl.split('@')[1].split(':')[0] : 'desconocido';
      
      // Listar algunos usuarios (solo nombres, no datos sensibles)
      const recentUsers = await this.prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          nombre: true,
          apellido: true,
          email: true,
          documento: true,
          estado: true,
          createdAt: true,
        },
      });

      return {
        database_host: dbHost,
        total_users: userCount,
        recent_users: recentUsers,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        error: 'Error conectando a la base de datos',
        details: error.message,
        database_url_configured: !!process.env.DATABASE_URL,
      };
    }
  }

  /**
   * Endpoint temporal para asignar roles de admin y organizador
   * SOLO USAR EN SETUP INICIAL - Documento hardcodeado para seguridad
   */
  /**
   * Endpoint de emergencia para ejecutar el seed inicial
   * Crea roles y categorías si no existen
   */
  @Post('run-seed')
  async runSeed(@Body('secret') secret: string) {
    if (secret !== 'fairpadel-setup-2026') {
      throw new UnauthorizedException('Invalid secret');
    }

    try {
      // Crear roles si no existen
      const roles = [
        { nombre: 'jugador', descripcion: 'Jugador de pádel' },
        { nombre: 'admin', descripcion: 'Administrador del sistema' },
        { nombre: 'organizador', descripcion: 'Organizador de torneos' },
      ];

      for (const rol of roles) {
        await this.prisma.role.upsert({
          where: { nombre: rol.nombre },
          update: {},
          create: rol,
        });
      }

      // Crear categorías si no existen
      // NOTA: Las categorías NO tienen género. El género es del usuario.
      const categorias = [
        { nombre: 'Principiante', tipo: 'MASCULINO' as const, orden: 0 },
        { nombre: '8ª Categoría', tipo: 'MASCULINO' as const, orden: 1 },
        { nombre: '7ª Categoría', tipo: 'MASCULINO' as const, orden: 2 },
        { nombre: '6ª Categoría', tipo: 'MASCULINO' as const, orden: 3 },
        { nombre: '5ª Categoría', tipo: 'MASCULINO' as const, orden: 4 },
        { nombre: '4ª Categoría', tipo: 'MASCULINO' as const, orden: 5 },
        { nombre: '3ª Categoría', tipo: 'MASCULINO' as const, orden: 6 },
        { nombre: '2ª Categoría', tipo: 'MASCULINO' as const, orden: 7 },
        { nombre: '1ª Categoría', tipo: 'MASCULINO' as const, orden: 8 },
      ];

      for (const cat of categorias) {
        await this.prisma.category.upsert({
          where: { nombre: cat.nombre },
          update: {},
          create: cat,
        });
      }

      // Contar datos creados
      const roleCount = await this.prisma.role.count();
      const categoryCount = await this.prisma.category.count();

      return {
        success: true,
        message: 'Seed ejecutado correctamente',
        roles_created: roleCount,
        categories_created: categoryCount,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error ejecutando seed',
        error: error.message,
      };
    }
  }

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

  /**
   * Obtener lista de usuarios (solo admin)
   */
  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getUsers() {
    const users = await this.prisma.user.findMany({
      include: {
        roles: {
          include: { role: true },
        },
        categoriaActual: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map(user => ({
      id: user.id,
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
      documento: user.documento,
      estado: user.estado,
      roles: user.roles.map(r => r.role.nombre),
      categoriaActual: user.categoriaActual ? { nombre: user.categoriaActual.nombre } : null,
    }));
  }

  /**
   * Actualizar roles de un usuario (solo admin)
   */
  @Post('users/update-roles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateUserRoles(
    @Body('userId') userId: string,
    @Body('roles') roles: string[],
  ) {
    // Validar que los roles existan
    const validRoles = await this.prisma.role.findMany({
      where: { nombre: { in: roles } },
    });

    if (validRoles.length !== roles.length) {
      return { success: false, message: 'Algunos roles no existen' };
    }

    // Eliminar roles actuales
    await this.prisma.userRole.deleteMany({
      where: { userId },
    });

    // Agregar nuevos roles
    for (const role of validRoles) {
      await this.prisma.userRole.create({
        data: {
          userId,
          roleId: role.id,
        },
      });
    }

    return { success: true, message: 'Roles actualizados correctamente' };
  }

  /**
   * Estadísticas del sistema (solo admin)
   */
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getStats() {
    const [
      totalUsers,
      activeUsers,
      pendingUsers,
      totalTournaments,
      totalInscripciones,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { estado: 'ACTIVO' } }),
      this.prisma.user.count({ where: { estado: 'NO_VERIFICADO' } }),
      this.prisma.tournament.count(),
      this.prisma.inscripcion.count(),
    ]);

    return {
      users: { total: totalUsers, active: activeUsers, pending: pendingUsers },
      tournaments: totalTournaments,
      inscripciones: totalInscripciones,
    };
  }
}
