import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class RevalidateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  // No control characters (blocks CR/LF log injection); otherwise permissive of real tag values.
  @Matches(/^[^\x00-\x1F\x7F]+$/)
  tag!: string;
}
