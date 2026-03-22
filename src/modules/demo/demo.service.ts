import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InscripcionEstado } from '@prisma/client';

interface LlenarTorneoDto {
  parejasPorCategoria?: number; // mínimo 12, default 16
  distribucion?: 'EQUILIBRADA' | 'ALEATORIA' | 'REALISTA';
}

@Injectable()
export class DemoService {
  constructor(private prisma: PrismaService) {}

  /**
   * Llena un torneo con inscripciones de jugadores demo
   */
  async llenarTorneo(tournamentId: string, dto: LlenarTorneoDto) {
    const { parejasPorCategoria = 16, distribucion = 'REALISTA' } = dto;

    // 1. Verificar torneo existe
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        categorias: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    // 2. Verificar que hay categorías habilitadas
    if (torneo.categorias.length === 0) {
      throw new BadRequestException('El torneo no tiene categorías habilitadas');
    }

    // 3. Obtener jugadores demo por género
    const jugadoresMasc = await this.prisma.jugadorDemo.findMany({
      where: { genero: 'MASCULINO' },
    });

    const jugadoresFem = await this.prisma.jugadorDemo.findMany({
      where: { genero: 'FEMENINO' },
    });

    if (jugadoresMasc.length < 24 || jugadoresFem.length < 24) {
      throw new BadRequestException(
        `No hay suficientes jugadores demo. Masc: ${jugadoresMasc.length}, Fem: ${jugadoresFem.length}. Ejecutar seed primero.`
      );
    }

    // 4. Distribución de parejas por categoría
    const distribucionParejas = this.calcularDistribucion(
      torneo.categorias,
      parejasPorCategoria,
      distribucion
    );

    // 5. Crear inscripciones
    const resultados = [];
    let indexMasc = 0;
    let indexFem = 0;

    for (const catConfig of distribucionParejas) {
      const categoria = catConfig.categoria;
      const cantidadParejas = catConfig.cantidad;
      
      // Seleccionar jugadores según género de la categoría
      const jugadoresPool = categoria.tipo === 'MASCULINO' ? jugadoresMasc : jugadoresFem;
      let index = categoria.tipo === 'MASCULINO' ? indexMasc : indexFem;

      const inscripcionesCreadas = [];

      for (let i = 0; i < cantidadParejas; i++) {
        // Tomar 2 jugadores consecutivos para formar pareja
        const jugador1 = jugadoresPool[index % jugadoresPool.length];
        const jugador2 = jugadoresPool[(index + 1) % jugadoresPool.length];
        
        index += 2;

        // Estado mixto: 60% CONFIRMADA, 30% PENDIENTE_PAGO, 10% PENDIENTE_CONFIRMACION
        const estado = this.sortearEstado();

        try {
          const inscripcion = await this.prisma.inscripcion.create({
            data: {
              tournamentId,
              categoryId: categoria.id,
              jugador1Id: jugador1.id, // Usamos el ID del jugador demo como si fuera user
              jugador2Id: jugador2.id,
              jugador2Documento: jugador2.documento,
              jugador2Email: jugador2.email,
              estado,
              modoPago: estado === 'CONFIRMADA' ? 'COMPLETO' : null,
              notas: `Inscripción DEMO - Generada automáticamente`,
            },
          });

          // Si está confirmada, crear pago ficticio
          if (estado === 'CONFIRMADA') {
            await this.prisma.pago.create({
              data: {
                inscripcionId: inscripcion.id,
                jugadorId: jugador1.id,
                metodoPago: 'TRANSFERENCIA',
                monto: Number(torneo.costoInscripcion),
                comision: 0,
                estado: 'CONFIRMADO',
                // FIX: fechas son String YYYY-MM-DD
                fechaPago: new Date().toISOString().split('T')[0],
                fechaConfirm: new Date().toISOString().split('T')[0],
              },
            });
          }

          inscripcionesCreadas.push(inscripcion);
        } catch (error) {
          console.error(`Error creando inscripción:`, error);
        }
      }

      resultados.push({
        categoria: categoria.nombre,
        tipo: categoria.tipo,
        parejasCreadas: inscripcionesCreadas.length,
      });

      // Actualizar índice global
      if (categoria.tipo === 'MASCULINO') {
        indexMasc = index;
      } else {
        indexFem = index;
      }
    }

    return {
      success: true,
      message: `Torneo llenado con éxito`,
      resumen: {
        totalCategorias: resultados.length,
        totalParejas: resultados.reduce((sum, r) => sum + r.parejasCreadas, 0),
        distribucion: resultados,
      },
    };
  }

  /**
   * Limpia todas las inscripciones demo de un torneo
   */
  async limpiarTorneo(tournamentId: string) {
    // Buscar inscripciones que tengan nota de DEMO
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: {
        tournamentId,
        notas: {
          contains: 'DEMO',
        },
      },
    });

    // Eliminar pagos asociados primero
    for (const insc of inscripciones) {
      await this.prisma.pago.deleteMany({
        where: { inscripcionId: insc.id },
      });
    }

    // Eliminar inscripciones
    const deleted = await this.prisma.inscripcion.deleteMany({
      where: {
        tournamentId,
        notas: {
          contains: 'DEMO',
        },
      },
    });

    return {
      success: true,
      message: `Eliminadas ${deleted.count} inscripciones demo`,
      eliminadas: deleted.count,
    };
  }

  /**
   * Calcula la distribución de parejas por categoría
   */
  private calcularDistribucion(
    categorias: any[],
    baseParejas: number,
    tipo: string
  ): Array<{ categoria: any; cantidad: number }> {
    // Ordenar categorías por nivel (asumiendo que orden más bajo = categoría más alta)
    const categoriasOrdenadas = [...categorias].sort((a, b) => a.category.orden - b.category.orden);

    if (tipo === 'REALISTA') {
      // Más parejas en categorías bajas (más populares)
      // Ej: 3ra=12, 4ta=14, 5ta=16, 6ta=18, 7ma=20
      const ajustes = [0, 2, 4, 6, 8, 10, 12]; // Diferencia por nivel
      
      return categoriasOrdenadas.map((cat, index) => ({
        categoria: cat.category,
        cantidad: Math.max(12, baseParejas - (ajustes[index] || 0)),
      }));
    }

    if (tipo === 'ALEATORIA') {
      return categoriasOrdenadas.map((cat) => ({
        categoria: cat.category,
        cantidad: Math.floor(Math.random() * 10) + 12, // 12-22 parejas
      }));
    }

    // EQUILIBRADA: igual número en todas
    return categoriasOrdenadas.map((cat) => ({
      categoria: cat.category,
      cantidad: baseParejas,
    }));
  }

  /**
   * Sortea estado de inscripción para simular diferentes situaciones
   */
  private sortearEstado(): InscripcionEstado {
    const random = Math.random();
    
    if (random < 0.6) {
      return 'CONFIRMADA'; // 60%
    } else if (random < 0.9) {
      return 'PENDIENTE_PAGO'; // 30%
    } else {
      return 'PENDIENTE_CONFIRMACION'; // 10%
    }
  }

  /**
   * Cuenta jugadores demo por género
   */
  async countJugadores(genero: 'MASCULINO' | 'FEMENINO'): Promise<number> {
    return this.prisma.jugadorDemo.count({
      where: { genero },
    });
  }
}
