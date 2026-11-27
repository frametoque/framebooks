export interface PosClientDisplayCustomer {
  id?: string | null;
  name: string;
  phone?: string | null;
  email?: string | null;
  isLoyaltyMember?: boolean;
  isNewClient?: boolean;
}

export interface PosClientDisplayItem {
  id: number | string;
  name: string;
  sku?: string;
  brand?: string;
  price: number;
  quantity: number;
  discount: number;
  total: number;
}

export interface PosClientDisplaySummary {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  totalDue: number;
  itemCount: number;
}

export interface PosClientDisplaySlide {
  id: string;
  badge?: string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  callToAction?: string | null;
  active: boolean;
}

export const DEFAULT_CUSTOMER_DISPLAY_SLIDES: PosClientDisplaySlide[] = [];

export interface PosClientDisplayPayment {
  isOpen: boolean;
  method: string;
  tendered: number;
  changeDue: number;
  totalPaid?: number;
  isCompleted: boolean;
  orderNumber?: string;
}

export interface PosClientDisplayState {
  tenantId: number;
  tenantName: string;
  tenantLogoUrl?: string | null;
  accentColor?: string | null;
  counterId?: number;
  counterName?: string;
  cashierName?: string;
  isShiftOpen: boolean;
  customer: PosClientDisplayCustomer;
  cart: PosClientDisplayItem[];
  summary: PosClientDisplaySummary;
  payment: PosClientDisplayPayment;
  slides?: PosClientDisplaySlide[];
  timestamp: number;
}

export type PosDisplayMessage =
  | {
      type: "POS_STATE_UPDATE";
      payload: PosClientDisplayState;
    }
  | {
      type: "CLIENT_INFO_SUBMITTED";
      payload: {
        tenantId: number;
        counterId?: number;
        customer: PosClientDisplayCustomer;
      };
    }
  | {
      type: "CLIENT_REQUEST_STATE";
      payload?: {
        counterId?: number;
      };
    };

export const POS_CLIENT_CHANNEL_NAME = "pos_customer_display_v1";

/**
 * Returns a tenant- and counter-scoped BroadcastChannel & localStorage key to prevent
 * cross-tenant event leakage on shared hardware or multi-tab browsers.
 */
export function getPosClientChannelName(tenantId: number | string, counterId?: number | string): string {
  return `pos_customer_display_v1_t${tenantId}_c${counterId || 1}`;
}

// Global store for cross-device tablet/phone synchronization across counters
declare global {
  // eslint-disable-next-line no-var
  var __pos_client_display_store: Map<string, PosClientDisplayState> | undefined;
}

const displayStore = globalThis.__pos_client_display_store || new Map<string, PosClientDisplayState>();
if (process.env.NODE_ENV !== "production") {
  globalThis.__pos_client_display_store = displayStore;
}

function getStoreKey(tenantId: number, counterId?: number): string {
  return `${tenantId}:${counterId || 1}`;
}

export function saveServerDisplayState(state: PosClientDisplayState) {
  const key = getStoreKey(state.tenantId, state.counterId);
  displayStore.set(key, state);
  // Also store by tenant only as fallback for single-counter stores
  displayStore.set(`${state.tenantId}:default`, state);
}

export function getServerDisplayState(tenantId: number, counterId?: number): PosClientDisplayState | null {
  const key = getStoreKey(tenantId, counterId);
  return displayStore.get(key) || displayStore.get(`${tenantId}:default`) || null;
}
