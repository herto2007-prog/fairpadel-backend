import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        documento: true,
        fotoUrl: true,
        esPremium: true,
        estado: true,
        createdAt: true,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        documento: true,
        telefono: true,
        fechaNacimiento: true,
        genero: true,
        ciudad: true,
        pais: true,
        fotoUrl: true,
        bannerUrl: true,
        bio: true,
        instagram: true,
        facebook: true,
        esPremium: true,
        estado: true,
        createdAt: true,
      },
    });
  }
}
