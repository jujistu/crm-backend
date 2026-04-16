import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Server health check' })
  @ApiResponse({ status: 200, description: 'Server is running' })
  getHealth() {
    return this.appService.getHealth();
  }

  @Get('health/db')
  @ApiOperation({ summary: 'Database connection health check' })
  @ApiResponse({ status: 200, description: 'Database connection status' })
  getDbHealth() {
    return this.appService.getDbHealth();
  }
}
