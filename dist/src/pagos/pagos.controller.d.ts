import { PagosService } from './pagos.service';
export declare class PagosController {
    private readonly pagosService;
    constructor(pagosService: PagosService);
    createCheckout(body: {
        inscripcionId: string;
    }): Promise<{
        checkoutUrl: string;
        transactionId: string;
    }>;
    confirmPayment(body: {
        transactionId: string;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
    handleWebhook(body: any): Promise<{
        received: boolean;
    }>;
    findByInscripcion(inscripcionId: string): Promise<{
        inscripcion: {
            tournament: {
                id: string;
                nombre: string;
                descripcion: string | null;
                createdAt: Date;
                ciudad: string;
                estado: import(".prisma/client").$Enums.TournamentStatus;
                updatedAt: Date;
                sede: string | null;
                pais: string;
                region: string;
                fechaInicio: Date;
                fechaFin: Date;
                flyerUrl: string;
                costoInscripcion: import("@prisma/client/runtime/library").Decimal;
                direccion: string | null;
                mapsUrl: string | null;
                fechaLimiteInscr: Date;
                sedeId: string | null;
                organizadorId: string;
            };
            pareja: {
                jugador1: {
                    id: string;
                    nombre: string;
                    createdAt: Date;
                    documento: string;
                    email: string;
                    telefono: string;
                    apellido: string;
                    genero: import(".prisma/client").$Enums.Gender;
                    passwordHash: string;
                    fechaNacimiento: Date | null;
                    ciudad: string | null;
                    bio: string | null;
                    fotoUrl: string | null;
                    estado: import(".prisma/client").$Enums.UserStatus;
                    emailVerificado: boolean;
                    esPremium: boolean;
                    ultimaSesion: Date | null;
                    updatedAt: Date;
                };
                jugador2: {
                    id: string;
                    nombre: string;
                    createdAt: Date;
                    documento: string;
                    email: string;
                    telefono: string;
                    apellido: string;
                    genero: import(".prisma/client").$Enums.Gender;
                    passwordHash: string;
                    fechaNacimiento: Date | null;
                    ciudad: string | null;
                    bio: string | null;
                    fotoUrl: string | null;
                    estado: import(".prisma/client").$Enums.UserStatus;
                    emailVerificado: boolean;
                    esPremium: boolean;
                    ultimaSesion: Date | null;
                    updatedAt: Date;
                };
            } & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                jugador2Documento: string;
                jugador1Id: string;
                jugador2Id: string | null;
            };
        } & {
            id: string;
            createdAt: Date;
            estado: import(".prisma/client").$Enums.InscripcionEstado;
            updatedAt: Date;
            categoryId: string;
            tournamentId: string;
            modalidad: import(".prisma/client").$Enums.Modalidad;
            parejaId: string;
        };
    } & {
        id: string;
        createdAt: Date;
        estado: import(".prisma/client").$Enums.PagoEstado;
        metodoPago: import(".prisma/client").$Enums.MetodoPago;
        monto: import("@prisma/client/runtime/library").Decimal;
        comision: import("@prisma/client/runtime/library").Decimal;
        transactionId: string | null;
        fechaPago: Date | null;
        fechaConfirm: Date | null;
        inscripcionId: string;
    }>;
}
