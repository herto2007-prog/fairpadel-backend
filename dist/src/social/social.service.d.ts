import { PrismaService } from '../prisma/prisma.service';
import { MensajeDto, SolicitudJugarDto } from './dto';
export declare class SocialService {
    private prisma;
    constructor(prisma: PrismaService);
    seguir(seguidorId: string, seguidoId: string): Promise<{
        message: string;
        seguimiento: {
            id: string;
            createdAt: Date;
            seguidorId: string;
            seguidoId: string;
            notificacionesActivas: boolean;
        };
    }>;
    dejarDeSeguir(seguidorId: string, seguidoId: string): Promise<{
        message: string;
    }>;
    obtenerSeguidores(userId: string): Promise<{
        id: string;
        nombre: string;
        documento: string;
        apellido: string;
        genero: import(".prisma/client").$Enums.Gender;
        ciudad: string;
        fotoUrl: string;
    }[]>;
    obtenerSiguiendo(userId: string): Promise<{
        id: string;
        nombre: string;
        documento: string;
        apellido: string;
        genero: import(".prisma/client").$Enums.Gender;
        ciudad: string;
        fotoUrl: string;
    }[]>;
    obtenerSugerencias(userId: string): Promise<{
        id: string;
        nombre: string;
        documento: string;
        apellido: string;
        genero: import(".prisma/client").$Enums.Gender;
        ciudad: string;
        fotoUrl: string;
    }[]>;
    enviarMensaje(remitenteId: string, dto: MensajeDto): Promise<{
        remitente: {
            id: string;
            nombre: string;
            apellido: string;
            fotoUrl: string;
        };
        destinatario: {
            id: string;
            nombre: string;
            apellido: string;
            fotoUrl: string;
        };
    } & {
        id: string;
        createdAt: Date;
        destinatarioId: string;
        contenido: string;
        leido: boolean;
        remitenteId: string;
    }>;
    obtenerConversaciones(userId: string): Promise<any[]>;
    obtenerMensajes(userId: string, otroUserId: string): Promise<({
        remitente: {
            id: string;
            nombre: string;
            apellido: string;
            fotoUrl: string;
        };
        destinatario: {
            id: string;
            nombre: string;
            apellido: string;
            fotoUrl: string;
        };
    } & {
        id: string;
        createdAt: Date;
        destinatarioId: string;
        contenido: string;
        leido: boolean;
        remitenteId: string;
    })[]>;
    marcarComoLeido(mensajeId: string, userId: string): Promise<{
        id: string;
        createdAt: Date;
        destinatarioId: string;
        contenido: string;
        leido: boolean;
        remitenteId: string;
    }>;
    enviarSolicitudJugar(emisorId: string, dto: SolicitudJugarDto): Promise<{
        emisor: {
            id: string;
            nombre: string;
            apellido: string;
            fotoUrl: string;
        };
        receptor: {
            id: string;
            nombre: string;
            apellido: string;
            fotoUrl: string;
        };
    } & {
        id: string;
        createdAt: Date;
        estado: import(".prisma/client").$Enums.SolicitudEstado;
        updatedAt: Date;
        mensaje: string | null;
        receptorId: string;
        fechaPropuesta: Date;
        hora: string;
        lugar: string;
        emisorId: string;
    }>;
    obtenerSolicitudesRecibidas(userId: string): Promise<({
        emisor: {
            id: string;
            nombre: string;
            apellido: string;
            fotoUrl: string;
        };
    } & {
        id: string;
        createdAt: Date;
        estado: import(".prisma/client").$Enums.SolicitudEstado;
        updatedAt: Date;
        mensaje: string | null;
        receptorId: string;
        fechaPropuesta: Date;
        hora: string;
        lugar: string;
        emisorId: string;
    })[]>;
    obtenerSolicitudesEnviadas(userId: string): Promise<({
        receptor: {
            id: string;
            nombre: string;
            apellido: string;
            fotoUrl: string;
        };
    } & {
        id: string;
        createdAt: Date;
        estado: import(".prisma/client").$Enums.SolicitudEstado;
        updatedAt: Date;
        mensaje: string | null;
        receptorId: string;
        fechaPropuesta: Date;
        hora: string;
        lugar: string;
        emisorId: string;
    })[]>;
    aceptarSolicitud(solicitudId: string, userId: string): Promise<{
        id: string;
        createdAt: Date;
        estado: import(".prisma/client").$Enums.SolicitudEstado;
        updatedAt: Date;
        mensaje: string | null;
        receptorId: string;
        fechaPropuesta: Date;
        hora: string;
        lugar: string;
        emisorId: string;
    }>;
    rechazarSolicitud(solicitudId: string, userId: string): Promise<{
        id: string;
        createdAt: Date;
        estado: import(".prisma/client").$Enums.SolicitudEstado;
        updatedAt: Date;
        mensaje: string | null;
        receptorId: string;
        fechaPropuesta: Date;
        hora: string;
        lugar: string;
        emisorId: string;
    }>;
    bloquear(bloqueadorId: string, bloqueadoId: string): Promise<{
        id: string;
        createdAt: Date;
        bloqueadorId: string;
        bloqueadoId: string;
    }>;
    desbloquear(bloqueadorId: string, bloqueadoId: string): Promise<{
        message: string;
    }>;
    obtenerBloqueados(userId: string): Promise<{
        id: string;
        nombre: string;
        apellido: string;
        fotoUrl: string;
    }[]>;
    reportar(reportadorId: string, reportadoId: string, data: {
        motivo: string;
        descripcion?: string;
    }): Promise<{
        message: string;
        reporte: {
            id: string;
            descripcion: string | null;
            createdAt: Date;
            estado: import(".prisma/client").$Enums.SolicitudEstado;
            motivo: string;
            reportadorId: string;
            reportadoId: string;
        };
    }>;
    buscarJugadores(query: string, ciudad?: string, genero?: string): Promise<{
        id: string;
        nombre: string;
        documento: string;
        apellido: string;
        genero: import(".prisma/client").$Enums.Gender;
        ciudad: string;
        fotoUrl: string;
    }[]>;
}
