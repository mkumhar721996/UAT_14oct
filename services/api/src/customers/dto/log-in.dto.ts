import { IsNotEmpty, IsString } from 'class-validator';

export class LogInDto {
  @IsString({ message: 'Enter your email.' })
  @IsNotEmpty({ message: 'Enter your email.' })
  email!: string;

  @IsString({ message: 'Enter your password.' })
  @IsNotEmpty({ message: 'Enter your password.' })
  password!: string;
}
