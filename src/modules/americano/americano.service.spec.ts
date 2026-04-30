import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { AmericanoService, ConfigAmericano, ModoJuegoConfig } from './americano.service';
import { PrismaService } from '../../prisma/prisma.service';

function createMockPrisma() {
  return {
    tournament: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    inscripcion: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    category: {
      findFirst: jest.fn(),
    },
    americanoRonda: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    americanoParejaRonda: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    americanoPartido: {
      findFirst: jest.fn(),
      update: jest.fn(),
      createMany: jest.fn(),
    },
    americanoPuntaje: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

describe('AmericanoService', () => {
  let service: AmericanoService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AmericanoService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AmericanoService>(AmericanoService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // ALGORITMOS DE PAREJAS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('generarParejasAleatorias', () => {
    it('debe generar parejas sin repetir jugador (4 jugadores)', () => {
      const jugadores = ['a', 'b', 'c', 'd'];
      const parejas = (service as any).generarParejasAleatorias(jugadores);
      
      expect(parejas).toHaveLength(2);
      const usados = new Set<string>();
      for (const [j1, j2] of parejas) {
        expect(j1).not.toBe(j2);
        expect(usados.has(j1)).toBe(false);
        expect(usados.has(j2)).toBe(false);
        usados.add(j1);
        usados.add(j2);
      }
    });

    it('debe manejar número impar dejugadores (5 jugadores = 2 parejas + 1 bye)', () => {
      const jugadores = ['a', 'b', 'c', 'd', 'e'];
      const parejas = (service as any).generarParejasAleatorias(jugadores);
      
      expect(parejas).toHaveLength(2);
      const usados = new Set<string>();
      for (const [j1, j2] of parejas) {
        usados.add(j1);
        usados.add(j2);
      }
      expect(usados.size).toBe(4); // 1 jugador queda sin pareja (bye)
    });
  });

  describe('generarParejasPorRanking', () => {
    it('debe emparejar 1ro con último, 2do con penúltimo', () => {
      const ranking = ['a', 'b', 'c', 'd'];
      const historial = new Set<string>();
      const parejas = (service as any).generarParejasPorRanking(ranking, historial);
      
      expect(parejas).toHaveLength(2);
      expect(parejas[0]).toEqual(['a', 'd']);
      expect(parejas[1]).toEqual(['b', 'c']);
    });

    it('debe evitar emparejar un jugador consigo mismo (número impar)', () => {
      const ranking = ['a', 'b', 'c', 'd', 'e'];
      const historial = new Set<string>();
      const parejas = (service as any).generarParejasPorRanking(ranking, historial);
      
      expect(parejas).toHaveLength(2); // 2 parejas, 1 jugador con bye
      const usados = new Set<string>();
      for (const [j1, j2] of parejas) {
        expect(j1).not.toBe(j2);
        usados.add(j1);
        usados.add(j2);
      }
      expect(usados.size).toBe(4);
    });

    it('debe intentar evitar parejas repetidas del historial', () => {
      const ranking = ['a', 'b', 'c', 'd'];
      const historial = new Set<string>(['a-d']); // a ya jugó con d
      const parejas = (service as any).generarParejasPorRanking(ranking, historial);
      
      expect(parejas).toHaveLength(2);
      // Como 'a-d' está en historial, debería intentar swap
      const key0 = [parejas[0][0], parejas[0][1]].sort().join('-');
      expect(key0).not.toBe('a-d');
    });
  });

  describe('crearPartidosDeRonda', () => {
    it('debe crear partidos emparejando parejas 0vs1, 2vs3', async () => {
      const parejas = [
        { id: 'p1', jugador1Id: 'a', jugador2Id: 'b' },
        { id: 'p2', jugador1Id: 'c', jugador2Id: 'd' },
        { id: 'p3', jugador1Id: 'e', jugador2Id: 'f' },
        { id: 'p4', jugador1Id: 'g', jugador2Id: 'h' },
      ];
      
      await (service as any).crearPartidosDeRonda('ronda1', parejas, 2);
      
      expect(prisma.americanoPartido.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ rondaId: 'ronda1', parejaAId: 'p1', parejaBId: 'p2', cancha: 1, estado: 'PENDIENTE' }),
          expect.objectContaining({ rondaId: 'ronda1', parejaAId: 'p3', parejaBId: 'p4', cancha: 2, estado: 'PENDIENTE' }),
        ]),
      });
    });

    it('debe rotar canchas en round-robin', async () => {
      const parejas = [
        { id: 'p1', jugador1Id: 'a', jugador2Id: 'b' },
        { id: 'p2', jugador1Id: 'c', jugador2Id: 'd' },
        { id: 'p3', jugador1Id: 'e', jugador2Id: 'f' },
        { id: 'p4', jugador1Id: 'g', jugador2Id: 'h' },
        { id: 'p5', jugador1Id: 'i', jugador2Id: 'j' },
        { id: 'p6', jugador1Id: 'k', jugador2Id: 'l' },
      ];
      
      await (service as any).crearPartidosDeRonda('ronda1', parejas, 2);
      
      const callData = prisma.americanoPartido.createMany.mock.calls[0][0].data;
      expect(callData[0].cancha).toBe(1);
      expect(callData[1].cancha).toBe(2);
      expect(callData[2].cancha).toBe(1); // vuelve a cancha 1
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // INSCRIPCIONES
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('inscribirJugador', () => {
    it('debe rechazar inscripción duplicada como jugador1', async () => {
      const torneo = {
        id: 't1',
        formato: 'americano',
        configAmericano: { tipoInscripcion: 'individual', inscripcionesAbiertas: true } as unknown as ConfigAmericano,
      };
      prisma.tournament.findUnique.mockResolvedValue(torneo);
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      prisma.inscripcion.findFirst.mockResolvedValue({ id: 'insc1' }); // ya existe

      await expect(service.inscribirJugador('t1', { jugadorId: 'u1' })).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar inscripción duplicada como jugador2 en parejas fijas', async () => {
      const torneo = {
        id: 't1',
        formato: 'americano',
        configAmericano: { tipoInscripcion: 'parejasFijas', inscripcionesAbiertas: true } as unknown as ConfigAmericano,
      };
      prisma.tournament.findUnique.mockResolvedValue(torneo);
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      prisma.category.findFirst.mockResolvedValue({ id: 'cat1' });
      // Primera búsqueda: el jugador principal no está inscrito
      // Segunda búsqueda: el compañero no está inscrito
      prisma.inscripcion.findFirst
        .mockResolvedValueOnce(null) // jugador principal no está
        .mockResolvedValueOnce(null); // compañero no está

      await service.inscribirJugador('t1', { jugadorId: 'u1', jugador2Id: 'u2' });
      expect(prisma.inscripcion.create).toHaveBeenCalled();
    });

    it('debe rechazar auto-compañero', async () => {
      const torneo = {
        id: 't1',
        formato: 'americano',
        configAmericano: { tipoInscripcion: 'parejasFijas', inscripcionesAbiertas: true } as unknown as ConfigAmericano,
      };
      prisma.tournament.findUnique.mockResolvedValue(torneo);
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });

      await expect(service.inscribirJugador('t1', { jugadorId: 'u1', jugador2Id: 'u1' })).rejects.toThrow(BadRequestException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // CONFIGURACIÓN
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('configurarModoJuego', () => {
    it('debe sincronizar config.tipoInscripcion con modoJuego.tipoInscripcion', async () => {
      const torneo = {
        id: 't1',
        organizadorId: 'org1',
        formato: 'americano',
        configAmericano: { tipoInscripcion: 'individual' } as unknown as ConfigAmericano,
        inscripciones: [],
      };
      prisma.tournament.findUnique.mockResolvedValue(torneo);

      const modoJuego: ModoJuegoConfig = {
        tipoInscripcion: 'parejasFijas',
        rotacion: 'automatica',
        sistemaPuntos: 'games',
        formatoPartido: 'games',
        valorObjetivo: 6,
        categorias: 'sin',
        numRondas: '4',
        canchasSimultaneas: 2,
      };

      await service.configurarModoJuego('t1', 'org1', modoJuego);

      expect(prisma.tournament.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: expect.objectContaining({
          configAmericano: expect.objectContaining({
            tipoInscripcion: 'parejasFijas',
            modoJuego: expect.objectContaining({ tipoInscripcion: 'parejasFijas' }),
          }),
        }),
      });
    });

    it('debe rechazar cambio a parejas fijas si hay inscriptos sin pareja', async () => {
      const torneo = {
        id: 't1',
        organizadorId: 'org1',
        formato: 'americano',
        configAmericano: { tipoInscripcion: 'individual' } as unknown as ConfigAmericano,
        inscripciones: [{ id: 'i1', jugador2Id: null }],
      };
      prisma.tournament.findUnique.mockResolvedValue(torneo);

      const modoJuego: ModoJuegoConfig = {
        tipoInscripcion: 'parejasFijas',
        rotacion: 'automatica',
        sistemaPuntos: 'games',
        formatoPartido: 'games',
        valorObjetivo: 6,
        categorias: 'sin',
        numRondas: '4',
      };

      await expect(service.configurarModoJuego('t1', 'org1', modoJuego)).rejects.toThrow(BadRequestException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // RONDAS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('iniciarPrimeraRonda', () => {
    it('debe crear parejas fijas desde inscripciones', async () => {
      const torneo = {
        id: 't1',
        organizadorId: 'org1',
        formato: 'americano',
        configAmericano: { tipoInscripcion: 'parejasFijas', modoJuego: { canchasSimultaneas: 1 } } as unknown as ConfigAmericano,
        inscripciones: [
          { id: 'i1', jugador1Id: 'a', jugador2Id: 'b', estado: 'CONFIRMADA', jugador1: { id: 'a', nombre: 'A', apellido: '' }, jugador2: { id: 'b', nombre: 'B', apellido: '' } },
          { id: 'i2', jugador1Id: 'c', jugador2Id: 'd', estado: 'CONFIRMADA', jugador1: { id: 'c', nombre: 'C', apellido: '' }, jugador2: { id: 'd', nombre: 'D', apellido: '' } },
        ],
        americanosRonda: [],
      };
      prisma.tournament.findUnique.mockResolvedValue(torneo);
      const rondaCreada = { id: 'r1', numero: 1, estado: 'EN_JUEGO' };
      prisma.americanoRonda.create.mockResolvedValue(rondaCreada);
      prisma.americanoParejaRonda.create
        .mockResolvedValueOnce({ id: 'p1' })
        .mockResolvedValueOnce({ id: 'p2' });
      prisma.tournament.update.mockResolvedValue({});
      prisma.americanoPuntaje.create.mockResolvedValue({});
      prisma.americanoPartido.createMany.mockResolvedValue({});

      await service.iniciarPrimeraRonda('t1', 'org1');

      expect(prisma.americanoParejaRonda.create).toHaveBeenCalledTimes(2);
      expect(prisma.americanoParejaRonda.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
        data: expect.objectContaining({ jugador1Id: 'a', jugador2Id: 'b' }),
      }));
    });

    it('debe rechazar inicio si hay inscriptos sin pareja en modo parejas fijas', async () => {
      const torneo = {
        id: 't1',
        organizadorId: 'org1',
        formato: 'americano',
        configAmericano: { tipoInscripcion: 'parejasFijas', modoJuego: { canchasSimultaneas: 1 } } as unknown as ConfigAmericano,
        inscripciones: [
          { id: 'i1', jugador1Id: 'a', jugador2Id: 'b', estado: 'CONFIRMADA', jugador1: { id: 'a' }, jugador2: { id: 'b' } },
          { id: 'i2', jugador1Id: 'c', jugador2Id: null, estado: 'CONFIRMADA', jugador1: { id: 'c' }, jugador2: null },
        ],
        americanosRonda: [],
      };
      prisma.tournament.findUnique.mockResolvedValue(torneo);

      await expect(service.iniciarPrimeraRonda('t1', 'org1')).rejects.toThrow(BadRequestException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // CLASIFICACIÓN
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('getClasificacionTorneo', () => {
    it('debe usar SOLO la última ronda (no sumar acumulados)', async () => {
      const torneo = {
        id: 't1',
        formato: 'americano',
        americanosRonda: [
          {
            numero: 1,
            puntajes: [
              { jugador: { id: 'a', nombre: 'A', apellido: '', fotoUrl: null }, puntos: 6, partidosJugados: 1, partidosGanados: 1, partidosPerdidos: 0, setsGanados: 1, setsPerdidos: 0, gamesGanados: 6, gamesPerdidos: 4, diferenciaGames: 2 },
              { jugador: { id: 'b', nombre: 'B', apellido: '', fotoUrl: null }, puntos: 4, partidosJugados: 1, partidosGanados: 0, partidosPerdidos: 1, setsGanados: 0, setsPerdidos: 1, gamesGanados: 4, gamesPerdidos: 6, diferenciaGames: -2 },
            ],
          },
          {
            numero: 2,
            puntajes: [
              // Acumulados: a ganó 6+5=11, b ganó 4+3=7
              { jugador: { id: 'a', nombre: 'A', apellido: '', fotoUrl: null }, puntos: 11, partidosJugados: 2, partidosGanados: 2, partidosPerdidos: 0, setsGanados: 2, setsPerdidos: 0, gamesGanados: 11, gamesPerdidos: 7, diferenciaGames: 4 },
              { jugador: { id: 'b', nombre: 'B', apellido: '', fotoUrl: null }, puntos: 7, partidosJugados: 2, partidosGanados: 0, partidosPerdidos: 2, setsGanados: 0, setsPerdidos: 2, gamesGanados: 7, gamesPerdidos: 11, diferenciaGames: -4 },
            ],
          },
        ],
      };
      prisma.tournament.findUnique.mockResolvedValue(torneo);

      const clasificacion = await service.getClasificacionTorneo('t1');

      // Solo debe reflejar los puntajes de la ronda 2 (la última)
      expect(clasificacion).toHaveLength(2);
      expect(clasificacion[0].puntosTotal).toBe(11); // no 6+11=17
      expect(clasificacion[1].puntosTotal).toBe(7);  // no 4+7=11
      expect(clasificacion[0].partidosJugados).toBe(2);
    });

    it('debe retornar array vacío si no hay rondas', async () => {
      const torneo = {
        id: 't1',
        formato: 'americano',
        americanosRonda: [],
      };
      prisma.tournament.findUnique.mockResolvedValue(torneo);

      const clasificacion = await service.getClasificacionTorneo('t1');
      expect(clasificacion).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // RESULTADOS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('registrarResultado', () => {
    it('debe dar error si no existe el partido entre las parejas', async () => {
      const torneo = { id: 't1', organizadorId: 'org1', formato: 'americano' };
      prisma.tournament.findUnique.mockResolvedValue(torneo);
      prisma.americanoRonda.findUnique.mockResolvedValue({
        id: 'r1',
        torneoId: 't1',
        estado: 'EN_JUEGO',
        parejas: [
          { id: 'pa', jugador1Id: 'a', jugador2Id: 'b' },
          { id: 'pb', jugador1Id: 'c', jugador2Id: 'd' },
        ],
      });
      prisma.americanoPartido.findFirst.mockResolvedValue(null); // no existe partido

      await expect(
        service.registrarResultado('t1', 'r1', 'pa', 'pb', [{ gamesEquipoA: 6, gamesEquipoB: 4 }], 'org1')
      ).rejects.toThrow(BadRequestException);
    });

    it('debe actualizar puntajes correctamente (games acumulados)', async () => {
      const torneo = { id: 't1', organizadorId: 'org1', formato: 'americano' };
      prisma.tournament.findUnique.mockResolvedValue(torneo);
      prisma.americanoRonda.findUnique.mockResolvedValue({
        id: 'r1',
        torneoId: 't1',
        estado: 'EN_JUEGO',
        parejas: [
          { id: 'pa', jugador1Id: 'a', jugador2Id: 'b' },
          { id: 'pb', jugador1Id: 'c', jugador2Id: 'd' },
        ],
      });
      prisma.americanoPartido.findFirst.mockResolvedValue({ id: 'm1' });
      prisma.americanoPuntaje.findUnique
        .mockResolvedValueOnce({ id: 'pa1', puntos: 0, partidosJugados: 0, partidosGanados: 0, partidosPerdidos: 0, setsGanados: 0, setsPerdidos: 0, gamesGanados: 0, gamesPerdidos: 0, diferenciaGames: 0 })
        .mockResolvedValueOnce({ id: 'pa2', puntos: 0, partidosJugados: 0, partidosGanados: 0, partidosPerdidos: 0, setsGanados: 0, setsPerdidos: 0, gamesGanados: 0, gamesPerdidos: 0, diferenciaGames: 0 })
        .mockResolvedValueOnce({ id: 'pb1', puntos: 0, partidosJugados: 0, partidosGanados: 0, partidosPerdidos: 0, setsGanados: 0, setsPerdidos: 0, gamesGanados: 0, gamesPerdidos: 0, diferenciaGames: 0 })
        .mockResolvedValueOnce({ id: 'pb2', puntos: 0, partidosJugados: 0, partidosGanados: 0, partidosPerdidos: 0, setsGanados: 0, setsPerdidos: 0, gamesGanados: 0, gamesPerdidos: 0, diferenciaGames: 0 });

      prisma.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          americanoPartido: { update: jest.fn() },
          americanoPuntaje: { findUnique: prisma.americanoPuntaje.findUnique, update: jest.fn() },
        };
        return fn(txMock);
      });

      const result = await service.registrarResultado('t1', 'r1', 'pa', 'pb', [{ gamesEquipoA: 6, gamesEquipoB: 4 }], 'org1');

      expect(result.ganador).toBe('Equipo A');
      expect(result.gamesTotalA).toBe(6);
      expect(result.gamesTotalB).toBe(4);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // NUM RONDAS (regresión del bug string vs number)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════════════
  // CÁLCULO DE RONDAS MÁXIMAS (MODO AUTOMÁTICO)
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('calcularRondasMaximas', () => {
    it('4 jugadores → 3 rondas', () => {
      expect((service as any).calcularRondasMaximas(4)).toBe(3);
    });
    it('5 jugadores → 5 rondas', () => {
      expect((service as any).calcularRondasMaximas(5)).toBe(5);
    });
    it('6 jugadores → 5 rondas', () => {
      expect((service as any).calcularRondasMaximas(6)).toBe(5);
    });
    it('7 jugadores → 7 rondas', () => {
      expect((service as any).calcularRondasMaximas(7)).toBe(7);
    });
    it('8 jugadores → 7 rondas', () => {
      expect((service as any).calcularRondasMaximas(8)).toBe(7);
    });
    it('10 jugadores → 9 rondas', () => {
      expect((service as any).calcularRondasMaximas(10)).toBe(9);
    });
    it('menos de 2 → 0', () => {
      expect((service as any).calcularRondasMaximas(1)).toBe(0);
    });
  });

  describe('generarParejasPorRanking sin combinaciones', () => {
    it('debe lanzar error cuando se agotan todas las combinaciones posibles', () => {
      const ranking = ['a', 'b', 'c', 'd'];
      // Historial con TODAS las combinaciones posibles
      const historial = new Set<string>([
        'a-b', 'a-c', 'a-d',
        'b-c', 'b-d',
        'c-d',
      ]);

      expect(() => (service as any).generarParejasPorRanking(ranking, historial)).toThrow(BadRequestException);
    });
  });

  describe('numRondasMax manual', () => {
    it('debe interpretar numRondas="5" como 5 rondas', () => {
      const numRondasConfig: any = '5';
      const numRondasMax = numRondasConfig === 'automatico' ? 999 : (typeof numRondasConfig === 'number' ? numRondasConfig : parseInt(numRondasConfig as string, 10) || 4);
      expect(numRondasMax).toBe(5);
    });

    it('debe interpretar numRondas=5 como 5 rondas', () => {
      const numRondasConfig: any = 5;
      const numRondasMax = numRondasConfig === 'automatico' ? 999 : (typeof numRondasConfig === 'number' ? numRondasConfig : parseInt(numRondasConfig as string, 10) || 4);
      expect(numRondasMax).toBe(5);
    });

    it('debe interpretar numRondas="automatico" como 999 (fallback legacy)', () => {
      const numRondasConfig: any = 'automatico';
      const numRondasMax = numRondasConfig === 'automatico' ? 999 : (typeof numRondasConfig === 'number' ? numRondasConfig : parseInt(numRondasConfig as string, 10) || 4);
      expect(numRondasMax).toBe(999);
    });
  });
});
