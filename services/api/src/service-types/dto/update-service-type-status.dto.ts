import { IsBoolean } from 'class-validator';

export class UpdateServiceTypeStatusDto {
  @IsBoolean()
  active!: boolean;
}
