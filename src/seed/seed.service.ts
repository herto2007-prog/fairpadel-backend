import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Gender } from '@prisma/client';

// Reglas base para modalidades
const REGLAS_BASE = {
  tipoEmparejamiento: 'PAREJA_FIJA',
  generoRequerido: 'CUALQUIERA',
  sistemaPuntos: 'TRADICIONAL',
  formatoBracket: 'ELIMINACION_DIRECTA',
  setsPorPartido: 3,
  puntosPorVictoria: 100,
  puntosPorDerrota: 50,
  requierePareja: true,
  permiteIndividual: false,
  descripcionLarga: '',
  // Nuevos campos para diferenciar variantes
  minimoPartidosGarantizados: 1,
  variante: 'MUNDIAL', // 'PY' o 'MUNDIAL'
};

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    this.logger.log('🌱 Iniciando seed...');
    try {
      await this.seedCategories();
      await this.seedRoles();
      await this.seedModalidades();
      await this.seedJugadoresDemo(); // NUEVO: Crear jugadores demo automáticamente
      await this.seedWhatsAppTemplates(); // NUEVO: Crear templates de WhatsApp
      this.logger.log('✅ Seed completado');
    } catch (error) {
      this.logger.error('❌ Error en seed:', error.message);
      // No propagamos el error para no bloquear el inicio de la app
    }
  }

  private async seedCategories() {
    // Categorías del sistema paraguayo de pádel
    // NOTA: Las categorías NO tienen género. El género es del usuario.
    // El sistema separa competencias por género (Caballeros/Damas) al organizar torneos.
    const categorias = [
      { nombre: 'Principiante', tipo: Gender.MASCULINO, orden: 0 },
      { nombre: '8ª Categoría', tipo: Gender.MASCULINO, orden: 1 },
      { nombre: '7ª Categoría', tipo: Gender.MASCULINO, orden: 2 },
      { nombre: '6ª Categoría', tipo: Gender.MASCULINO, orden: 3 },
      { nombre: '5ª Categoría', tipo: Gender.MASCULINO, orden: 4 },
      { nombre: '4ª Categoría', tipo: Gender.MASCULINO, orden: 5 },
      { nombre: '3ª Categoría', tipo: Gender.MASCULINO, orden: 6 },
      { nombre: '2ª Categoría', tipo: Gender.MASCULINO, orden: 7 },
      { nombre: '1ª Categoría', tipo: Gender.MASCULINO, orden: 8 },
    ];



    for (const categoria of categorias) {
      await this.prisma.category.upsert({
        where: { nombre: categoria.nombre },
        update: {}, // No actualizar si ya existe
        create: categoria,
      });
    }

    this.logger.log('✅ Categorías verificadas');
  }

  private async seedRoles() {
    const roles = [
      { nombre: 'jugador', descripcion: 'Jugador de pádel' },
      { nombre: 'admin', descripcion: 'Administrador del sistema' },
      { nombre: 'organizador', descripcion: 'Organizador de torneos' },
    ];

    for (const rol of roles) {
      await this.prisma.role.upsert({
        where: { nombre: rol.nombre },
        update: {},
        create: rol,
      });
    }

    this.logger.log('✅ Roles verificados');
  }

  private async seedModalidades() {
    const modalidades = [
      // ═══════════════════════════════════════════════════════════
      // CLÁSICO - Parejas fijas, formato tradicional
      // ═══════════════════════════════════════════════════════════
      {
        nombre: 'Clásico PY',
        descripcion: 'Modalidad tradicional paraguaya. Todos juegan mínimo 2 partidos.',
        reglas: {
          ...REGLAS_BASE,
          variante: 'PY',
          tipoEmparejamiento: 'PAREJA_FIJA',
          sistemaPuntos: 'TRADICIONAL',
          formatoBracket: 'GARANTIZADO_2_PARTIDOS', // Todos juegan 2 partidos mínimo
          setsPorPartido: 3,
          requierePareja: true,
          minimoPartidosGarantizados: 2,
          descripcionLarga: 'Formato tradicional de Paraguay. Cada jugador forma pareja fija y garantiza jugar al menos 2 partidos. El bracket se organiza para que nadie quede eliminado en el primer partido.',
        },
      },
      {
        nombre: 'Clásico Mundo',
        descripcion: 'Modalidad clásica internacional. Eliminación directa pura.',
        reglas: {
          ...REGLAS_BASE,
          variante: 'MUNDIAL',
          tipoEmparejamiento: 'PAREJA_FIJA',
          sistemaPuntos: 'TRADICIONAL',
          formatoBracket: 'ELIMINACION_DIRECTA', // Pierdes, te vas
          setsPorPartido: 3,
          requierePareja: true,
          minimoPartidosGarantizados: 1,
          descripcionLarga: 'Formato internacional de eliminación directa. Parejas fijas. Pierdes un partido y quedas eliminado del torneo.',
        },
      },
      // ═══════════════════════════════════════════════════════════
      // MIXTO - Parejas de género opuesto
      // ═══════════════════════════════════════════════════════════
      {
        nombre: 'Mixto PY',
        descripcion: 'Modalidad mixta paraguaya. 1 hombre + 1 mujer, mínimo 2 partidos.',
        reglas: {
          ...REGLAS_BASE,
          variante: 'PY',
          tipoEmparejamiento: 'PAREJA_FIJA',
          generoRequerido: 'MIXTO',
          sistemaPuntos: 'TRADICIONAL',
          formatoBracket: 'GARANTIZADO_2_PARTIDOS',
          setsPorPartido: 3,
          requierePareja: true,
          minimoPartidosGarantizados: 2,
          descripcionLarga: 'Cada pareja está conformada por un jugador masculino y uno femenino. Todos garantizan jugar al menos 2 partidos.',
        },
      },
      {
        nombre: 'Mixto Mundo',
        descripcion: 'Modalidad mixta internacional. Eliminación directa.',
        reglas: {
          ...REGLAS_BASE,
          variante: 'MUNDIAL',
          tipoEmparejamiento: 'PAREJA_FIJA',
          generoRequerido: 'MIXTO',
          sistemaPuntos: 'TRADICIONAL',
          formatoBracket: 'ELIMINACION_DIRECTA',
          setsPorPartido: 3,
          requierePareja: true,
          minimoPartidosGarantizados: 1,
          descripcionLarga: 'Pareja mixta (hombre + mujer) con eliminación directa. Pierdes, quedas fuera.',
        },
      },
      // ═══════════════════════════════════════════════════════════
      // SUMA - Puntos acumulados, rotación de parejas
      // ═══════════════════════════════════════════════════════════
      {
        nombre: 'Suma PY',
        descripcion: 'Formato suma paraguayo. Rotación de parejas, todos juegan igual.',
        reglas: {
          ...REGLAS_BASE,
          variante: 'PY',
          tipoEmparejamiento: 'ROTATIVO',
          sistemaPuntos: 'SUMA',
          formatoBracket: 'LIGA_ROTATIVA_PY', // Todos contra todos, rotación específica PY
          setsPorPartido: 1,
          puntosPorVictoria: 100,
          puntosPorDerrota: 50,
          requierePareja: false,
          permiteIndividual: true,
          minimoPartidosGarantizados: 0, // En suma todos juegan la misma cantidad
          descripcionLarga: 'Los jugadores rotan parejas según el sistema paraguayo. Se acumulan puntos individuales. Gana quien tenga más puntos al final. Todos juegan la misma cantidad de partidos.',
        },
      },
      {
        nombre: 'Suma Mundo',
        descripcion: 'Formato suma internacional. Rotación suiza o americana.',
        reglas: {
          ...REGLAS_BASE,
          variante: 'MUNDIAL',
          tipoEmparejamiento: 'ROTATIVO',
          sistemaPuntos: 'SUMA',
          formatoBracket: 'SUIZO', // Sistema suizo de emparejamiento
          setsPorPartido: 1,
          puntosPorVictoria: 100,
          puntosPorDerrota: 50,
          requierePareja: false,
          permiteIndividual: true,
          minimoPartidosGarantizados: 0,
          descripcionLarga: 'Rotación de parejas estilo suizo. Los emparejamientos se ajustan según el desempeño. Sistema usado internacionalmente.',
        },
      },
      // ═══════════════════════════════════════════════════════════
      // AMERICANO - Rotación cada partido
      // ═══════════════════════════════════════════════════════════
      {
        nombre: 'Americano PY',
        descripcion: 'Americano a la paraguaya. Rotación aleatoria, mismas oportunidades.',
        reglas: {
          ...REGLAS_BASE,
          variante: 'PY',
          tipoEmparejamiento: 'ROTATIVO',
          sistemaPuntos: 'TRADICIONAL',
          formatoBracket: 'AMERICANO_PY', // Sistema paraguayo de americanos
          setsPorPartido: 1,
          puntosPorVictoria: 2,
          puntosPorDerrota: 1,
          requierePareja: false,
          permiteIndividual: true,
          minimoPartidosGarantizados: 0,
          descripcionLarga: 'Los jugadores cambian de pareja en cada partido según sorteo aleatorio paraguayo. Todos juegan la misma cantidad de partidos contra diferentes oponentes.',
        },
      },
      {
        nombre: 'Americano Mundo',
        descripcion: 'Americano internacional. Rotación por ranking.',
        reglas: {
          ...REGLAS_BASE,
          variante: 'MUNDIAL',
          tipoEmparejamiento: 'ROTATIVO',
          sistemaPuntos: 'TRADICIONAL',
          formatoBracket: 'AMERICANO_SUIZO', // Rotación basada en resultados
          setsPorPartido: 1,
          puntosPorVictoria: 2,
          puntosPorDerrota: 1,
          requierePareja: false,
          permiteIndividual: true,
          minimoPartidosGarantizados: 0,
          descripcionLarga: 'Rotación de parejas basada en ranking y resultados (sistema suizo-americano). Usado en torneos internacionales.',
        },
      },
    ];

    for (const modalidad of modalidades) {
      await this.prisma.modalidadConfig.upsert({
        where: { nombre: modalidad.nombre },
        update: {}, // No actualizar si ya existe
        create: {
          ...modalidad,
          activa: true,
        },
      });
    }

    this.logger.log('✅ Modalidades verificadas (PY + Mundo)');
  }

  private async seedJugadoresDemo() {
    this.logger.log('🎮 Verificando jugadores demo...');

    // Verificar si ya existen jugadores demo
    const existingCount = await this.prisma.jugadorDemo.count();
    if (existingCount > 0) {
      this.logger.log(`✅ Ya existen ${existingCount} jugadores demo`);
      return;
    }

    // Obtener categorías
    const categoriasMasc = await this.prisma.category.findMany({
      where: { tipo: Gender.MASCULINO },
      orderBy: { orden: 'asc' },
    });
    
    const categoriasFem = await this.prisma.category.findMany({
      where: { tipo: Gender.FEMENINO },
      orderBy: { orden: 'asc' },
    });

    if (categoriasMasc.length === 0 || categoriasFem.length === 0) {
      this.logger.warn('⚠️ No hay categorías suficientes para crear jugadores demo');
      return;
    }

    const jugadores = [];

    // 200 masculinos
    for (let i = 1; i <= 200; i++) {
      const categoria = categoriasMasc[(i - 1) % categoriasMasc.length];
      jugadores.push({
        nombre: `Player ${i}`,
        apellido: `Masculino ${i}`,
        documento: `DEMO-M-${String(i).padStart(5, '0')}`,
        email: `demo.m${i}@fairpadel.test`,
        telefono: `+595991${String(i).padStart(6, '0')}`,
        genero: Gender.MASCULINO,
        categoriaId: categoria.id,
      });
    }

    // 200 femeninas
    for (let i = 1; i <= 200; i++) {
      const categoria = categoriasFem[(i - 1) % categoriasFem.length];
      jugadores.push({
        nombre: `Player ${i}`,
        apellido: `Femenino ${i}`,
        documento: `DEMO-F-${String(i).padStart(5, '0')}`,
        email: `demo.f${i}@fairpadel.test`,
        telefono: `+595992${String(i).padStart(6, '0')}`,
        genero: Gender.FEMENINO,
        categoriaId: categoria.id,
      });
    }

    // Insertar en batches
    const batchSize = 50;
    let inserted = 0;
    for (let i = 0; i < jugadores.length; i += batchSize) {
      const batch = jugadores.slice(i, i + batchSize);
      const result = await this.prisma.jugadorDemo.createMany({
        data: batch,
        skipDuplicates: true,
      });
      inserted += result.count;
    }

    this.logger.log(`✅ Creados ${inserted} jugadores demo (200M + 200F)`);
  }

  private async seedWhatsAppTemplates() {
    this.logger.log('📱 Verificando templates de WhatsApp...');

    const templates = [
      {
        nombre: 'confirmacion_consentimiento',
        categoria: 'SISTEMA',
        lenguaje: 'es',
        contenido: 'Hola {{nombre}}, bienvenido a FairPadel. Para recibir notificaciones por WhatsApp, responde SI a este mensaje. Puedes cancelar en cualquier momento respondiendo NO.',
        variables: ['nombre'],
        waTemplateName: 'fairpadel_consent_confirmation',
        descripcion: 'Mensaje para solicitar confirmación de consentimiento (doble opt-in)',
        ejemplo: 'Hola Juan, bienvenido a FairPadel. Para recibir notificaciones por WhatsApp, responde SI a este mensaje. Puedes cancelar en cualquier momento respondiendo NO.',
      },
      {
        nombre: 'bienvenida_consentimiento',
        categoria: 'SISTEMA',
        lenguaje: 'es',
        contenido: 'Has activado las notificaciones de FairPadel. Recibiras alertas sobre tus reservas y torneos. Responde NO para cancelar.',
        variables: [],
        waTemplateName: 'consentimiento_activado',
        descripcion: 'Confirmacion despues de activar consentimiento',
        ejemplo: 'Has activado las notificaciones de FairPadel. Recibiras alertas sobre tus reservas y torneos. Responde NO para cancelar.',
      },
      {
        nombre: 'confirmacion_reserva',
        categoria: 'RESERVA',
        lenguaje: 'es',
        contenido: 'Hola {{nombre}}, tu reserva fue confirmada:\n\n📅 Fecha: {{fecha}}\n🎾 Cancha: {{cancha}}\n⏰ Hora: {{hora}}\n\nNos vemos en la cancha!',
        variables: ['nombre', 'fecha', 'cancha', 'hora'],
        waTemplateName: 'fairpadel_reserva_confirmada',
        descripcion: 'Confirmación de reserva de cancha',
        ejemplo: 'Hola Juan, tu reserva fue confirmada:\n\n📅 Fecha: 15/01/2026\n🎾 Cancha: Cancha 1\n⏰ Hora: 18:00\n\nNos vemos en la cancha!',
      },
      {
        nombre: 'recordatorio_reserva_24h',
        categoria: 'RECORDATORIO',
        lenguaje: 'es',
        contenido: '⏰ Recordatorio: Tenés una reserva mañana!\n\n📅 {{fecha}}\n🎾 {{cancha}}\n⏰ {{hora}}\n\nSi no podés asistir, cancelá con anticipación.',
        variables: ['fecha', 'cancha', 'hora'],
        waTemplateName: 'fairpadel_recordatorio_24h',
        descripcion: 'Recordatorio 24 horas antes de la reserva',
        ejemplo: '⏰ Recordatorio: Tenés una reserva mañana!\n\n📅 15/01/2026\n🎾 Cancha 1\n⏰ 18:00\n\nSi no podés asistir, cancelá con anticipación.',
      },
      {
        nombre: 'recordatorio_reserva_4h',
        categoria: 'RECORDATORIO',
        lenguaje: 'es',
        contenido: '🔔 ¡Te esperamos en unas horas!\n\n📅 {{fecha}}\n🎾 {{cancha}}\n⏰ {{hora}}\n\nNo olvides tu equipo. ¡Buen partido!',
        variables: ['fecha', 'cancha', 'hora'],
        waTemplateName: 'fairpadel_recordatorio_4h',
        descripcion: 'Recordatorio 4 horas antes de la reserva',
        ejemplo: '🔔 ¡Te esperamos en unas horas!\n\n📅 15/01/2026\n🎾 Cancha 1\n⏰ 18:00\n\nNo olvides tu equipo. ¡Buen partido!',
      },
      {
        nombre: 'inscripcion_torneo',
        categoria: 'TORNEO',
        lenguaje: 'es',
        contenido: 'Confirmamos tu inscripcion en {{torneo}}:\n\nCategoria: {{categoria}}\nPareja: {{pareja}}\n\nVer detalles en fairpadel.com',
        variables: ['torneo', 'categoria', 'pareja'],
        waTemplateName: 'confirmacion_inscripcion_torneo',
        descripcion: 'Confirmación de inscripción a torneo',
        ejemplo: 'Confirmamos tu inscripcion en Torneo Verano 2026:\n\nCategoria: 3ra Masculina\nPareja: Pedro Gomez\n\nVer detalles en fairpadel.com',
      },
      {
        nombre: 'fixture_publicado',
        categoria: 'TORNEO',
        lenguaje: 'es',
        contenido: 'Tu primer partido del torneo {{torneo}} esta programado:\n\nFecha: {{fecha}}\nHora: {{hora}}\nRival: {{rival}}\n\nLlega 15 minutos antes.',
        variables: ['torneo', 'fecha', 'hora', 'rival'],
        waTemplateName: 'recordatorio_primer_partido',
        descripcion: 'Recordatorio del primer partido del torneo',
        ejemplo: 'Tu primer partido del torneo Torneo Verano 2026 esta programado:\n\nFecha: 20/01/2026\nHora: 19:00\nRival: Martinez-Lopez\n\nLlega 15 minutos antes.',
      },
    ];

    let created = 0;
    for (const template of templates) {
      try {
        await this.prisma.whatsappTemplate.upsert({
          where: { nombre: template.nombre },
          update: {}, // No actualizar si ya existe
          create: {
            ...template,
            aprobado: false,
            activo: true,
          },
        });
        created++;
      } catch (error) {
        this.logger.warn(`⚠️ Error creando template ${template.nombre}: ${error.message}`);
      }
    }

    this.logger.log(`✅ ${created} templates de WhatsApp verificados`);
  }
}
