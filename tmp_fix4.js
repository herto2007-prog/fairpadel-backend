const fs = require('fs');
let c = fs.readFileSync('src/modules/americano/americano.service.ts', 'utf8');

// Find and remove the duplicate config declaration in iniciarPrimeraRonda
let marker = '// Crear partidos emparejando parejas entre s';
let idx = c.indexOf(marker);
if (idx !== -1) {
  let lineStart = c.lastIndexOf('\n', idx) + 1;
  let nextLine = c.indexOf('\n', lineStart);
  let line2 = c.indexOf('\n', nextLine + 1);
  let line3 = c.indexOf('\n', line2 + 1);
  
  let oldText = c.substring(lineStart, line3 + 1);
  let newText = '    // Crear partidos emparejando parejas entre si\n    const canchasSimultaneas = config.modoJuego?.canchasSimultaneas ?? 1;\n';
  
  c = c.replace(oldText, newText);
  console.log('Removed duplicate config in iniciarPrimeraRonda');
} else {
  console.log('Marker not found');
}

fs.writeFileSync('src/modules/americano/americano.service.ts', c, 'utf8');
