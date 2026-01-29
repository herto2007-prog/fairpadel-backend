import { PrismaService } from '../prisma/prisma.service';
import { BancardService } from '../pagos/bancard.service';
import { CreateSuscripcionDto } from './dto';
export declare class SuscripcionesService {
    private prisma;
    private bancardService;
    constructor(prisma: PrismaService, bancardService: BancardService);
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
    crearSuscripcion(dto: CreateSuscripcionDto, userId: string): Promise<{
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
    obtenerSuscripcionActiva(userId: string): Promise<{
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
    cancelarSuscripcion(userId: string): Promise<{
        message: string;
    }>;
    reactivarSuscripcion(userId: string): Promise<{
        message: string;
    }>;
    confirmarPagoSuscripcion(suscripcionId: string): Promise<{
        message: string;
    }>;
    validarCupon(codigo: string): Promise<{
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
    private aplicarDescuento;
    renovarSuscripcionesVencidas(): Promise<{
        procesadas: number;
    }>;
}
