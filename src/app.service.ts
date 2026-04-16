import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHealth() {
    return {
      name: 'internal-tool-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  async getDbHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'connected' };
    } catch (error) {
      return {
        status: 'error',
        database: 'unreachable',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
