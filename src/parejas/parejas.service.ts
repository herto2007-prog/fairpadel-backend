import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateParejaDto } from './dto/create-pareja.dto';

@Injectable()
export class ParejasService {
  constructor(private prisma: PrismaService) {}

  async create(createParejaDto: CreateParejaDto, jugador1Id: string) {
    const { jugador2Documento } = createParejaDto;

    // Buscar si el jugador 2 existe
    const jugador2 = await this.prisma.user.findUnique({
      where: { documento: jugador2Documento },
    });

    // Verificar que no sea el mismo jugador
    const jugador1 = await this.prisma.user.findUnique({
      where: { id: jugador1Id },
    });

    if (jugador1.documento === jugador2Documento) {
      throw new BadRequestException('No puedes crear una pareja contigo mismo');
    }

    // Crear la pareja
    const pareja = await this.prisma.pareja.create({
      data: {
        jugador1Id,
        jugador2Id: jugador2?.id || null,
        jugador2Documento,
      },
      include: {
        jugador1: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            documento: true,
            genero: true,
            fotoUrl: true,
          },
        },
        jugador2: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            documento: true,
            genero: true,
            fotoUrl: true,
          },
        },
      },
    });

    return pareja;
  }

  async findOne(id: string) {
    const pareja = await this.prisma.pareja.findUnique({
      where: { id },
      include: {
        jugador1: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            documento: true,
            genero: true,
            fotoUrl: true,
          },
        },
        jugador2: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            documento: true,
            genero: true,
            fotoUrl: true,
          },
        },
      },
    });

    if (!pareja) {
      throw new NotFoundException('Pareja no encontrada');
    }

    return pareja;
  }

  async findByUser(userId: string) {
    const parejas = await this.prisma.pareja.findMany({
      where: {
        OR: [
          { jugador1Id: userId },
          { jugador2Id: userId },
        ],
      },
      include: {
        jugador1: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            documento: true,
            genero: true,
            fotoUrl: true,
          },
        },
        jugador2: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            documento: true,
            genero: true,
            fotoUrl: true,
          },
        },
      },
    });

    return parejas;
  }

  async buscarJugadorPorDocumento(documento: string) {
    const jugador = await this.prisma.user.findUnique({
      where: { documento },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        documento: true,
        genero: true,
        ciudad: true,
        fotoUrl: true,
      },
    });

    if (!jugador) {
      return {
        encontrado: false,
        mensaje: 'Jugador no registrado. La pareja se activará cuando este jugador se registre.',
      };
    }

    return {
      encontrado: true,
      jugador,
    };
  }
}