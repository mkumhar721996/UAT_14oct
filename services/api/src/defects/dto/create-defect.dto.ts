import { IsIn, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { DEFECT_SEVERITIES, DefectSeverity } from '../defect-severities';

export class CreateDefectDto {
  @IsString({ message: 'Enter a title for the defect.' })
  @IsNotEmpty({ message: 'Enter a title for the defect.' })
  @Matches(/\S/, { message: 'Enter a title for the defect.' })
  title!: string;

  @IsString({ message: 'Describe the defect.' })
  @IsNotEmpty({ message: 'Describe the defect.' })
  @Matches(/\S/, { message: 'Describe the defect.' })
  description!: string;

  @IsIn(DEFECT_SEVERITIES, { message: 'Choose a severity.' })
  severity!: DefectSeverity;

  @IsString({ message: 'Describe the steps to reproduce the defect.' })
  @IsNotEmpty({ message: 'Describe the steps to reproduce the defect.' })
  @Matches(/\S/, { message: 'Describe the steps to reproduce the defect.' })
  stepsToReproduce!: string;

  @IsOptional()
  @IsString()
  expectedResult?: string;

  @IsOptional()
  @IsString()
  actualResult?: string;

  @IsOptional()
  @IsString()
  environment?: string;
}
