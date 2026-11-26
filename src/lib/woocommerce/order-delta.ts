export type OrderStockAction = "decrement" | "restore" | "noop";

/**
 * Determines whether a WooCommerce order status requires decrementing stock,
 * restoring stock, or taking no action.
 */
export function getOrderStockAction(status: string): OrderStockAction {
  const s = (status || "").toLowerCase();
  if (s === "processing" || s === "completed" || s === "on-hold") {
    return "decrement";
  }
  if (s === "cancelled" || s === "refunded" || s === "failed") {
    return "restore";
  }
  return "noop";
}

/**
 * Computes the net stock multiplier for an order status transition.
 * Negative number = reduce Framebooks stock.
 * Positive number = restore Framebooks stock.
 * 0 = no stock change needed.
 */
export function computeOrderStatusDelta(
  previousStatus: string | null,
  currentStatus: string,
  quantity: number
): number {
  const prevAction = previousStatus ? getOrderStockAction(previousStatus) : "noop";
  const currAction = getOrderStockAction(currentStatus);

  if (prevAction === currAction) {
    return 0; // e.g. processing -> completed: already decremented
  }

  if (prevAction === "decrement" && currAction === "restore") {
    return Math.abs(quantity); // Restore previously deducted stock
  }

  if (prevAction === "restore" && currAction === "decrement") {
    return -Math.abs(quantity); // Re-deduct restored stock
  }

  if (prevAction === "noop" && currAction === "decrement") {
    return -Math.abs(quantity); // Deduct stock on new order
  }

  if (prevAction === "noop" && currAction === "restore") {
    return 0; // Order was never deducted, so nothing to restore
  }

  return 0;
}

/**
 * Generates the deterministic idempotency key for an order transition.
 */
export function buildOrderTransitionIdempotencyKey(orderId: number | string, status: string): string {
  return `order_${orderId}_${(status || "").toLowerCase()}`;
}
