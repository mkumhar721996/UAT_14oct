import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DEFECT_SEVERITIES } from '../defect-severities';

/** Status is deliberately not a property: the global whitelist pipe rejects it with a 400. */
export class UpdateDefectDto {
  @IsOptional() @IsString() @IsNotEmpty() description?: string;
  @IsOptional() @IsString() @IsNotEmpty() reproSteps?: string;
  @IsOptional() @IsIn(DEFECT_SEVERITIES) severity?: string;
}
