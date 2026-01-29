"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Modalidad = exports.CreateTournamentDto = void 0;
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
Object.defineProperty(exports, "Modalidad", { enumerable: true, get: function () { return client_1.Modalidad; } });
class CreateTournamentDto {
}
exports.CreateTournamentDto = CreateTournamentDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'El nombre del torneo es obligatorio' }),
    (0, class_validator_1.MinLength)(5, { message: 'El nombre debe tener al menos 5 caracteres' }),
    (0, class_validator_1.MaxLength)(150, { message: 'El nombre no puede exceder 150 caracteres' }),
    __metadata("design:type", String)
], CreateTournamentDto.prototype, "nombre", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.MaxLength)(2000, { message: 'La descripción no puede exceder 2000 caracteres' }),
    __metadata("design:type", String)
], CreateTournamentDto.prototype, "descripcion", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'El país es obligatorio' }),
    __metadata("design:type", String)
], CreateTournamentDto.prototype, "pais", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'La región es obligatoria' }),
    __metadata("design:type", String)
], CreateTournamentDto.prototype, "region", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'La ciudad es obligatoria' }),
    __metadata("design:type", String)
], CreateTournamentDto.prototype, "ciudad", void 0);
__decorate([
    (0, class_validator_1.IsDateString)({}, { message: 'La fecha de inicio debe ser una fecha válida' }),
    __metadata("design:type", String)
], CreateTournamentDto.prototype, "fechaInicio", void 0);
__decorate([
    (0, class_validator_1.IsDateString)({}, { message: 'La fecha de fin debe ser una fecha válida' }),
    __metadata("design:type", String)
], CreateTournamentDto.prototype, "fechaFin", void 0);
__decorate([
    (0, class_validator_1.IsDateString)({}, { message: 'La fecha límite de inscripción debe ser una fecha válida' }),
    __metadata("design:type", String)
], CreateTournamentDto.prototype, "fechaLimiteInscripcion", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'El flyer es obligatorio' }),
    __metadata("design:type", String)
], CreateTournamentDto.prototype, "flyerUrl", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({}, { message: 'El costo de inscripción debe ser un número' }),
    (0, class_validator_1.Min)(0, { message: 'El costo de inscripción no puede ser negativo' }),
    __metadata("design:type", Number)
], CreateTournamentDto.prototype, "costoInscripcion", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateTournamentDto.prototype, "sede", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateTournamentDto.prototype, "direccion", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateTournamentDto.prototype, "mapsUrl", void 0);
__decorate([
    (0, class_validator_1.IsArray)({ message: 'Las categorías deben ser un array' }),
    (0, class_validator_1.ArrayMinSize)(1, { message: 'Debes seleccionar al menos una categoría' }),
    (0, class_validator_1.IsString)({ each: true, message: 'Cada categoría debe ser un ID válido' }),
    __metadata("design:type", Array)
], CreateTournamentDto.prototype, "categorias", void 0);
__decorate([
    (0, class_validator_1.IsArray)({ message: 'Las modalidades deben ser un array' }),
    (0, class_validator_1.ArrayMinSize)(1, { message: 'Debes seleccionar al menos una modalidad' }),
    (0, class_validator_1.IsEnum)(client_1.Modalidad, { each: true, message: 'Modalidad inválida' }),
    __metadata("design:type", Array)
], CreateTournamentDto.prototype, "modalidades", void 0);
//# sourceMappingURL=create-tournament.dto.js.map