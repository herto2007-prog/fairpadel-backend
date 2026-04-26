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
    // NOTA: Templates ya creados en Meta. Este seed solo verifica que existan en BD.
    // Las categorías fueron asignadas por Meta (algunas UTILITY reclasificadas a MARKETING).

    const templates = [
      // MARKETING (asignado por Meta)
      {
        nombre: 'solicitud_consentimiento',
        categoria: 'MARKETING',
        waTemplateName: 'fairpadel_consent_solicitud',
        descripcion: 'Solicitud inicial de opt-in para notificaciones',
        parametros: { contenido: 'Bienvenido a FairPadel. Para recibir datos de tus reservas y torneos por este canal, responde SI. Responde NO para omitir.', variables: [] },
      },
      {
        nombre: 'bienvenida_consentimiento',
        categoria: 'MARKETING',
        waTemplateName: 'fairpadel_consent_confirmado',
        descripcion: 'Confirmacion de opt-in',
        parametros: { contenido: 'Gracias por confirmar. Ahora recibiras mensajes de FairPadel sobre tus reservas activas.', variables: [] },
      },
      {
        nombre: 'consentimiento_cancelado',
        categoria: 'MARKETING',
        waTemplateName: 'fairpadel_consent_cancelado',
        descripcion: 'Confirmacion de cancelacion',
        parametros: { contenido: 'Has cancelado los mensajes de FairPadel. Para reactivar, accede a tu cuenta.', variables: [] },
      },
      {
        nombre: 'reserva_confirmada',
        categoria: 'MARKETING',
        waTemplateName: 'fairpadel_reserva_ok',
        descripcion: 'Confirmacion de reserva - datos basicos',
        parametros: { contenido: 'Datos de tu reserva confirmada: Cancha numero {{1}} asignada para fecha {{2}} segun disponibilidad.', variables: ['1', '2'] },
      },
      {
        nombre: 'reserva_sede_info',
        categoria: 'MARKETING',
        waTemplateName: 'fairpadel_reserva_sede',
        descripcion: 'Informacion de sede para reserva',
        parametros: { contenido: 'Detalles de tu sede confirmada: {{1}}. Presentarse 15 minutos antes del horario.', variables: ['1'] },
      },
      {
        nombre: 'torneo_fecha_partido',
        categoria: 'MARKETING',
        waTemplateName: 'fairpadel_torneo_fecha',
        descripcion: 'Fecha del partido',
        parametros: { contenido: 'Fecha confirmada para tu partido: {{1}} a las {{2}} segun fixture oficial.', variables: ['1', '2'] },
      },
      {
        nombre: 'torneo_inscripcion_confirmada',
        categoria: 'MARKETING',
        waTemplateName: 'fairpadel_torneo_insc_ok',
        descripcion: 'Confirmacion de inscripcion a torneo',
        parametros: { contenido: 'Tu inscripcion al torneo {{1}} esta registrada en la categoria {{2}}.', variables: ['1', '2'] },
      },
      // UTILITY (mantenidos por Meta)
      {
        nombre: 'recordatorio_24h',
        categoria: 'UTILITY',
        waTemplateName: 'fairpadel_recordatorio_24h',
        descripcion: 'Recordatorio 24 horas antes',
        parametros: { contenido: 'Recordatorio de tu reserva: El partido es manana en sede {{1}} a las {{2}} segun confirmacion previa.', variables: ['1', '2'] },
      },
      {
        nombre: 'recordatorio_4h',
        categoria: 'UTILITY',
        waTemplateName: 'fairpadel_recordatorio_4h',
        descripcion: 'Recordatorio 4 horas antes',
        parametros: { contenido: 'Recordatorio para hoy: Te esperamos en sede {{1}} a las {{2}} segun tu reserva registrada.', variables: ['1', '2'] },
      },
      {
        nombre: 'torneo_pareja_asignada',
        categoria: 'UTILITY',
        waTemplateName: 'fairpadel_torneo_pareja',
        descripcion: 'Pareja asignada',
        parametros: { contenido: 'Informacion de tu torneo: La pareja asignada es el jugador {{1}} en categoria {{2}} segun registro.', variables: ['1', '2'] },
      },
      {
        nombre: 'torneo_rival_asignado',
        categoria: 'UTILITY',
        waTemplateName: 'fairpadel_torneo_rival',
        descripcion: 'Rival del partido',
        parametros: { contenido: 'Informacion del fixture: El rival asignado es {{1}} en el torneo {{2}} segun programacion.', variables: ['1', '2'] },
      },
    ];

    let created = 0;
    for (const template of templates) {
      try {
        await this.prisma.whatsappTemplate.upsert({
          where: { nombre: template.nombre },
          update: {}, // No actualizar si ya existe (evita sobreescribir lo que ya está en BD)
          create: {
            ...template,
            idioma: 'es',
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
