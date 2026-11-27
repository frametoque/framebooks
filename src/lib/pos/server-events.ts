import { EventEmitter } from "events";

export interface StockChangeEvent {
  type: "stock_update";
  tenantId: number;
  timestamp: number;
  source: string;
  items?: Array<{
    id: number;
    newQuantity?: number;
    delta?: number;
  }>;
}

// Global EventEmitter instance to survive Next.js module reloads in development
declare global {
  // eslint-disable-next-line no-var
  var __pos_stock_emitter: EventEmitter | undefined;
}

const emitter = globalThis.__pos_stock_emitter || new EventEmitter();
if (process.env.NODE_ENV !== "production") {
  globalThis.__pos_stock_emitter = emitter;
}
emitter.setMaxListeners(500);

/**
 * Notifies all connected cashiers and counters for a given tenant
 * that stock has changed, across different physical devices.
 */
export function notifyTenantStockUpdate(
  tenantId: number | string,
  event: {
    source: string;
    items?: Array<{
      id: number;
      newQuantity?: number;
      delta?: number;
    }>;
  }
) {
  const tid = Number(tenantId);
  if (!tid) return;

  const payload: StockChangeEvent = {
    type: "stock_update",
    tenantId: tid,
    timestamp: Date.now(),
    source: event.source,
    items: event.items,
  };

  emitter.emit(`tenant:${tid}`, payload);
  emitter.emit("all", payload);
}

/**
 * Subscribes to real-time server-side stock events for a tenant.
 */
export function subscribeTenantStockEvents(
  tenantId: number | string,
  callback: (event: StockChangeEvent) => void
): () => void {
  const tid = Number(tenantId);
  const eventName = `tenant:${tid}`;
  emitter.on(eventName, callback);
  return () => {
    emitter.off(eventName, callback);
  };
}
