import { IsNotEmpty, IsString } from 'class-validator';

export class RevalidateDto {
  @IsString()
  @IsNotEmpty()
  tag!: string;
}
