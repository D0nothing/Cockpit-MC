import { Body, Controller, Get, Headers, Param, Patch, Post, Put } from '@nestjs/common';
import { AssignTicketDto, LaunchWorkflowDto, RiskDto, TransitionTicketDto, UpsertSpecDto, ValidateSpecDto } from './dto';
import { TicketsService } from './tickets.service';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}
  @Get() list() { return this.tickets.list(); }
  @Get(':id') find(@Param('id') id: string) { return this.tickets.find(id); }
  @Patch(':id/assign') assign(@Param('id') id: string, @Body() dto: AssignTicketDto) { return this.tickets.assign(id, dto.assigneeId); }
  @Patch(':id/risk') risk(@Param('id') id: string, @Body() dto: RiskDto, @Headers('x-actor-id') actor = 'system') { return this.tickets.setRisk(id, dto.riskLevel, actor); }
  @Patch(':id/status') transition(@Param('id') id: string, @Body() dto: TransitionTicketDto, @Headers('x-actor-id') actor = 'system') { return this.tickets.transition(id, dto.status, actor, dto.reason); }
  @Put(':id/specification') saveSpec(@Param('id') id: string, @Body() dto: UpsertSpecDto, @Headers('x-actor-id') actor = 'system') { return this.tickets.saveSpecification(id, dto, actor); }
  @Post(':id/validations') validate(@Param('id') id: string, @Body() dto: ValidateSpecDto) { return this.tickets.validateSpecification(id, dto); }
  @Post(':id/workflows') launch(@Param('id') id: string, @Body() dto: LaunchWorkflowDto) { return this.tickets.launchWorkflow(id, dto); }
}
