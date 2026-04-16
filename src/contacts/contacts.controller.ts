import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { RequestUser } from '../common/types/request-user.type';
import { ContactsService } from './contacts.service';
import { CreateContactPersonDto } from './dto/create-contact-person.dto';
import { UpdateContactPersonDto } from './dto/update-contact-person.dto';

@ApiTags('Contacts')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post('contacts')
  @Roles(Role.ADMIN, Role.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Create a new contact' })
  @ApiResponse({ status: 201, description: 'Contact created' })
  create(
    @Body() dto: CreateContactPersonDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.contactsService.create(dto, user);
  }

  @Get('clients/:clientId/contacts')
  @Roles(Role.ADMIN, Role.ACCOUNT_MANAGER, Role.STAFF)
  @ApiOperation({ summary: 'List all contacts for a client' })
  @ApiResponse({ status: 200, description: 'List of contacts' })
  findAll(
    @Param('clientId') clientId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.contactsService.findAll(clientId, user);
  }

  @Get('contacts/:id')
  @Roles(Role.ADMIN, Role.ACCOUNT_MANAGER, Role.STAFF)
  @ApiOperation({ summary: 'Get a contact by ID' })
  @ApiResponse({ status: 200, description: 'Contact record' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.contactsService.findOne(id, user);
  }

  @Patch('contacts/:id')
  @Roles(Role.ADMIN, Role.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Update a contact' })
  @ApiResponse({ status: 200, description: 'Contact updated' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateContactPersonDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.contactsService.update(id, dto, user);
  }

  @Delete('contacts/:id')
  @Roles(Role.ADMIN, Role.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Soft delete a contact' })
  @ApiResponse({ status: 200, description: 'Contact deleted' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.contactsService.remove(id, user);
  }
}
