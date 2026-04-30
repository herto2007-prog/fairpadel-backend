const fs = require('fs');
let c = fs.readFileSync('src/modules/americano/americano.service.ts', 'utf8');

// Fix 3: replace pareja generation block
let a3 = `    // Generar parejas aleatorias (sin repetir compa`;
let idx = c.indexOf(a3);
if (idx === -1) {
  console.log('Fix 3 FAILED: start marker not found');
  process.exit(1);
}

let start = idx;
let endMarker = `    // Crear partidos emparejando parejas entre s`;
let end = c.indexOf(endMarker, start);
if (end === -1) {
  console.log('Fix 3 FAILED: end marker not found');
  process.exit(1);
}

let oldBlock = c.substring(start, end);

let newBlock = `    let parejasCreadas: { id: string; jugador1Id: string; jugador2Id: string }[] = [];

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
    }

`;

c = c.substring(0, start) + newBlock + c.substring(end);

fs.writeFileSync('src/modules/americano/americano.service.ts', c, 'utf8');
console.log('Fix 3 done');
