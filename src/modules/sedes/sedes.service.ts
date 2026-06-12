import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSedeDto } from './dto/create-sede.dto';
import { UpdateSedeDto } from './dto/update-sede.dto';
import { CreateCanchaDto } from './dto/create-cancha.dto';

@Injectable()
export class SedesService {
  constructor(private prisma: PrismaService) {}

  // ============ SEDES ============
  
  async create(createSedeDto: CreateSedeDto, duenoId?: string) {
    // El creador queda como dueño: sin esto, el guard de gestión de sedes
    // (dueño/encargado/admin) lo dejaría afuera de su propia sede.
    return this.prisma.sede.create({
      data: { ...createSedeDto, ...(duenoId ? { duenoId } : {}) },
    });
  }

  async findAll(ciudad?: string) {
    const where = ciudad ? { ciudad, activa: true } : { activa: true };
    return this.prisma.sede.findMany({
      where,
      include: {
        canchas: {
          where: { activa: true },
        },
        _count: {
          select: { canchas: true },
        },
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(id: string) {
    const sede = await this.prisma.sede.findUnique({
      where: { id },
      include: {
        canchas: true,
        alquilerConfig: true,
      },
    });

    if (!sede) {
      throw new NotFoundException('Sede no encontrada');
    }

    return sede;
  }

  async update(id: string, updateSedeDto: UpdateSedeDto) {
    await this.findOne(id);
    
    return this.prisma.sede.update({
      where: { id },
      data: updateSedeDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    
    return this.prisma.sede.update({
      where: { id },
      data: { activa: false },
    });
  }

  // ============ CANCHAS ============

  async createCancha(sedeId: string, createCanchaDto: CreateCanchaDto) {
    await this.findOne(sedeId);
    
    return this.prisma.sedeCancha.create({
      data: {
        ...createCanchaDto,
        sedeId,
      },
    });
  }

  async findCanchasBySede(sedeId: string) {
    await this.findOne(sedeId);
    
    return this.prisma.sedeCancha.findMany({
      where: { sedeId, activa: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async findCanchaById(canchaId: string) {
    const cancha = await this.prisma.sedeCancha.findUnique({
      where: { id: canchaId },
      include: { sede: true },
    });

    if (!cancha) {
      throw new NotFoundException('Cancha no encontrada');
    }

    return cancha;
  }

  async updateCancha(canchaId: string, updateCanchaDto: Partial<CreateCanchaDto>) {
    await this.findCanchaById(canchaId);
    
    return this.prisma.sedeCancha.update({
      where: { id: canchaId },
      data: updateCanchaDto,
    });
  }

  async removeCancha(canchaId: string) {
    await this.findCanchaById(canchaId);
    
    return this.prisma.sedeCancha.update({
      where: { id: canchaId },
      data: { activa: false },
    });
  }
}
