import { IsNotEmpty, IsString } from 'class-validator';

export class RejectRequisitionDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
