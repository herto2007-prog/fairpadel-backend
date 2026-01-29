export declare class SmsService {
    private readonly twilioAccountSid;
    private readonly twilioAuthToken;
    private readonly twilioPhoneNumber;
    enviarSms(to: string, message: string): Promise<{
        success: boolean;
    }>;
    enviarNotificacion(telefono: string, contenido: string): Promise<{
        success: boolean;
    }>;
    recordatorioPartido(telefono: string, detalles: string): Promise<{
        success: boolean;
    }>;
    notificacionPagoConfirmado(telefono: string): Promise<{
        success: boolean;
    }>;
    cambioHorarioTorneo(telefono: string, torneo: string): Promise<{
        success: boolean;
    }>;
}
