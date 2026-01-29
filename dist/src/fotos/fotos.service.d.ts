import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from './cloudinary.service';
export declare class FotosService {
    private prisma;
    private cloudinary;
    constructor(prisma: PrismaService, cloudinary: CloudinaryService);
    subirFoto(userId: string, data: any): Promise<{
        id: string;
        descripcion: string | null;
        createdAt: Date;
        tipo: string;
        userId: string;
        tournamentId: string | null;
        urlImagen: string;
        urlThumbnail: string | null;
        estadoModeracion: import(".prisma/client").$Enums.ModerationStatus;
        likesCount: number;
        comentariosCount: number;
        esPrivada: boolean;
        fechaSubida: Date;
    }>;
    obtenerFotos(filtros: any): Promise<({
        user: {
            id: string;
            nombre: string;
            apellido: string;
            fotoUrl: string;
        };
    } & {
        id: string;
        descripcion: string | null;
        createdAt: Date;
        tipo: string;
        userId: string;
        tournamentId: string | null;
        urlImagen: string;
        urlThumbnail: string | null;
        estadoModeracion: import(".prisma/client").$Enums.ModerationStatus;
        likesCount: number;
        comentariosCount: number;
        esPrivada: boolean;
        fechaSubida: Date;
    })[]>;
    obtenerFotoDetalle(id: string): Promise<{
        user: {
            id: string;
            nombre: string;
            apellido: string;
            fotoUrl: string;
        };
    } & {
        id: string;
        descripcion: string | null;
        createdAt: Date;
        tipo: string;
        userId: string;
        tournamentId: string | null;
        urlImagen: string;
        urlThumbnail: string | null;
        estadoModeracion: import(".prisma/client").$Enums.ModerationStatus;
        likesCount: number;
        comentariosCount: number;
        esPrivada: boolean;
        fechaSubida: Date;
    }>;
    actualizarFoto(id: string, data: any, userId: string): Promise<{
        id: string;
        descripcion: string | null;
        createdAt: Date;
        tipo: string;
        userId: string;
        tournamentId: string | null;
        urlImagen: string;
        urlThumbnail: string | null;
        estadoModeracion: import(".prisma/client").$Enums.ModerationStatus;
        likesCount: number;
        comentariosCount: number;
        esPrivada: boolean;
        fechaSubida: Date;
    }>;
    eliminarFoto(id: string, userId: string): Promise<{
        message: string;
    }>;
    darLike(fotoId: string, userId: string): Promise<{
        message: string;
    }>;
    obtenerLikes(fotoId: string): Promise<({
        user: {
            id: string;
            nombre: string;
            apellido: string;
            fotoUrl: string;
        };
    } & {
        id: string;
        createdAt: Date;
        userId: string;
        fotoId: string;
    })[]>;
    comentar(fotoId: string, userId: string, contenido: string): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        contenido: string;
        fotoId: string;
        parentId: string | null;
    }>;
    obtenerComentarios(fotoId: string): Promise<({
        user: {
            id: string;
            nombre: string;
            apellido: string;
            fotoUrl: string;
        };
    } & {
        id: string;
        createdAt: Date;
        userId: string;
        contenido: string;
        fotoId: string;
        parentId: string | null;
    })[]>;
    eliminarComentario(comentarioId: string, userId: string): Promise<{
        message: string;
    }>;
    reportarFoto(fotoId: string, userId: string, motivo: string): Promise<{
        message: string;
    }>;
}
