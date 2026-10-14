import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { UpdateRequisitionDto } from './update-requisition.dto';

export class CreateRequisitionDto extends UpdateRequisitionDto {
  @IsString()
  @IsNotEmpty()
  declare title: string;

  @IsOptional()
  @IsIn(['draft', 'submit'])
  action?: 'draft' | 'submit';
}
