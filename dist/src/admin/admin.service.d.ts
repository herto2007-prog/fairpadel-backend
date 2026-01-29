import { PrismaService } from '../prisma/prisma.service';
import { RankingsService } from '../rankings/rankings.service';
export declare class AdminService {
    private prisma;
    private rankingsService;
    constructor(prisma: PrismaService, rankingsService: RankingsService);
    obtenerTorneosPendientes(): Promise<({
        organizador: {
            id: string;
            nombre: string;
            email: string;
            telefono: string;
            apellido: string;
        };
        categorias: ({
            category: {
                id: string;
                nombre: string;
                createdAt: Date;
                tipo: import(".prisma/client").$Enums.Gender;
                orden: number;
            };
        } & {
            id: string;
            createdAt: Date;
            categoryId: string;
            tournamentId: string;
        })[];
        modalidades: {
            id: string;
            createdAt: Date;
            tournamentId: string;
            modalidad: import(".prisma/client").$Enums.Modalidad;
        }[];
    } & {
        id: string;
        nombre: string;
        descripcion: string | null;
        createdAt: Date;
        ciudad: string;
        estado: import(".prisma/client").$Enums.TournamentStatus;
        updatedAt: Date;
        pais: string;
        region: string;
        fechaInicio: Date;
        fechaFin: Date;
        flyerUrl: string;
        costoInscripcion: import("@prisma/client/runtime/library").Decimal;
        sede: string | null;
        direccion: string | null;
        mapsUrl: string | null;
        fechaLimiteInscr: Date;
        organizadorId: string;
    })[]>;
    aprobarTorneo(id: string): Promise<{
        message: string;
    }>;
    rechazarTorneo(id: string, motivo: string): Promise<{
        message: string;
    }>;
    obtenerSolicitudesOrganizador(estado?: string): Promise<({
        user: {
            id: string;
            nombre: string;
            email: string;
            telefono: string;
            apellido: string;
            ciudad: string;
        };
    } & {
        id: string;
        createdAt: Date;
        telefono: string;
        ciudad: string;
        estado: import(".prisma/client").$Enums.SolicitudEstado;
        updatedAt: Date;
        userId: string;
        motivo: string | null;
        organizacion: string | null;
        experiencia: string;
        motivacion: string;
    })[]>;
    aprobarSolicitudOrganizador(id: string): Promise<{
        message: string;
    }>;
    rechazarSolicitudOrganizador(id: string, motivo: string): Promise<{
        message: string;
    }>;
    obtenerFotosModeracion(): Promise<({
        user: {
            id: string;
            nombre: string;
            email: string;
            apellido: string;
        };
        tournament: {
            id: string;
            nombre: string;
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
    aprobarFoto(id: string): Promise<{
        message: string;
    }>;
    eliminarFotoInapropiada(id: string, motivo: string): Promise<{
        message: string;
    }>;
    obtenerUsuarios(search?: string, estado?: string): Promise<{
        id: string;
        nombre: string;
        createdAt: Date;
        documento: string;
        email: string;
        telefono: string;
        apellido: string;
        ciudad: string;
        estado: import(".prisma/client").$Enums.UserStatus;
        esPremium: boolean;
    }[]>;
    suspenderUsuario(id: string, motivo: string): Promise<{
        message: string;
    }>;
    activarUsuario(id: string): Promise<{
        message: string;
    }>;
    obtenerReportesFotos(estado?: string): Promise<({
        user: {
            id: string;
            nombre: string;
            apellido: string;
        };
        foto: {
            user: {
                id: string;
                nombre: string;
                apellido: string;
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
        };
    } & {
        id: string;
        createdAt: Date;
        estado: import(".prisma/client").$Enums.SolicitudEstado;
        userId: string;
        motivo: string;
        fotoId: string;
    })[]>;
    obtenerReportesUsuarios(estado?: string): Promise<({
        reportado: {
            id: string;
            nombre: string;
            apellido: string;
        };
        reportador: {
            id: string;
            nombre: string;
            apellido: string;
        };
    } & {
        id: string;
        descripcion: string | null;
        createdAt: Date;
        estado: import(".prisma/client").$Enums.SolicitudEstado;
        motivo: string;
        reportadorId: string;
        reportadoId: string;
    })[]>;
    resolverReporteFoto(id: string, accion: string): Promise<{
        message: string;
    }>;
    resolverReporteUsuario(id: string, accion: string): Promise<{
        message: string;
    }>;
    obtenerSuscripciones(estado?: string): Promise<({
        user: {
            id: string;
            nombre: string;
            email: string;
            apellido: string;
        };
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
    })[]>;
    extenderSuscripcion(id: string, dias: number): Promise<{
        message: string;
    }>;
    obtenerConfiguracionPuntos(): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        posicion: string;
        puntosBase: number;
        multiplicador: number;
    }[]>;
    actualizarConfiguracionPuntos(id: string, data: any): Promise<{
        message: string;
    }>;
    crearCupon(data: any): Promise<{
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
    }>;
    obtenerCupones(): Promise<{
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
    }[]>;
    desactivarCupon(id: string): Promise<{
        message: string;
    }>;
    obtenerMetricasDashboard(): Promise<{
        totalUsuarios: number;
        usuariosPremium: number;
        totalTorneos: number;
        torneosPendientes: number;
    }>;
    obtenerMetricasUsuarios(): Promise<{
        porEstado: (import(".prisma/client").Prisma.PickEnumerable<import(".prisma/client").Prisma.UserGroupByOutputType, "estado"[]> & {
            _count: number;
        })[];
        porGenero: (import(".prisma/client").Prisma.PickEnumerable<import(".prisma/client").Prisma.UserGroupByOutputType, "genero"[]> & {
            _count: number;
        })[];
    }>;
    obtenerMetricasTorneos(): Promise<{
        porEstado: (import(".prisma/client").Prisma.PickEnumerable<import(".prisma/client").Prisma.TournamentGroupByOutputType, "estado"[]> & {
            _count: number;
        })[];
    }>;
    obtenerMetricasIngresos(): Promise<{
        mrr: number;
        totalComisiones: number;
        suscripcionesActivas: number;
    }>;
}
