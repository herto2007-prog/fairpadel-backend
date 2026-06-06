import { Controller, Post, Get, Put, Body, Param, UnauthorizedException, NotFoundException, UseGuards, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '@prisma/client';
import { UpdateUserAdminDto } from './dto/update-user-admin.dto';

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
      telefono: user.telefono,
      documento: user.documento,
      estado: user.estado,
      fotoUrl: user.fotoUrl,
      roles: user.roles.map(r => r.role.nombre),
      categoriaActual: user.categoriaActual ? { nombre: user.categoriaActual.nombre } : null,
      consentWhatsappStatus: user.consentWhatsappStatus,
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
   * Confirmar consentimiento de WhatsApp para un usuario (solo admin)
   * Workaround: mientras la app no esté publicada en Meta, los webhooks no llegan.
   * Este endpoint permite confirmar manualmente el consentimiento.
   */
  @Post('users/:id/whatsapp/confirmar-consentimiento')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async confirmarConsentimientoWhatsapp(@Param('id') userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { telefono: true, consentWhatsappStatus: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!user.telefono) {
      return { success: false, message: 'El usuario no tiene teléfono registrado' };
    }

    if (user.consentWhatsappStatus === 'CONFIRMADO') {
      return { success: true, message: 'El usuario ya tiene WhatsApp confirmado' };
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        consentCheckboxWhatsapp: true,
        consentWhatsappStatus: 'CONFIRMADO',
        consentWhatsappDate: new Date(),
        preferenciaNotificacion: 'AMBOS',
      },
    });

    return { success: true, message: 'Consentimiento de WhatsApp confirmado' };
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

  /**
   * Actualizar datos de un usuario desde admin (solo admin)
   */
  @Put('users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateUser(
    @Param('id') userId: string,
    @Body() dto: UpdateUserAdminDto,
    @GetUser() admin: User,
  ) {
    // Verificar que el usuario existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { categoriaActual: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const updateData: any = {};
    const advertencias: { inscripciones: any[]; ascensosPendientes: any[] } = {
      inscripciones: [],
      ascensosPendientes: [],
    };

    // Campos básicos editables
    if (dto.telefono !== undefined) updateData.telefono = dto.telefono || null;
    if (dto.ciudad !== undefined) updateData.ciudad = dto.ciudad || null;
    if (dto.fechaNacimiento !== undefined) updateData.fechaNacimiento = dto.fechaNacimiento || null;
    if (dto.genero !== undefined) updateData.genero = dto.genero;
    if (dto.estado !== undefined) updateData.estado = dto.estado;

    // Cambio de categoría
    if (dto.categoriaActualId !== undefined) {
      const nuevaCategoria = await this.prisma.category.findUnique({
        where: { id: dto.categoriaActualId },
      });

      if (!nuevaCategoria) {
        throw new BadRequestException('La categoría seleccionada no existe');
      }

      if (nuevaCategoria.tipo !== user.genero) {
        throw new BadRequestException(
          `La categoría "${nuevaCategoria.nombre}" es ${nuevaCategoria.tipo.toLowerCase()} y el jugador es ${user.genero.toLowerCase()}`
        );
      }

      const categoriaAnterior = user.categoriaActual;

      // Solo procesar si realmente cambia
      if (!categoriaAnterior || categoriaAnterior.id !== nuevaCategoria.id) {
        updateData.categoriaActualId = nuevaCategoria.id;

        // Determinar tipo de cambio según orden
        let tipoCambio: string;
        if (!categoriaAnterior) {
          tipoCambio = 'MANTENIMIENTO';
        } else if (nuevaCategoria.orden > categoriaAnterior.orden) {
          tipoCambio = 'DESCENSO_MANUAL';
        } else if (nuevaCategoria.orden < categoriaAnterior.orden) {
          tipoCambio = 'ASCENSO_MANUAL';
        } else {
          tipoCambio = 'MANTENIMIENTO';
        }

        // Crear historial
        await this.prisma.historialCategoria.create({
          data: {
            userId: user.id,
            categoriaAnteriorId: categoriaAnterior?.id ?? null,
            categoriaNuevaId: nuevaCategoria.id,
            tipo: tipoCambio as any,
            motivo: dto.motivoCambioCategoria || `Cambio de categoría realizado desde el panel de administración`,
            realizadoPor: admin.id,
          },
        });

        // Detectar inscripciones activas
        const inscripcionesActivas = await this.prisma.inscripcion.findMany({
          where: {
            OR: [
              { jugador1Id: userId },
              { jugador2Id: userId },
            ],
            estado: { in: ['CONFIRMADA', 'PENDIENTE_PAGO', 'PENDIENTE_CONFIRMACION'] },
            tournament: {
              estado: { in: ['PUBLICADO', 'EN_CURSO'] },
            },
          },
          include: {
            tournament: { select: { id: true, nombre: true, estado: true } },
            category: { select: { id: true, nombre: true } },
          },
        });
        advertencias.inscripciones = inscripcionesActivas;

        // Detectar ascensos pendientes obsoletos
        const ascensosPendientes = await this.prisma.ascensoPendiente.findMany({
          where: {
            userId,
            estado: 'PENDIENTE',
            categoriaActualId: categoriaAnterior?.id,
          },
          include: {
            categoriaNueva: { select: { nombre: true } },
          },
        });
        advertencias.ascensosPendientes = ascensosPendientes;
      }
    }

    // Actualizar usuario
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        categoriaActual: true,
        roles: { include: { role: true } },
      },
    });

    return {
      success: true,
      message: 'Usuario actualizado correctamente',
      user: {
        id: updatedUser.id,
        nombre: updatedUser.nombre,
        apellido: updatedUser.apellido,
        email: updatedUser.email,
        telefono: updatedUser.telefono,
        documento: updatedUser.documento,
        estado: updatedUser.estado,
        fotoUrl: updatedUser.fotoUrl,
        genero: updatedUser.genero,
        ciudad: updatedUser.ciudad,
        fechaNacimiento: updatedUser.fechaNacimiento,
        roles: updatedUser.roles.map(r => r.role.nombre),
        categoriaActual: updatedUser.categoriaActual ? { id: updatedUser.categoriaActual.id, nombre: updatedUser.categoriaActual.nombre } : null,
      },
      advertencias: advertencias.inscripciones.length > 0 || advertencias.ascensosPendientes.length > 0
        ? advertencias
        : undefined,
    };
  }

  /**
   * Obtener inscripciones activas de un usuario (solo admin)
   */
  @Get('users/:id/inscripciones-activas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getInscripcionesActivas(@Param('id') userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const inscripciones = await this.prisma.inscripcion.findMany({
      where: {
        OR: [
          { jugador1Id: userId },
          { jugador2Id: userId },
        ],
        estado: { in: ['CONFIRMADA', 'PENDIENTE_PAGO', 'PENDIENTE_CONFIRMACION'] },
        tournament: {
          estado: { in: ['PUBLICADO', 'EN_CURSO'] },
        },
      },
      include: {
        tournament: {
          select: { id: true, nombre: true, estado: true, fechaInicio: true },
        },
        category: { select: { id: true, nombre: true } },
        jugador1: { select: { id: true, nombre: true, apellido: true } },
        jugador2: { select: { id: true, nombre: true, apellido: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: inscripciones };
  }

  /**
   * Obtener historial de categorías de un usuario (solo admin)
   */
  @Get('users/:id/historial-categorias')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getHistorialCategorias(@Param('id') userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const historial = await this.prisma.historialCategoria.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // Enriquecer con nombres de categorías (no hay relaciones definidas en el schema)
    const catIds = new Set<string>();
    for (const h of historial) {
      if (h.categoriaAnteriorId) catIds.add(h.categoriaAnteriorId);
      if (h.categoriaNuevaId) catIds.add(h.categoriaNuevaId);
    }

    const categorias = catIds.size > 0
      ? await this.prisma.category.findMany({
          where: { id: { in: Array.from(catIds) } },
          select: { id: true, nombre: true },
        })
      : [];

    const catMap = new Map(categorias.map(c => [c.id, c.nombre]));

    const data = historial.map(h => ({
      ...h,
      categoriaAnterior: h.categoriaAnteriorId ? { id: h.categoriaAnteriorId, nombre: catMap.get(h.categoriaAnteriorId) || 'Desconocida' } : null,
      categoriaNueva: h.categoriaNuevaId ? { id: h.categoriaNuevaId, nombre: catMap.get(h.categoriaNuevaId) || 'Desconocida' } : null,
    }));

    return { success: true, data };
  }
}
