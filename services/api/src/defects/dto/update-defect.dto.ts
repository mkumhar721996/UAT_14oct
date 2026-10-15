import { IsIn, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { DEFECT_SEVERITIES, DefectSeverity } from '../defect-severities';

export class UpdateDefectDto {
  @IsOptional()
  @IsString({ message: 'Describe the defect.' })
  @IsNotEmpty({ message: 'Describe the defect.' })
  @Matches(/\S/, { message: 'Describe the defect.' })
  description?: string;

  @IsOptional()
  @IsString({ message: 'Describe the steps to reproduce the defect.' })
  @IsNotEmpty({ message: 'Describe the steps to reproduce the defect.' })
  @Matches(/\S/, { message: 'Describe the steps to reproduce the defect.' })
  stepsToReproduce?: string;

  @IsOptional()
  @IsIn(DEFECT_SEVERITIES, { message: 'Choose a severity.' })
  severity?: DefectSeverity;
}
