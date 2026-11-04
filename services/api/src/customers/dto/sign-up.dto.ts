import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class SignUpDto {
  @IsString({ message: 'Enter your name.' })
  @Matches(/\S/, { message: 'Enter your name.' })
  name!: string;

  @IsEmail({}, { message: 'Enter a valid email address.' })
  email!: string;

  @IsString({ message: 'Password must be at least 8 characters.' })
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  password!: string;
}
