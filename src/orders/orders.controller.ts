// src/orders/orders.controller.ts
import { Controller, Post, Get, Body, UseGuards, Req, Patch, Param } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { UserRole } from 'src/users/user-role.enum';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) { }

  // 1. Checkout: Buyer places an order
  @Post()
  create(@Req() req, @Body() dto: CreateOrderDto) {

    return this.ordersService.createOrder(req.user.sub, req.user.email, dto);
  }
  //New. retry payment
  @Post(':id/retry-payment')
  @UseGuards(JwtAuthGuard)
  async retryPayment(@Param('id') id: string, @Req() req) {

 return this.ordersService.retryPayment(id, req.user.sub);
  }



  // 2. Buyer History: Get all orders I have placed
  @Get('my-purchases')
  getMyOrders(@Req() req) {
    return this.ordersService.findAllByUser(req.user.sub);
  }

  @Patch('sales/:id/ship')
  @UseGuards(JwtAuthGuard)
  async markShipped(
    @Param('id') id: string,
    @Req() req: any
  ) {

    return this.ordersService.markItemAsShipped(id, req.user.sub);
  }

  @Patch(':id/confirm')
  @UseGuards(JwtAuthGuard)
  async confirmOrder(@Param('id') id: string, @Req() req) {
    return this.ordersService.confirmDelivery(id, req.user.sub);
  }


  // 3. Seller Dashboard: Get all orders for my store
  @Get('seller/sales')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  async getSellerOrders(@Req() req) {


    const sellerId = req.user.sub;
    return this.ordersService.findSalesBySeller(sellerId);
  }
}