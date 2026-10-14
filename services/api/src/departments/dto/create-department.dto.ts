import { IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'name must not be blank' })
  name!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @IsUUID()
  managerId!: string;
}
