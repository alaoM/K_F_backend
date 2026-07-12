import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { RolesGuard } from "src/auth/roles.guard";
import { DisputeService } from "./dispute.service";
import { Roles } from "src/auth/roles.decorator";
import { UserRole } from "src/users/user-role.enum";
import { AddDisputeMessageDto, InitiateDisputeDto, ResolveDisputeDto } from "./dto/dispute.dto";

@Controller('disputes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DisputeController {
  constructor(private readonly disputeService: DisputeService) { }

  @Post('initiate/:orderId')
  @Roles(UserRole.BUYER)
  initiate(@Param('orderId') orderId: string, @Req() req, @Body() dto: InitiateDisputeDto) {


    return {
      success: true,
      message: "Dispute submitted successfully",
      data: this.disputeService.initiate(orderId, req.user.sub, dto),
    }
  }
ƒ
  @Get('my-disputes')
  findAll(@Req() req) {
    return this.disputeService.findMyDisputes(req.user.sub, req.user.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req) {
    return this.disputeService.findOne(id, req.user.role, req.user.sub);
  }

  @Post(':id/message')
  addMessage(@Param('id') id: string, @Req() req, @Body() dto: AddDisputeMessageDto) {
    return this.disputeService.addMessage(id, req.user.sub, dto);
  }

  @Patch(':id/escalate')
  escalate(@Param('id') id: string, @Req() req) {
    return this.disputeService.escalate(id, req.user.sub);
  }

  @Patch(':id/resolve')
  @Roles(UserRole.ADMIN)
  resolve(@Param('id') id: string, @Body() dto: ResolveDisputeDto) {
    return this.disputeService.resolve(id, dto);
  }
}