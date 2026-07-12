import axios from "axios";
import { IPaymentGateway, VerifiedPayment } from "./interfaces/payment-gateway.interface";
import { Injectable } from "@nestjs/common";
import { SystemSettingsService } from "src/system-settings/system-settings.service";

@Injectable()
export class FlutterwaveService implements IPaymentGateway {
    constructor(private readonly settingsService: SystemSettingsService) { }

    private readonly secretKey = process.env.FLW_SECRET_KEY;
    private readonly flwUrl = 'https://api.flutterwave.com/v3';
    private get headers() {
        return { Authorization: `Bearer ${this.secretKey}` };
    }


    validateWebhookSignature(payload: any, signature: string): boolean {
        // Flutterwave uses a secret hash header instead of HMAC
        return signature === process.env.FLUTTERWAVE_WEBHOOK_SECRET;
    }

    parseWebhookEvent(body: any) {
        if (body.event === 'charge.completed' && body.data.status === 'successful') {
            return {
                event: 'payment.success' as const,
                orderId: body.data.meta?.orderId,
                reference: body.data.tx_ref,
            };
        }
        return { event: 'unknown' as const };
    }

    async initializeTransaction(email, amount, metadata) {
        const response = await axios.post(`${this.flwUrl}/payments`, {
            tx_ref: `order-${metadata.orderId}-${Date.now()}`,
            amount,
            currency: 'NGN',
            redirect_url: process.env.FRONTEND_URL + '/checkout/verify',
            customer: { email },
            meta: metadata,
        }, { headers: this.headers });

        return {
            authorization_url: response.data.data.link,
            reference: response.data.data.tx_ref, // normalized field name
        };
    }

    async verifyTransaction(reference: string): Promise<VerifiedPayment> {

        console.log(reference)
        const response = await axios.get(
            `${this.flwUrl}/transactions/${reference}/verify`,
            { headers: this.headers, }
        );
        const d = response.data.data;
        return {
            status: d.status === 'successful' ? 'success' : 'failed',
            reference: d.tx_ref,
            orderId: d.meta?.orderId,
            amount: d.amount,
        };
    }

    async createRecipient(name, accountNumber, bankCode) {
        // Flutterwave's equivalent API call
        const res = await axios.post(`${this.flwUrl}/beneficiaries`, {
            account_number: accountNumber,
            account_bank: bankCode,
            beneficiary_name: name,
        }, { headers: this.headers, });

        return { recipientCode: res.data.data.id }; // normalized
    }

    async createTransfer(
        amount: number,
        beneficiaryId: string,
        narration: string
    ) {
        try {
            const response = await axios.post(
                `${this.flwUrl}/transfers`,
                {
                    beneficiary: beneficiaryId,
                    amount,
                    narration,
                    currency: 'NGN',
                    reference: `TRF-F&K-${Date.now()}`,
                },
                {
                    headers: this.headers,
                }
            );

            return { success: true, data: response.data };
        } catch (error: any) {
            return {
                success: false,
                message: error?.response?.data?.message || 'Transfer failed',
            };
        }
    }

    async calculateTransactionFee(amount: number): Promise<number> {
        const [percent, cap] = await Promise.all([
            this.settingsService.getNumber('GATEWAY_FLUTTERWAVE_PERCENT', 0.014),
            this.settingsService.getNumber('GATEWAY_FLUTTERWAVE_CAP', 2000),
        ]);

        // If Flutterwave later introduces a flat fee structure,
        // admin just adds the key — no code change needed
        const flatFee = await this.settingsService.getNumber(
            'GATEWAY_FLUTTERWAVE_FLAT_FEE',
            0 // default 0 until Flutterwave introduces one
        );
        const minForFlat = await this.settingsService.getNumber(
            'GATEWAY_FLUTTERWAVE_MIN_FOR_FLAT',
            0
        );

        let fee = amount * percent + (flatFee > 0 && minForFlat > 0 && amount >= minForFlat
            ? flatFee
            : 0);


        return Math.min(fee, cap);
    }

}