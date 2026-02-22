// DTOs para admin
export class AprobarTorneoDto {
  torneoId: string;
}

export class RechazarTorneoDto {
  torneoId: string;
  motivo: string;
}

export * from './seed-test-data.dto';