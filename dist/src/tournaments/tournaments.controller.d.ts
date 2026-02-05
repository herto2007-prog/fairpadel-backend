import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto, UpdateTournamentDto } from './dto';
export declare class TournamentsController {
    private readonly tournamentsService;
    constructor(tournamentsService: TournamentsService);
    create(createTournamentDto: CreateTournamentDto, req: any): Promise<{
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
    findAll(pais?: string, ciudad?: string, estado?: string): Promise<({
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
    obtenerCategorias(): Promise<{
        id: string;
        nombre: string;
        createdAt: Date;
        tipo: import(".prisma/client").$Enums.Gender;
        orden: number;
    }[]>;
    findMyTournaments(req: any): Promise<({
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
    update(id: string, updateTournamentDto: UpdateTournamentDto, req: any): Promise<{
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
    publish(id: string, req: any): Promise<{
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
    remove(id: string, req: any): Promise<{
        message: string;
    }>;
}
