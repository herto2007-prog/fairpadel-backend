import { TipoCancha } from '@prisma/client';
export declare class UpdateSedeCanchaDto {
    id?: string;
    nombre?: string;
    tipo?: TipoCancha;
    posicionX?: number;
    posicionY?: number;
    ancho?: number;
    alto?: number;
    rotacion?: number;
    imagenUrl?: string;
    activa?: boolean;
}
