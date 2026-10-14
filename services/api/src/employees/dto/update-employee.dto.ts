import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Min, Matches } from 'class-validator';

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'fullName must not be blank' })
  fullName?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  startDate?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string | null;

  @IsOptional()
  @IsDateString({ strict: true })
  jobTitleEffectiveDate?: string;

  @IsOptional()
  @IsString()
  department?: string | null;

  @IsOptional()
  @IsDateString({ strict: true })
  departmentEffectiveDate?: string;

  @IsOptional()
  @IsString()
  contractType?: string | null;

  @IsOptional()
  @IsDateString({ strict: true })
  contractTypeEffectiveDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salary?: number | null;

  @IsOptional()
  @IsDateString({ strict: true })
  salaryEffectiveDate?: string;
}
