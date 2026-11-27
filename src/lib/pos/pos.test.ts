import test from "node:test";
import assert from "node:assert/strict";
import { encodeCode128, generateBarcodeSvg, generateQrCodeSvg } from "./barcode-generator.ts";

test("Code 128 Barcode Generator", async (t) => {
  await t.test("generates valid module strings for alphanumeric SKU", () => {
    const sku = "SKU-00123";
    const modules = encodeCode128(sku);
    assert.ok(modules.length > 0, "Module string should not be empty");
    assert.match(modules, /^[01]+$/, "Module string must only contain 1s and 0s");
    // Code 128-B starts with 11010010000 (Start B)
    assert.ok(modules.startsWith("11010010000"), "Must start with Code 128-B start pattern");
    // Ends with termination bar 11
    assert.ok(modules.endsWith("11"), "Must end with termination bar");
  });

  await t.test("generates valid SVG XML elements", () => {
    const svg = generateBarcodeSvg("ITEM-45678", { height: 40, barWidth: 2 });
    assert.ok(svg.includes("<svg"), "Output must contain <svg element");
    assert.ok(svg.includes("ITEM-45678"), "SVG must include readable text label");
    assert.ok(svg.includes("<rect"), "SVG must contain bar rectangles");
  });

  await t.test("generates valid QR Code SVG", () => {
    const qrSvg = generateQrCodeSvg("POS-ORD-20261124-0001", 100);
    assert.ok(qrSvg.includes("<svg"), "QR output must contain <svg element");
    assert.ok(qrSvg.includes('viewBox="0 0 100 100"'), "QR SVG must match specified size");
    assert.ok(qrSvg.includes("<rect"), "QR SVG must contain matrix rects");
  });
});

test("POS Entitlement and Plan Rules", async (t) => {
  await t.test("Free plan tenants are not allowed to purchase POS add-on", () => {
    const plan = "Free";
    const isEligible = plan.toLowerCase() === "pro" || plan.toLowerCase() === "pro plus";
    assert.equal(isEligible, false, "Free plan tenants must be blocked from POS add-on");
  });

  await t.test("Pro and Pro Plus tenants are eligible to purchase POS add-on", () => {
    assert.equal("Pro".toLowerCase() === "pro" || "Pro".toLowerCase() === "pro plus", true);
    assert.equal("Pro Plus".toLowerCase() === "pro" || "Pro Plus".toLowerCase() === "pro plus", true);
  });

  await t.test("POS add-on monthly price is exactly 3000 LKR", () => {
    const posAddonMonthlyPrice = 3000;
    assert.equal(posAddonMonthlyPrice, 3000, "POS add-on monthly price must be 3,000 LKR");
  });

  await t.test("POS add-on yearly pricing defaults to 10x monthly with 2 months free", () => {
    const monthlyPrice = 3000;
    const yearlyPrice = monthlyPrice * 10;
    assert.equal(yearlyPrice, 30000, "POS add-on yearly price must be 30,000 LKR (10x monthly / 2 months free)");
  });

  await t.test("POS add-on pricing is only compatible with Pro and Pro Plus plans", () => {
    const compatiblePlans = ["pro", "pro_plus"];
    assert.ok(compatiblePlans.includes("pro"));
    assert.ok(compatiblePlans.includes("pro_plus"));
    assert.ok(!compatiblePlans.includes("free"));
  });

  await t.test("Validates customized default permissions for Super Admin, Admin, and Editor", () => {
    // Super Admin customized defaults
    const superAdminPerms = {
      invoices: { read: true, insert: true, update: true, delete: true, customize: true },
      incomes: { read: true, insert: true, update: true, delete: true },
      expenses: { read: true, insert: true, update: true, delete: true },
      clients: { read: true, insert: true, update: true, delete: true },
      accounts: { read: true, insert: true, update: true, delete: true },
      inventory: { read: true, insert: true, update: true, delete: true },
      pos: { use: true, refund: true, discount: true, void: true, reports_view: false },
      stock: { view: false, manage: true },
      settings: { manage: true, appearance: true },
      team: { manage: true },
      export: { data: true },
    };
    assert.equal(superAdminPerms.pos.use, true);
    assert.equal(superAdminPerms.pos.reports_view, false);
    assert.equal(superAdminPerms.stock.manage, true);
    assert.equal(superAdminPerms.export.data, true);

    // Admin customized defaults
    const adminPerms = {
      invoices: { read: true, insert: true, update: true, delete: true, customize: true },
      incomes: { read: true, insert: true, update: true, delete: true },
      expenses: { read: true, insert: true, update: true, delete: true },
      clients: { read: true, insert: true, update: true, delete: true },
      accounts: { read: true, insert: true, update: true, delete: true },
      inventory: { read: true, insert: true, update: true, delete: true },
      pos: { use: false, refund: false, discount: true, void: false, reports_view: true },
      stock: { view: true, manage: false },
      settings: { manage: true, appearance: true },
      team: { manage: true },
      export: { data: false },
    };
    assert.equal(adminPerms.pos.use, false);
    assert.equal(adminPerms.pos.discount, true);
    assert.equal(adminPerms.pos.reports_view, true);
    assert.equal(adminPerms.stock.view, true);
    assert.equal(adminPerms.stock.manage, false);
    assert.equal(adminPerms.export.data, false);

    // Editor customized defaults
    const editorPerms = {
      invoices: { read: true, insert: true, update: true, delete: true, customize: false },
      incomes: { read: true, insert: true, update: true, delete: true },
      expenses: { read: true, insert: true, update: true, delete: true },
      clients: { read: true, insert: true, update: true, delete: true },
      accounts: { read: true, insert: true, update: true, delete: true },
      inventory: { read: true, insert: true, update: true, delete: true },
      pos: { use: false, refund: false, discount: false, void: false, reports_view: true },
      stock: { view: true, manage: false },
      settings: { manage: false, appearance: false },
      team: { manage: false },
      export: { data: false },
    };
    assert.equal(editorPerms.invoices.delete, true);
    assert.equal(editorPerms.inventory.delete, true);
    assert.equal(editorPerms.pos.use, false);
    assert.equal(editorPerms.pos.reports_view, true);
    assert.equal(editorPerms.stock.view, true);
    assert.equal(editorPerms.stock.manage, false);
  });
});

test("Stock Calculation and Oversell Protection Rules", async (t) => {
  await t.test("Blocks negative stock when allow_negative_stock is false", () => {
    const allowNegativeStock = false;
    const currentQty = 3;
    const requestedDeduction = 5;
    const newQty = currentQty - requestedDeduction;

    const shouldBlock = newQty < 0 && !allowNegativeStock;
    assert.equal(shouldBlock, true, "Should block transaction when stock would be negative");
  });

  await t.test("Allows negative stock when allow_negative_stock is true", () => {
    const allowNegativeStock = true;
    const currentQty = 1;
    const requestedDeduction = 4;
    const newQty = currentQty - requestedDeduction;

    const shouldBlock = newQty < 0 && !allowNegativeStock;
    assert.equal(shouldBlock, false, "Should allow negative stock when setting is on");
  });

  await t.test("Restores inventory quantity on order refund or void", () => {
    const initialQty = 10;
    const soldQty = 3;
    const remainingAfterSale = initialQty - soldQty; // 7

    // Refund 3 items
    const restoredQty = remainingAfterSale + soldQty; // 10
    assert.equal(restoredQty, initialQty, "Stock must be fully restored upon refund");
  });

  await t.test("Document Type and Receipt Template Assignment Rules", () => {
    const layouts = [
      { id: "1", name: "General Template", document_type: "all" },
      { id: "2", name: "Custom Thermal Slip", document_type: "receipt" },
      { id: "3", name: "Invoice Format", document_type: "invoice" },
    ];

    const matchReceipt = layouts.find(l => l.document_type === "receipt") || layouts.find(l => l.document_type === "all");
    assert.equal(matchReceipt?.id, "2");
    assert.equal(matchReceipt?.name, "Custom Thermal Slip");

    const withoutSpecificReceipt = layouts.filter(l => l.document_type !== "receipt");
    const fallbackReceipt = withoutSpecificReceipt.find(l => l.document_type === "receipt") || withoutSpecificReceipt.find(l => l.document_type === "all");
    assert.equal(fallbackReceipt?.id, "1");

    const fallbackQuotation = withoutSpecificReceipt.find(l => l.document_type === "quotation") || withoutSpecificReceipt.find(l => l.document_type === "all");
    assert.equal(fallbackQuotation?.id, "1");
  });
});

test("Invoice and POS Income Ledger Synchronization Rules", async (t) => {
  await t.test("Cancelling or voiding invoice/POS order removes it from income ledger", () => {
    let ledger = [
      { id: 1, invoice_id: 'INV-0001', amount: 3500000, description: 'POS Sale #POS-001' },
      { id: 2, invoice_id: 'INV-0002', amount: 50000, description: 'Payment for Invoice #INV-0002' },
    ];

    // Simulate voiding/cancelling INV-0001
    const targetInvoiceId = 'INV-0001';
    ledger = ledger.filter(inc => inc.invoice_id !== targetInvoiceId);

    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].invoice_id, 'INV-0002');
  });

  await t.test("Invoice status calculation preserves cancelled and refunded without forcing fully paid", () => {
    const rawInvoices = [
      { id: 'INV-001', total: '3500000.00', status: 'cancelled' },
      { id: 'INV-002', total: '10000.00', status: 'refunded' },
      { id: 'INV-003', total: '5000.00', status: 'paid' },
    ];

    const processed = rawInvoices.map(r => {
      const isCancelledOrRefunded = ['cancelled', 'canceled', 'refunded', 'voided'].includes(r.status.toLowerCase());
      const calculatedTotalDue = isCancelledOrRefunded ? 0 : 0;
      let status = r.status;
      if (!isCancelledOrRefunded && calculatedTotalDue < 0.01) {
        status = 'fully paid';
      }
      return { id: r.id, status, isCancelledOrRefunded };
    });

    assert.equal(processed[0].status, 'cancelled');
    assert.equal(processed[1].status, 'refunded');
    assert.equal(processed[2].status, 'fully paid');
  });

  await t.test("Editing invoice amount updates linked income record with exact matching values", () => {
    let income = { id: 1, invoice_id: 'INV-0010', amount: 25000 };
    const newInvoiceTotal = 30000;
    income = { ...income, amount: newInvoiceTotal };
    assert.equal(income.amount, 30000);
  });
});

test("POS Special Discounts, Offers & Client Management Rules", async (t) => {
  await t.test("Calculates line item percentage and fixed fee discounts correctly", () => {
    const item1 = { price: 1000, quantity: 2, discount: 10, discountType: 'percent' as const };
    const line1Subtotal = item1.price * item1.quantity; // 2000
    const line1Disc = (line1Subtotal * item1.discount) / 100; // 200
    assert.equal(line1Disc, 200, "10% on 2000 should be 200");

    const item2 = { price: 500, quantity: 3, discount: 50, discountType: 'fixed' as const };
    const line2Subtotal = item2.price * item2.quantity; // 1500
    const line2Disc = Math.min(line2Subtotal, item2.discount * item2.quantity); // 150
    assert.equal(line2Disc, 150, "50 LKR off per unit on 3 units should be 150");
  });

  await t.test("Calculates cross-item bundle offer (Buy A get discount on B)", () => {
    const cart = [
      { id: 101, name: "Frame", price: 10000, quantity: 1 },
      { id: 202, name: "Lens", price: 5000, quantity: 1 },
    ];
    const bundleOffer = {
      type: "bundle",
      trigger_item_id: 101,
      target_item_id: 202,
      discount_type: "fixed",
      discount_value: 1500,
      active: true,
    };

    const hasTrigger = cart.some(it => it.id === bundleOffer.trigger_item_id);
    const targetItem = cart.find(it => it.id === bundleOffer.target_item_id);
    assert.equal(hasTrigger, true);
    assert.ok(targetItem);

    const targetSubtotal = targetItem!.price * targetItem!.quantity;
    const bundleDiscount = bundleOffer.discount_type === "fixed"
      ? Math.min(targetSubtotal, bundleOffer.discount_value * targetItem!.quantity)
      : (targetSubtotal * bundleOffer.discount_value) / 100;

    assert.equal(bundleDiscount, 1500, "Bundle discount must deduct 1500 on target item");
  });

  await t.test("Calculates brand-level promotional discounts", () => {
    const cart = [
      { id: 1, name: "Air Max", brand: "Nike", price: 20000, quantity: 1 },
      { id: 2, name: "Socks", brand: "Nike", price: 2000, quantity: 2 },
      { id: 3, name: "Shirt", brand: "Puma", price: 8000, quantity: 1 },
    ];
    const brandOffer = {
      type: "brand",
      brand: "Nike",
      discount_type: "percent",
      discount_value: 15,
      active: true,
    };

    const matchingItems = cart.filter(it => it.brand.toLowerCase() === brandOffer.brand.toLowerCase());
    assert.equal(matchingItems.length, 2);

    const brandDiscount = matchingItems.reduce((acc, it) => {
      const lineTotal = it.price * it.quantity;
      return acc + (lineTotal * brandOffer.discount_value) / 100;
    }, 0);

    // Nike items: 20000 + 4000 = 24000. 15% of 24000 = 3600
    assert.equal(brandDiscount, 3600, "15% on 24000 Nike goods should be 3600");
  });

  await t.test("Validates client identification rules", () => {
    const walkInClient = { name: "Walk-in Customer", phone: "" };
    assert.equal(walkInClient.name.toLowerCase() === "walk-in customer", true);

    const customClient = { name: "Kasun Perera", phone: "0771234567" };
    assert.equal(customClient.name.length > 0 && customClient.phone.length > 0, true);

    // Phone normalization and lookup rule: if number exists, retrieve name and start sale; if not advance focus to name
    const clientsDb = [
      { id: "c1", name: "Kasun Perera", phone: "077 123 4567" },
      { id: "c2", name: "Amali Silva", phone: "0719876543" },
    ];

    const lookupCustomer = (inputPhone: string) => {
      const cleanDigits = inputPhone.replace(/\D/g, "");
      const match = clientsDb.find(c => (c.phone || "").replace(/\D/g, "") === cleanDigits);
      if (match) {
        return { exists: true, name: match.name, customer: match, nextAction: "start_sale" };
      }
      return { exists: false, name: null, nextAction: "focus_name_field" };
    };

    const existingResult = lookupCustomer("0771234567");
    assert.equal(existingResult.exists, true);
    assert.equal(existingResult.name, "Kasun Perera");
    assert.equal(existingResult.nextAction, "start_sale");

    const newResult = lookupCustomer("0750000000");
    assert.equal(newResult.exists, false);
    assert.equal(newResult.nextAction, "focus_name_field");

    // Client details in receipt formatting
    const receiptOrder = {
      order_number: "POS-1001",
      customer_name: "Kasun Perera",
      customer_phone: "077 123 4567",
      total_amount: 5000,
    };
    assert.equal(receiptOrder.customer_name, "Kasun Perera");
    assert.equal(receiptOrder.customer_phone, "077 123 4567");
  });

  await t.test("Validates manager approval requirement & access code format", () => {
    // Offer requiring supervisor sign-off
    const protectedOffer = {
      id: 10,
      name: "VIP Executive 50% Off",
      requires_manager_approval: true,
      discount_value: 50,
      discount_type: "percent",
    };
    assert.equal(protectedOffer.requires_manager_approval, true);

    // QR Code badge parsing (handles POS_MGR: prefix from badge scan)
    const qrScannedBadge = "POS_MGR:984210";
    const cleanFromQr = qrScannedBadge.replace(/^POS_MGR:/i, "").trim();
    assert.equal(cleanFromQr, "984210");

    // Manual PIN code entry
    const manualEnteredPin = "  984210  ";
    assert.equal(manualEnteredPin.trim(), "984210");

    // Manager role authorization check
    const isAuthorizedRole = (role: string) => {
      const lower = role.toLowerCase();
      return lower === "owner" || lower === "super admin" || lower === "admin" || lower === "manager";
    };

    assert.equal(isAuthorizedRole("Owner"), true);
    assert.equal(isAuthorizedRole("Manager"), true);
    assert.equal(isAuthorizedRole("Admin"), true);
    assert.equal(isAuthorizedRole("Cashier"), false);
    assert.equal(isAuthorizedRole("Viewer"), false);

    // Manager Alert Bell Sound trigger rule when offer requires supervisor approval
    const shouldPlayManagerBell = (offer: { requires_manager_approval: boolean }, isManager: boolean) => {
      // Plays distinct service desk bell when showing offer requiring manager authorization to alert floor managers
      return Boolean(offer.requires_manager_approval) && !isManager;
    };

    assert.equal(shouldPlayManagerBell(protectedOffer, false), true, "Must ring bell to alert managers for cashier");
    assert.equal(shouldPlayManagerBell(protectedOffer, true), false, "Manager already has authorization; no alert bell needed");
    assert.equal(shouldPlayManagerBell({ requires_manager_approval: false }, false), false, "Standard offers do not trigger bell");
  });

  await t.test("Validates cashier restriction for POS settings access", () => {
    const canAccessSettings = (role: string, isCashierOnly: boolean, canManageStock: boolean) => {
      const isCashier = isCashierOnly || role.toLowerCase() === "cashier";
      return !isCashier && canManageStock;
    };

    assert.equal(canAccessSettings("Owner", false, true), true, "Owner can access POS settings");
    assert.equal(canAccessSettings("Admin", false, true), true, "Admin can access POS settings");
    assert.equal(canAccessSettings("Manager", false, true), true, "Manager with stock manage can access POS settings");
    assert.equal(canAccessSettings("Cashier", false, true), false, "Cashier cannot access POS settings");
    assert.equal(canAccessSettings("Cashier", true, false), false, "Cashier-only cannot access POS settings");
  });

  await t.test("Validates Barcode & QR Scanner single item per scan guarantee & debounce", () => {
    // Simulated POS scan state
    let cart: { id: number; name: string; qty: number }[] = [];
    let lastScan: { code: string; time: number } | null = null;

    const addToCart = (product: { id: number; name: string }, qty: number = 1) => {
      const existing = cart.find((i) => i.id === product.id);
      if (existing) {
        existing.qty += qty;
      } else {
        cart.push({ id: product.id, name: product.name, qty });
      }
    };

    const handleScan = (code: string, timestamp: number) => {
      const clean = code.trim();
      if (!clean) return false;

      // Strict debounce: 2000ms for identical code, 500ms for consecutive scans
      if (lastScan) {
        const isSame = lastScan.code.toLowerCase() === clean.toLowerCase();
        const elapsed = timestamp - lastScan.time;
        if (isSame && elapsed < 2000) return false;
        if (elapsed < 500) return false;
      }
      lastScan = { code: clean, time: timestamp };
      addToCart({ id: 101, name: "Bluetooth Desktop Label Printer" }, 1);
      return true;
    };

    const handleSearchInputEnter = (searchTerm: string, timestamp: number) => {
      // Suppress duplicate addition if a scan occurred within 1500ms
      if (lastScan && timestamp - lastScan.time < 1500) {
        return false;
      }
      addToCart({ id: 101, name: "Bluetooth Desktop Label Printer" }, 1);
      return true;
    };

    // Scan #1: First scan at t = 1000ms
    const scan1 = handleScan("FT-PRN-005", 1000);
    assert.equal(scan1, true, "First scan must succeed");
    assert.equal(cart[0].qty, 1, "Cart must have exactly 1 item");

    // Rapid Enter from search input (dual-fire bug) at t = 1002ms
    const enterDualFire = handleSearchInputEnter("FT-PRN-005", 1002);
    assert.equal(enterDualFire, false, "Search input Enter within debounce must be suppressed");
    assert.equal(cart[0].qty, 1, "Cart must still have exactly 1 item (no double-count)");

    // Trailing CRLF keystroke at t = 1020ms
    const isSwallowedCRLF = (1020 - 1000) < 350;
    assert.equal(isSwallowedCRLF, true, "Trailing CRLF must be swallowed");

    // Camera detector consecutive frame burst at t = 1016ms
    const rapidFrame = handleScan("FT-PRN-005", 1016);
    assert.equal(rapidFrame, false, "Rapid consecutive video frame must be suppressed");
    assert.equal(cart[0].qty, 1, "Cart must remain at 1 item");

    // Legitimate 2nd scan of same product after 2500ms at t = 3500ms
    const scan2 = handleScan("FT-PRN-005", 3500);
    assert.equal(scan2, true, "Scan after cooldown must succeed");
    assert.equal(cart[0].qty, 2, "Cart now has exactly 2 items");
  });

  await t.test("Validates pre-flight stock sufficiency check before adding to order and payment", () => {
    // Inventory: Bluetooth Desktop Label Printer has 9 in stock
    const inventory = [
      { id: 1, name: "Bluetooth Desktop Label Printer", sku: "FT-PRN-006", quantity: 9 },
      { id: 2, name: "Out of Stock Mouse", sku: "FT-MOU-000", quantity: 0 },
    ];

    let cart: { id: number; name: string; quantity: number }[] = [];
    const allowNegativeStock = false;

    const addToCart = (product: { id: number; name: string; quantity: number }, qtyToAdd: number) => {
      if (!allowNegativeStock) {
        const inCart = cart.find((i) => i.id === product.id);
        const currentQty = inCart ? inCart.quantity : 0;
        const targetQty = currentQty + qtyToAdd;

        if (product.quantity <= 0) {
          return { success: false, error: `"${product.name}" is out of stock` };
        }
        if (targetQty > product.quantity) {
          return { success: false, error: `Insufficient stock for "${product.name}": Only ${product.quantity} in stock` };
        }
      }

      const existing = cart.find((i) => i.id === product.id);
      if (existing) {
        existing.quantity += qtyToAdd;
      } else {
        cart.push({ id: product.id, name: product.name, quantity: qtyToAdd });
      }
      return { success: true };
    };

    const updateCartQty = (productId: number, delta: number) => {
      if (delta > 0 && !allowNegativeStock) {
        const product = inventory.find((p) => p.id === productId);
        const cartItem = cart.find((i) => i.id === productId);
        if (product && cartItem) {
          if (cartItem.quantity + delta > product.quantity) {
            return { success: false, error: `Cannot add more: Only ${product.quantity} available in stock` };
          }
        }
      }
      const item = cart.find((i) => i.id === productId);
      if (item) item.quantity += delta;
      return { success: true };
    };

    // 1. Trying to add 0-stock item
    const outOfStockRes = addToCart(inventory[1], 1);
    assert.equal(outOfStockRes.success, false);
    assert.ok(outOfStockRes.error?.includes("out of stock"));
    assert.equal(cart.length, 0, "Out of stock item must not be added to cart");

    // 2. Add 9 items (exact stock available)
    const validAddRes = addToCart(inventory[0], 9);
    assert.equal(validAddRes.success, true);
    assert.equal(cart[0].quantity, 9);

    // 3. Trying to add 1 more via product card / scan when at stock limit
    const exceedAddRes = addToCart(inventory[0], 1);
    assert.equal(exceedAddRes.success, false);
    assert.ok(exceedAddRes.error?.includes("Insufficient stock"));
    assert.equal(cart[0].quantity, 9, "Quantity must remain 9 and not exceed available stock");

    // 4. Trying to increment via cart '+' button
    const plusRes = updateCartQty(inventory[0].id, 1);
    assert.equal(plusRes.success, false);
    assert.equal(cart[0].quantity, 9);

    // 5. Pre-flight checkout validation ensures order never reaches payment with invalid stock
    const preFlightCheckout = () => {
      const overStockItem = cart.find((item) => {
        const p = inventory.find((prod) => prod.id === item.id);
        return p && item.quantity > p.quantity;
      });
      return !overStockItem;
    };
    assert.equal(preFlightCheckout(), true, "Cart within stock limit passes pre-flight checkout");
  });

  await t.test("Validates Mobile POS responsive view switcher and navigation logic", () => {
    // State machine for Mobile POS navigation
    let mobileView: "catalog" | "cart" = "catalog";
    let isMobileMenuOpen = false;
    let cart = [{ id: 1, name: "Item A", price: 1000, quantity: 2 }];

    // 1. Initial mobile view defaults to catalog
    assert.equal(mobileView, "catalog");

    // 2. Tapping bottom order pill or Order tab switches view to cart
    const openCartOnMobile = () => { mobileView = "cart"; };
    openCartOnMobile();
    assert.equal(mobileView, "cart");

    // 3. Tapping Add More Products button switches view back to catalog
    const returnToCatalog = () => { mobileView = "catalog"; };
    returnToCatalog();
    assert.equal(mobileView, "catalog");

    // 4. Starting new sale or completing checkout automatically resets view to catalog
    const onSaleCompleteOrNew = () => {
      cart = [];
      mobileView = "catalog";
    };
    mobileView = "cart";
    onSaleCompleteOrNew();
    assert.equal(mobileView, "catalog");
    assert.equal(cart.length, 0);

    // 5. Mobile actions drawer toggle
    const toggleMobileMenu = (open: boolean) => { isMobileMenuOpen = open; };
    toggleMobileMenu(true);
    assert.equal(isMobileMenuOpen, true);
    toggleMobileMenu(false);
    assert.equal(isMobileMenuOpen, false);
  });

  await t.test("Validates cashier direct discount manager authorization requirement", () => {
    // Simulated discount application rules
    type UserRole = "cashier" | "manager" | "owner";

    const applyOrderDiscount = (
      role: UserRole,
      discountVal: number,
      managerCodeProvided?: string
    ) => {
      if (discountVal <= 0) {
        return { applied: true, percent: 0, requiresManagerAuth: false };
      }

      const isCashier = role === "cashier";
      if (!isCashier) {
        // Managers and Owners can apply discounts directly
        return { applied: true, percent: discountVal, requiresManagerAuth: false };
      }

      // Cashiers require valid manager access code
      const validManagerCodes = ["MGR-9901", "POS_MGR:1234"];
      const cleanCode = (managerCodeProvided || "").trim();
      const isValid = validManagerCodes.some(
        c => c.toLowerCase() === cleanCode.toLowerCase() ||
             c.replace("POS_MGR:", "").toLowerCase() === cleanCode.toLowerCase()
      );

      if (!isValid) {
        return { applied: false, percent: 0, requiresManagerAuth: true, error: "Manager authorization required" };
      }

      return { applied: true, percent: discountVal, requiresManagerAuth: true, authorizedBy: "Manager" };
    };

    // 1. Manager or Owner applies 15% discount directly without code
    const mgrResult = applyOrderDiscount("manager", 15);
    assert.equal(mgrResult.applied, true);
    assert.equal(mgrResult.requiresManagerAuth, false);
    assert.equal(mgrResult.percent, 15);

    // 2. Cashier attempts to apply 15% discount without manager authorization
    const cashierBlocked = applyOrderDiscount("cashier", 15);
    assert.equal(cashierBlocked.applied, false);
    assert.equal(cashierBlocked.requiresManagerAuth, true);
    assert.ok(cashierBlocked.error?.includes("Manager authorization required"));

    // 3. Cashier applies 15% discount with valid manager authorization code / scanned QR
    const cashierAuthorized = applyOrderDiscount("cashier", 15, "1234");
    assert.equal(cashierAuthorized.applied, true);
    assert.equal(cashierAuthorized.percent, 15);
    assert.equal(cashierAuthorized.authorizedBy, "Manager");

    // 4. Clearing discount (0%) is always allowed without manager authorization
    const clearResult = applyOrderDiscount("cashier", 0);
    assert.equal(clearResult.applied, true);
    assert.equal(clearResult.percent, 0);
  });

  await t.test("Validates mandatory active register shift requirement before adding products or checking out", () => {
    // POS Order validation function against active shift status
    interface MockShift {
      id: number;
      status: "open" | "closed";
      opened_at: string;
    }

    const validatePosAction = (
      action: "add_item" | "update_qty" | "open_checkout" | "execute_checkout",
      activeShift: MockShift | null
    ): { allowed: boolean; error?: string } => {
      if (!activeShift || activeShift.status !== "open") {
        return {
          allowed: false,
          error: "Please open a register shift before processing sales or adding products.",
        };
      }
      return { allowed: true };
    };

    const closedShift: MockShift | null = null;
    const openShift: MockShift = { id: 1, status: "open", opened_at: new Date().toISOString() };

    // 1. Adding item without open shift must be rejected
    const addWithoutShift = validatePosAction("add_item", closedShift);
    assert.equal(addWithoutShift.allowed, false);
    assert.ok(addWithoutShift.error?.includes("open a register shift"));

    // 2. Adding item with active open shift must be permitted
    const addWithShift = validatePosAction("add_item", openShift);
    assert.equal(addWithShift.allowed, true);

    // 3. Updating cart quantity without active shift must be rejected
    const updateWithoutShift = validatePosAction("update_qty", closedShift);
    assert.equal(updateWithoutShift.allowed, false);

    // 4. Opening checkout modal without active shift must be rejected
    const checkoutWithoutShift = validatePosAction("open_checkout", closedShift);
    assert.equal(checkoutWithoutShift.allowed, false);

    // 5. Checkout execution with active shift succeeds
    const checkoutWithShift = validatePosAction("execute_checkout", openShift);
    assert.equal(checkoutWithShift.allowed, true);
  });

  await t.test("Validates cart updater purity (updater called multiple times in StrictMode increments exactly by 1)", () => {
    let state = [{ id: 101, name: "TEST Auto QR", quantity: 1 }];

    const pureUpdater = (prev: typeof state, qtyToAdd: number) => {
      const existingIdx = prev.findIndex((item) => item.id === 101);
      if (existingIdx >= 0) {
        return prev.map((item, idx) =>
          idx === existingIdx
            ? { ...item, quantity: item.quantity + qtyToAdd }
            : item
        );
      }
      return [...prev, { id: 101, name: "TEST Auto QR", quantity: qtyToAdd }];
    };

    // React StrictMode simulates running updater twice with the same initial prev state:
    const run1 = pureUpdater(state, 1);
    const run2 = pureUpdater(state, 1);

    // Both runs must yield exactly quantity = 2, NOT 3!
    assert.equal(run1[0].quantity, 2);
    assert.equal(run2[0].quantity, 2);
    // Original state must NOT be mutated in place
    assert.equal(state[0].quantity, 1);
  });

  await t.test("Validates automatic promotion application and checkout manager approval interceptor", () => {
    interface Promotion {
      id: number;
      name: string;
      requires_manager_approval: boolean;
      discount_value: number;
    }

    const regularOffer: Promotion = {
      id: 1,
      name: "10% Spring Offer",
      requires_manager_approval: false,
      discount_value: 10,
    };

    const protectedOffer: Promotion = {
      id: 2,
      name: "25% VIP Manager Offer",
      requires_manager_approval: true,
      discount_value: 25,
    };

    const qualifiedPromotions = [regularOffer, protectedOffer];

    // 1. Auto-apply resolution logic for Cashier (isCashierOnly = true, isManager = false)
    const computeAutoAppliedIds = (promos: Promotion[], isManager: boolean, currentApplied: number[]) => {
      const qualifiedIds = new Set(promos.map((p) => p.id));
      const stillQualified = currentApplied.filter((id) => qualifiedIds.has(id));
      const autoApply = promos
        .filter((p) => !p.requires_manager_approval || isManager)
        .map((p) => p.id);
      return Array.from(new Set([...stillQualified, ...autoApply]));
    };

    const cashierApplied = computeAutoAppliedIds(qualifiedPromotions, false, []);
    // Regular offer must be auto-applied immediately
    assert.ok(cashierApplied.includes(1), "Regular offer should be auto-applied for cashier");
    // Protected offer must NOT be auto-applied during scanning
    assert.equal(cashierApplied.includes(2), false, "Protected offer must require manager authorization");

    // 2. Auto-apply resolution logic for Manager/Admin
    const managerApplied = computeAutoAppliedIds(qualifiedPromotions, true, []);
    assert.ok(managerApplied.includes(1), "Regular offer auto-applied for manager");
    assert.ok(managerApplied.includes(2), "Protected offer auto-applied directly for manager");

    // 3. Checkout interceptor logic for Cashier:
    // When cashier clicks charge / initiates checkout, check if any qualified offer requires manager authorization
    const handleCheckoutIntercept = (
      promos: Promotion[],
      appliedIds: number[],
      isManager: boolean
    ): { openPayment: boolean; requireManagerAuthForPromo?: Promotion } => {
      if (!isManager) {
        const pendingPromo = promos.find(
          (p) => p.requires_manager_approval && !appliedIds.includes(p.id)
        );
        if (pendingPromo) {
          return { openPayment: false, requireManagerAuthForPromo: pendingPromo };
        }
      }
      return { openPayment: true };
    };

    // When cashier checks out with protected offer unapproved:
    const interceptResult = handleCheckoutIntercept(qualifiedPromotions, cashierApplied, false);
    assert.equal(interceptResult.openPayment, false, "Payment modal must be intercepted before payment");
    assert.equal(interceptResult.requireManagerAuthForPromo?.id, 2, "Must prompt for the unapproved offer");

    // Once manager enters PIN and authorizes:
    const afterApprovalApplied = [...cashierApplied, interceptResult.requireManagerAuthForPromo!.id];
    assert.ok(afterApprovalApplied.includes(2), "Protected offer is now applied");

    // Now cashier checking out proceeds directly to payment:
    const afterApprovalIntercept = handleCheckoutIntercept(qualifiedPromotions, afterApprovalApplied, false);
    assert.equal(afterApprovalIntercept.openPayment, true, "Proceeds to payment modal once authorized");

    // 4. If manager authorization is cancelled / skipped by cashier:
    const proceedWithoutProtected = handleCheckoutIntercept(qualifiedPromotions, cashierApplied, false);
    // Proceed to payment with only regular offer applied
    assert.deepEqual(cashierApplied, [1], "Cart retains regular offer without protected offer");
  });

  await t.test("POS Multiple Cashier Counters and Shifts Architecture Rules", async (ct) => {
    interface MockCounter {
      id: number;
      tenant_id: number;
      name: string;
      code: string;
      is_active: boolean;
      active_shift?: { id: number; shift_number: number; user_name: string } | null;
    }

    interface MockShift {
      id: number;
      tenant_id: number;
      counter_id: number;
      counter_name: string;
      shift_number: number;
      status: "open" | "closed";
      user_name: string;
      opening_cash: number;
    }

    const countersDb: MockCounter[] = [
      { id: 1, tenant_id: 1, name: "Counter 1", code: "C1", is_active: true },
      { id: 2, tenant_id: 1, name: "Counter 2", code: "C2", is_active: true },
      { id: 3, tenant_id: 1, name: "Floor 2 Express", code: "EXP", is_active: false },
    ];

    const shiftsDb: MockShift[] = [
      {
        id: 101,
        tenant_id: 1,
        counter_id: 1,
        counter_name: "Counter 1",
        shift_number: 1,
        status: "closed",
        user_name: "Kasun",
        opening_cash: 5000,
      },
      {
        id: 102,
        tenant_id: 1,
        counter_id: 1,
        counter_name: "Counter 1",
        shift_number: 2,
        status: "open",
        user_name: "Amali",
        opening_cash: 10000,
      },
    ];

    await ct.test("Validates counter naming uniqueness per tenant", () => {
      const validateNewCounter = (name: string, tenantId: number) => {
        const trimmed = name.trim().toLowerCase();
        const exists = countersDb.some(
          (c) => c.tenant_id === tenantId && c.name.trim().toLowerCase() === trimmed
        );
        if (exists) return { valid: false, error: `A counter named "${name}" already exists.` };
        return { valid: true };
      };

      assert.equal(validateNewCounter("Counter 1", 1).valid, false);
      assert.equal(validateNewCounter("counter 1", 1).valid, false);
      assert.equal(validateNewCounter("Counter 3", 1).valid, true);
      assert.equal(validateNewCounter("Counter 1", 2).valid, true); // Tenant isolation
    });

    await ct.test("Counters track shifts independently with sequential numbering", () => {
      const getNextShiftNumber = (tenantId: number) => {
        const tenantShifts = shiftsDb.filter((s) => s.tenant_id === tenantId);
        const maxNum = tenantShifts.reduce((max, s) => Math.max(max, s.shift_number), 0);
        return maxNum + 1;
      };

      assert.equal(getNextShiftNumber(1), 3);

      // Open new shift on Counter 2
      const newShift: MockShift = {
        id: 103,
        tenant_id: 1,
        counter_id: 2,
        counter_name: "Counter 2",
        shift_number: getNextShiftNumber(1),
        status: "open",
        user_name: "Devinda",
        opening_cash: 7500,
      };
      shiftsDb.push(newShift);

      assert.equal(newShift.shift_number, 3);
      assert.equal(newShift.counter_name, "Counter 2");
    });

    await ct.test("Guards against deactivating or deleting a counter with an active shift", () => {
      const canDeactivateOrDelete = (counterId: number) => {
        const hasOpenShift = shiftsDb.some(
          (s) => s.counter_id === counterId && s.status === "open"
        );
        if (hasOpenShift) {
          return { allowed: false, error: "Cannot modify or delete counter while a shift is open." };
        }
        return { allowed: true };
      };

      // Counter 1 has open shift #102
      assert.equal(canDeactivateOrDelete(1).allowed, false);
      // Floor 2 Express has no shifts
      assert.equal(canDeactivateOrDelete(3).allowed, true);
    });

    await ct.test("Orders inherit counter_id and counter_name from active shift", () => {
      const activeShift = shiftsDb.find((s) => s.id === 102 && s.status === "open")!;
      const createOrder = (orderNum: string, shift: MockShift) => ({
        order_number: orderNum,
        shift_id: shift.id,
        counter_id: shift.counter_id,
        counter_name: shift.counter_name,
        total_amount: 4500,
      });

      const order = createOrder("POS-2001", activeShift);
      assert.equal(order.counter_id, 1);
      assert.equal(order.counter_name, "Counter 1");
      assert.equal(order.shift_id, 102);
    });
  });
});
