import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      name: 'internal-tool-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
