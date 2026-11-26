"use client";

export interface ProductSyncChangeDetail {
  name: string;
  sku: string;
  currentStock?: number;
  changes: Array<{
    field: "SKU" | "Stock" | "Price" | "Name" | "Category";
    from: string | number;
    to: string | number;
  }>;
}

export interface ProductSyncState {
  isSyncing: boolean;
  progress: {
    current: number;
    total: number;
    percent: number;
  } | null;
  lastSyncedAt?: number;
  lastResult?: {
    total: number;
    imported: number;
    updated: number;
    updatedDetails?: ProductSyncChangeDetail[];
    importedDetails?: any[];
  } | null;
  error?: string | null;
}

const STORAGE_KEY = "framebooks_product_sync_state";
const CHANNEL_NAME = "framebooks_product_sync_channel";
const STOCK_UPDATE_EVENT = "framebooks_stock_updated";
const STOCK_UPDATE_CHANNEL = "framebooks_stock_channel";

let currentState: ProductSyncState = {
  isSyncing: false,
  progress: null,
  lastSyncedAt: undefined,
  lastResult: null,
  error: null,
};

// Initialize from localStorage if available
if (typeof window !== "undefined") {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // If was syncing before refresh, reset isSyncing if older than 5 minutes
      if (parsed.isSyncing && parsed.lastSyncedAt && Date.now() - parsed.lastSyncedAt > 300000) {
        parsed.isSyncing = false;
        parsed.progress = null;
      }
      currentState = { ...currentState, ...parsed };
    }
  } catch {}
}

function persistAndBroadcast(state: ProductSyncState) {
  currentState = state;
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}

  try {
    if (typeof BroadcastChannel !== "undefined") {
      const bc = new BroadcastChannel(CHANNEL_NAME);
      bc.postMessage(state);
      bc.close();
    }
  } catch {}

  try {
    window.dispatchEvent(new CustomEvent("product-sync:state-change", { detail: state }));
  } catch {}
}

export function broadcastProductSyncStart() {
  persistAndBroadcast({
    isSyncing: true,
    progress: { current: 0, total: 0, percent: 0 },
    lastSyncedAt: Date.now(),
    lastResult: null,
    error: null,
  });
}

export function broadcastProductSyncProgress(progress: { current: number; total: number; percent: number }) {
  persistAndBroadcast({
    isSyncing: true,
    progress,
    lastSyncedAt: Date.now(),
    lastResult: null,
    error: null,
  });
}

export function broadcastProductSyncComplete(result: {
  total: number;
  imported: number;
  updated: number;
  updatedDetails?: ProductSyncChangeDetail[];
  importedDetails?: any[];
}) {
  persistAndBroadcast({
    isSyncing: false,
    progress: null,
    lastSyncedAt: Date.now(),
    lastResult: result,
    error: null,
  });

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("stock:refresh", { detail: result }));
  }
  broadcastStockUpdated(result);
}

/**
 * Broadcasts an instant stock update event across all open tabs (POS, Stock catalog, modals).
 */
export function broadcastStockUpdated(detail?: any): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STOCK_UPDATE_EVENT, Date.now().toString());
  } catch {}
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const bc = new BroadcastChannel(STOCK_UPDATE_CHANNEL);
      bc.postMessage({ timestamp: Date.now(), ...detail });
      bc.close();
    }
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent(STOCK_UPDATE_EVENT, { detail }));
  } catch {}
}

/**
 * Subscribes to cross-tab stock update events to seamlessly refresh POS and Stock catalogs.
 */
export function subscribeStockUpdated(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handleCustom = () => callback();
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STOCK_UPDATE_EVENT) {
      callback();
    }
  };

  let bc: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      bc = new BroadcastChannel(STOCK_UPDATE_CHANNEL);
      bc.onmessage = () => callback();
    }
  } catch {}

  window.addEventListener(STOCK_UPDATE_EVENT, handleCustom);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(STOCK_UPDATE_EVENT, handleCustom);
    window.removeEventListener("storage", handleStorage);
    if (bc) {
      bc.close();
    }
  };
}

export function broadcastProductSyncError(errorMsg: string) {
  persistAndBroadcast({
    isSyncing: false,
    progress: null,
    lastSyncedAt: Date.now(),
    lastResult: null,
    error: errorMsg,
  });
}

export function getProductSyncState(): ProductSyncState {
  return currentState;
}

export function subscribeProductSync(callback: (state: ProductSyncState) => void): () => void {
  if (typeof window === "undefined") return () => {};

  // Immediately notify with current state
  callback(currentState);

  const handleCustomEvent = (e: any) => {
    if (e.detail) {
      callback(e.detail);
    }
  };

  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        currentState = parsed;
        callback(parsed);
      } catch {}
    }
  };

  let bc: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      bc = new BroadcastChannel(CHANNEL_NAME);
      bc.onmessage = (event) => {
        if (event.data) {
          currentState = event.data;
          callback(event.data);
        }
      };
    }
  } catch {}

  window.addEventListener("product-sync:state-change", handleCustomEvent);
  window.addEventListener("storage", handleStorageEvent);

  return () => {
    window.removeEventListener("product-sync:state-change", handleCustomEvent);
    window.removeEventListener("storage", handleStorageEvent);
    if (bc) {
      bc.close();
    }
  };
}

let checkPromise: Promise<{ imported: number; updated: number }> | null = null;
let lastCheckTimestamp = 0;
const MIN_CHECK_COOLDOWN_MS = 180_000; // 3 minutes cooldown to prevent serverless function CPU burn

/**
 * Checks WooCommerce for newly created or recently modified products and automatically
 * syncs them into Framebooks in the background.
 * Throttled to at least 3 minutes between auto-checks to conserve serverless Active CPU.
 */
export async function checkAndSyncRecentProducts(force = false): Promise<{ imported: number; updated: number }> {
  const now = Date.now();
  if (!force && now - lastCheckTimestamp < MIN_CHECK_COOLDOWN_MS) {
    return { imported: 0, updated: 0 };
  }

  if (checkPromise) return checkPromise;

  checkPromise = (async () => {
    try {
      lastCheckTimestamp = Date.now();
      const { syncWooRecentProductsAction } = await import("@/app/(dashboard)/user/actions/woocommerce");
      const res = await syncWooRecentProductsAction();
      if (res.success && (res.imported > 0 || res.updated > 0)) {
        broadcastProductSyncComplete({
          total: res.imported + res.updated,
          imported: res.imported,
          updated: res.updated,
          updatedDetails: (res as any).updatedDetails,
          importedDetails: (res as any).importedDetails,
        });
      }
      return { imported: res.imported || 0, updated: res.updated || 0 };
    } catch (e) {
      return { imported: 0, updated: 0 };
    } finally {
      checkPromise = null;
    }
  })();

  return checkPromise;
}
