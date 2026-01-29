export declare class CreateInscripcionDto {
    tournamentId: string;
    categoryId: string;
    modalidad: 'TRADICIONAL' | 'MIXTO' | 'SUMA';
    jugador2Documento: string;
    metodoPago: 'BANCARD' | 'TRANSFERENCIA' | 'EFECTIVO';
}
