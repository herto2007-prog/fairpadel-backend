import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface AsignarDuenoDto {
  sedeId: string;
  userId: string;
}

interface AsignarEncargadoDto {
  sedeId: string;
  userId: string;
}

@Injectable()
export class SedesAdminService {
  constructor(private prisma: PrismaService) {}

  /**
   * Asigna un dueño a una sede
   * Solo admin puede hacer esto
   */
  async asignarDueno(dto: AsignarDuenoDto) {
    const { sedeId, userId } = dto;

    // Verificar que la sede existe
    const sede = await this.prisma.sede.findUnique({
      where: { id: sedeId },
    });

    if (!sede) {
      throw new NotFoundException('Sede no encontrada');
    }

    // Verificar que el usuario existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Asignar dueño y también como encargado si no tiene
    const updateData: any = { duenoId: userId };
    if (!sede.encargadoId) {
      updateData.encargadoId = userId;
    }

    const sedeActualizada = await this.prisma.sede.update({
      where: { id: sedeId },
      data: updateData,
      include: {
        dueno: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
          },
        },
        encargado: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
          },
        },
      },
    });

    // Asegurar que el usuario tenga el rol de dueño
    const tieneRolDueno = await this.prisma.userRole.findFirst({
      where: { userId, role: { nombre: 'dueño' } },
    });

    if (!tieneRolDueno) {
      // Buscar o crear rol dueño
      let rolDueno = await this.prisma.role.findUnique({
        where: { nombre: 'dueño' },
      });

      if (!rolDueno) {
        rolDueno = await this.prisma.role.create({
          data: { nombre: 'dueño', descripcion: 'Dueño de sede' },
        });
      }

      await this.prisma.userRole.create({
        data: { userId, roleId: rolDueno.id },
      });
    }

    return sedeActualizada;
  }

  /**
   * Asigna un encargado a una sede
   * El dueño puede hacer esto, o el admin
   */
  async asignarEncargado(dto: AsignarEncargadoDto) {
    const { sedeId, userId } = dto;

    // Verificar que la sede existe
    const sede = await this.prisma.sede.findUnique({
      where: { id: sedeId },
    });

    if (!sede) {
      throw new NotFoundException('Sede no encontrada');
    }

    // Verificar que el usuario existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const sedeActualizada = await this.prisma.sede.update({
      where: { id: sedeId },
      data: { encargadoId: userId },
      include: {
        dueno: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
          },
        },
        encargado: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
          },
        },
      },
    });

    return sedeActualizada;
  }

  /**
   * Obtiene todas las sedes con su dueño y encargado
   */
  async obtenerSedesConDuenos() {
    return this.prisma.sede.findMany({
      include: {
        dueno: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
          },
        },
        encargado: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
          },
        },
        alquilerConfig: {
          select: {
            suscripcionActiva: true,
            suscripcionVenceEn: true,
          },
        },
      },
      orderBy: { nombre: 'asc' },
    });
  }

  /**
   * Obtiene las sedes donde el usuario es dueño
   */
  async obtenerSedesDeDueno(userId: string) {
    console.log(`[SedesAdminService] Buscando sedes con duenoId: ${userId}`);
    
    const sedes = await this.prisma.sede.findMany({
      where: { duenoId: userId },
      include: {
        alquilerConfig: {
          select: {
            suscripcionActiva: true,
            suscripcionVenceEn: true,
          },
        },
        _count: {
          select: { canchas: true },
        },
      },
    });
    
    console.log(`[SedesAdminService] Encontradas ${sedes.length} sedes para duenoId ${userId}`);
    return sedes;
  }

  /**
   * Verifica si un usuario es dueño de una sede específica
   */
  async esDuenoDeSede(userId: string, sedeId: string): Promise<boolean> {
    const sede = await this.prisma.sede.findFirst({
      where: {
        id: sedeId,
        duenoId: userId,
      },
    });
    return !!sede;
  }

  /**
   * Verifica si un usuario es dueño o encargado de una sede
   */
  async esDuenoOEncargado(userId: string, sedeId: string): Promise<boolean> {
    const sede = await this.prisma.sede.findFirst({
      where: {
        id: sedeId,
        OR: [
          { duenoId: userId },
          { encargadoId: userId },
        ],
      },
    });
    return !!sede;
  }
}
