import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract'];

/** Fields shared by create and update; `title` is declared separately by each since its
 * required-ness differs and class-validator ANDs inherited + own decorators per property. */
export class RequisitionFieldsDto {
  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsIn(EMPLOYMENT_TYPES)
  employmentType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  headcount?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMax?: number;
}

/** Editable requisition fields; title is optional so a draft can be saved half-filled. */
export class UpdateRequisitionDto extends RequisitionFieldsDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;
}
