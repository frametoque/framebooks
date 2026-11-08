export type PaymentProvider = "payments_lk" | "stripe" | "payhere" | "sandbox";

export interface CreateCheckoutParams {
  tenantId: number;
  userId?: number | null;
  userEmail: string;
  userName?: string;
  planId?: number;
  planName: string;
  billingInterval: "monthly" | "yearly";
  amount: number;
  currency: string;
  successUrl?: string;
  cancelUrl?: string;
  couponCode?: string;
}

export interface CheckoutResult {
  success: boolean;
  provider: PaymentProvider;
  sessionId?: string;
  checkoutUrl?: string;
  requiresRedirect?: boolean;
  isSandbox?: boolean;
  message?: string;
  error?: string;
  formData?: Record<string, string>;
}

export interface ActivationParams {
  tenantId: number;
  userId?: number | null;
  planName: string;
  billingInterval: "monthly" | "yearly";
  amount: number;
  currency?: string;
  provider: string;
  providerReference: string;
  receiptUrl?: string;
  notes?: string;
  savedCardId?: string;
  cardBrand?: string;
  cardLast4?: string;
  cardExpMonth?: number;
  cardExpYear?: number;
  autoRenew?: boolean;
  couponCode?: string;
  providerSubscriptionId?: string;
}

export interface GatewayStatus {
  isConfigured: boolean;
  activeProvider: PaymentProvider;
  availableProviders: {
    payments_lk: boolean;
    stripe: boolean;
    payhere: boolean;
    sandbox: boolean;
  };
  cardPaymentsDisabled?: boolean;
  cardPaymentsDisabledReason?: string;
  isLive?: boolean;
  isTestKey?: boolean;
}
