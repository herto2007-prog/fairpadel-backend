import { Controller, Post, Get, Body, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
      const categoriasMasculinas = [
        { nombre: 'Principiante', tipo: 'MASCULINO', orden: 0 },
        { nombre: '8ª Categoría', tipo: 'MASCULINO', orden: 1 },
        { nombre: '7ª Categoría', tipo: 'MASCULINO', orden: 2 },
        { nombre: '6ª Categoría', tipo: 'MASCULINO', orden: 3 },
        { nombre: '5ª Categoría', tipo: 'MASCULINO', orden: 4 },
        { nombre: '4ª Categoría', tipo: 'MASCULINO', orden: 5 },
        { nombre: '3ª Categoría', tipo: 'MASCULINO', orden: 6 },
        { nombre: '2ª Categoría', tipo: 'MASCULINO', orden: 7 },
        { nombre: '1ª Categoría', tipo: 'MASCULINO', orden: 8 },
      ];

      const categoriasFemeninas = [
        { nombre: 'Principiante Femenino', tipo: 'FEMENINO', orden: 0 },
        { nombre: '8ª Categoría Femenina', tipo: 'FEMENINO', orden: 1 },
        { nombre: '7ª Categoría Femenina', tipo: 'FEMENINO', orden: 2 },
        { nombre: '6ª Categoría Femenina', tipo: 'FEMENINO', orden: 3 },
        { nombre: '5ª Categoría Femenina', tipo: 'FEMENINO', orden: 4 },
        { nombre: '4ª Categoría Femenina', tipo: 'FEMENINO', orden: 5 },
        { nombre: '3ª Categoría Femenina', tipo: 'FEMENINO', orden: 6 },
        { nombre: '2ª Categoría Femenina', tipo: 'FEMENINO', orden: 7 },
        { nombre: '1ª Categoría Femenina', tipo: 'FEMENINO', orden: 8 },
      ];

      for (const cat of [...categoriasMasculinas, ...categoriasFemeninas]) {
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
}
