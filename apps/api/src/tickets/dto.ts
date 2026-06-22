import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { RiskLevel, TicketStatus, ValidationKind, WorkflowMode } from '@prisma/client';
export class AssignTicketDto { @IsString() assigneeId!: string; }
export class TransitionTicketDto { @IsEnum(TicketStatus) status!: TicketStatus; @IsOptional() @IsString() reason?: string; }
export class UpsertSpecDto { @IsString() content!: string; }
export class ValidateSpecDto { @IsString() validatorId!: string; @IsEnum(ValidationKind) kind!: ValidationKind; @IsBoolean() approved!: boolean; @IsOptional() @IsString() comment?: string; }
export class LaunchWorkflowDto { @IsEnum(WorkflowMode) mode!: WorkflowMode; @IsString() actorId!: string; }
export class RiskDto { @IsEnum(RiskLevel) riskLevel!: RiskLevel; }
