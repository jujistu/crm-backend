import { OmitType } from '@nestjs/mapped-types';
import { CreateContactPersonDto } from './create-contact-person.dto';

export class CreateClientContactDto extends OmitType(CreateContactPersonDto, [
  'clientId',
] as const) {}
