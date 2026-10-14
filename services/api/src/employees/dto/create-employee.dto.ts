import { IsDateString, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min, Matches } from 'class-validator';

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'fullName must not be blank' })
  fullName!: string;

  @IsDateString({ strict: true })
  @IsNotEmpty()
  startDate!: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  contractType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salary?: number;
}
