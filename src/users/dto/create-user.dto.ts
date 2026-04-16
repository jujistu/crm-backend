import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Jane Manager' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'jane.manager@edgenet.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'ChangeMe123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ enum: Role, example: Role.ACCOUNT_MANAGER })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
