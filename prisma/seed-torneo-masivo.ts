/**
 * seed-torneo-masivo.ts
 *
 * Inserts a large number of test pairs into a specific tournament,
 * with exact counts per category as specified.
 * Bypasses all backend validations — direct Prisma inserts.
 * All inscriptions are CONFIRMADA with verified payments.
 *
 * Usage:
 *   npx ts-node prisma/seed-torneo-masivo.ts <tournamentId>
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ─── Target pairs per category ─────────────────────────────────

const MASCULINO_TARGETS: Record<string, number> = {
  '8va': 13,
  '7ma': 21,
  '6ta': 15,
  '5ta': 12,
  '4ta': 8,
  '3ra': 6,
  // 2da: 0, 1ra: 0
};

const FEMENINO_TARGETS: Record<string, number> = {
  '8va': 26,
  '7ma': 24,
  '6ta': 16,
  '5ta': 19,
  '4ta': 12,
  // 3ra: 0, 2da: 0, 1ra: 0
};

const TOTAL_M = Object.values(MASCULINO_TARGETS).reduce((a, b) => a + b, 0); // 75
const TOTAL_F = Object.values(FEMENINO_TARGETS).reduce((a, b) => a + b, 0); // 97
const TOTAL_PLAYERS_M = TOTAL_M * 2; // 150
const TOTAL_PLAYERS_F = TOTAL_F * 2; // 194

// ─── Name pools ────────────────────────────────────────────────

const nombresM = [
  'Carlos', 'Martín', 'Diego', 'Alejandro', 'Fernando', 'Gabriel', 'Sebastián', 'Nicolás',
  'Matías', 'Lucas', 'Joaquín', 'Santiago', 'Andrés', 'Rafael', 'Daniel', 'Pablo',
  'Emiliano', 'Rodrigo', 'Tomás', 'Ignacio', 'Facundo', 'Bruno', 'Maximiliano', 'Federico',
  'Agustín', 'Franco', 'Leandro', 'Gonzalo', 'Ramiro', 'Cristian', 'Marcelo', 'Hugo',
  'Óscar', 'Esteban', 'Víctor', 'Adrián', 'Julio', 'César', 'Fabián', 'Hernán',
  'Javier', 'Mauricio', 'Ricardo', 'Eduardo', 'Luis', 'Roberto', 'Alberto', 'Miguel',
  'Sergio', 'Antonio', 'Manuel', 'Jorge', 'Francisco', 'Raúl', 'Enrique', 'Alfredo',
  'Gustavo', 'Walter', 'Rubén', 'Héctor', 'Darío', 'Iván', 'Claudio', 'Ariel',
  'Leonardo', 'Néstor', 'Armando', 'Orlando', 'Ernesto', 'Ángel', 'Damián', 'Joel',
  'Lautaro', 'Thiago', 'Bautista', 'Benicio', 'Dante', 'Gael', 'Noah', 'Ian',
  'Elías', 'Ciro', 'Valentín', 'Santino', 'Lorenzo', 'Simón', 'Mateo', 'Benjamín',
  'Axel', 'Dylan', 'Alan', 'Kevin', 'Braian', 'Jonathan', 'Christian', 'Ezequiel',
  'Mauro', 'Gerardo', 'Nelson', 'Rolando', 'Osvaldo', 'Reinaldo', 'Aníbal', 'Félix',
  'Pascual', 'Celestino', 'Amado', 'Bernardo', 'Isidro', 'Porfirio', 'Teófilo', 'Zoilo',
  'Abundio', 'Cándido', 'Demetrio', 'Epifanio', 'Florentino', 'Genaro', 'Hilario', 'Jacinto',
  'Ladislao', 'Macedonio', 'Nicandro', 'Onésimo', 'Pancracio', 'Quirino', 'Rosendo', 'Silvestre',
  'Telesforo', 'Ubaldo', 'Venancio', 'Wilfrido', 'Xenón', 'Yosef', 'Zenón', 'Américo',
  'Baldomero', 'Calixto', 'Desiderio', 'Eusebio', 'Fulgencio', 'Gumersindo', 'Heriberto', 'Isidoro',
  'Jeremías', 'Kléber', 'Lázaro', 'Metodio', 'Nicanor', 'Olegario', 'Primitivo', 'Remigio',
];

const nombresF = [
  'Sofía', 'Valentina', 'Camila', 'Luciana', 'María', 'Isabella', 'Martina', 'Julieta',
  'Catalina', 'Florencia', 'Agustina', 'Victoria', 'Natalia', 'Carolina', 'Daniela', 'Paula',
  'Andrea', 'Romina', 'Micaela', 'Celeste', 'Antonella', 'Brenda', 'Gabriela', 'Fernanda',
  'Rocío', 'Belén', 'Mariana', 'Lorena', 'Carla', 'Silvana', 'Claudia', 'Verónica',
  'Patricia', 'Alejandra', 'Mónica', 'Sandra', 'Laura', 'Elena', 'Teresa', 'Marta',
  'Graciela', 'Noemí', 'Silvia', 'Liliana', 'Julia', 'Rosa', 'Ana', 'Estela',
  'Alicia', 'Beatriz', 'Carmen', 'Dolores', 'Elvira', 'Fátima', 'Gloria', 'Herminia',
  'Irma', 'Josefina', 'Karina', 'Leticia', 'Magdalena', 'Nilda', 'Olga', 'Pilar',
  'Ramona', 'Soledad', 'Tamara', 'Úrsula', 'Viviana', 'Ximena', 'Yolanda', 'Zulma',
  'Aída', 'Blanca', 'Concepción', 'Delia', 'Eugenia', 'Francisca', 'Gisela', 'Helena',
  'Inés', 'Juana', 'Lidia', 'Miriam', 'Norma', 'Ofelia', 'Palmira', 'Rebeca',
  'Sara', 'Tania', 'Vanesa', 'Wendy', 'Yasmin', 'Zenaida', 'Amalia', 'Berta',
  'Celia', 'Diana', 'Emilia', 'Flavia', 'Gilda', 'Hilda', 'Ivana', 'Jésica',
  'Lilian', 'Milagros', 'Nélida', 'Otilia', 'Priscila', 'Rafaela', 'Susana', 'Tatiana',
  'Urania', 'Virginia', 'Wanda', 'Xiomara', 'Yésica', 'Zoraida', 'Aurora', 'Bárbara',
  'Cristina', 'Dora', 'Elsa', 'Felisa', 'Gladys', 'Hortensia', 'Irene', 'Jimena',
  'Katia', 'Lucía', 'Malena', 'Nancy', 'Olivia', 'Penélope', 'Rita', 'Selena',
  'Teodora', 'Uliana', 'Vera', 'Wilma', 'Xenia', 'Yamila', 'Zaira', 'Abril',
  'Brisa', 'Clara', 'Débora', 'Esther', 'Fabiola', 'Guadalupe', 'Heidi', 'Iliana',
  'Jazmín', 'Karen', 'Lourdes', 'Mabel', 'Noelia', 'Oriana', 'Paloma', 'Ruth',
  'Samanta', 'Thelma', 'Uxía', 'Vilma', 'Yuliana', 'Zara', 'Alma', 'Bianca',
  'Claudina', 'Dalila', 'Edith', 'Fiona', 'Griselda', 'Haydeé', 'Ileana', 'Juanita',
  'Kiara', 'Luisa', 'Marina', 'Nadia', 'Ornella', 'Perla', 'Raquel', 'Stella',
  'Trinidad', 'Uriel', 'Valeria', 'Waleska', 'Yadira', 'Zunilda', 'Adela', 'Benita',
  'Corina', 'Dominga',
];

const apellidos = [
  'González', 'López', 'Ramírez', 'Benítez', 'Giménez', 'Martínez', 'Rojas', 'Fernández',
  'Acosta', 'Villalba', 'Gómez', 'Díaz', 'Pérez', 'Torres', 'Romero', 'Álvarez',
  'Ruiz', 'Mendoza', 'Ortiz', 'Silva', 'Castro', 'Morales', 'Vargas', 'Herrera',
  'Medina', 'Flores', 'Ríos', 'Cabrera', 'Sánchez', 'Delgado', 'Vera', 'Núñez',
  'Peralta', 'Ayala', 'Cardozo', 'Espínola', 'Duarte', 'Gauto', 'Riveros', 'Aquino',
  'Barrios', 'Centurión', 'Franco', 'Lezcano', 'Ojeda', 'Paredes', 'Rolón', 'Valenzuela',
  'Arce', 'Bogado', 'Caballero', 'Domínguez', 'Escobar', 'Figueredo', 'García', 'Insfrán',
  'Jara', 'Leguizamón', 'Maidana', 'Narváez', 'Ocampo', 'Patiño', 'Quintana', 'Recalde',
  'Samudio', 'Toledo', 'Urdapilleta', 'Velázquez', 'Zacarías', 'Agüero', 'Brizuela', 'Chamorro',
  'Echagüe', 'Fretes', 'Gamarra', 'Ibarra', 'Jiménez', 'Krivoshein', 'Laterza', 'Monges',
  'Narvaja', 'Otazú', 'Pintos', 'Quiñónez', 'Romagnoli', 'Sanabria', 'Torales', 'Urunaga',
  'Vázquez', 'Yegros', 'Zarate', 'Almada', 'Báez', 'Coronel', 'Delvalle', 'Enciso',
  'Ferreira', 'Godoy', 'Huerta', 'Irala', 'Jacquet', 'Klein', 'Lugo', 'Maldonado',
  'Noguera', 'Ortigoza', 'Portillo', 'Ramoa', 'Saldívar', 'Talavera', 'Urbieta', 'Viveros',
  'Ybarra', 'Zaldívar', 'Amarilla', 'Brítez', 'Cantero', 'Dávalos', 'Echeverría', 'Fleitas',
  'Garay', 'Haedo', 'Insaurralde', 'Jover', 'Kallsen', 'Leiva', 'Montiel', 'Nuñez',
  'Olmedo', 'Penayo', 'Rolon', 'Samaniego', 'Taboada', 'Urrutia', 'Yaluk', 'Zarza',
  'Arguello', 'Bobadilla', 'Colmán', 'Dure', 'Etcheverry', 'Fariña', 'Guzmán', 'Hicks',
  'Isasi', 'Jáuregui', 'Kanasawa', 'Lird', 'Marecos', 'Noldin', 'Ortega', 'Palacios',
  'Quevedo', 'Riquelme', 'Sotelo', 'Troche', 'Ugarte', 'Villagra', 'Ynsfrán', 'Zárate',
];

const ciudades = ['Asunción', 'Luque', 'San Lorenzo', 'Lambaré', 'Fernando de la Mora', 'Capiatá',
  'Ñemby', 'Mariano Roque Alonso', 'Villa Elisa', 'Areguá'];

// ─── Main ──────────────────────────────────────────────────────

async function main() {
  const tournamentId = process.argv[2];
  if (!tournamentId) {
    console.error('❌ Uso: npx ts-node prisma/seed-torneo-masivo.ts <tournamentId>');
    process.exit(1);
  }

  // ── 1. Fetch tournament + categories ──
  const torneo = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      categorias: { include: { category: true } },
      modalidades: true,
    },
  });

  if (!torneo) {
    console.error(`❌ Torneo "${tournamentId}" no encontrado`);
    process.exit(1);
  }

  console.log(`\n🏆 Torneo: "${torneo.nombre}" (${torneo.estado})`);
  console.log(`   Categorías: ${torneo.categorias.length}`);

  // Map category name patterns to TournamentCategory IDs
  const catMap: Record<string, { tcId: string; catId: string; catName: string }> = {};
  for (const tc of torneo.categorias) {
    const name = tc.category.nombre.toLowerCase();
    catMap[`${tc.category.tipo}_${name}`] = {
      tcId: tc.id,
      catId: tc.categoryId,
      catName: tc.category.nombre,
    };
  }

  // Helper to find category by gender + partial name
  function findCat(genero: 'MASCULINO' | 'FEMENINO', shortName: string) {
    // shortName = "8va", "7ma", "6ta", "5ta", "4ta", "3ra", "2da", "1ra"
    const entries = Object.entries(catMap);
    for (const [key, val] of entries) {
      if (key.startsWith(genero) && val.catName.toLowerCase().includes(shortName.toLowerCase())) {
        return val;
      }
    }
    return null;
  }

  // Verify all target categories exist
  console.log('\n📋 Categorías Masculinas:');
  for (const [cat, count] of Object.entries(MASCULINO_TARGETS)) {
    const found = findCat('MASCULINO', cat);
    console.log(`   ${cat}: ${count} parejas → ${found ? `✅ ${found.catName}` : '❌ NO ENCONTRADA'}`);
    if (!found) { console.error(`❌ Categoría masculina "${cat}" no existe en el torneo`); process.exit(1); }
  }

  console.log('\n📋 Categorías Femeninas:');
  for (const [cat, count] of Object.entries(FEMENINO_TARGETS)) {
    const found = findCat('FEMENINO', cat);
    console.log(`   ${cat}: ${count} parejas → ${found ? `✅ ${found.catName}` : '❌ NO ENCONTRADA'}`);
    if (!found) { console.error(`❌ Categoría femenina "${cat}" no existe en el torneo`); process.exit(1); }
  }

  console.log(`\n👥 Necesito crear: ${TOTAL_PLAYERS_M} jugadores M + ${TOTAL_PLAYERS_F} jugadoras F = ${TOTAL_PLAYERS_M + TOTAL_PLAYERS_F} total`);

  // ── 2. Create players ──
  const passwordHash = await bcrypt.hash('test123', 10);
  const rolJugador = await prisma.role.findUnique({ where: { nombre: 'jugador' } });
  if (!rolJugador) { console.error('❌ Rol "jugador" no encontrado'); process.exit(1); }

  const modalidad = torneo.modalidades.length > 0 ? torneo.modalidades[0].modalidad : 'TRADICIONAL';
  const monto = torneo.costoInscripcion ? Number(torneo.costoInscripcion) : 0;
  const comision = monto * 0.05;

  // Create male players (docs 4000001+)
  console.log('\n👔 Creando jugadores masculinos...');
  const hombres = await createPlayers(
    TOTAL_PLAYERS_M,
    'MASCULINO',
    4000001,
    nombresM,
    passwordHash,
    rolJugador.id,
  );
  console.log(`   ✅ ${hombres.length} jugadores M listos`);

  // Create female players (docs 5000001+)
  console.log('👗 Creando jugadoras femeninas...');
  const mujeres = await createPlayers(
    TOTAL_PLAYERS_F,
    'FEMENINO',
    5000001,
    nombresF,
    passwordHash,
    rolJugador.id,
  );
  console.log(`   ✅ ${mujeres.length} jugadoras F listas`);

  // ── 3. Create pairs & inscriptions ──
  let mIdx = 0;
  let totalParejas = 0;

  console.log('\n═══════════════════════════════════════');
  console.log('  INSCRIBIENDO PAREJAS MASCULINAS');
  console.log('═══════════════════════════════════════');

  for (const [catShort, targetPairs] of Object.entries(MASCULINO_TARGETS)) {
    const cat = findCat('MASCULINO', catShort)!;
    console.log(`\n🎯 ${cat.catName}: ${targetPairs} parejas`);

    const created = await createPairsAndInscribe(
      hombres, mIdx, targetPairs, torneo.id, cat.catId, modalidad, monto, comision,
    );
    mIdx += targetPairs * 2;
    totalParejas += created;
    console.log(`   ✅ ${created} parejas inscritas`);
  }

  let fIdx = 0;
  console.log('\n═══════════════════════════════════════');
  console.log('  INSCRIBIENDO PAREJAS FEMENINAS');
  console.log('═══════════════════════════════════════');

  for (const [catShort, targetPairs] of Object.entries(FEMENINO_TARGETS)) {
    const cat = findCat('FEMENINO', catShort)!;
    console.log(`\n🎯 ${cat.catName}: ${targetPairs} parejas`);

    const created = await createPairsAndInscribe(
      mujeres, fIdx, targetPairs, torneo.id, cat.catId, modalidad, monto, comision,
    );
    fIdx += targetPairs * 2;
    totalParejas += created;
    console.log(`   ✅ ${created} parejas inscritas`);
  }

  // ── 4. Update tournament category states to INSCRIPCIONES_CERRADAS ──
  console.log('\n🔒 Cerrando inscripciones en todas las categorías...');
  for (const tc of torneo.categorias) {
    // Only close categories that have inscriptions
    const hasTarget =
      findCat('MASCULINO', tc.category.nombre.toLowerCase().split(' ')[0]) ||
      findCat('FEMENINO', tc.category.nombre.toLowerCase().split(' ')[0]);

    if (hasTarget) {
      await prisma.tournamentCategory.update({
        where: { id: tc.id },
        data: { estado: 'INSCRIPCIONES_CERRADAS', inscripcionAbierta: false },
      });
      console.log(`   ✅ ${tc.category.nombre} → INSCRIPCIONES_CERRADAS`);
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log(`🎉 TOTAL: ${totalParejas} parejas inscritas al torneo "${torneo.nombre}"`);
  if (monto > 0) {
    console.log(`💰 Pagos: ${totalParejas} x Gs.${monto.toLocaleString()} = Gs.${(totalParejas * monto).toLocaleString()}`);
  }
  console.log('═══════════════════════════════════════');
  console.log('\n✅ Listo para sorteo. Configurar canchas y ejecutar sorteo desde el panel.');
  console.log('   Login ejemplo: Doc 4000001 / Password test123 (hombre)');
  console.log('   Login ejemplo: Doc 5000001 / Password test123 (mujer)');
}

// ─── Helpers ───────────────────────────────────────────────────

async function createPlayers(
  count: number,
  genero: 'MASCULINO' | 'FEMENINO',
  docStart: number,
  namePool: string[],
  passwordHash: string,
  roleId: string,
): Promise<{ id: string; documento: string }[]> {
  const players: { id: string; documento: string }[] = [];

  for (let i = 0; i < count; i++) {
    const doc = `${docStart + i}`;
    const nombre = namePool[i % namePool.length];
    const apellido = apellidos[i % apellidos.length];
    const suffix = i >= namePool.length ? `${Math.floor(i / namePool.length) + 1}` : '';
    const ciudad = ciudades[i % ciudades.length];

    // Check if already exists
    let user = await prisma.user.findUnique({ where: { documento: doc } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          documento: doc,
          nombre: nombre + suffix,
          apellido,
          genero,
          email: `test.${genero.toLowerCase().charAt(0)}${doc}@fairpadel-test.com`,
          telefono: `+595${genero === 'MASCULINO' ? '982' : '983'}${String(i + 1).padStart(6, '0')}`,
          passwordHash,
          estado: 'ACTIVO',
          emailVerificado: true,
          ciudad,
        },
      });

      await prisma.userRole.create({
        data: { userId: user.id, roleId },
      });
    }

    players.push({ id: user.id, documento: user.documento });
  }

  return players;
}

async function createPairsAndInscribe(
  players: { id: string; documento: string }[],
  startIdx: number,
  targetPairs: number,
  tournamentId: string,
  categoryId: string,
  modalidad: string,
  monto: number,
  comision: number,
): Promise<number> {
  let created = 0;

  for (let i = 0; i < targetPairs; i++) {
    const p1 = players[startIdx + i * 2];
    const p2 = players[startIdx + i * 2 + 1];

    if (!p1 || !p2) {
      console.error(`   ⚠️  No hay suficientes jugadores (necesitaba índice ${startIdx + i * 2 + 1})`);
      break;
    }

    // Check duplicate
    const existing = await prisma.inscripcion.findFirst({
      where: {
        tournamentId,
        categoryId,
        pareja: {
          OR: [
            { jugador1Id: p1.id, jugador2Id: p2.id },
            { jugador1Id: p2.id, jugador2Id: p1.id },
          ],
        },
      },
    });

    if (existing) {
      created++;
      continue;
    }

    const pareja = await prisma.pareja.create({
      data: {
        jugador1Id: p1.id,
        jugador2Id: p2.id,
        jugador2Documento: p2.documento,
      },
    });

    const inscripcion = await prisma.inscripcion.create({
      data: {
        tournamentId,
        parejaId: pareja.id,
        categoryId,
        modalidad: modalidad as any,
        estado: 'CONFIRMADA',
        modoPago: 'COMPLETO',
      },
    });

    // Create confirmed payment
    if (monto > 0) {
      await prisma.pago.create({
        data: {
          inscripcionId: inscripcion.id,
          jugadorId: p1.id,
          metodoPago: 'EFECTIVO',
          monto,
          comision,
          estado: 'CONFIRMADO',
          fechaPago: new Date(),
          fechaConfirm: new Date(),
        },
      });
    }

    created++;
  }

  return created;
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
