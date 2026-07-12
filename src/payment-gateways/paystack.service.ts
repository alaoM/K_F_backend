import {
    BadRequestException,
    Injectable,
    InternalServerErrorException,
    Logger,
    ServiceUnavailableException
} from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { IPaymentGateway } from './interfaces/payment-gateway.interface';
import * as crypto from 'crypto';
import { SystemSettingsService } from 'src/system-settings/system-settings.service';

@Injectable()
export class PaystackService implements IPaymentGateway {
    // Standard NestJS Logger
    private readonly logger = new Logger(PaystackService.name);

    private readonly secretKey = process.env.PAYSTACK_SECRET_KEY;
    private readonly paystackUrl = process.env.PAYSTACK_URL;
    constructor(private readonly settingsService: SystemSettingsService) { }

    validateWebhookSignature(payload: any, signature: string): boolean {
        const hash = crypto
            .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
            .update(JSON.stringify(payload))
            .digest('hex');
        return hash === signature;
    }

    parseWebhookEvent(body: any) {
        if (body.event === 'charge.success') {
            return {
                event: 'payment.success' as const,
                orderId: body.data.metadata?.orderId,
                reference: body.data.reference,
            };
        }
        if (body.event === 'transfer.success') {
            return { event: 'transfer.success' as const };
        }
        return { event: 'unknown' as const };
    }

    /**
     * Helper to centralize headers and prevent repetition
     */
    private get headers() {
        return {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
        };
    }

    async getBanks() {
        try {
            const res = await axios.get(`${this.paystackUrl}/bank`, {
                headers: this.headers,
            });
            return res.data.data;
        } catch (error) {
            this.handleError(error, 'Fetching Banks');
        }
    }

    async resolveAccount(accountNumber: string, bankCode: string) {
        try {
            const res = await axios.get(`${this.paystackUrl}/bank/resolve`, {
                params: { account_number: accountNumber, bank_code: bankCode },
                headers: this.headers,
            });

            this.logger.log(`Account Resolved: ${accountNumber} at ${bankCode}`);
            return res.data.data;
        } catch (error) {
            // Mask the specific "Test Limit" error we saw earlier
            const message = error.response?.data?.message;
            if (message?.includes('limit of 3 live bank resolves')) {
                throw new BadRequestException(
                    "Account verification is limited in Test Mode. Please use Bank Code '058' and Account '0000000001'."
                );
            }
            this.handleError(error, 'Resolving Account');
        }
    }

    async createRecipient(name: string, accountNumber: string, bankCode: string) {
        const body = {
            type: "nuban",
            name,
            account_number: accountNumber,
            bank_code: bankCode,
            currency: "NGN"
        };

        try {
            const response = await axios.post(
                `${this.paystackUrl}/transferrecipient`,
                body,
                { headers: this.headers },
            );

            this.logger.log(`Payout Recipient Created: ${name} (${accountNumber})`);
            return { recipientCode: response.data.data.recipient_code };
        } catch (error) {
            this.handleError(error, 'Creating Transfer Recipient');
        }
    }

    async initializeTransaction(email: string, amount: number, metadata: any) {
        try {
            const response = await axios.post(
                `${this.paystackUrl}/transaction/initialize`,
                {
                    email,
                    amount: Math.round(amount * 100), // Ensure it's an integer
                    metadata,
                    callback_url: `${process.env.FRONTEND_URL}/checkout`,
                },
                { headers: this.headers },
            );
            

            return { authorization_url: response.data.data.authorization_url, reference: response.data.data.reference };
        } catch (error) {
            this.handleError(error, 'Initializing Transaction');
        }
    }

    async verifyTransaction(reference: string) {
        try {
            const raw = await axios.get(
                `${this.paystackUrl}/transaction/verify/${reference}`,
                { headers: this.headers, }
            );

            this.logger.log(`Transaction Verified: Ref ${reference} - Status: ${raw.data.data.status}`);
            
            return {
                status: raw.data.data.status,           // already 'success'|'failed'
                reference: raw.data.data.reference,
                orderId: raw.data.data.metadata.orderId,
                amount: raw.data.data.amount / 100,
            };
        } catch (error) {
            this.handleError(error, 'Verifying Transaction');
        }
    }

    async createTransfer(amount: number, recipientCode: string, reason: string) {
        try {
            const response = await axios.post(
                `${this.paystackUrl}/transfer`,
                {
                    source: 'balance',
                    amount: Math.round(amount * 100),
                    recipient: recipientCode,
                    reason
                },
                { headers: this.headers },
            );

            this.logger.warn(`PAYOUT TRIGGERED: Amount ${amount} to Recipient ${recipientCode}`);
            return {
                success: true,
                transferId: response.data.data,
            }
        } catch (error) {
            this.handleError(error, 'Creating Transfer');
        }
    }

    /**
     * UNIVERSAL ERROR HANDLER
     * Masks sensitive data while logging full details for debugging
     */
    private handleError(error: any, context: string) {
        const axiosError = error as AxiosError<any>;

        // Log the full detail for internal debugging
        this.logger.error(
            `[${context}] Error: ${axiosError.response?.data?.message || axiosError.message}`,
            axiosError.response?.data || 'No Response Data'
        );

        if (axiosError.response) {
            const status = axiosError.response.status;
            const message = axiosError.response.data?.message || 'Payment provider error';

            // Custom masking for production users
            if (status === 401) throw new InternalServerErrorException('Payment gateway configuration error');
            if (status === 422) throw new BadRequestException(message);

            throw new BadRequestException(message);
        }

        // If Paystack is down or unreachable
        if (axiosError.request) {
            throw new ServiceUnavailableException('Payment service is temporarily unreachable. Please try again later.');
        }

        throw new InternalServerErrorException('An unexpected error occurred during payment processing');
    }


    async calculateTransactionFee(amount: number): Promise<number> {
        // Each gateway fetches only its own namespaced keys
        const [percent, flatFee, cap, minForFlat] = await Promise.all([
            this.settingsService.getNumber('GATEWAY_PAYSTACK_PERCENT', 0.015),
            this.settingsService.getNumber('GATEWAY_PAYSTACK_FLAT_FEE', 100),
            this.settingsService.getNumber('GATEWAY_PAYSTACK_CAP', 2000),
            this.settingsService.getNumber('GATEWAY_PAYSTACK_MIN_FOR_FLAT', 2500),
        ]);

        let fee = amount * percent + (amount >= minForFlat ? flatFee : 0);
        return Math.min(fee, cap);
    }


}