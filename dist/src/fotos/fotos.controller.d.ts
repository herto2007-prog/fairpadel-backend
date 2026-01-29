import { FotosService } from './fotos.service';
export declare class FotosController {
    private readonly fotosService;
    constructor(fotosService: FotosService);
    subirFoto(dto: any, req: any): Promise<{
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
    listarFotos(userId?: string, tournamentId?: string, tipo?: string): Promise<({
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
    obtenerFoto(id: string): Promise<{
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
    actualizarFoto(id: string, body: any, req: any): Promise<{
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
    eliminarFoto(id: string, req: any): Promise<{
        message: string;
    }>;
    darLike(id: string, req: any): Promise<{
        message: string;
    }>;
    obtenerLikes(id: string): Promise<({
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
    comentar(id: string, body: any, req: any): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        contenido: string;
        fotoId: string;
        parentId: string | null;
    }>;
    obtenerComentarios(id: string): Promise<({
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
    eliminarComentario(comentarioId: string, req: any): Promise<{
        message: string;
    }>;
    reportarFoto(id: string, body: any, req: any): Promise<{
        message: string;
    }>;
}
