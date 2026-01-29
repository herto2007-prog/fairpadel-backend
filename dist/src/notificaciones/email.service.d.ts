export declare class EmailService {
    private readonly fromEmail;
    enviarEmail(to: string, subject: string, html: string): Promise<{
        success: boolean;
    }>;
    enviarEmailVerificacion(email: string, nombre: string, token: string): Promise<{
        success: boolean;
    }>;
    enviarEmailBienvenida(email: string, nombre: string): Promise<{
        success: boolean;
    }>;
    enviarEmailRecuperacion(email: string, nombre: string, token: string): Promise<{
        success: boolean;
    }>;
    enviarNotificacion(email: string, nombre: string, contenido: string): Promise<{
        success: boolean;
    }>;
    enviarResumenSemanal(email: string, nombre: string, datos: any): Promise<{
        success: boolean;
    }>;
}
