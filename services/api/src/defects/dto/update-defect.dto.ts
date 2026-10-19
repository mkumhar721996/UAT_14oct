import { IsIn, IsNotEmpty, IsString, Matches, ValidateIf } from 'class-validator';
import { DEFECT_SEVERITIES, DefectSeverity } from '../defect-severities';

export class UpdateDefectDto {
  @ValidateIf((_, v) => v !== undefined)
  @IsString({ message: 'Describe the defect.' })
  @IsNotEmpty({ message: 'Describe the defect.' })
  @Matches(/\S/, { message: 'Describe the defect.' })
  description?: string;

  @ValidateIf((_, v) => v !== undefined)
  @IsString({ message: 'Describe the steps to reproduce the defect.' })
  @IsNotEmpty({ message: 'Describe the steps to reproduce the defect.' })
  @Matches(/\S/, { message: 'Describe the steps to reproduce the defect.' })
  stepsToReproduce?: string;

  @ValidateIf((_, v) => v !== undefined)
  @IsIn(DEFECT_SEVERITIES, { message: 'Choose a severity.' })
  severity?: DefectSeverity;
}
