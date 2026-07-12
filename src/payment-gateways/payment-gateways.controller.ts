import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Headers, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaymentGatewaysService } from './payment-gateways.service';

import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PaystackService } from './paystack.service';
import { OrdersService } from 'src/orders/orders.service';


import * as crypto from 'crypto';
import { PaymentGatewayFactory } from './factories/payment-gateway.factory';
import { FlutterwaveService } from './flutterwave.service';
import { PaymentMethod } from 'src/orders/entities/order.entity';
import { VerifiedPayment } from './interfaces/payment-gateway.interface';

@Controller('payment-gateways')

export class PaymentGatewaysController {
  constructor(
    private readonly gatewayFactory: PaymentGatewayFactory,

    private readonly paystackService: PaystackService,

    private readonly flutterWaveService: FlutterwaveService,



    private ordersService: OrdersService,
  ) { }

  @Get('verify')
@UseGuards(JwtAuthGuard)
async verifyPayment(
    @Query('reference') reference: string,
    @Query('gateway') gatewayParam: string = 'paystack',
) {
    if (!reference) {
        return { success: false, message: 'Missing reference' };
    }

    const gatewayService = this.gatewayFactory.getGateway(gatewayParam as PaymentMethod);

    let paymentData: VerifiedPayment;
    try {
        paymentData = await gatewayService.verifyTransaction(reference);
    } catch {
        return { success: false, message: 'Could not reach payment provider' };
    }

    if (paymentData.status !== 'success') {
        return { success: false, message: 'Payment was not successful' };
    }

    // ✅ Look up by orderId from metadata — not by reference
    const orderId = paymentData.orderId;
    if (!orderId) {
        return { success: false, message: 'Order ID missing from payment metadata' };
    }

    // ✅ Save reference in case webhook hasn't fired yet
    await this.ordersService.updatePaymentReference(orderId, reference);

    const order = await this.ordersService.findOneById(orderId);
    if (!order) {
        return { success: false, message: 'Order not found' };
    }

    // ✅ Only mark as paid if webhook hasn't already done it
    // This is the fallback — webhook is the primary trigger
    if (order.paymentStatus === 'unpaid') {
        await this.ordersService.markAsPaid(orderId);
    }

    return {
        success: true,
        message: 'Payment verified',
        orderId: order.id,
    };
}


@Post('webhook/:gateway') // e.g. POST /payment-gateways/webhook/paystack
async handleWebhook(
  @Param('gateway') gateway: string,
  @Body() body: any,
  @Headers('x-paystack-signature') paystackSig: string,
  @Headers('verif-hash') flutterwaveSig: string, // Flutterwave uses this header
) {
  // Pick the right service for signature validation
  const service = gateway === 'flutterwave'
    ? this.flutterWaveService
    : this.paystackService;

  const signature = gateway === 'flutterwave' ? flutterwaveSig : paystackSig;

  if (!service.validateWebhookSignature(body, signature)) {
    throw new ForbiddenException('Invalid webhook signature');
  }

  // ✅ Normalized event — same handling logic regardless of gateway
  const event = service.parseWebhookEvent(body);

  if (event.event === 'payment.success') {
    await this.ordersService.markAsPaid(event.orderId);
  }

  return { status: 'ok' };
}

  @Get('banks')
  @UseGuards(JwtAuthGuard)
  async getBanks() {
    return this.paystackService.getBanks();
  }

  @Get('resolve')
  @UseGuards(JwtAuthGuard)
  async resolveAccount(
    @Query('account') account: string,
    @Query('bank') bank: string,
  ) {
    return this.paystackService.resolveAccount(account, bank);
  }
}
