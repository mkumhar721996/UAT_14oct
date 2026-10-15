import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { RequisitionFieldsDto } from './update-requisition.dto';

export class CreateRequisitionDto extends RequisitionFieldsDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsIn(['draft', 'submit'])
  action?: 'draft' | 'submit';
}
