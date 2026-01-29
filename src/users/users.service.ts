import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async obtenerPerfilPublico(id: string) {
    const usuario = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        genero: true,
        ciudad: true,
        bio: true,
        fotoUrl: true,
        esPremium: true,
        createdAt: true,
        // NO incluir: documento, email, telefono, passwordHash
      },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return usuario;
  }

  async actualizarPerfil(id: string, data: any) {
    const usuario = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Solo permitir editar ciertos campos
    const datosPermitidos = {
      nombre: data.nombre,
      apellido: data.apellido,
      ciudad: data.ciudad,
      bio: data.bio,
      fotoUrl: data.fotoUrl,
    };

    const usuarioActualizado = await this.prisma.user.update({
      where: { id },
      data: datosPermitidos,
    });

    return usuarioActualizado;
  }

  async buscarPorDocumento(documento: string) {
    return this.prisma.user.findUnique({
      where: { documento },
    });
  }

  async buscarPorEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }
}