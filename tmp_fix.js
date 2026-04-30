const fs = require('fs');
let content = fs.readFileSync('src/modules/americano/americano.service.ts', 'utf8');

// 1. Add jugador2 to include in iniciarPrimeraRonda
const oldInclude = `jugador1: { select: { id: true, nombre: true, apellido: true } },
          },
        },
        americanosRonda: true,
      },
    });`;

const newInclude = `jugador1: { select: { id: true, nombre: true, apellido: true } },
            jugador2: { select: { id: true, nombre: true, apellido: true } },
          },
        },
        americanosRonda: true,
      },
    });`;

if (!content.includes(oldInclude)) {
  console.log('Pattern 1 not found');
  process.exit(1);
}

content = content.replace(oldInclude, newInclude);

// 2. Replace generar parejas section
const oldGenerar = `const jugadores = torneo.inscripciones.map(i => i.jugador1);

    if (jugadores.length < 4) {
      throw new BadRequestException('Se necesitan al menos 4 jugadores para iniciar');
    }

    if (torneo.americanosRonda.length > 0) {
      throw new BadRequestException('Ya existe al menos una ronda iniciada');
    }

    // Crear ronda 1
    const ronda = await this.prisma.americanoRonda.create({
      data: {
        numero: 1,
        torneoId,
        estado: 'EN_JUEGO',
      },
    });

    // Generar parejas aleatorias (sin repetir companero - en ronda 1 todos son nuevos)
    const parejasJugadores = this.generarParejasAleatorias(jugadores.map(j => j.id));

    // Guardar parejas y obtener sus IDs
    const parejasCreadas: { id: string; jugador1Id: string; jugador2Id: string }[] = [];
    for (const [j1, j2] of parejasJugadores) {
      const p = await this.prisma.americanoParejaRonda.create({
        data: {
          rondaId: ronda.id,
          jugador1Id: j1,
          jugador2Id: j2,
        },
      });
      parejasCreadas.push({ id: p.id, jugador1Id: j1, jugador2Id: j2 });
    }`;

const newGenerar = `const config = (torneo.configAmericano as unknown as ConfigAmericano) ?? { rondaActual: 0, visibilidad: 'publico', modoJuegoConfigurado: false, inscripcionesAbiertas: true, tipoInscripcion: 'individual' };
    const esParejasFijas = config.tipoInscripcion === 'parejasFijas';

    const jugadores = torneo.inscripciones.map(i => i.jugador1);

    if (jugadores.length < 4) {
      throw new BadRequestException('Se necesitan al menos 4 jugadores para iniciar');
    }

    if (torneo.americanosRonda.length > 0) {
      throw new BadRequestException('Ya existe al menos una ronda iniciada');
    }

    // Crear ronda 1
    const ronda = await this.prisma.americanoRonda.create({
      data: {
        numero: 1,
        torneoId,
        estado: 'EN_JUEGO',
      },
    });

    let parejasCreadas: { id: string; jugador1Id: string; jugador2Id: string }[] = [];

    if (esParejasFijas) {
      // Usar las parejas definidas en las inscripciones
      const inscripcionesConPareja = torneo.inscripciones.filter(i => i.jugador2Id);
      if (inscripcionesConPareja.length < 2) {
        throw new BadRequestException('Se necesitan al menos 2 parejas completas para iniciar (parejas fijas)');
      }
      if (inscripcionesConPareja.length !== torneo.inscripciones.length) {
        throw new BadRequestException('Todos los inscriptos deben tener un companero asignado (parejas fijas)');
      }
      for (const insc of inscripcionesConPareja) {
        const p = await this.prisma.americanoParejaRonda.create({
          data: {
            rondaId: ronda.id,
            jugador1Id: insc.jugador1Id,
            jugador2Id: insc.jugador2Id!,
          },
        });
        parejasCreadas.push({ id: p.id, jugador1Id: insc.jugador1Id, jugador2Id: insc.jugador2Id! });
      }
    } else {
      // Generar parejas aleatorias (sin repetir companero)
      const parejasJugadores = this.generarParejasAleatorias(jugadores.map(j => j.id));
      for (const [j1, j2] of parejasJugadores) {
        const p = await this.prisma.americanoParejaRonda.create({
          data: {
            rondaId: ronda.id,
            jugador1Id: j1,
            jugador2Id: j2,
          },
        });
        parejasCreadas.push({ id: p.id, jugador1Id: j1, jugador2Id: j2 });
      }
    }`;

if (!content.includes(oldGenerar)) {
  console.log('Pattern 2 not found');
  process.exit(1);
}

content = content.replace(oldGenerar, newGenerar);

fs.writeFileSync('src/modules/americano/americano.service.ts', content, 'utf8');
console.log('Done');
