import { IsNotEmpty, IsString } from 'class-validator';

export class ReassignRequisitionDto {
  @IsString()
  @IsNotEmpty()
  newHiringManagerId!: string;
}
