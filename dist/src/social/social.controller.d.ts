import { SocialService } from './social.service';
import { MensajeDto, SolicitudJugarDto } from './dto';
export declare class SocialController {
    private readonly socialService;
    constructor(socialService: SocialService);
    seguir(userId: string, req: any): Promise<{
        message: string;
        seguimiento: {
            id: string;
            createdAt: Date;
            seguidorId: string;
            seguidoId: string;
            notificacionesActivas: boolean;
        };
    }>;
    dejarDeSeguir(userId: string, req: any): Promise<{
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
    obtenerSugerencias(req: any): Promise<{
        id: string;
        nombre: string;
        documento: string;
        apellido: string;
        genero: import(".prisma/client").$Enums.Gender;
        ciudad: string;
        fotoUrl: string;
    }[]>;
    enviarMensaje(dto: MensajeDto, req: any): Promise<{
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
    obtenerConversaciones(req: any): Promise<any[]>;
    obtenerMensajes(otroUserId: string, req: any): Promise<({
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
    marcarComoLeido(mensajeId: string, req: any): Promise<{
        id: string;
        createdAt: Date;
        destinatarioId: string;
        contenido: string;
        leido: boolean;
        remitenteId: string;
    }>;
    enviarSolicitudJugar(dto: SolicitudJugarDto, req: any): Promise<{
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
    obtenerSolicitudesRecibidas(req: any): Promise<({
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
    obtenerSolicitudesEnviadas(req: any): Promise<({
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
    aceptarSolicitud(solicitudId: string, req: any): Promise<{
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
    rechazarSolicitud(solicitudId: string, req: any): Promise<{
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
    bloquear(userId: string, req: any): Promise<{
        id: string;
        createdAt: Date;
        bloqueadorId: string;
        bloqueadoId: string;
    }>;
    desbloquear(userId: string, req: any): Promise<{
        message: string;
    }>;
    obtenerBloqueados(req: any): Promise<{
        id: string;
        nombre: string;
        apellido: string;
        fotoUrl: string;
    }[]>;
    reportar(userId: string, body: {
        motivo: string;
        descripcion?: string;
    }, req: any): Promise<{
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
