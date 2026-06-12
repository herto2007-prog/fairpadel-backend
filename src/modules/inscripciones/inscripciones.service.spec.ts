import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InscripcionEstado } from '@prisma/client';
import { InscripcionesService } from './inscripciones.service';

/**
 * Tests de autorización/seguridad de InscripcionesService:
 * - findOneAutorizado: cierra la lectura IDOR del detalle (datos personales).
 * - remove: no permite borrar una inscripción confirmada (corrompería el bracket).
 */
const INSCRIPCION_BASE = {
  id: 'insc-1',
  jugador1Id: 'jug-1',
  jugador2Id: 'jug-2',
  tournamentId: 'torneo-1',
  estado: InscripcionEstado.PENDIENTE_CONFIRMACION as InscripcionEstado,
};

const build = ({ inscripcion = INSCRIPCION_BASE, puede = false } = {}) => {
  const prisma = {
    inscripcion: {
      findUnique: jest.fn().mockResolvedValue(inscripcion),
      delete: jest.fn().mockResolvedValue(inscripcion),
    },
  };
  const tournamentsService = {
    puedeGestionarTorneo: jest.fn().mockResolvedValue(puede),
  };
  const service = new InscripcionesService(
    prisma as any,
    {} as any, // notificacionesService
    {} as any, // notificacionesWhatsApp
    {} as any, // comisionService
    tournamentsService as any,
  );
  return { service, prisma, tournamentsService };
};

describe('InscripcionesService.findOneAutorizado', () => {
  it('permite al jugador1 ver su inscripción', async () => {
    const { service } = build();
    await expect(service.findOneAutorizado('insc-1', 'jug-1')).resolves.toMatchObject({ id: 'insc-1' });
  });

  it('permite al jugador2 ver la inscripción', async () => {
    const { service } = build();
    await expect(service.findOneAutorizado('insc-1', 'jug-2')).resolves.toMatchObject({ id: 'insc-1' });
  });

  it('permite a quien gestiona el torneo (dueño/coorg/admin)', async () => {
    const { service } = build({ puede: true });
    await expect(service.findOneAutorizado('insc-1', 'organizador-x')).resolves.toMatchObject({ id: 'insc-1' });
  });

  it('rechaza a un usuario ajeno (IDOR)', async () => {
    const { service } = build({ puede: false });
    await expect(service.findOneAutorizado('insc-1', 'extraño-9')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lanza 404 si la inscripción no existe', async () => {
    const { service } = build({ inscripcion: null });
    await expect(service.findOneAutorizado('nope', 'jug-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('InscripcionesService.remove', () => {
  it('no permite borrar una inscripción CONFIRMADA', async () => {
    const { service, prisma } = build({
      inscripcion: { ...INSCRIPCION_BASE, estado: InscripcionEstado.CONFIRMADA },
    });
    await expect(service.remove('insc-1', 'jug-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.inscripcion.delete).not.toHaveBeenCalled();
  });

  it('permite borrar una inscripción pendiente (la propia)', async () => {
    const { service, prisma } = build({
      inscripcion: { ...INSCRIPCION_BASE, estado: InscripcionEstado.PENDIENTE_CONFIRMACION },
    });
    await service.remove('insc-1', 'jug-1');
    expect(prisma.inscripcion.delete).toHaveBeenCalledWith({ where: { id: 'insc-1' } });
  });

  it('rechaza si no es el jugador1', async () => {
    const { service, prisma } = build();
    await expect(service.remove('insc-1', 'otro')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.inscripcion.delete).not.toHaveBeenCalled();
  });
});
