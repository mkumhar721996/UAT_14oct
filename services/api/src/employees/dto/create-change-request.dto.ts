import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CORE_FIELDS, CoreField } from '../employee-fields';

export class CreateChangeRequestDto {
  @IsIn(CORE_FIELDS)
  field!: CoreField;

  @IsString()
  @IsNotEmpty()
  requestedValue!: string;

  @IsDateString({ strict: true })
  effectiveDate!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
