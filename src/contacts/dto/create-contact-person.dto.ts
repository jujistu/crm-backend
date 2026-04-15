import {
  IsEmail,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateContactPersonDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsISO8601()
  birthday?: string;

  @IsUUID()
  clientId: string;
}
