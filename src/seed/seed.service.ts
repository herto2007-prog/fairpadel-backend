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
    // NOTA: confirmacion_consentimiento y consentimiento_cancelado son MARKETING porque
    // Meta las reclasifica automaticamente al detectar palabras como 'notificaciones'.
    // Se usan minimo (1 vez por usuario). Las demas son UTILITY.

    const templates = [
      {
        nombre: 'confirmacion_consentimiento',
        categoria: 'MARKETING',
        lenguaje: 'es',
        contenido: 'Para activar notificaciones de FairPadel, responde SI. Responde NO para cancelar.',
        variables: [],
        waTemplateName: 'confirmacion_consentimiento',
        descripcion: 'Mensaje para solicitar confirmación de consentimiento (doble opt-in)',
        ejemplo: 'Hola Juan, bienvenido a FairPadel. Para recibir notificaciones por WhatsApp, responde SI a este mensaje. Puedes cancelar en cualquier momento respondiendo NO.',
      },
      {
        nombre: 'bienvenida_consentimiento',
        categoria: 'SISTEMA',
        lenguaje: 'es',
        contenido: 'Confirmamos tu suscripcion. Recibiras alertas sobre tus reservas.',
        variables: [],
        waTemplateName: 'notif_consent_activado',
        descripcion: 'Confirmacion despues de activar consentimiento UTILITY',
        ejemplo: 'Confirmamos tu suscripcion. Recibiras alertas sobre tus reservas.',
      },
      {
        nombre: 'consentimiento_cancelado',
        categoria: 'MARKETING',
        lenguaje: 'es',
        contenido: 'Has cancelado las notificaciones. Reactiva en fairpadel.com',
        variables: [],
        waTemplateName: 'notif_consent_cancelado',
        descripcion: 'Confirmacion de cancelacion UTILITY',
        ejemplo: 'Has cancelado las notificaciones. Reactiva en fairpadel.com',
      },
      {
        nombre: 'torneo_pareja',
        categoria: 'TORNEO',
        lenguaje: 'es',
        contenido: 'Pareja para torneo confirmada. Tu companero registrado es {{1}} para categoria {{2}} segun inscripcion',
        variables: ['pareja', 'categoria'],
        waTemplateName: 'torneo_pareja_ok',
        descripcion: 'Pareja asignada UTILITY',
        ejemplo: 'Pareja para torneo confirmada. Tu companero registrado es Pedro Gomez para categoria 3ra Masculina segun inscripcion',
      },
      {
        nombre: 'torneo_partido_rival',
        categoria: 'TORNEO',
        lenguaje: 'es',
        contenido: 'Rival asignado para tu partido. Tu encuentro es contra {{1}} en torneo {{2}} segun fixture oficial',
        variables: ['rival', 'torneo'],
        waTemplateName: 'partido_rival_ok',
        descripcion: 'Rival del partido UTILITY',
        ejemplo: 'Rival asignado para tu partido. Tu encuentro es contra Martinez-Lopez en torneo Verano 2026 segun fixture oficial',
      },
      {
        nombre: 'reserva_ubicacion',
        categoria: 'RESERVA',
        lenguaje: 'es',
        contenido: 'Reserva registrada. Datos confirmados: Sede {{1}}, Cancha {{2}}, Fecha {{3}}, Hora {{4}}',
        variables: ['sede', 'cancha', 'fecha', 'hora'],
        waTemplateName: 'datos_reserva_ubicacion',
        descripcion: 'Confirmacion de reserva con sede UTILITY',
        ejemplo: 'Reserva registrada. Datos confirmados: Sede Sede Central, Cancha Cancha 1, Fecha 15/01/2026, Hora 18:00',
      },
      {
        nombre: 'reserva_recordatorio_24h',
        categoria: 'RECORDATORIO',
        lenguaje: 'es',
        contenido: 'Recordatorio de tu reserva. Tu cancha manana esta en Sede {{1}} con horario {{2}} segun confirmacion previa',
        variables: ['sede', 'hora'],
        waTemplateName: 'alerta_reserva_manana',
        descripcion: 'Recordatorio 24 horas UTILITY',
        ejemplo: 'Recordatorio de tu reserva. Tu cancha manana esta en Sede Central con horario 18:00 segun confirmacion previa',
      },
      {
        nombre: 'reserva_recordatorio_4h',
        categoria: 'RECORDATORIO',
        lenguaje: 'es',
        contenido: 'Recordatorio de tu reserva para hoy. Te esperamos en Sede {{1}} a las {{2}} segun tu reserva registrada',
        variables: ['sede', 'hora'],
        waTemplateName: 'alerta_reserva_hoy',
        descripcion: 'Recordatorio 4 horas UTILITY',
        ejemplo: 'Recordatorio de tu reserva para hoy. Te esperamos en Sede Central a las 18:00 segun tu reserva registrada',
      },
      {
        nombre: 'torneo_inscripcion',
        categoria: 'TORNEO',
        lenguaje: 'es',
        contenido: 'Inscripcion al torneo registrada exitosamente. El torneo asignado es {{1}} en categoria {{2}} segun tu solicitud enviada',
        variables: ['torneo', 'categoria'],
        waTemplateName: 'torneo_inscripcion_registrada',
        descripcion: 'Confirmacion de inscripcion UTILITY',
        ejemplo: 'Inscripcion al torneo registrada exitosamente. El torneo asignado es Verano 2026 en categoria 3ra Masculina segun tu solicitud enviada',
      },
      {
        nombre: 'torneo_partido_fecha',
        categoria: 'TORNEO',
        lenguaje: 'es',
        contenido: 'Partido programado segun fixture. La fecha confirmada para tu partido es {{1}} a las {{2}} segun programacion',
        variables: ['fecha', 'hora'],
        waTemplateName: 'partido_fecha_ok',
        descripcion: 'Fecha del partido UTILITY',
        ejemplo: 'Partido programado segun fixture. La fecha confirmada para tu partido es 20/01/2026 a las 19:00 segun programacion',
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
