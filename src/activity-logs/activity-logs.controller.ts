import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { RequestUser } from '../common/types/request-user.type';
import { ActivityLogsService } from './activity-logs.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.ACCOUNT_MANAGER)
  findAll(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.activityLogsService.findAll(query, user);
  }
}
