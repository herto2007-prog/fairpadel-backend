import { PrismaService } from '../prisma/prisma.service';
import { CreateSedeDto } from './dto/create-sede.dto';
import { UpdateSedeDto } from './dto/update-sede.dto';
import { CreateSedeCanchaDto } from './dto/create-sede-cancha.dto';
import { UpdateSedeCanchaDto } from './dto/update-sede-cancha.dto';
import { ConfigurarTorneoCanchasDto } from './dto/configurar-torneo-canchas.dto';
export declare class SedesService {
    private prisma;
    constructor(prisma: PrismaService);
    createSede(dto: CreateSedeDto): Promise<{
        canchas: {
            id: string;
            nombre: string;
            createdAt: Date;
            tipo: import(".prisma/client").$Enums.TipoCancha;
            updatedAt: Date;
            sedeId: string;
            posicionX: number;
            posicionY: number;
            ancho: number;
            alto: number;
            rotacion: number;
            imagenUrl: string | null;
            activa: boolean;
        }[];
    } & {
        id: string;
        nombre: string;
        createdAt: Date;
        telefono: string | null;
        ciudad: string;
        updatedAt: Date;
        activo: boolean;
        direccion: string | null;
        mapsUrl: string | null;
        logoUrl: string | null;
        imagenFondo: string | null;
        horarioAtencion: string | null;
        contactoEncargado: string | null;
        canvasWidth: number;
        canvasHeight: number;
    }>;
    findAllSedes(filters: {
        ciudad?: string;
        activo?: boolean;
    }): Promise<({
        _count: {
            canchas: number;
            torneosPrincipal: number;
        };
        canchas: {
            id: string;
            nombre: string;
            createdAt: Date;
            tipo: import(".prisma/client").$Enums.TipoCancha;
            updatedAt: Date;
            sedeId: string;
            posicionX: number;
            posicionY: number;
            ancho: number;
            alto: number;
            rotacion: number;
            imagenUrl: string | null;
            activa: boolean;
        }[];
    } & {
        id: string;
        nombre: string;
        createdAt: Date;
        telefono: string | null;
        ciudad: string;
        updatedAt: Date;
        activo: boolean;
        direccion: string | null;
        mapsUrl: string | null;
        logoUrl: string | null;
        imagenFondo: string | null;
        horarioAtencion: string | null;
        contactoEncargado: string | null;
        canvasWidth: number;
        canvasHeight: number;
    })[]>;
    findOneSede(id: string): Promise<{
        _count: {
            torneoSedes: number;
            canchas: number;
            torneosPrincipal: number;
        };
        canchas: {
            id: string;
            nombre: string;
            createdAt: Date;
            tipo: import(".prisma/client").$Enums.TipoCancha;
            updatedAt: Date;
            sedeId: string;
            posicionX: number;
            posicionY: number;
            ancho: number;
            alto: number;
            rotacion: number;
            imagenUrl: string | null;
            activa: boolean;
        }[];
        torneosPrincipal: {
            id: string;
            nombre: string;
            estado: import(".prisma/client").$Enums.TournamentStatus;
            fechaInicio: Date;
        }[];
    } & {
        id: string;
        nombre: string;
        createdAt: Date;
        telefono: string | null;
        ciudad: string;
        updatedAt: Date;
        activo: boolean;
        direccion: string | null;
        mapsUrl: string | null;
        logoUrl: string | null;
        imagenFondo: string | null;
        horarioAtencion: string | null;
        contactoEncargado: string | null;
        canvasWidth: number;
        canvasHeight: number;
    }>;
    updateSede(id: string, dto: UpdateSedeDto): Promise<{
        canchas: {
            id: string;
            nombre: string;
            createdAt: Date;
            tipo: import(".prisma/client").$Enums.TipoCancha;
            updatedAt: Date;
            sedeId: string;
            posicionX: number;
            posicionY: number;
            ancho: number;
            alto: number;
            rotacion: number;
            imagenUrl: string | null;
            activa: boolean;
        }[];
    } & {
        id: string;
        nombre: string;
        createdAt: Date;
        telefono: string | null;
        ciudad: string;
        updatedAt: Date;
        activo: boolean;
        direccion: string | null;
        mapsUrl: string | null;
        logoUrl: string | null;
        imagenFondo: string | null;
        horarioAtencion: string | null;
        contactoEncargado: string | null;
        canvasWidth: number;
        canvasHeight: number;
    }>;
    deleteSede(id: string): Promise<{
        id: string;
        nombre: string;
        createdAt: Date;
        telefono: string | null;
        ciudad: string;
        updatedAt: Date;
        activo: boolean;
        direccion: string | null;
        mapsUrl: string | null;
        logoUrl: string | null;
        imagenFondo: string | null;
        horarioAtencion: string | null;
        contactoEncargado: string | null;
        canvasWidth: number;
        canvasHeight: number;
    }>;
    createCancha(sedeId: string, dto: CreateSedeCanchaDto): Promise<{
        id: string;
        nombre: string;
        createdAt: Date;
        tipo: import(".prisma/client").$Enums.TipoCancha;
        updatedAt: Date;
        sedeId: string;
        posicionX: number;
        posicionY: number;
        ancho: number;
        alto: number;
        rotacion: number;
        imagenUrl: string | null;
        activa: boolean;
    }>;
    findAllCanchas(sedeId: string): Promise<{
        id: string;
        nombre: string;
        createdAt: Date;
        tipo: import(".prisma/client").$Enums.TipoCancha;
        updatedAt: Date;
        sedeId: string;
        posicionX: number;
        posicionY: number;
        ancho: number;
        alto: number;
        rotacion: number;
        imagenUrl: string | null;
        activa: boolean;
    }[]>;
    updateCancha(sedeId: string, canchaId: string, dto: UpdateSedeCanchaDto): Promise<{
        id: string;
        nombre: string;
        createdAt: Date;
        tipo: import(".prisma/client").$Enums.TipoCancha;
        updatedAt: Date;
        sedeId: string;
        posicionX: number;
        posicionY: number;
        ancho: number;
        alto: number;
        rotacion: number;
        imagenUrl: string | null;
        activa: boolean;
    }>;
    deleteCancha(sedeId: string, canchaId: string): Promise<{
        id: string;
        nombre: string;
        createdAt: Date;
        tipo: import(".prisma/client").$Enums.TipoCancha;
        updatedAt: Date;
        sedeId: string;
        posicionX: number;
        posicionY: number;
        ancho: number;
        alto: number;
        rotacion: number;
        imagenUrl: string | null;
        activa: boolean;
    }>;
    updateCanchasBulk(sedeId: string, canchas: UpdateSedeCanchaDto[]): Promise<{
        id: string;
        nombre: string;
        createdAt: Date;
        tipo: import(".prisma/client").$Enums.TipoCancha;
        updatedAt: Date;
        sedeId: string;
        posicionX: number;
        posicionY: number;
        ancho: number;
        alto: number;
        rotacion: number;
        imagenUrl: string | null;
        activa: boolean;
    }[]>;
    configurarTorneoCanchas(tournamentId: string, dto: ConfigurarTorneoCanchasDto): Promise<{
        message: string;
        torneoCanchas: any[];
    }>;
    getTorneoCanchas(tournamentId: string): Promise<{
        torneo: {
            id: string;
            nombre: string;
            fechaInicio: Date;
            fechaFin: Date;
        };
        sedePrincipal: {
            canchas: {
                id: string;
                nombre: string;
                createdAt: Date;
                tipo: import(".prisma/client").$Enums.TipoCancha;
                updatedAt: Date;
                sedeId: string;
                posicionX: number;
                posicionY: number;
                ancho: number;
                alto: number;
                rotacion: number;
                imagenUrl: string | null;
                activa: boolean;
            }[];
        } & {
            id: string;
            nombre: string;
            createdAt: Date;
            telefono: string | null;
            ciudad: string;
            updatedAt: Date;
            activo: boolean;
            direccion: string | null;
            mapsUrl: string | null;
            logoUrl: string | null;
            imagenFondo: string | null;
            horarioAtencion: string | null;
            contactoEncargado: string | null;
            canvasWidth: number;
            canvasHeight: number;
        };
        sedesAdicionales: ({
            canchas: {
                id: string;
                nombre: string;
                createdAt: Date;
                tipo: import(".prisma/client").$Enums.TipoCancha;
                updatedAt: Date;
                sedeId: string;
                posicionX: number;
                posicionY: number;
                ancho: number;
                alto: number;
                rotacion: number;
                imagenUrl: string | null;
                activa: boolean;
            }[];
        } & {
            id: string;
            nombre: string;
            createdAt: Date;
            telefono: string | null;
            ciudad: string;
            updatedAt: Date;
            activo: boolean;
            direccion: string | null;
            mapsUrl: string | null;
            logoUrl: string | null;
            imagenFondo: string | null;
            horarioAtencion: string | null;
            contactoEncargado: string | null;
            canvasWidth: number;
            canvasHeight: number;
        })[];
        canchasConfiguradas: ({
            sedeCancha: {
                sede: {
                    id: string;
                    nombre: string;
                };
            } & {
                id: string;
                nombre: string;
                createdAt: Date;
                tipo: import(".prisma/client").$Enums.TipoCancha;
                updatedAt: Date;
                sedeId: string;
                posicionX: number;
                posicionY: number;
                ancho: number;
                alto: number;
                rotacion: number;
                imagenUrl: string | null;
                activa: boolean;
            };
            horarios: {
                id: string;
                createdAt: Date;
                torneoCanchaId: string;
                fecha: Date;
                horaInicio: string;
                horaFin: string;
            }[];
        } & {
            id: string;
            createdAt: Date;
            tournamentId: string;
            sedeCanchaId: string;
        })[];
    }>;
    agregarSedeATorneo(tournamentId: string, sedeId: string): Promise<{
        sede: {
            canchas: {
                id: string;
                nombre: string;
                createdAt: Date;
                tipo: import(".prisma/client").$Enums.TipoCancha;
                updatedAt: Date;
                sedeId: string;
                posicionX: number;
                posicionY: number;
                ancho: number;
                alto: number;
                rotacion: number;
                imagenUrl: string | null;
                activa: boolean;
            }[];
        } & {
            id: string;
            nombre: string;
            createdAt: Date;
            telefono: string | null;
            ciudad: string;
            updatedAt: Date;
            activo: boolean;
            direccion: string | null;
            mapsUrl: string | null;
            logoUrl: string | null;
            imagenFondo: string | null;
            horarioAtencion: string | null;
            contactoEncargado: string | null;
            canvasWidth: number;
            canvasHeight: number;
        };
    } & {
        id: string;
        createdAt: Date;
        sedeId: string;
        tournamentId: string;
    }>;
    removerSedeDeTorneo(tournamentId: string, sedeId: string): Promise<{
        id: string;
        createdAt: Date;
        sedeId: string;
        tournamentId: string;
    }>;
    getSedesDeTorneo(tournamentId: string): Promise<any[]>;
}
