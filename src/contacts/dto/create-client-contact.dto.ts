import { OmitType } from '@nestjs/swagger';
import { CreateContactPersonDto } from './create-contact-person.dto';

export class CreateClientContactDto extends OmitType(CreateContactPersonDto, [
  'clientId',
] as const) {}
