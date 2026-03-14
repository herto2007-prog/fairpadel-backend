const fs = require('fs');
const path = require('path');

const controllerPath = path.join(__dirname, '../src/modules/admin/admin-torneos.controller.ts');
let content = fs.readFileSync(controllerPath, 'utf8');

const newEndpoints = `
  // ═══════════════════════════════════════════════════════════
  // EDITAR INSCRIPCIÓN Y MOVER DE CATEGORÍA
  // ═══════════════════════════════════════════════════════════

  /**
   * PUT /admin/torneos/:id/inscripciones/:inscripcionId
   * Editar datos de una inscripción
   */
  @Put(':id/inscripciones/:inscripcionId')
  async editarInscripcion(
    @Param('id') tournamentId: string,
    @Param('inscripcionId') inscripcionId: string,
    @Body() body: {
      jugador2Id?: string;
      jugador2Temp?: {
        nombre?: string;
        apellido?: string;
        email?: string;
        telefono?: string;
        documento?: string;
      };
      modoPago?: 'COMPLETO' | 'INDIVIDUAL';
      notas?: string;
    },
  ) {
    const inscripcion = await this.prisma.inscripcion.update({
      where: { id: inscripcionId, tournamentId },
      data: {
        jugador2Id: body.jugador2Id,
        jugador2Email: body.jugador2Temp?.email,
        jugador2Documento: body.jugador2Temp?.documento,
        modoPago: body.modoPago,
        notas: body.notas,
      },
      include: {
        jugador1: { select: { id: true, nombre: true, apellido: true, email: true, telefono: true } },
        jugador2: { select: { id: true, nombre: true, apellido: true, email: true, telefono: true } },
        category: true,
      },
    });

    return {
      success: true,
      message: 'Inscripción actualizada',
      inscripcion,
    };
  }

  /**
   * PUT /admin/torneos/:id/inscripciones/:inscripcionId/cambiar-categoria
   * Mover inscripción a otra categoría
   */
  @Put(':id/inscripciones/:inscripcionId/cambiar-categoria')
  async cambiarCategoria(
    @Param('id') tournamentId: string,
    @Param('inscripcionId') inscripcionId: string,
    @Body('nuevaCategoriaId') nuevaCategoriaId: string,
  ) {
    // Validar que la nueva categoría existe en el torneo
    const categoriaExiste = await this.prisma.tournamentCategory.findFirst({
      where: { tournamentId, categoryId: nuevaCategoriaId },
    });

    if (!categoriaExiste) {
      throw new BadRequestException('La categoría no existe en este torneo');
    }

    // Obtener inscripción actual
    const inscripcionActual = await this.prisma.inscripcion.findUnique({
      where: { id: inscripcionId, tournamentId },
      select: { jugador1Id: true, jugador2Id: true },
    });

    if (!inscripcionActual) {
      throw new NotFoundException('Inscripción no encontrada');
    }

    // Verificar que ninguno de los jugadores esté ya en la nueva categoría
    if (inscripcionActual.jugador1Id) {
      const existe = await this.prisma.inscripcion.findFirst({
        where: {
          tournamentId,
          categoryId: nuevaCategoriaId,
          OR: [
            { jugador1Id: inscripcionActual.jugador1Id },
            { jugador2Id: inscripcionActual.jugador1Id },
          ],
          estado: { not: 'CANCELADA' },
          id: { not: inscripcionId },
        },
      });
      if (existe) {
        throw new BadRequestException('El jugador 1 ya está inscrito en la categoría destino');
      }
    }

    if (inscripcionActual.jugador2Id) {
      const existe = await this.prisma.inscripcion.findFirst({
        where: {
          tournamentId,
          categoryId: nuevaCategoriaId,
          OR: [
            { jugador1Id: inscripcionActual.jugador2Id },
            { jugador2Id: inscripcionActual.jugador2Id },
          ],
          estado: { not: 'CANCELADA' },
          id: { not: inscripcionId },
        },
      });
      if (existe) {
        throw new BadRequestException('El jugador 2 ya está inscrito en la categoría destino');
      }
    }

    const inscripcion = await this.prisma.inscripcion.update({
      where: { id: inscripcionId, tournamentId },
      data: { categoryId: nuevaCategoriaId },
      include: {
        jugador1: { select: { id: true, nombre: true, apellido: true } },
        jugador2: { select: { id: true, nombre: true, apellido: true } },
        category: true,
      },
    });

    return {
      success: true,
      message: 'Inscripción movida a ' + inscripcion.category.nombre,
      inscripcion,
    };
  }
`;

const marker = '// OVERVIEW / DASHBOARD DEL TORNEO';
content = content.replace(marker, newEndpoints + '\n  // ' + marker);

fs.writeFileSync(controllerPath, content);
console.log('Done');
