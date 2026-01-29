interface CheckoutData {
    transactionId: string;
    amount: number;
    description: string;
    returnUrl: string;
    cancelUrl: string;
}
export declare class BancardService {
    private readonly publicKey;
    private readonly privateKey;
    private readonly environment;
    private readonly baseUrl;
    createCheckout(data: CheckoutData): Promise<string>;
    verifyPayment(transactionId: string): Promise<any>;
    validateWebhook(webhookData: any): boolean;
    private generateToken;
    private generateWebhookSignature;
}
export {};
