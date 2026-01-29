import { ParejasService } from './parejas.service';
import { CreateParejaDto } from './dto/create-pareja.dto';
export declare class ParejasController {
    private readonly parejasService;
    constructor(parejasService: ParejasService);
    create(createParejaDto: CreateParejaDto, req: any): Promise<{
        jugador1: {
            id: string;
            nombre: string;
            documento: string;
            apellido: string;
            genero: import(".prisma/client").$Enums.Gender;
            fotoUrl: string;
        };
        jugador2: {
            id: string;
            nombre: string;
            documento: string;
            apellido: string;
            genero: import(".prisma/client").$Enums.Gender;
            fotoUrl: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        jugador2Documento: string;
        jugador1Id: string;
        jugador2Id: string | null;
    }>;
    findOne(id: string): Promise<{
        jugador1: {
            id: string;
            nombre: string;
            documento: string;
            apellido: string;
            genero: import(".prisma/client").$Enums.Gender;
            fotoUrl: string;
        };
        jugador2: {
            id: string;
            nombre: string;
            documento: string;
            apellido: string;
            genero: import(".prisma/client").$Enums.Gender;
            fotoUrl: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        jugador2Documento: string;
        jugador1Id: string;
        jugador2Id: string | null;
    }>;
    findByUser(userId: string): Promise<({
        jugador1: {
            id: string;
            nombre: string;
            documento: string;
            apellido: string;
            genero: import(".prisma/client").$Enums.Gender;
            fotoUrl: string;
        };
        jugador2: {
            id: string;
            nombre: string;
            documento: string;
            apellido: string;
            genero: import(".prisma/client").$Enums.Gender;
            fotoUrl: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        jugador2Documento: string;
        jugador1Id: string;
        jugador2Id: string | null;
    })[]>;
    buscarJugador(body: {
        documento: string;
    }): Promise<{
        encontrado: boolean;
        mensaje: string;
        jugador?: undefined;
    } | {
        encontrado: boolean;
        jugador: {
            id: string;
            nombre: string;
            documento: string;
            apellido: string;
            genero: import(".prisma/client").$Enums.Gender;
            ciudad: string;
            fotoUrl: string;
        };
        mensaje?: undefined;
    }>;
}
