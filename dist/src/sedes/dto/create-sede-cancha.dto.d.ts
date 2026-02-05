import { TipoCancha } from '@prisma/client';
export declare class CreateSedeCanchaDto {
    nombre: string;
    tipo?: TipoCancha;
    posicionX?: number;
    posicionY?: number;
    ancho?: number;
    alto?: number;
    rotacion?: number;
    imagenUrl?: string;
}
