import { TipoNotificacion } from '@prisma/client';

/**
 * "Tu actividad" (Inicio) = avisos de la plataforma HACIA el jugador (lo tuyo):
 * inscripción confirmada, partido programado, ganaste/avanzaste, sumaste puntos,
 * nuevo torneo en tu ciudad, recordatorios. Todos esos eventos ya existen
 * materializados en la tabla Notificacion (los crea "notificar todo").
 *
 * Lo SOCIAL (te siguen, me gusta) NO entra acá: vive solo en la campana
 * (y, en el caso de posts/inscripciones de seguidos, en el feed de Comunidad).
 */
export function esTipoInicio(tipo: TipoNotificacion): boolean {
  return tipo !== 'SOCIAL';
}

export interface InicioCard {
  id: string;
  /** TipoNotificacion crudo (PARTIDO/INSCRIPCION/RANKING/TORNEO/...); la app mapea ícono + color. */
  tipo: TipoNotificacion;
  titulo: string;
  detalle: string;
  link: string | null;
  fecha: string; // ISO
  leida: boolean;
}

interface NotificacionParaInicio {
  id: string;
  tipo: TipoNotificacion;
  titulo: string | null;
  contenido: string;
  enlace: string | null;
  leida: boolean;
  createdAt: Date;
}

/**
 * Convierte una Notificacion en una tarjeta del Inicio.
 * Si la notificación trae título, ese es el encabezado y el contenido pasa a detalle;
 * si no, el contenido es el encabezado (y el detalle queda vacío).
 */
export function mapNotificacionAInicio(n: NotificacionParaInicio): InicioCard {
  const tituloLimpio = n.titulo?.trim();
  return {
    id: n.id,
    tipo: n.tipo,
    titulo: tituloLimpio || n.contenido,
    detalle: tituloLimpio ? n.contenido : '',
    link: n.enlace ?? null,
    fecha: n.createdAt.toISOString(),
    leida: n.leida,
  };
}
