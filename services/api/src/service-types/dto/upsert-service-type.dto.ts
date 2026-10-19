import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class UpsertServiceTypeDto {
  @IsString({ message: 'Enter a name for this service type.' })
  @IsNotEmpty({ message: 'Enter a name for this service type.' })
  @Matches(/\S/, { message: 'Enter a name for this service type.' })
  name!: string;

  // null or '' on update clears the description.
  @IsOptional()
  @IsString()
  description?: string | null;
}
