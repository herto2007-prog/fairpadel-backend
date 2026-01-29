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
    }>;
    remove(id: string, req: any): Promise<{
        message: string;
    }>;
}
