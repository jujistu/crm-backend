import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { ClientQueryDto } from './dto/client-query.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientsService } from './clients.service';

@ApiTags('Clients')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Create a new client' })
  @ApiResponse({ status: 201, description: 'Client created' })
  create(@Body() dto: CreateClientDto, @CurrentUser() user: RequestUser) {
    return this.clientsService.create(dto, user);
  }

  @Get()
  @Roles(Role.ADMIN, Role.ACCOUNT_MANAGER, Role.STAFF)
  @ApiOperation({ summary: 'List all clients' })
  @ApiResponse({ status: 200, description: 'Paginated list of clients' })
  findAll(@Query() query: ClientQueryDto, @CurrentUser() user: RequestUser) {
    return this.clientsService.findAll(query, user);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.ACCOUNT_MANAGER, Role.STAFF)
  @ApiOperation({ summary: 'Get a client by ID' })
  @ApiResponse({ status: 200, description: 'Client record' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.clientsService.findOne(id, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Update a client' })
  @ApiResponse({ status: 200, description: 'Client updated' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.clientsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Soft delete a client and its contacts' })
  @ApiResponse({ status: 200, description: 'Client deleted' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.clientsService.remove(id, user);
  }
}
