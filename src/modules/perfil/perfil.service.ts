import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificacionPreferencia } from '@prisma/client';

@Injectable()
export class PerfilService {
  constructor(private prisma: PrismaService) {}

  /**
   * Obtiene el perfil completo de un jugador con estadísticas
   */
  async getPerfilJugador(userId: string) {
    const usuario = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        categoriaActual: true,
        roles: {
          include: { role: true },
        },
        _count: {
          select: {
            seguidores: true,
            siguiendo: true,
          },
        },
      },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Obtener rankings
    const rankings = await this.prisma.ranking.findMany({
      where: { jugadorId: userId },
      orderBy: { puntosTotales: 'desc' },
    });

    // Obtener historial de puntos para gráfico
    const historialPuntos = await this.prisma.historialPuntos.findMany({
      where: { jugadorId: userId },
      include: {
        tournament: { select: { nombre: true } },
        category: { select: { nombre: true } },
      },
      orderBy: { fechaTorneo: 'desc' },
      take: 10,
    });

    // Calcular estadísticas desde el historial
    const statsTorneos = await this.calcularStatsTorneos(userId);
    
    // Obtener actividad reciente
    const actividadReciente = await this.obtenerActividadReciente(userId);

    // Calcular logros
    const logros = await this.calcularLogros(userId, statsTorneos);

    return {
      success: true,
      data: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        username: `${usuario.nombre.toLowerCase()}.${usuario.apellido.toLowerCase()}`,
        email: usuario.email,
        fotoUrl: usuario.fotoUrl,
        bannerUrl: null,
        bio: null,
        ciudad: usuario.ciudad,
        pais: usuario.pais || 'Paraguay',
        categoria: usuario.categoriaActual,
        edad: usuario.fechaNacimiento 
          ? this.calcularEdad(usuario.fechaNacimiento)
          : null,
        estado: usuario.estado,
        esPremium: usuario.esPremium,
        roles: usuario.roles.map(r => r.role.nombre),
        seguidores: usuario._count.seguidores,
        siguiendo: usuario._count.siguiendo,
        stats: {
          torneosJugados: statsTorneos.jugados,
          torneosGanados: statsTorneos.ganados,
          finalesJugadas: statsTorneos.finales,
          semifinalesJugadas: statsTorneos.semis,
        },
        partidos: {
          jugados: rankings.reduce((acc, r) => acc + r.torneosJugados, 0),
          ganados: rankings.reduce((acc, r) => acc + r.victorias, 0),
          perdidos: rankings.reduce((acc, r) => acc + r.derrotas, 0),
          efectividad: rankings.length > 0 
            ? Math.round(rankings.reduce((acc, r) => acc + (r.porcentajeVictorias?.toNumber() || 0), 0) / rankings.length)
            : 0,
          rachaActual: rankings[0]?.rachaActual || 0,
          mejorRacha: 0, // TODO: Calcular desde historial
        },
        ranking: rankings.map(r => ({
          tipo: r.tipoRanking,
          alcance: r.alcance,
          posicion: r.posicion,
          puntosTotales: r.puntosTotales,
          torneosJugados: r.torneosJugados,
          victorias: r.victorias,
          temporada: r.temporada,
        })),
        historialPuntos: historialPuntos.map(h => ({
          torneo: h.tournament.nombre,
          categoria: h.category.nombre,
          posicion: h.posicionFinal,
          puntos: h.puntosGanados,
          fecha: h.fechaTorneo,
        })),
        actividadReciente,
        logros,
      },
    };
  }

  /**
   * Obtiene el perfil del usuario autenticado
   */
  async getMiPerfil(userId: string) {
    const perfil = await this.getPerfilJugador(userId);
    
    // Obtener datos privados adicionales del usuario
    const usuario = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        telefono: true,
        consentCheckboxWhatsapp: true,
        consentWhatsappStatus: true,
        consentWhatsappDate: true,
        preferenciaNotificacion: true,
      },
    });
    
    const inscripcionesPendientes = await this.prisma.inscripcion.count({
      where: {
        OR: [{ jugador1Id: userId }, { jugador2Id: userId }],
        estado: { in: ['PENDIENTE_PAGO', 'PENDIENTE_CONFIRMACION'] },
      },
    });

    return {
      ...perfil,
      data: {
        ...perfil.data,
        telefono: usuario?.telefono,
        whatsapp: {
          consentCheckbox: usuario?.consentCheckboxWhatsapp || false,
          consentStatus: usuario?.consentWhatsappStatus || null,
          consentDate: usuario?.consentWhatsappDate || null,
          preferenciaNotificacion: usuario?.preferenciaNotificacion || 'EMAIL',
        },
        privado: {
          inscripcionesPendientes,
          notificacionesNoLeidas: 0,
        },
      },
    };
  }

  private async calcularStatsTorneos(userId: string) {
    const historial = await this.prisma.historialPuntos.findMany({
      where: { jugadorId: userId },
      select: { posicionFinal: true },
    });

    const jugados = historial.length;
    const ganados = historial.filter(h => h.posicionFinal === '1ro').length;
    const finales = historial.filter(h => ['1ro', '2do'].includes(h.posicionFinal)).length;
    const semis = historial.filter(h => ['1ro', '2do', '3ro', '3ro-4to'].includes(h.posicionFinal)).length;

    return { jugados, ganados, finales, semis };
  }

  private async obtenerActividadReciente(userId: string) {
    const actividades = [];

    // Últimos torneos
    const ultimosTorneos = await this.prisma.historialPuntos.findMany({
      where: { jugadorId: userId },
      include: {
        tournament: { select: { id: true, nombre: true } },
        category: { select: { nombre: true } },
      },
      orderBy: { fechaTorneo: 'desc' },
      take: 5,
    });

    for (const t of ultimosTorneos) {
      let titulo = '';
      let tipo = 'torneo';
      
      if (t.posicionFinal === '1ro') {
        titulo = `🏆 Campeón en ${t.tournament.nombre}`;
        tipo = 'campeonato';
      } else if (t.posicionFinal === '2do') {
        titulo = `🥈 Subcampeón en ${t.tournament.nombre}`;
        tipo = 'subcampeonato';
      } else {
        titulo = `Participó en ${t.tournament.nombre}`;
      }

      actividades.push({
        id: `torneo-${t.id}`,
        tipo,
        titulo,
        fecha: t.fechaTorneo,
        detalle: `Categoría ${t.category.nombre} - ${t.puntosGanados} pts`,
      });
    }

    // Últimos ascensos
    const ultimosAscensos = await this.prisma.historialCategoria.findMany({
      where: {
        userId,
        tipo: { in: ['ASCENSO', 'ASCENSO_AUTOMATICO', 'ASCENSO_MANUAL'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    for (const a of ultimosAscensos) {
      const categoriaNueva = await this.prisma.category.findUnique({
        where: { id: a.categoriaNuevaId },
      });
      
      actividades.push({
        id: `ascenso-${a.id}`,
        tipo: 'ascenso',
        titulo: `⬆️ Ascendió a ${categoriaNueva?.nombre || 'nueva categoría'}`,
        fecha: a.createdAt,
        detalle: a.motivo || 'Ascenso por rendimiento',
      });
    }

    return actividades
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .slice(0, 10);
  }

  private async calcularLogros(userId: string, stats: any) {
    const logros = [];

    // Logro: Campeón
    if (stats.ganados > 0) {
      logros.push({
        id: 'campeon',
        icon: '🏆',
        nombre: stats.ganados === 1 ? 'Campeón' : `Campeón x${stats.ganados}`,
        descripcion: `${stats.ganados} torneo${stats.ganados > 1 ? 's' : ''} ganado${stats.ganados > 1 ? 's' : ''}`,
        nivel: stats.ganados >= 5 ? 'oro' : stats.ganados >= 3 ? 'plata' : 'bronce',
        progreso: Math.min((stats.ganados / 10) * 100, 100),
      });
    }

    // Logro: Finalista
    const subcampeonatos = stats.finales - stats.ganados;
    if (subcampeonatos > 0) {
      logros.push({
        id: 'finalista',
        icon: '🥈',
        nombre: 'Finalista',
        descripcion: `${subcampeonatos} final${subcampeonatos > 1 ? 'es' : ''} jugada${subcampeonatos > 1 ? 's' : ''}`,
        nivel: subcampeonatos >= 5 ? 'oro' : subcampeonatos >= 3 ? 'plata' : 'bronce',
        progreso: Math.min((subcampeonatos / 10) * 100, 100),
      });
    }

    // Logro: Veterano
    if (stats.jugados >= 10) {
      logros.push({
        id: 'veterano',
        icon: '🏟️',
        nombre: 'Veterano',
        descripcion: `${stats.jugados} torneos jugados`,
        nivel: stats.jugados >= 50 ? 'oro' : stats.jugados >= 25 ? 'plata' : 'bronce',
        progreso: Math.min((stats.jugados / 100) * 100, 100),
      });
    }

    // Logro: Ascenso
    const ascensos = await this.prisma.historialCategoria.count({
      where: {
        userId,
        tipo: { in: ['ASCENSO', 'ASCENSO_AUTOMATICO', 'ASCENSO_MANUAL'] },
      },
    });

    if (ascensos > 0) {
      logros.push({
        id: 'ascenso',
        icon: '⭐',
        nombre: 'Ascenso',
        descripcion: `${ascensos} ascenso${ascensos > 1 ? 's' : ''} logrado${ascensos > 1 ? 's' : ''}`,
        nivel: 'especial',
        progreso: 100,
      });
    }

    return logros;
  }

  private calcularEdad(fechaNacimiento: string): number {
    // FIX: fechaNacimiento es String YYYY-MM-DD
    const [year, month, day] = fechaNacimiento.split('-').map(Number);
    const fechaNac = new Date(year, month - 1, day);
    const hoy = new Date();
    let edad = hoy.getFullYear() - fechaNac.getFullYear();
    const mes = hoy.getMonth() - fechaNac.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) {
      edad--;
    }
    return edad;
  }

  // ═══════════════════════════════════════════════════════════
  // MÉTODOS DE ACTUALIZACIÓN
  // ═══════════════════════════════════════════════════════════

  /**
   * Actualiza los datos del perfil del usuario
   */
  async updatePerfil(userId: string, dto: any) {
    const updateData: any = {};

    if (dto.bio !== undefined) updateData.bio = dto.bio;
    if (dto.ciudad !== undefined) updateData.ciudad = dto.ciudad;
    if (dto.pais !== undefined) updateData.pais = dto.pais;
    if (dto.telefono !== undefined) updateData.telefono = dto.telefono;
    if (dto.fechaNacimiento !== undefined) {
      // FIX: fechaNacimiento es String YYYY-MM-DD
      updateData.fechaNacimiento = dto.fechaNacimiento;
    }
    if (dto.instagram !== undefined) updateData.instagram = dto.instagram;
    if (dto.facebook !== undefined) updateData.facebook = dto.facebook;

    const usuario = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        nombre: true,
        apellido: true,
        bio: true,
        ciudad: true,
        pais: true,
        telefono: true,
        fechaNacimiento: true,
        instagram: true,
        facebook: true,
        fotoUrl: true,
        bannerUrl: true,
      },
    });

    return {
      success: true,
      message: 'Perfil actualizado correctamente',
      data: usuario,
    };
  }

  /**
   * Actualiza la foto de perfil
   */
  async updateFoto(userId: string, fotoUrl: string) {
    const usuario = await this.prisma.user.update({
      where: { id: userId },
      data: { fotoUrl },
      select: { id: true, fotoUrl: true },
    });

    return {
      success: true,
      message: 'Foto de perfil actualizada',
      data: usuario,
    };
  }

  /**
   * Actualiza el banner del perfil
   */
  async updateBanner(userId: string, bannerUrl: string) {
    const usuario = await this.prisma.user.update({
      where: { id: userId },
      data: { bannerUrl },
      select: { id: true, bannerUrl: true },
    });

    return {
      success: true,
      message: 'Banner actualizado',
      data: usuario,
    };
  }

  /**
   * Cambia la contraseña del usuario
   */
  async updatePassword(userId: string, passwordActual: string, passwordNuevo: string) {
    // Verificar contraseña actual
    const usuario = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Importar bcrypt para comparar contraseñas
    const bcrypt = require('bcrypt');
    const passwordValida = await bcrypt.compare(passwordActual, usuario.password);

    if (!passwordValida) {
      return {
        success: false,
        message: 'Contraseña actual incorrecta',
      };
    }

    // Hashear nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(passwordNuevo, salt);

    // Actualizar
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return {
      success: true,
      message: 'Contraseña actualizada correctamente',
    };
  }

  /**
   * Actualiza las preferencias de notificación del usuario
   */
  async updatePreferenciasNotificacion(userId: string, dto: { preferenciaNotificacion: string }) {
    const validPreferences = ['EMAIL', 'WHATSAPP', 'AMBOS'];
    
    if (!validPreferences.includes(dto.preferenciaNotificacion)) {
      return {
        success: false,
        message: 'Preferencia de notificación inválida',
      };
    }

    // Si el usuario quiere WhatsApp pero no tiene consentimiento confirmado
    const usuario = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        consentWhatsappStatus: true,
        telefono: true,
      },
    });

    if ((dto.preferenciaNotificacion === 'WHATSAPP' || dto.preferenciaNotificacion === 'AMBOS') && 
        usuario?.consentWhatsappStatus !== 'CONFIRMADO') {
      return {
        success: false,
        message: 'No tienes WhatsApp confirmado. Responde "SI" al mensaje de confirmación primero.',
      };
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        preferenciaNotificacion: dto.preferenciaNotificacion as NotificacionPreferencia,
      },
    });

    return {
      success: true,
      message: 'Preferencias de notificación actualizadas',
    };
  }

  /**
   * Revoca el consentimiento de WhatsApp
   */
  async revocarConsentimientoWhatsapp(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        consentWhatsappStatus: 'REVOCADO',
        consentWhatsappDate: new Date(),
        preferenciaNotificacion: 'EMAIL',
      },
    });

    return {
      success: true,
      message: 'Consentimiento de WhatsApp revocado',
    };
  }
}
