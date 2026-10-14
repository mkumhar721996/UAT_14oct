import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** Status is deliberately not a property: the global whitelist pipe rejects it with a 400. */
export class UpdateDefectDto {
  @IsOptional() @IsString() @IsNotEmpty() description?: string;
  @IsOptional() @IsString() @IsNotEmpty() reproSteps?: string;
  @IsOptional() @IsIn(['Critical', 'High', 'Medium', 'Low']) severity?: string;
}
