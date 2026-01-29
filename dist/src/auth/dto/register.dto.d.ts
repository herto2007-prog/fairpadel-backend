export declare enum Gender {
    FEMENINO = "FEMENINO",
    MASCULINO = "MASCULINO"
}
export declare class RegisterDto {
    documento: string;
    nombre: string;
    apellido: string;
    genero: Gender;
    email: string;
    telefono: string;
    password: string;
    confirmPassword: string;
    ciudad?: string;
    fotoUrl?: string;
}
