export interface InitializedPayment {
  authorization_url: string;
  reference: string;
}

export interface VerifiedPayment {
  status: 'success' | 'failed' | 'pending';
  reference: string;
  orderId: string;
  amount: number;
}

export interface VerifiedPayment {
    status: 'success' | 'failed' | 'pending';
    reference: string;
    orderId: string;
    amount: number;
}


export interface PayoutRecipient {
  recipientCode: string;
}

export interface IPaymentGateway {
  /**
   * Start a payment session and return a checkout URL
   */
  initializeTransaction(
    email: string,
    amount: number,
    metadata: Record<string, any>
  ): Promise<InitializedPayment>;

  /**
   * Verify a payment by its reference
   */
  verifyTransaction(reference: string): Promise<VerifiedPayment>;

  /**
   * Register a bank account to receive payouts
   */
  createRecipient(
    name: string,
    accountNumber: string,
    bankCode: string
  ): Promise<PayoutRecipient>;

  /**
   * Send money to a registered recipient
   */
  createTransfer(
    amount: number,
    recipientCode: string,
    reason: string
  ): Promise<any>;

  /**
   * Validate that a webhook call is genuinely from this gateway
   */
  validateWebhookSignature(payload: any, signature: string): boolean;

  /**
   * Parse a raw webhook body into a normalized shape your app understands
   */
  parseWebhookEvent(body: any): {
    event: 'payment.success' | 'transfer.success' | 'unknown';
    orderId?: string;
    reference?: string;
  };

  /**
   * Each gateway calculates its own fee differently.
   * Amount is in Naira (not kobo).
   * Returns the fee in Naira.
   */
 calculateTransactionFee(amount: number): Promise<number>;
}

// Use this as an injection token
export const PAYMENT_GATEWAY = 'PAYMENT_GATEWAY';