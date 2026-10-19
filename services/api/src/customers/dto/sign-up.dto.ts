import { IsEmail, IsString, MinLength } from 'class-validator';

export class SignUpDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email!: string;

  @IsString({ message: 'Password must be at least 8 characters.' })
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  password!: string;
}
