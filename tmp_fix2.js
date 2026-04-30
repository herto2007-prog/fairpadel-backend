const fs = require('fs');
let c = fs.readFileSync('src/modules/americano/americano.service.ts', 'utf8');

// Fix 2: add config/esParejasFijas before jugadores
let a2 = "    const jugadores = torneo.inscripciones.map(i => i.jugador1);";
let b2 = `    const config = (torneo.configAmericano as unknown as ConfigAmericano) ?? { rondaActual: 0, visibilidad: 'publico', modoJuegoConfigurado: false, inscripcionesAbiertas: true, tipoInscripcion: 'individual' };
    const esParejasFijas = config.tipoInscripcion === 'parejasFijas';

    const jugadores = torneo.inscripciones.map(i => i.jugador1);`;
if (c.includes(a2)) { c = c.replace(a2, b2); console.log('Fix 2 done'); }
else { console.log('Fix 2 FAILED'); }

fs.writeFileSync('src/modules/americano/americano.service.ts', c, 'utf8');
