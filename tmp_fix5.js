const fs = require('fs');
let c = fs.readFileSync('src/modules/americano/americano.service.ts', 'utf8');

// Find generarSiguienteRonda and replace pareja generation
let marker = '// Obtener jugadores ordenados por ranking de la ronda anterior';
let idx = c.indexOf(marker);
if (idx === -1) {
  console.log('Marker not found');
  process.exit(1);
}

let lineStart = c.lastIndexOf('\n', idx) + 1;
let endMarker = '// Crear nueva ronda';
let endIdx = c.indexOf(endMarker, idx);
if (endIdx === -1) {
  console.log('End marker not found');
  process.exit(1);
}

let oldText = c.substring(lineStart, endIdx);

let newText = `// Si es parejas fijas, mantener las mismas parejas que en la primera ronda
    let nuevaParejas: [string, string][] = [];
    let parejasRondaAnterior: { id: string; jugador1Id: string; jugador2Id: string }[] = [];

    if (config.tipoInscripcion === 'parejasFijas') {
      // Obtener parejas de la primera ronda (o de inscripciones)
      const primeraRonda = await this.prisma.americanoRonda.findFirst({
        where: { torneoId },
        orderBy: { numero: 'asc' },
        include: { parejas: true },
      });
      if (primeraRonda) {
        for (const par of primeraRonda.parejas) {
          nuevaParejas.push([par.jugador1Id, par.jugador2Id]);
          parejasRondaAnterior.push(par);
        }
      }
    } else {
      // Obtener jugadores ordenados por ranking de la ronda anterior
      const ranking = ultimaRonda.puntajes.map(p => ({
        jugadorId: p.jugadorId,
        puntos: p.puntos,
        diferenciaGames: p.diferenciaGames,
      }));

      // Obtener historial de parejas para evitar repetir companeros
      const historialParejas = await this.obtenerHistorialParejas(torneoId);

      // Generar nuevas parejas (1ro con ultimo, evitando repetir companeros)
      nuevaParejas = this.generarParejasPorRanking(
        ranking.map(r => r.jugadorId),
        historialParejas,
      );
    }

`;

c = c.substring(0, lineStart) + newText + c.substring(endIdx);

fs.writeFileSync('src/modules/americano/americano.service.ts', c, 'utf8');
console.log('Fix 5 done');
