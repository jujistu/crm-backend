import { Role } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ClientQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  accountManagerId?: string;

  @IsOptional()
  @IsEnum(Role)
  accountManagerRole?: Role;
}
