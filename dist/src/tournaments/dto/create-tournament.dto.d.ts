import { Modalidad } from '@prisma/client';
export declare class CreateTournamentDto {
    nombre: string;
    descripcion?: string;
    pais: string;
    region: string;
    ciudad: string;
    fechaInicio: string;
    fechaFin: string;
    fechaLimiteInscripcion: string;
    flyerUrl: string;
    costoInscripcion: number;
    sede?: string;
    direccion?: string;
    mapsUrl?: string;
    categorias: string[];
    modalidades: Modalidad[];
}
export { Modalidad };
