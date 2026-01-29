import { NotificacionesService } from './notificaciones.service';
export declare class NotificacionesController {
    private readonly notificacionesService;
    constructor(notificacionesService: NotificacionesService);
    obtenerNotificaciones(req: any, leida?: string): Promise<{
        id: string;
        createdAt: Date;
        tipo: import(".prisma/client").$Enums.TipoNotificacion;
        userId: string;
        contenido: string;
        leida: boolean;
    }[]>;
    contarNoLeidas(req: any): Promise<{
        count: number;
    }>;
    marcarComoLeida(id: string, req: any): Promise<{
        id: string;
        createdAt: Date;
        tipo: import(".prisma/client").$Enums.TipoNotificacion;
        userId: string;
        contenido: string;
        leida: boolean;
    }>;
    marcarTodasComoLeidas(req: any): Promise<{
        message: string;
    }>;
}
