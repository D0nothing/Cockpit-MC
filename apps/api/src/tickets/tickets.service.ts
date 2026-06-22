import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RiskLevel, SpecStatus, TicketStatus, ValidationKind, WorkflowMode } from '@prisma/client';
import { canTransition } from '@vistory/contracts';
import { createHash } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { GithubService } from '../connectors/github.service';
import { PrismaService } from '../prisma.service';
import { LaunchWorkflowDto, UpsertSpecDto, ValidateSpecDto } from './dto';

const include = { project: true, assignee: true, specification: true, validations: { include: { validator: true } }, workflow: true } as const;

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly github: GithubService) {}

  list() { return this.prisma.ticket.findMany({ include, orderBy: { updatedAt: 'desc' } }); }
  async find(id: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id }, include });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async assign(id: string, assigneeId: string) {
    const ticket = await this.find(id);
    if (!['imported', 'assigned'].includes(ticket.status)) throw new BadRequestException('Ticket can no longer be assigned');
    const updated = await this.prisma.ticket.update({ where: { id }, data: { assigneeId, status: 'assigned' }, include });
    await this.audit.record({ actorId: assigneeId, action: 'ticket.assigned', targetType: 'ticket', targetId: id, metadata: { assigneeId } });
    return updated;
  }

  async setRisk(id: string, riskLevel: RiskLevel, actorId = 'system') {
    const updated = await this.prisma.ticket.update({ where: { id }, data: { riskLevel }, include });
    await this.audit.record({ actorId, action: 'ticket.risk_changed', targetType: 'ticket', targetId: id, metadata: { riskLevel } });
    return updated;
  }

  async transition(id: string, status: TicketStatus, actorId = 'system', reason?: string) {
    const ticket = await this.find(id);
    if (!canTransition(ticket.status, status)) throw new BadRequestException(`Invalid transition: ${ticket.status} → ${status}`);
    const updated = await this.prisma.ticket.update({ where: { id }, data: { status }, include });
    await this.audit.record({ actorId, action: 'ticket.transitioned', targetType: 'ticket', targetId: id, metadata: { from: ticket.status, to: status, reason } });
    return updated;
  }

  async saveSpecification(id: string, dto: UpsertSpecDto, actorId = 'system') {
    const ticket = await this.find(id);
    if (!['context_ready', 'spec_generating', 'spec_review_required'].includes(ticket.status)) throw new BadRequestException('Specification cannot be edited in this state');
    const generatedFromHash = createHash('sha256').update(`${ticket.description}:${ticket.updatedAt.toISOString()}`).digest('hex');
    const specification = await this.prisma.specification.upsert({
      where: { ticketId: id },
      create: { ticketId: id, content: dto.content, generatedFromHash, status: SpecStatus.REVIEW_REQUIRED },
      update: { content: dto.content, generatedFromHash, status: SpecStatus.REVIEW_REQUIRED, version: { increment: 1 } },
    });
    await this.prisma.ticket.update({ where: { id }, data: { status: 'spec_review_required' } });
    await this.audit.record({ actorId, action: 'spec.saved', targetType: 'specification', targetId: specification.id, metadata: { ticketId: id, version: specification.version, contentHash: createHash('sha256').update(dto.content).digest('hex') } });
    return this.find(id);
  }

  async validateSpecification(id: string, dto: ValidateSpecDto) {
    const ticket = await this.find(id);
    if (!ticket.specification) throw new BadRequestException('A specification is required');
    if (dto.kind === ValidationKind.PRIMARY && ticket.assigneeId !== dto.validatorId) throw new ForbiddenException('Only the assignee can perform primary validation');
    if (dto.kind === ValidationKind.SECONDARY && ticket.assigneeId === dto.validatorId) throw new ForbiddenException('Secondary validation requires another person');
    if (dto.kind === ValidationKind.SECONDARY && ticket.status !== 'second_validation_required') throw new BadRequestException('Secondary validation is not expected');
    if (dto.kind === ValidationKind.PRIMARY && ticket.status !== 'spec_review_required') throw new BadRequestException('Primary validation is not expected');

    await this.prisma.validation.upsert({
      where: { ticketId_validatorId_kind: { ticketId: id, validatorId: dto.validatorId, kind: dto.kind } },
      create: { ticketId: id, validatorId: dto.validatorId, kind: dto.kind, approved: dto.approved, comment: dto.comment },
      update: { approved: dto.approved, comment: dto.comment },
    });
    const requiresSecond = ticket.riskLevel !== 'standard' && ticket.project.requireSecondaryForSensitive;
    const nextStatus = !dto.approved ? 'rejected' : dto.kind === 'PRIMARY' && requiresSecond ? 'second_validation_required' : 'ready_for_ai';
    await this.prisma.$transaction([
      this.prisma.specification.update({ where: { ticketId: id }, data: { status: dto.approved ? 'VALIDATED' : 'REJECTED' } }),
      this.prisma.ticket.update({ where: { id }, data: { status: nextStatus } }),
    ]);
    await this.audit.record({ actorId: dto.validatorId, action: dto.approved ? 'spec.approved' : 'spec.rejected', targetType: 'specification', targetId: ticket.specification.id, metadata: { kind: dto.kind, nextStatus, comment: dto.comment } });
    return this.find(id);
  }

  async launchWorkflow(id: string, dto: LaunchWorkflowDto) {
    const ticket = await this.find(id);
    if (ticket.status !== 'ready_for_ai' || ticket.specification?.status !== 'VALIDATED') throw new ForbiddenException('A validated specification is required');
    if (!ticket.validations.some(v => v.kind === 'PRIMARY' && v.approved)) throw new ForbiddenException('Primary validation is missing');
    if (ticket.riskLevel !== 'standard' && ticket.project.requireSecondaryForSensitive && !ticket.validations.some(v => v.kind === 'SECONDARY' && v.approved)) throw new ForbiddenException('Secondary validation is missing');

    const branchName = `codex/ticket-${ticket.externalId}-${slug(ticket.title)}`.slice(0, 100);
    if (dto.mode === WorkflowMode.CODEX) await this.github.dispatchCodex(branchName, ticket.id);
    const status: TicketStatus = dto.mode === WorkflowMode.CODEX ? 'ai_requested' : 'human_review_required';
    await this.prisma.$transaction([
      this.prisma.workflowRun.upsert({ where: { ticketId: id }, create: { ticketId: id, mode: dto.mode, branchName: dto.mode === 'CODEX' ? branchName : null }, update: { mode: dto.mode, branchName: dto.mode === 'CODEX' ? branchName : null } }),
      this.prisma.ticket.update({ where: { id }, data: { status } }),
    ]);
    await this.audit.record({ actorId: dto.actorId, action: 'workflow.launched', targetType: 'ticket', targetId: id, metadata: { mode: dto.mode, branchName: dto.mode === 'CODEX' ? branchName : null } });
    return this.find(id);
  }
}

function slug(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 54); }
