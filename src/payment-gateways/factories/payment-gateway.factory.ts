import { Injectable } from "@nestjs/common";
 
import { FlutterwaveService } from "../flutterwave.service";
import { PaystackService } from "../paystack.service";
import { IPaymentGateway } from "../interfaces/payment-gateway.interface";
import { PaymentMethod } from "src/orders/entities/order.entity";

@Injectable()
export class PaymentGatewayFactory {
    constructor(
        private paystackService: PaystackService,
        private flutterwaveService: FlutterwaveService,
    ) { }

    getGateway(type?: PaymentMethod): IPaymentGateway {
    switch (type) {
        case PaymentMethod.FLUTTERWAVE:
            return this.flutterwaveService;
        case PaymentMethod.PAYSTACK:
        default:
            return this.paystackService;
    }
}
}