import { PrismaService } from '../prisma/prisma.service';
export declare class FixtureService {
    private prisma;
    constructor(prisma: PrismaService);
    generarFixtureCompleto(tournamentId: string): Promise<{
        tournamentId: string;
        fixtures: any[];
        message: string;
    }>;
    private generarFixturePorCategoria;
    private generarRondas;
    private getNombreRonda;
    private calcularNumeroPartidos;
    private shuffleArray;
    private asignarCanchasYHorarios;
    private calcularHoraFin;
    private generarPartidoUbicacion;
    obtenerFixture(tournamentId: string, categoryId?: string): Promise<{}>;
}
