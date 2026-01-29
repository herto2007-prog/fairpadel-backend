import { SuscripcionesService } from './suscripciones.service';
import { CreateSuscripcionDto } from './dto';
export declare class SuscripcionesController {
    private readonly suscripcionesService;
    constructor(suscripcionesService: SuscripcionesService);
    obtenerPlanes(): Promise<{
        id: string;
        nombre: string;
        createdAt: Date;
        tipo: import(".prisma/client").$Enums.PlanTipo;
        precioMensual: import("@prisma/client/runtime/library").Decimal;
        precioAnual: import("@prisma/client/runtime/library").Decimal;
        caracteristicas: string;
        activo: boolean;
    }[]>;
    crearSuscripcion(dto: CreateSuscripcionDto, req: any): Promise<{
        suscripcion: {
            id: string;
            createdAt: Date;
            estado: import(".prisma/client").$Enums.SuscripcionEstado;
            updatedAt: Date;
            userId: string;
            fechaInicio: Date;
            fechaFin: Date;
            planId: string;
            periodo: import(".prisma/client").$Enums.PeriodoSuscripcion;
            precio: import("@prisma/client/runtime/library").Decimal;
            fechaRenovacion: Date | null;
            autoRenovar: boolean;
            metodoPagoId: string | null;
            cuponAplicado: string | null;
        };
        checkoutUrl: string;
        transactionId: string;
    }>;
    obtenerMiSuscripcion(req: any): Promise<{
        plan: {
            id: string;
            nombre: string;
            createdAt: Date;
            tipo: import(".prisma/client").$Enums.PlanTipo;
            precioMensual: import("@prisma/client/runtime/library").Decimal;
            precioAnual: import("@prisma/client/runtime/library").Decimal;
            caracteristicas: string;
            activo: boolean;
        };
    } & {
        id: string;
        createdAt: Date;
        estado: import(".prisma/client").$Enums.SuscripcionEstado;
        updatedAt: Date;
        userId: string;
        fechaInicio: Date;
        fechaFin: Date;
        planId: string;
        periodo: import(".prisma/client").$Enums.PeriodoSuscripcion;
        precio: import("@prisma/client/runtime/library").Decimal;
        fechaRenovacion: Date | null;
        autoRenovar: boolean;
        metodoPagoId: string | null;
        cuponAplicado: string | null;
    }>;
    cancelarSuscripcion(req: any): Promise<{
        message: string;
    }>;
    reactivarSuscripcion(req: any): Promise<{
        message: string;
    }>;
    validarCupon(body: {
        codigo: string;
    }): Promise<{
        valido: boolean;
        mensaje: string;
        cupon?: undefined;
    } | {
        valido: boolean;
        cupon: {
            id: string;
            createdAt: Date;
            tipo: string;
            estado: string;
            fechaInicio: Date;
            codigo: string;
            valor: import("@prisma/client/runtime/library").Decimal;
            fechaExpiracion: Date;
            limiteUsos: number;
            usosActuales: number;
        };
        mensaje: string;
    }>;
}
