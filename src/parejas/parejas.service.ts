import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateParejaDto } from './dto/create-pareja.dto';

@Injectable()
export class ParejasService {
  constructor(private prisma: PrismaService) {}

  private readonly parejaInclude = {
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
  };

  /**
   * Find-or-create: returns existing pareja if same jugador1+jugador2Documento,
   * otherwise creates a new one. Also accepts an optional Prisma transaction client.
   */
  async findOrCreate(createParejaDto: CreateParejaDto, jugador1Id: string, tx?: any) {
    const prisma = tx || this.prisma;
    const { jugador2Documento } = createParejaDto;

    // Buscar si el jugador 2 existe
    const jugador2 = await prisma.user.findUnique({
      where: { documento: jugador2Documento },
    });

    // Verificar que no sea el mismo jugador
    const jugador1 = await prisma.user.findUnique({
      where: { id: jugador1Id },
    });

    if (!jugador1) {
      throw new NotFoundException('Jugador no encontrado');
    }

    if (jugador1.documento === jugador2Documento) {
      throw new BadRequestException('No puedes crear una pareja contigo mismo');
    }

    // Buscar pareja existente (jugador1 + jugador2Documento)
    const existente = await prisma.pareja.findFirst({
      where: {
        jugador1Id,
        jugador2Documento,
      },
      include: this.parejaInclude,
    });

    if (existente) {
      return existente;
    }

    // También buscar en orden inverso (jugador2 es ahora jugador1)
    if (jugador2) {
      const existenteInverso = await prisma.pareja.findFirst({
        where: {
          jugador1Id: jugador2.id,
          jugador2Documento: jugador1.documento,
        },
        include: this.parejaInclude,
      });

      if (existenteInverso) {
        return existenteInverso;
      }
    }

    // Crear la pareja
    const pareja = await prisma.pareja.create({
      data: {
        jugador1Id,
        jugador2Id: jugador2?.id || null,
        jugador2Documento,
      },
      include: this.parejaInclude,
    });

    return pareja;
  }

  /** @deprecated Use findOrCreate instead */
  async create(createParejaDto: CreateParejaDto, jugador1Id: string) {
    return this.findOrCreate(createParejaDto, jugador1Id);
  }

  async findOne(id: string) {
    const pareja = await this.prisma.pareja.findUnique({
      where: { id },
      include: this.parejaInclude,
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
      include: this.parejaInclude,
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