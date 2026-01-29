import { PrismaService } from '../prisma/prisma.service';
export declare class RankingsService {
    private prisma;
    constructor(prisma: PrismaService);
    obtenerRankings(tipo?: string, alcance?: string, genero?: string): Promise<({
        jugador: {
            id: string;
            nombre: string;
            documento: string;
            apellido: string;
            genero: import(".prisma/client").$Enums.Gender;
            ciudad: string;
            fotoUrl: string;
        };
    } & {
        id: string;
        genero: import(".prisma/client").$Enums.Gender;
        posicion: number;
        jugadorId: string;
        tipoRanking: import(".prisma/client").$Enums.TipoRanking;
        alcance: string;
        puntosTotales: number;
        posicionAnterior: number | null;
        torneosJugados: number;
        victorias: number;
        derrotas: number;
        porcentajeVictorias: import("@prisma/client/runtime/library").Decimal | null;
        rachaActual: number;
        mejorPosicion: number | null;
        campeonatos: number;
        ultimaActualizacion: Date;
    })[]>;
    obtenerRankingGlobal(genero?: string): Promise<({
        jugador: {
            id: string;
            nombre: string;
            documento: string;
            apellido: string;
            genero: import(".prisma/client").$Enums.Gender;
            ciudad: string;
            fotoUrl: string;
        };
    } & {
        id: string;
        genero: import(".prisma/client").$Enums.Gender;
        posicion: number;
        jugadorId: string;
        tipoRanking: import(".prisma/client").$Enums.TipoRanking;
        alcance: string;
        puntosTotales: number;
        posicionAnterior: number | null;
        torneosJugados: number;
        victorias: number;
        derrotas: number;
        porcentajeVictorias: import("@prisma/client/runtime/library").Decimal | null;
        rachaActual: number;
        mejorPosicion: number | null;
        campeonatos: number;
        ultimaActualizacion: Date;
    })[]>;
    obtenerRankingPorPais(pais: string, genero?: string): Promise<({
        jugador: {
            id: string;
            nombre: string;
            documento: string;
            apellido: string;
            genero: import(".prisma/client").$Enums.Gender;
            ciudad: string;
            fotoUrl: string;
        };
    } & {
        id: string;
        genero: import(".prisma/client").$Enums.Gender;
        posicion: number;
        jugadorId: string;
        tipoRanking: import(".prisma/client").$Enums.TipoRanking;
        alcance: string;
        puntosTotales: number;
        posicionAnterior: number | null;
        torneosJugados: number;
        victorias: number;
        derrotas: number;
        porcentajeVictorias: import("@prisma/client/runtime/library").Decimal | null;
        rachaActual: number;
        mejorPosicion: number | null;
        campeonatos: number;
        ultimaActualizacion: Date;
    })[]>;
    obtenerRankingPorCiudad(ciudad: string, genero?: string): Promise<({
        jugador: {
            id: string;
            nombre: string;
            documento: string;
            apellido: string;
            genero: import(".prisma/client").$Enums.Gender;
            ciudad: string;
            fotoUrl: string;
        };
    } & {
        id: string;
        genero: import(".prisma/client").$Enums.Gender;
        posicion: number;
        jugadorId: string;
        tipoRanking: import(".prisma/client").$Enums.TipoRanking;
        alcance: string;
        puntosTotales: number;
        posicionAnterior: number | null;
        torneosJugados: number;
        victorias: number;
        derrotas: number;
        porcentajeVictorias: import("@prisma/client/runtime/library").Decimal | null;
        rachaActual: number;
        mejorPosicion: number | null;
        campeonatos: number;
        ultimaActualizacion: Date;
    })[]>;
    obtenerRankingPorCategoria(categoria: string, genero?: string): Promise<({
        jugador: {
            id: string;
            nombre: string;
            documento: string;
            apellido: string;
            genero: import(".prisma/client").$Enums.Gender;
            ciudad: string;
            fotoUrl: string;
        };
    } & {
        id: string;
        genero: import(".prisma/client").$Enums.Gender;
        posicion: number;
        jugadorId: string;
        tipoRanking: import(".prisma/client").$Enums.TipoRanking;
        alcance: string;
        puntosTotales: number;
        posicionAnterior: number | null;
        torneosJugados: number;
        victorias: number;
        derrotas: number;
        porcentajeVictorias: import("@prisma/client/runtime/library").Decimal | null;
        rachaActual: number;
        mejorPosicion: number | null;
        campeonatos: number;
        ultimaActualizacion: Date;
    })[]>;
    obtenerTop10(genero?: string): Promise<({
        jugador: {
            id: string;
            nombre: string;
            documento: string;
            apellido: string;
            genero: import(".prisma/client").$Enums.Gender;
            ciudad: string;
            fotoUrl: string;
        };
    } & {
        id: string;
        genero: import(".prisma/client").$Enums.Gender;
        posicion: number;
        jugadorId: string;
        tipoRanking: import(".prisma/client").$Enums.TipoRanking;
        alcance: string;
        puntosTotales: number;
        posicionAnterior: number | null;
        torneosJugados: number;
        victorias: number;
        derrotas: number;
        porcentajeVictorias: import("@prisma/client/runtime/library").Decimal | null;
        rachaActual: number;
        mejorPosicion: number | null;
        campeonatos: number;
        ultimaActualizacion: Date;
    })[]>;
    obtenerRankingJugador(jugadorId: string): Promise<({
        jugador: {
            id: string;
            nombre: string;
            documento: string;
            apellido: string;
            genero: import(".prisma/client").$Enums.Gender;
            ciudad: string;
            fotoUrl: string;
        };
    } & {
        id: string;
        genero: import(".prisma/client").$Enums.Gender;
        posicion: number;
        jugadorId: string;
        tipoRanking: import(".prisma/client").$Enums.TipoRanking;
        alcance: string;
        puntosTotales: number;
        posicionAnterior: number | null;
        torneosJugados: number;
        victorias: number;
        derrotas: number;
        porcentajeVictorias: import("@prisma/client/runtime/library").Decimal | null;
        rachaActual: number;
        mejorPosicion: number | null;
        campeonatos: number;
        ultimaActualizacion: Date;
    })[]>;
    obtenerHistorialPuntos(jugadorId: string): Promise<({
        category: {
            id: string;
            nombre: string;
        };
        tournament: {
            id: string;
            nombre: string;
            ciudad: string;
            fechaInicio: Date;
        };
    } & {
        id: string;
        createdAt: Date;
        categoryId: string;
        tournamentId: string;
        jugadorId: string;
        posicionFinal: string;
        puntosGanados: number;
        fechaTorneo: Date;
    })[]>;
    actualizarRankings(tournamentId: string): Promise<{
        message: string;
    }>;
    private registrarPuntos;
    private actualizarRankingJugador;
    private recalcularPosiciones;
    recalcularRankings(): Promise<{
        message: string;
    }>;
}
