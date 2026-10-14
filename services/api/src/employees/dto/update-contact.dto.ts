import { IsEmail, IsOptional, IsString, ValidateIf } from 'class-validator';

/** Only the non-core, self-editable fields; core fields are rejected by the whitelist pipe. */
export class UpdateContactDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== '')
  @IsEmail()
  personalEmail?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
