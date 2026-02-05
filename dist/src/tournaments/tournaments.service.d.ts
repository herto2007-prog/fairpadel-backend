import { PrismaService } from '../prisma/prisma.service';
import { CreateTournamentDto, UpdateTournamentDto } from './dto';
export declare class TournamentsService {
    private prisma;
    constructor(prisma: PrismaService);
    create(createTournamentDto: CreateTournamentDto, organizadorId: string): Promise<{
        organizador: {
            id: string;
            nombre: string;
            email: string;
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
    }>;
    findAll(filters?: {
        pais?: string;
        ciudad?: string;
        estado?: string;
    }): Promise<({
        organizador: {
            id: string;
            nombre: string;
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
    })[]>;
    findOne(id: string): Promise<{
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
    }>;
    findMyTournaments(organizadorId: string): Promise<({
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
    })[]>;
    update(id: string, updateTournamentDto: UpdateTournamentDto, userId: string): Promise<{
        organizador: {
            id: string;
            nombre: string;
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
    }>;
    publish(id: string, userId: string): Promise<{
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
    }>;
    remove(id: string, userId: string): Promise<{
        message: string;
    }>;
    obtenerCategorias(): Promise<{
        id: string;
        nombre: string;
        createdAt: Date;
        tipo: import(".prisma/client").$Enums.Gender;
        orden: number;
    }[]>;
}
