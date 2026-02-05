export declare class HorarioDto {
    fecha: string;
    horaInicio: string;
    horaFin: string;
}
export declare class CanchaConfigDto {
    sedeCanchaId: string;
    horarios: HorarioDto[];
}
export declare class ConfigurarTorneoCanchasDto {
    canchas: CanchaConfigDto[];
}
