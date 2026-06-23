import { Controller, Get } from '@nestjs/common';

@Controller()
export class RootController {
  @Get()
  getRoot() {
    return {
      status: 'ok',
      service: 'vistory-api',
      message: 'Cockpit MC API is running. Use /api/health for health checks.',
      health: '/api/health',
    };
  }
}
