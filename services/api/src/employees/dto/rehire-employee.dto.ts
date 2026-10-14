import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class RehireEmployeeDto {
  @IsDateString({ strict: true })
  @IsNotEmpty()
  startDate!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'fullName must not be blank' })
  fullName?: string;

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
