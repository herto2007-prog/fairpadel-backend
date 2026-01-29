import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
export declare class NotificacionesService {
    private prisma;
    private emailService;
    private smsService;
    constructor(prisma: PrismaService, emailService: EmailService, smsService: SmsService);
    crearNotificacion(userId: string, tipo: string, contenido: string, enviarEmail?: boolean, enviarSms?: boolean): Promise<{
        id: string;
        createdAt: Date;
        tipo: import(".prisma/client").$Enums.TipoNotificacion;
        userId: string;
        contenido: string;
        leida: boolean;
    }>;
    obtenerNotificaciones(userId: string, leida?: boolean): Promise<{
        id: string;
        createdAt: Date;
        tipo: import(".prisma/client").$Enums.TipoNotificacion;
        userId: string;
        contenido: string;
        leida: boolean;
    }[]>;
    contarNoLeidas(userId: string): Promise<{
        count: number;
    }>;
    marcarComoLeida(id: string, userId: string): Promise<{
        id: string;
        createdAt: Date;
        tipo: import(".prisma/client").$Enums.TipoNotificacion;
        userId: string;
        contenido: string;
        leida: boolean;
    }>;
    marcarTodasComoLeidas(userId: string): Promise<{
        message: string;
    }>;
    notificarInscripcionConfirmada(userId: string, torneoNombre: string): Promise<{
        id: string;
        createdAt: Date;
        tipo: import(".prisma/client").$Enums.TipoNotificacion;
        userId: string;
        contenido: string;
        leida: boolean;
    }>;
    notificarPagoConfirmado(userId: string, torneoNombre: string): Promise<{
        id: string;
        createdAt: Date;
        tipo: import(".prisma/client").$Enums.TipoNotificacion;
        userId: string;
        contenido: string;
        leida: boolean;
    }>;
    notificarResultadoPartido(userId: string, resultado: string): Promise<{
        id: string;
        createdAt: Date;
        tipo: import(".prisma/client").$Enums.TipoNotificacion;
        userId: string;
        contenido: string;
        leida: boolean;
    }>;
    notificarCambioRanking(userId: string, posicionNueva: number): Promise<{
        id: string;
        createdAt: Date;
        tipo: import(".prisma/client").$Enums.TipoNotificacion;
        userId: string;
        contenido: string;
        leida: boolean;
    }>;
    notificarNuevoSeguidor(userId: string, seguidorNombre: string): Promise<{
        id: string;
        createdAt: Date;
        tipo: import(".prisma/client").$Enums.TipoNotificacion;
        userId: string;
        contenido: string;
        leida: boolean;
    }>;
    notificarNuevoMensaje(userId: string, remitenteNombre: string): Promise<{
        id: string;
        createdAt: Date;
        tipo: import(".prisma/client").$Enums.TipoNotificacion;
        userId: string;
        contenido: string;
        leida: boolean;
    }>;
    recordatorioPartido(userId: string, detalles: string): Promise<{
        id: string;
        createdAt: Date;
        tipo: import(".prisma/client").$Enums.TipoNotificacion;
        userId: string;
        contenido: string;
        leida: boolean;
    }>;
}
