import { PartialType } from '@nestjs/mapped-types';
import { CreateCircuitoDto } from './create-circuito.dto';

export class UpdateCircuitoDto extends PartialType(CreateCircuitoDto) {}
