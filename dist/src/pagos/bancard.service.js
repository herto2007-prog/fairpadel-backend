"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BancardService = void 0;
const common_1 = require("@nestjs/common");
const crypto = __importStar(require("crypto"));
let BancardService = class BancardService {
    constructor() {
        this.publicKey = process.env.BANCARD_PUBLIC_KEY;
        this.privateKey = process.env.BANCARD_PRIVATE_KEY;
        this.environment = process.env.NODE_ENV === 'production' ? 'prod' : 'staging';
        this.baseUrl = this.environment === 'prod'
            ? 'https://vpos.infonet.com.py'
            : 'https://vpos.infonet.com.py:8888';
    }
    async createCheckout(data) {
        const { transactionId, amount, description, returnUrl, cancelUrl, } = data;
        const checkoutData = {
            public_key: this.publicKey,
            operation: {
                token: transactionId,
                shop_process_id: transactionId,
                currency: 'PYG',
                amount: amount.toString(),
                additional_data: '',
                description,
                return_url: returnUrl,
                cancel_url: cancelUrl,
            },
        };
        const token = this.generateToken(checkoutData);
        const checkoutUrl = `${this.baseUrl}/checkout/new?process_id=${transactionId}`;
        return checkoutUrl;
    }
    async verifyPayment(transactionId) {
        return {
            status: 'success',
            transactionId,
            amount: 0,
            timestamp: new Date().toISOString(),
        };
    }
    validateWebhook(webhookData) {
        const signature = webhookData.signature;
        const expectedSignature = this.generateWebhookSignature(webhookData);
        return signature === expectedSignature;
    }
    generateToken(data) {
        const stringToHash = JSON.stringify(data) + this.privateKey;
        return crypto.createHash('md5').update(stringToHash).digest('hex');
    }
    generateWebhookSignature(data) {
        const stringToHash = JSON.stringify(data) + this.privateKey;
        return crypto.createHash('sha256').update(stringToHash).digest('hex');
    }
};
exports.BancardService = BancardService;
exports.BancardService = BancardService = __decorate([
    (0, common_1.Injectable)()
], BancardService);
//# sourceMappingURL=bancard.service.js.map