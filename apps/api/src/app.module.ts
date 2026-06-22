import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';
import { AuditService } from './audit/audit.service';
import { AuditController } from './audit/audit.controller';
import { TicketsController } from './tickets/tickets.controller';
import { TicketsService } from './tickets/tickets.service';
import { GithubService } from './connectors/github.service';
import { WorkerController } from './worker/worker.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'] })],
  controllers: [HealthController, TicketsController, AuditController, WorkerController],
  providers: [PrismaService, AuditService, TicketsService, GithubService],
})
export class AppModule {}
