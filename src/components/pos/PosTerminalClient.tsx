"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { 
  Store, Search, Camera, Barcode, ShoppingCart, Trash2, 
  Plus, Minus, ArrowLeft, ArrowRight, LogOut, Package, History, Settings, 
  CreditCard, DollarSign, UserCheck, CheckCircle2, AlertTriangle, AlertCircle, 
  Clock, X, Printer, Percent, RefreshCw, Zap, Keyboard, HelpCircle,
  Sparkles, Tag, UserPlus, Layers, Vault, Menu, ChevronRight, ShieldCheck
} from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { StockItem } from "@/lib/pos/stock-service";
import { generateBarcodeSvg } from "@/lib/pos/barcode-generator";
import { 
  loadStockProductsAction, 
  findProductByBarcodeAction,
  loadPosSettingsAction
} from "@/app/(dashboard)/pos/actions/stock";
import { getActiveReceiptLayoutAction } from "@/app/(dashboard)/user/actions/invoice-layouts";
import { 
  CartItem, 
  CheckoutPayload, 
  checkoutPosOrderAction, 
  getOrCreateShiftAction 
} from "@/app/(dashboard)/pos/actions/sales";
import { PosPromotion, loadPosPromotionsAction } from "@/app/(dashboard)/pos/actions/promotions";
import { useHardwareBarcodeScanner, playScanSound } from "./useHardwareBarcodeScanner";
import { CameraScannerModal } from "./CameraScannerModal";
import { ReceiptModal } from "./ReceiptModal";
import { ShiftModal } from "./ShiftModal";
import { StockManagementModal } from "./StockManagementModal";
import { OrderHistoryModal } from "./OrderHistoryModal";
import { PosSettingsModal } from "./PosSettingsModal";
import { CustomerSelectModal } from "./CustomerSelectModal";
import { SpecialOffersModal } from "./SpecialOffersModal";
import { ItemDiscountModal } from "./ItemDiscountModal";
import { ManagerApprovalModal } from "./ManagerApprovalModal";
import { TenantLogo } from "@/components/TenantLogo";

interface PosTerminalClientProps {
  initialShift: any | null;
  tenantName: string;
  tenantLogoUrl?: string | null;
  userName: string;
  userRole: string;
  isCashierOnly: boolean;
  canManageStock: boolean;
  canRefund: boolean;
  canDiscount: boolean;
  canVoid: boolean;
  canViewReports: boolean;
  isWooConnected?: boolean;
}

export function PosTerminalClient({
  initialShift,
  tenantName,
  tenantLogoUrl,
  userName,
  userRole,
  isCashierOnly,
  canManageStock,
  canRefund,
  canDiscount,
  canVoid,
  canViewReports,
  isWooConnected = false,
}: PosTerminalClientProps) {
  // Products catalog state
  const [products, setProducts] = useState<StockItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("Walk-in Customer");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(Boolean(initialShift));

  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountFixed, setDiscountFixed] = useState<number>(0);
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);

  // Draft & Manager Authorization for Order Discounts
  const [draftDiscountPercent, setDraftDiscountPercent] = useState<number>(0);
  const [draftDiscountFixed, setDraftDiscountFixed] = useState<number>(0);
  const [draftDiscountType, setDraftDiscountType] = useState<"percent" | "fixed">("percent");

  const [pendingOrderDiscount, setPendingOrderDiscount] = useState<{
    percent: number;
    fixed: number;
    type: "percent" | "fixed";
  } | null>(null);
  const [isAuthorizingOrderDiscount, setIsAuthorizingOrderDiscount] = useState(false);

  // Draft & Manager Authorization for Item Discounts
  const [pendingItemDiscount, setPendingItemDiscount] = useState<{
    itemId: number;
    itemName: string;
    discount: number;
    discountType: "percent" | "fixed";
    reason?: string;
  } | null>(null);
  const [isAuthorizingItemDiscount, setIsAuthorizingItemDiscount] = useState(false);

  // Promotions & Special Offers State
  const [promotions, setPromotions] = useState<PosPromotion[]>([]);
  const [appliedPromotionIds, setAppliedPromotionIds] = useState<number[]>([]);
  const [isSpecialOffersModalOpen, setIsSpecialOffersModalOpen] = useState(false);
  const [discountingItem, setDiscountingItem] = useState<CartItem | null>(null);
  const [isItemDiscountModalOpen, setIsItemDiscountModalOpen] = useState(false);
  const [authorizingPromo, setAuthorizingPromo] = useState<PosPromotion | null>(null);
  const [pendingCheckoutAfterPromo, setPendingCheckoutAfterPromo] = useState(false);
  const pendingCheckoutAfterPromoRef = useRef(false);
  const promptedOffersRef = useRef<Set<number>>(new Set());

  // Shift state
  const [activeShift, setActiveShift] = useState<any | null>(initialShift);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(!initialShift);

  // Modals state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);

  // Mobile navigation & sheet state
  const [mobileView, setMobileView] = useState<"catalog" | "cart">("catalog");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Keyboard navigation & element refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tenderedInputRef = useRef<HTMLInputElement>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Payment checkout state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Card" | "Bank Transfer">("Cash");
  const [tenderedCash, setTenderedCash] = useState<string>("");
  const [checkingOut, setCheckingOut] = useState(false);

  // Completed order & receipt state
  const [completedOrder, setCompletedOrder] = useState<any | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [receiptLayout, setReceiptLayout] = useState<{ id: string; name: string; definition: any } | null>(null);
  const [receiptSettings, setReceiptSettings] = useState<{ header: string; footer: string }>({ header: "", footer: "Thank you for your purchase!" });
  const [allowNegativeStock, setAllowNegativeStock] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Role permissions
  const isCashier = isCashierOnly || userRole?.toLowerCase() === "cashier";
  const canAccessPosSettings = !isCashier && canManageStock;

  // Toast notification
  const [scanToast, setScanToast] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Product Sync indicator state
  const [productSyncState, setProductSyncState] = useState<{
    isSyncing: boolean;
    progress: { current: number; total: number; percent: number } | null;
  }>({ isSyncing: false, progress: null });
  const [syncCompletedNotice, setSyncCompletedNotice] = useState<{ total: number } | null>(null);

  useEffect(() => {
    let isMounted = true;
    let cleanupSync = () => {};
    let cleanupStock = () => {};

    import("@/lib/pos/product-sync-events").then(
      ({ subscribeProductSync, subscribeStockUpdated, checkAndSyncRecentProducts }) => {
        if (!isMounted) return;

        cleanupSync = subscribeProductSync((state) => {
          setProductSyncState({ isSyncing: state.isSyncing, progress: state.progress });
          if (!state.isSyncing && state.lastResult) {
            setSyncCompletedNotice({ total: state.lastResult.total });
            fetchProducts(true);
            setTimeout(() => setSyncCompletedNotice(null), 5000);
          }
        });

        // Instant silent cross-tab sync when stock is adjusted anywhere
        cleanupStock = subscribeStockUpdated(() => {
          fetchProducts(true);
        });

        // Auto-check for new or modified WooCommerce products on initial POS load
        checkAndSyncRecentProducts();
      }
    );

    return () => {
      isMounted = false;
      cleanupSync();
      cleanupStock();
    };
  }, []);

  // Load products, receipt template, and promotions on mount
  useEffect(() => {
    fetchProducts();
    fetchReceiptTemplate();
    fetchPromotions();
  }, []);

  const fetchPromotions = async () => {
    try {
      const res = await loadPosPromotionsAction();
      if (res.success) {
        setPromotions(res.promotions);
      }
    } catch (e) {
      console.error("fetchPromotions error:", e);
    }
  };

  const fetchReceiptTemplate = async () => {
    try {
      const [lRes, sRes] = await Promise.all([
        getActiveReceiptLayoutAction(),
        loadPosSettingsAction(),
      ]);
      if (lRes.success && lRes.layout) {
        setReceiptLayout(lRes.layout);
      }
      if (sRes.success && sRes.settings) {
        setReceiptSettings({
          header: sRes.settings.receipt_header || "",
          footer: sRes.settings.receipt_footer || "Thank you for your purchase!",
        });
        setAllowNegativeStock(Boolean(sRes.settings.allow_negative_stock));
      }
    } catch (e) {
      console.error("fetchReceiptTemplate error:", e);
    }
  };

  const fetchProducts = async (silent = false) => {
    if (!silent) {
      setLoadingProducts(true);
    }
    try {
      const res = await loadStockProductsAction();
      if (res.success) {
        setProducts(res.items);
      }
    } catch (e) {
      console.error("fetchProducts error:", e);
    } finally {
      if (!silent) {
        setLoadingProducts(false);
      }
    }
  };

  // Toast timer
  const triggerToast = (text: string, type: "success" | "error" = "success") => {
    setScanToast({ text, type });
    setTimeout(() => {
      setScanToast(null);
    }, 2800);
  };

  // Add product to cart helper with stock sufficiency check
  const addToCart = useCallback(
    (product: StockItem, qtyToAdd: number = 1): boolean => {
      // Must have an active register shift before adding products to order
      if (!activeShift) {
        playScanSound("error");
        triggerToast("Please open a register shift before adding products to an order.", "error");
        setIsShiftModalOpen(true);
        return false;
      }

      // Validate available inventory before adding to order
      if (!allowNegativeStock) {
        const inCart = cart.find((item) => item.id === product.id);
        const currentQty = inCart ? inCart.quantity : 0;
        const targetQty = currentQty + qtyToAdd;

        if (product.quantity <= 0) {
          playScanSound("error");
          triggerToast(
            `"${product.item_name}" is out of stock (0 ${product.unit || "pcs"} available).`,
            "error"
          );
          return false;
        }

        if (targetQty > product.quantity) {
          playScanSound("error");
          triggerToast(
            `Insufficient stock for "${product.item_name}": Only ${product.quantity} ${product.unit || "pcs"} in stock (${currentQty} already in order).`,
            "error"
          );
          return false;
        }
      }

      setCart((prev) => {
        const existingIdx = prev.findIndex((item) => item.id === product.id);
        if (existingIdx >= 0) {
          return prev.map((item, idx) =>
            idx === existingIdx
              ? { ...item, quantity: item.quantity + qtyToAdd }
              : item
          );
        } else {
          return [
            ...prev,
            {
              id: product.id,
              name: product.item_name,
              sku: product.sku,
              price: product.selling_price,
              costPrice: product.cost_price,
              quantity: qtyToAdd,
              taxRate: product.tax_rate,
              brand: product.brand || null,
              category: product.category,
              unit: product.unit,
            },
          ];
        }
      });
      return true;
    },
    [allowNegativeStock, cart, activeShift]
  );

  // Update item quantity with stock sufficiency check
  const updateCartQty = (productId: number, delta: number) => {
    if (!activeShift) {
      playScanSound("error");
      triggerToast("Please open a register shift before updating an order.", "error");
      setIsShiftModalOpen(true);
      return;
    }

    if (delta > 0 && !allowNegativeStock) {
      const product = products.find((p) => p.id === productId);
      const cartItem = cart.find((i) => i.id === productId);
      if (product && cartItem) {
        const nextQty = cartItem.quantity + delta;
        if (nextQty > product.quantity) {
          playScanSound("error");
          triggerToast(
            `Insufficient stock for "${cartItem.name}": Only ${product.quantity} ${product.unit || "pcs"} available.`,
            "error"
          );
          return;
        }
      }
    }

    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.id === productId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  // Remove item from cart
  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.id !== productId));
  };

  // Clear entire cart
  const clearCart = () => {
    setCart([]);
    setDiscountPercent(0);
    setDiscountFixed(0);
    setAppliedPromotionIds([]);
    promptedOffersRef.current.clear();
    setCustomerName("Walk-in Customer");
    setCustomerPhone("");
    setCustomerId(null);
    setCompletedOrder(null);
    setIsReceiptOpen(false);
    setMobileView("catalog");
    if (typeof document !== "undefined") {
      (document.activeElement as HTMLElement)?.blur();
    }
  };

  // Start new sale (clears cart and prompts customer identification)
  const startNewSale = () => {
    clearCart();
    setMobileView("catalog");
    setIsCustomerModalOpen(true);
  };

  // Open order discount modal and initialize drafts
  const handleOpenDiscountModal = () => {
    setDraftDiscountPercent(discountPercent);
    setDraftDiscountFixed(discountFixed);
    setDraftDiscountType(discountType);
    setIsDiscountModalOpen(true);
  };

  // Apply or update special discount on specific line item
  const handleApplyItemDiscount = (
    itemId: number,
    discount: number,
    discountType: 'percent' | 'fixed',
    reason?: string
  ) => {
    if (discount <= 0) {
      setCart((prev) =>
        prev.map((it) => {
          if (it.id === itemId) {
            return {
              ...it,
              discount: undefined,
              discountType,
              discountReason: undefined,
            };
          }
          return it;
        })
      );
      setIsItemDiscountModalOpen(false);
      return;
    }

    // Cashiers require manager authorization code to apply direct item discount:
    if (isCashier) {
      const targetItem = cart.find((it) => it.id === itemId);
      setPendingItemDiscount({
        itemId,
        itemName: targetItem?.name || "Product",
        discount,
        discountType,
        reason,
      });
      setIsItemDiscountModalOpen(false);
      setIsAuthorizingItemDiscount(true);
      return;
    }

    // Managers / Admins apply directly:
    setCart((prev) =>
      prev.map((it) => {
        if (it.id === itemId) {
          return {
            ...it,
            discount: discount > 0 ? discount : undefined,
            discountType: discount > 0 ? discountType : undefined,
            discountReason: discount > 0 ? reason : undefined,
          };
        }
        return it;
      })
    );
    setIsItemDiscountModalOpen(false);
  };

  // Apply order-level direct discount
  const handleApplyOrderDiscount = (e: React.FormEvent) => {
    e.preventDefault();
    const val = draftDiscountType === "percent" ? draftDiscountPercent : draftDiscountFixed;

    // Clearing discount (0):
    if (val <= 0) {
      setDiscountPercent(0);
      setDiscountFixed(0);
      setIsDiscountModalOpen(false);
      triggerToast("Order discount removed", "success");
      return;
    }

    // Cashiers require manager authorization code to apply direct discount:
    if (isCashier) {
      setPendingOrderDiscount({
        percent: draftDiscountType === "percent" ? draftDiscountPercent : 0,
        fixed: draftDiscountType === "fixed" ? draftDiscountFixed : 0,
        type: draftDiscountType,
      });
      setIsDiscountModalOpen(false);
      setIsAuthorizingOrderDiscount(true);
      return;
    }

    // Managers / Admins apply directly:
    setDiscountType(draftDiscountType);
    if (draftDiscountType === "percent") {
      setDiscountPercent(draftDiscountPercent);
      setDiscountFixed(0);
    } else {
      setDiscountFixed(draftDiscountFixed);
      setDiscountPercent(0);
    }
    setIsDiscountModalOpen(false);
    triggerToast(
      `Order discount applied (${draftDiscountType === "percent" ? `${draftDiscountPercent}%` : `LKR ${formatLKR(draftDiscountFixed)}`})`,
      "success"
    );
  };

  // Toggle applying a promotional offer to the cart
  const handleToggleApplyPromotion = (promo: PosPromotion) => {
    // If offer is already applied, removing it does not require manager re-authorization
    if (appliedPromotionIds.includes(promo.id)) {
      setAppliedPromotionIds((prev) => prev.filter((id) => id !== promo.id));
      triggerToast(`Removed offer: "${promo.name}"`, "error");
      return;
    }

    // Check if offer requires manager approval AND current user is a cashier (not manager/owner)
    const isManagerUser = !isCashierOnly && canManageStock;
    if (promo.requires_manager_approval && !isManagerUser) {
      setAuthorizingPromo(promo);
      return;
    }

    // Apply directly if authorized
    setAppliedPromotionIds((prev) => [...prev, promo.id]);
    triggerToast(
      isManagerUser && promo.requires_manager_approval
        ? `Applied offer (Manager Verified): "${promo.name}"`
        : `Applied offer: "${promo.name}"`,
      "success"
    );
  };

  const handleManagerAuthorized = (promo: PosPromotion, managerName: string) => {
    setAppliedPromotionIds((prev) => (prev.includes(promo.id) ? prev : [...prev, promo.id]));
    triggerToast(`Offer "${promo.name}" authorized by ${managerName}`, "success");
    setAuthorizingPromo(null);

    // If checkout was waiting on manager authorization, proceed to payment
    if (pendingCheckoutAfterPromoRef.current) {
      pendingCheckoutAfterPromoRef.current = false;
      setPendingCheckoutAfterPromo(false);

      // Check if there is another qualified offer requiring manager approval
      const nextPending = qualifiedPromotions.find(
        (p) => p.id !== promo.id && p.requires_manager_approval && !appliedPromotionIds.includes(p.id)
      );
      if (nextPending) {
        pendingCheckoutAfterPromoRef.current = true;
        setPendingCheckoutAfterPromo(true);
        setAuthorizingPromo(nextPending);
        return;
      }

      // Proceed seamlessly to payment modal
      setTimeout(() => {
        setPaymentError(null);
        setIsPaymentModalOpen(true);
        setTimeout(() => tenderedInputRef.current?.focus(), 60);
      }, 100);
    }
  };

  const lastTerminalScanRef = useRef<{ code: string; time: number } | null>(null);

  // Hardware and Camera scanner integration
  const handleHardwareScan = useCallback(
    async (code: string) => {
      const cleanCode = code.trim();
      if (!cleanCode) return;

      if (!activeShift) {
        playScanSound("error");
        triggerToast("Please open a register shift before scanning items.", "error");
        setIsShiftModalOpen(true);
        return;
      }

      const now = Date.now();
      // Strict debounce: suppress identical code within 2500ms, and minimum 1000ms between ANY scans
      if (
        lastTerminalScanRef.current &&
        lastTerminalScanRef.current.code.toLowerCase() === cleanCode.toLowerCase() &&
        now - lastTerminalScanRef.current.time < 2500
      ) {
        return;
      }
      if (lastTerminalScanRef.current && now - lastTerminalScanRef.current.time < 1000) {
        return;
      }
      lastTerminalScanRef.current = { code: cleanCode, time: now };

      // Immediately clear search term and input to prevent double-firing from search input Enter
      setSearchTerm("");
      if (searchInputRef.current) {
        searchInputRef.current.value = "";
      }
      setHighlightedIndex(0);

      // Find in local products first for instant response
      const localMatch = products.find(
        (p) =>
          p.sku.toLowerCase() === cleanCode.toLowerCase() ||
          (p.barcode && p.barcode.toLowerCase() === cleanCode.toLowerCase())
      );

      if (localMatch) {
        const added = addToCart(localMatch, 1);
        if (added) {
          playScanSound("success");
          triggerToast(`Scanned: ${localMatch.item_name} (+1)`, "success");
        }
        return;
      }

      // If not in local memory, check server database
      try {
        const res = await findProductByBarcodeAction(cleanCode);
        if (res.success && res.item) {
          const added = addToCart(res.item, 1);
          if (added) {
            playScanSound("success");
            triggerToast(`Scanned: ${res.item.item_name} (+1)`, "success");
          }
        } else {
          playScanSound("error");
          triggerToast(`Barcode not found: "${cleanCode}"`, "error");
        }
      } catch {
        playScanSound("error");
        triggerToast(`Barcode scan failed for "${cleanCode}"`, "error");
      }
    },
    [products, addToCart, activeShift]
  );

  const isAnyModalOpen =
    isCameraOpen ||
    isStockModalOpen ||
    isHistoryModalOpen ||
    isSettingsModalOpen ||
    isPaymentModalOpen ||
    isCustomerModalOpen ||
    isSpecialOffersModalOpen ||
    isItemDiscountModalOpen ||
    Boolean(authorizingPromo) ||
    isAuthorizingOrderDiscount ||
    isAuthorizingItemDiscount ||
    isShiftModalOpen ||
    isReceiptOpen ||
    isShortcutsHelpOpen ||
    isMobileMenuOpen;

  // Attach hardware barcode listener only when terminal is active without background modals
  useHardwareBarcodeScanner({
    onScan: handleHardwareScan,
    enabled: !isAnyModalOpen,
  });

  // Calculate cart financials
  const subtotal = useMemo(() => {
    return cart.reduce((acc, it) => acc + it.price * it.quantity, 0);
  }, [cart]);

  // Line Item Discounts
  const itemDiscounts = useMemo(() => {
    return cart.reduce((acc, it) => {
      if (!it.discount || it.discount <= 0) return acc;
      const lineSubtotal = it.price * it.quantity;
      const disc =
        it.discountType === 'fixed'
          ? Math.min(lineSubtotal, it.discount * it.quantity)
          : (lineSubtotal * it.discount) / 100;
      return acc + disc;
    }, 0);
  }, [cart]);

  // Promotional Special Offers (Brand offers, Cross-item bundle offers, etc.)
  const promotionalDiscount = useMemo(() => {
    let promoTotal = 0;
    for (const promoId of appliedPromotionIds) {
      const promo = promotions.find((p) => p.id === promoId && p.active);
      if (!promo) continue;

      if (promo.type === 'brand' && promo.brand) {
        const bLower = promo.brand.toLowerCase();
        const brandItems = cart.filter(
          (it) =>
            (it.brand && it.brand.toLowerCase() === bLower) ||
            (it.category && it.category.toLowerCase() === bLower)
        );
        for (const it of brandItems) {
          const lineTotal = it.price * it.quantity;
          promoTotal +=
            promo.discount_type === 'percent'
              ? (lineTotal * promo.discount_value) / 100
              : Math.min(lineTotal, promo.discount_value * it.quantity);
        }
      } else if (promo.type === 'bundle' && promo.trigger_item_id && promo.target_item_id) {
        const hasTrigger = cart.some((it) => it.id === promo.trigger_item_id);
        const targetItem = cart.find((it) => it.id === promo.target_item_id);
        if (hasTrigger && targetItem) {
          const targetTotal = targetItem.price * targetItem.quantity;
          promoTotal +=
            promo.discount_type === 'percent'
              ? (targetTotal * promo.discount_value) / 100
              : Math.min(targetTotal, promo.discount_value * targetItem.quantity);
        }
      } else if (promo.type === 'item' && promo.target_item_id) {
        const targetItem = cart.find((it) => it.id === promo.target_item_id);
        if (targetItem) {
          const targetTotal = targetItem.price * targetItem.quantity;
          promoTotal +=
            promo.discount_type === 'percent'
              ? (targetTotal * promo.discount_value) / 100
              : Math.min(targetTotal, promo.discount_value * targetItem.quantity);
        }
      } else if (promo.type === 'cart') {
        if (subtotal >= (promo.min_cart_total || 0)) {
          promoTotal +=
            promo.discount_type === 'percent'
              ? (subtotal * promo.discount_value) / 100
              : Math.min(subtotal, promo.discount_value);
        }
      }
    }
    return promoTotal;
  }, [appliedPromotionIds, promotions, cart, subtotal]);

  // Cart-level General Discount
  const generalDiscount = useMemo(() => {
    if (discountType === "percent") {
      return (subtotal * discountPercent) / 100;
    }
    return Math.min(subtotal, discountFixed);
  }, [subtotal, discountPercent, discountFixed, discountType]);

  // Combined Total Discount
  const discountAmount = useMemo(() => {
    return Math.min(subtotal, itemDiscounts + promotionalDiscount + generalDiscount);
  }, [subtotal, itemDiscounts, promotionalDiscount, generalDiscount]);

  // Qualified Active Promotions for Current Cart
  const qualifiedPromotions = useMemo(() => {
    if (cart.length === 0) return [];
    return promotions.filter((promo) => {
      if (!promo.active) return false;
      if (promo.type === 'brand' && promo.brand) {
        const bLower = promo.brand.toLowerCase();
        return cart.some(
          (it) =>
            (it.brand && it.brand.toLowerCase() === bLower) ||
            (it.category && it.category.toLowerCase() === bLower)
        );
      }
      if (promo.type === 'bundle' && promo.trigger_item_id && promo.target_item_id) {
        return (
          cart.some((it) => it.id === promo.trigger_item_id) &&
          cart.some((it) => it.id === promo.target_item_id)
        );
      }
      if (promo.type === 'item' && promo.target_item_id) {
        return cart.some((it) => it.id === promo.target_item_id);
      }
      if (promo.type === 'cart') {
        return subtotal >= (promo.min_cart_total || 0);
      }
      return false;
    });
  }, [cart, promotions, subtotal]);

  // Auto-apply qualified promotions that don't require manager approval (or if user is a manager)
  useEffect(() => {
    if (cart.length === 0) {
      if (appliedPromotionIds.length > 0) {
        setAppliedPromotionIds([]);
      }
      return;
    }

    const isManagerUser = !isCashierOnly && canManageStock;
    const qualifiedIds = new Set(qualifiedPromotions.map((p) => p.id));

    // Keep applied promotions that are still qualified
    const stillQualifiedApplied = appliedPromotionIds.filter((id) => qualifiedIds.has(id));

    // Automatically apply all qualified promotions that do not require manager approval,
    // or all qualified promotions if current user is a manager/admin:
    const toAutoApply = qualifiedPromotions
      .filter((p) => !p.requires_manager_approval || isManagerUser)
      .map((p) => p.id);

    const merged = Array.from(new Set([...stillQualifiedApplied, ...toAutoApply]));

    const hasChanged =
      merged.length !== appliedPromotionIds.length ||
      merged.some((id) => !appliedPromotionIds.includes(id));

    if (hasChanged) {
      setAppliedPromotionIds(merged);
    }
  }, [qualifiedPromotions, isCashierOnly, canManageStock, appliedPromotionIds, cart.length]);

  const pendingManagerOffers = useMemo(() => {
    const isManagerUser = !isCashierOnly && canManageStock;
    if (isManagerUser) return [];
    return qualifiedPromotions.filter(
      (p) => p.requires_manager_approval && !appliedPromotionIds.includes(p.id)
    );
  }, [isCashierOnly, canManageStock, qualifiedPromotions, appliedPromotionIds]);

  const taxAmount = useMemo(() => {
    return cart.reduce((acc, it) => {
      const lineTotal = it.price * it.quantity;
      return acc + (lineTotal * (it.taxRate || 0)) / 100;
    }, 0);
  }, [cart]);

  const totalAmount = useMemo(() => {
    return Math.max(0, subtotal - discountAmount + taxAmount);
  }, [subtotal, discountAmount, taxAmount]);

  // Sync tendered cash default when payment modal opens
  useEffect(() => {
    if (isPaymentModalOpen) {
      setTenderedCash(totalAmount.toString());
    }
  }, [isPaymentModalOpen]);

  // Quick cash calculations
  const parsedTendered = parseFloat(tenderedCash) || 0;
  const changeDue = Math.max(0, parsedTendered - totalAmount);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        !searchTerm ||
        p.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCat =
        selectedCategory === "All" || p.category === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [products, searchTerm, selectedCategory]);

  // Unique categories (deduplicated & decoded, always keep "All" at 1st position)
  const categories = useMemo(() => {
    const seen = new Set<string>();
    seen.add("all");
    const unique: string[] = [];
    for (const p of products) {
      const raw = (p.category || "General").trim();
      const decoded = raw
        .replace(/&amp;/g, "&")
        .replace(/&#038;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#039;|&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ")
        .trim();
      const lower = decoded.toLowerCase();
      if (decoded && lower !== "all" && !seen.has(lower)) {
        seen.add(lower);
        unique.push(decoded);
      }
    }
    return ["All", ...unique];
  }, [products]);

  // Open Payment Modal with pre-flight inventory sufficiency validation
  const handleOpenPaymentModal = () => {
    if (!activeShift) {
      playScanSound("error");
      triggerToast("Please open a register shift before checking out.", "error");
      setIsShiftModalOpen(true);
      return;
    }

    if (cart.length === 0) return;

    if (!allowNegativeStock) {
      const overStockItem = cart.find((item) => {
        const p = products.find((prod) => prod.id === item.id);
        return p && item.quantity > p.quantity;
      });

      if (overStockItem) {
        const p = products.find((prod) => prod.id === overStockItem.id);
        const avail = p ? p.quantity : 0;
        playScanSound("error");
        triggerToast(
          `Cannot checkout: "${overStockItem.name}" exceeds stock (${avail} available, ${overStockItem.quantity} in order). Please adjust quantity.`,
          "error"
        );
        return;
      }
    }

    // Check if there are qualified promotional offers requiring manager approval that haven't been authorized yet
    const isManagerUser = !isCashierOnly && canManageStock;
    if (!isManagerUser) {
      const pendingApprovalOffer = qualifiedPromotions.find(
        (p) => p.requires_manager_approval && !appliedPromotionIds.includes(p.id)
      );
      if (pendingApprovalOffer) {
        pendingCheckoutAfterPromoRef.current = true;
        setPendingCheckoutAfterPromo(true);
        setAuthorizingPromo(pendingApprovalOffer);
        return;
      }
    }

    setPaymentError(null);
    setIsPaymentModalOpen(true);
    setTimeout(() => tenderedInputRef.current?.focus(), 60);
  };

  // Handle Checkout Execution
  const handleExecuteCheckout = async () => {
    if (!activeShift) {
      playScanSound("error");
      setPaymentError("Cannot process checkout: No active register shift is open.");
      triggerToast("Please open a register shift before processing payment.", "error");
      setIsShiftModalOpen(true);
      return;
    }

    if (cart.length === 0) return;
    setPaymentError(null);

    // Pre-flight stock check before processing payment
    if (!allowNegativeStock) {
      const overStockItem = cart.find((item) => {
        const p = products.find((prod) => prod.id === item.id);
        return p && item.quantity > p.quantity;
      });

      if (overStockItem) {
        const p = products.find((prod) => prod.id === overStockItem.id);
        const avail = p ? p.quantity : 0;
        const msg = `Insufficient stock for "${overStockItem.name}". In stock: ${avail}, requested: ${overStockItem.quantity}. Please adjust your order.`;
        playScanSound("error");
        setPaymentError(msg);
        triggerToast(msg, "error");
        return;
      }
    }

    if (paymentMethod === "Cash" && parsedTendered < totalAmount) {
      const msg = "Tendered cash is less than the total amount due.";
      setPaymentError(msg);
      triggerToast(msg, "error");
      playScanSound("error");
      return;
    }

    setCheckingOut(true);

    try {
      const payload: CheckoutPayload = {
        items: cart,
        customerName,
        customerPhone: customerPhone || undefined,
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
        paymentMethod,
        amountTendered: paymentMethod === "Cash" ? parsedTendered : totalAmount,
        changeReturned: paymentMethod === "Cash" ? changeDue : 0,
      };

      const res = await checkoutPosOrderAction(payload, activeShift?.id || null);

      if (res.success && res.order) {
        playScanSound("success");
        setCompletedOrder({
          ...res.order,
          customer_name: customerName,
          customer_phone: customerPhone,
          items: cart,
          order_number: res.orderNumber,
          invoice_id: res.invoiceId,
        });
        setIsPaymentModalOpen(false);
        setIsReceiptOpen(true);
        clearCart();
        // Refresh product inventory quantities and broadcast to Stock page
        fetchProducts();
        import("@/lib/pos/product-sync-events").then(m => m.broadcastStockUpdated({
          source: 'pos_checkout',
          orderNumber: res.orderNumber,
          items: (res as any).updatedStockItems,
        })).catch(() => {});
      } else {
        playScanSound("error");
        const errMsg = res.error || "Failed to complete checkout.";
        setPaymentError(errMsg);
        triggerToast(errMsg, "error");
      }
    } catch (e: any) {
      playScanSound("error");
      const errMsg = e.message || "An error occurred during checkout.";
      setPaymentError(errMsg);
      triggerToast(errMsg, "error");
    } finally {
      setCheckingOut(false);
    }
  };

  // Open Cash Drawer (Hardware kick-out command preparation + chime)
  const handleOpenCashDrawer = useCallback(() => {
    playScanSound("drawer");
    triggerToast("Cash drawer opened", "success");

    // Standard ESC/POS kick-out drawer pulse command preparation
    // Pin 2: 0x1B, 0x70, 0x00, 0x19, 0xFA
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("pos:cash-drawer-open", {
          detail: {
            timestamp: Date.now(),
            command: [0x1b, 0x70, 0x00, 0x19, 0xfa],
          },
        })
      );
    }
  }, []);

  // Print Test Bill for Thermal Printer & New Paper Roll Calibration
  const handlePrintTestBill = useCallback(() => {
    triggerToast("Printing thermal test slip & paper alignment...", "success");

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print test bill.");
      return;
    }

    const testBarcodeSvg = generateBarcodeSvg("TEST-ROLL-80MM", { height: 32, barWidth: 1.4 });
    const nowStr = new Date().toLocaleString();

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Printer Alignment & Test Slip</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 4mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              width: 72mm;
              margin: 0 auto;
              padding: 6px;
              color: #000;
              font-size: 11px;
              line-height: 1.35;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .solid-divider { border-top: 1px solid #000; margin: 8px 0; }
            .box { border: 1px solid #000; padding: 4px; margin: 6px 0; text-align: center; }
            .barcode-wrap { text-align: center; margin: 8px 0; }
            .barcode-wrap svg { max-width: 100%; height: auto; }
            .grid { display: flex; justify-content: space-between; font-size: 10px; }
            .feed-lines { border-left: 1px dotted #888; border-right: 1px dotted #888; height: 16px; margin: 4px 0; }
          </style>
        </head>
        <body>
          <div class="center">
            <div style="font-size: 15px; font-weight: bold; letter-spacing: -0.5px;">${tenantName}</div>
            <div style="font-size: 11px; font-weight: bold; margin-top: 2px;">THERMAL PRINTER TEST SLIP</div>
            <div style="font-size: 9px; color: #444; margin-top: 2px;">NEW PAPER ROLL & PRINTER CONFIG</div>
          </div>

          <div class="solid-divider"></div>

          <div class="grid">
            <span>Date & Time:</span>
            <span class="bold">${nowStr}</span>
          </div>
          <div class="grid">
            <span>Roll Width:</span>
            <span class="bold">80mm / 3.15" (Print: 72mm)</span>
          </div>
          <div class="grid">
            <span>Cashier:</span>
            <span>${userName} (${userRole})</span>
          </div>
          <div class="grid">
            <span>Drawer Status:</span>
            <span class="bold">PIN 2 ESC/POS READY</span>
          </div>

          <div class="divider"></div>

          <div class="center bold" style="font-size: 10px; margin-bottom: 4px;">
            [ PAPER ALIGNMENT MARGINS ]
          </div>
          <div class="feed-lines">
            <div style="font-size: 8px; text-align: center; line-height: 16px; color: #666;">
              |&larr; &mdash;&mdash;&mdash;&mdash;&mdash;&mdash; 72mm Printable Area &mdash;&mdash;&mdash;&mdash;&mdash;&mdash; &rarr;|
            </div>
          </div>

          <div class="box">
            <div style="font-size: 10px; font-weight: bold;">DENSITY & FONT STYLES</div>
            <div style="font-size: 9px; margin-top: 2px;">Regular Font 9pt &bull; <b>Bold Font 9pt</b></div>
            <div style="font-size: 12px; font-weight: bold; margin-top: 2px;">LARGE HEADER 12PT BOLD</div>
          </div>

          <div class="center bold" style="font-size: 10px; margin-top: 6px;">
            BARCODE SCANNER TEST
          </div>
          <div class="barcode-wrap">
            ${testBarcodeSvg}
            <div style="font-size: 9px; margin-top: 2px;">* TEST-ROLL-80MM *</div>
          </div>

          <div class="divider"></div>

          <div class="center" style="font-size: 9px; line-height: 1.4;">
            <div class="bold" style="font-size: 10px; color: #000;">FEED & ALIGNMENT OK</div>
            <div>Tear paper here after test or inspect auto-cutter.</div>
            <div style="font-size: 8px; color: #555; margin-top: 4px; text-transform: uppercase;">
              Framebooks POS Hardware Diagnostics
            </div>
          </div>

          <div style="height: 25px;"></div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [tenantName, userName, userRole]);

  // Global Keyboard Navigation for High-Speed Cashier Operations
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isInputActive =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        document.activeElement instanceof HTMLSelectElement;

      // Handle Escape: close open modal or unfocus active input
      if (e.key === "Escape") {
        if (isMobileMenuOpen) {
          setIsMobileMenuOpen(false);
          return;
        }
        if (isShortcutsHelpOpen) {
          setIsShortcutsHelpOpen(false);
          return;
        }
        if (isCustomerModalOpen) {
          setIsCustomerModalOpen(false);
          return;
        }
        if (isSpecialOffersModalOpen) {
          setIsSpecialOffersModalOpen(false);
          return;
        }
        if (isItemDiscountModalOpen) {
          setIsItemDiscountModalOpen(false);
          return;
        }
        if (isCameraOpen) {
          setIsCameraOpen(false);
          return;
        }
        if (isPaymentModalOpen) {
          setIsPaymentModalOpen(false);
          return;
        }
        if (isReceiptOpen) {
          setIsReceiptOpen(false);
          clearCart();
          return;
        }
        if (isDiscountModalOpen) {
          setIsDiscountModalOpen(false);
          return;
        }
        if (isHistoryModalOpen) {
          setIsHistoryModalOpen(false);
          return;
        }
        if (isStockModalOpen) {
          setIsStockModalOpen(false);
          return;
        }
        if (isShiftModalOpen && activeShift) {
          setIsShiftModalOpen(false);
          return;
        }
        if (isAuthorizingOrderDiscount) {
          setIsAuthorizingOrderDiscount(false);
          setPendingOrderDiscount(null);
          return;
        }
        if (isAuthorizingItemDiscount) {
          setIsAuthorizingItemDiscount(false);
          setPendingItemDiscount(null);
          return;
        }
        if (isSettingsModalOpen) {
          setIsSettingsModalOpen(false);
          return;
        }
        if (isInputActive) {
          (document.activeElement as HTMLElement).blur();
          return;
        }
      }

      // If Payment Checkout Modal is open:
      if (isPaymentModalOpen) {
        if (e.key === "1") {
          e.preventDefault();
          setPaymentMethod("Cash");
          setTimeout(() => tenderedInputRef.current?.focus(), 50);
          return;
        }
        if (e.key === "2") {
          e.preventDefault();
          setPaymentMethod("Card");
          return;
        }
        if (e.key === "3") {
          e.preventDefault();
          setPaymentMethod("Bank Transfer");
          return;
        }
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleExecuteCheckout();
          return;
        }
        return;
      }

      // If any other modal is open, avoid triggering background shortcuts
      if (
        isCameraOpen ||
        isReceiptOpen ||
        isDiscountModalOpen ||
        isHistoryModalOpen ||
        isStockModalOpen ||
        isShiftModalOpen ||
        isSettingsModalOpen ||
        isShortcutsHelpOpen ||
        isCustomerModalOpen ||
        isSpecialOffersModalOpen ||
        isItemDiscountModalOpen
      ) {
        return;
      }

      // If product search input is focused:
      if (document.activeElement === searchInputRef.current) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setHighlightedIndex((prev) => Math.min(filteredProducts.length - 1, prev + 1));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setHighlightedIndex((prev) => Math.max(0, prev - 1));
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          const now = Date.now();
          // Suppress duplicate item addition if a scan occurred within the last 1500ms
          if (
            lastTerminalScanRef.current &&
            now - lastTerminalScanRef.current.time < 1500
          ) {
            setSearchTerm("");
            setHighlightedIndex(0);
            return;
          }

          // If user typed a search query, add the matched product
          if (searchTerm.trim().length > 0 && filteredProducts.length > 0) {
            if (!activeShift) {
              playScanSound("error");
              triggerToast("Please open a register shift before adding products.", "error");
              setIsShiftModalOpen(true);
              return;
            }
            const prod = filteredProducts[highlightedIndex] || filteredProducts[0];
            const added = addToCart(prod, 1);
            if (added) {
              playScanSound("success");
              triggerToast(`Added: ${prod.item_name} (+1)`, "success");
              setSearchTerm("");
              setHighlightedIndex(0);
            }
            return;
          }

          // If search bar is empty and cart is empty: Enter prints test bill!
          if (cart.length === 0 && searchTerm.trim() === "") {
            handlePrintTestBill();
            return;
          }

          return;
        }

        // If search bar is empty and cart is empty: Space key opens cash drawer!
        if (e.key === " " && cart.length === 0 && searchTerm.trim() === "") {
          e.preventDefault();
          handleOpenCashDrawer();
          return;
        }

        return;
      }

      // If any other input/textarea is currently focused, allow normal typing
      if (isInputActive) {
        return;
      }

      // --- Main Terminal Hotkeys ---

      // Empty Screen Special Shortcuts:
      // When on the main screen with empty cart (cart.length === 0):
      // 1. Enter prints test bill (paper roll calibration)
      // 2. Space opens cash drawer
      if (cart.length === 0) {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          (document.activeElement as HTMLElement)?.blur();
          handlePrintTestBill();
          return;
        }
        if (e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          (document.activeElement as HTMLElement)?.blur();
          handleOpenCashDrawer();
          return;
        }
      }

      // F1 or /: Focus Product Search
      if (e.key === "F1" || e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // F2 or C: Open Continuous Camera Scanner
      if (e.key === "F2" || e.key.toLowerCase() === "c") {
        e.preventDefault();
        setIsCameraOpen(true);
        return;
      }

      // F3 or U: Select or Edit Customer Details
      if (e.key === "F3" || e.key.toLowerCase() === "u") {
        e.preventDefault();
        setIsCustomerModalOpen(true);
        return;
      }

      // F4 or D: Open Order Discount Modal
      if ((e.key === "F4" || e.key.toLowerCase() === "d") && canDiscount) {
        e.preventDefault();
        handleOpenDiscountModal();
        return;
      }

      // F5: Open Cash Drawer
      if (e.key === "F5" && !e.shiftKey) {
        e.preventDefault();
        handleOpenCashDrawer();
        return;
      }

      // Shift+F5 or Alt+P: Print Test Bill (Config new paper roll)
      if ((e.key === "F5" && e.shiftKey) || (e.altKey && e.key.toLowerCase() === "p")) {
        e.preventDefault();
        handlePrintTestBill();
        return;
      }

      // F6 or O: Open Special Offers & Promotions
      if (e.key === "F6" || e.key.toLowerCase() === "o") {
        e.preventDefault();
        setIsSpecialOffersModalOpen(true);
        return;
      }

      // F7: Start New Sale (Clear Cart & Prompt Customer)
      if (e.key === "F7" || (e.ctrlKey && e.key === "Backspace")) {
        e.preventDefault();
        startNewSale();
        triggerToast("Started new sale", "success");
        return;
      }

      // F8 or H: Open Sales History
      if (e.key === "F8" || e.key.toLowerCase() === "h") {
        e.preventDefault();
        setIsHistoryModalOpen(true);
        return;
      }

      // F9 or S: Open Stock Management
      if ((e.key === "F9" || e.key.toLowerCase() === "s") && canManageStock) {
        e.preventDefault();
        setIsStockModalOpen(true);
        return;
      }

      // F10: Open Shift Modal
      if (e.key === "F10") {
        e.preventDefault();
        setIsShiftModalOpen(true);
        return;
      }

      // ? or F11: Open Shortcuts Cheat Sheet
      if (e.key === "?" || e.key === "F11") {
        e.preventDefault();
        setIsShortcutsHelpOpen(true);
        return;
      }

      // F12 or Space or Ctrl+Enter: Pay / Charge (when cart has items)
      if (e.key === "F12" || (e.key === " " && cart.length > 0) || (e.ctrlKey && e.key === "Enter")) {
        e.preventDefault();
        if (cart.length > 0) {
          setTenderedCash(totalAmount.toString());
          handleOpenPaymentModal();
        }
        return;
      }

      // + or =: Increase qty of last item in cart
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        if (cart.length > 0) {
          const lastItem = cart[cart.length - 1];
          updateCartQty(lastItem.id, 1);
        }
        return;
      }

      // - or _: Decrease qty of last item in cart
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        if (cart.length > 0) {
          const lastItem = cart[cart.length - 1];
          updateCartQty(lastItem.id, -1);
        }
        return;
      }

      // Backspace or Delete: Remove last item from cart
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        if (cart.length > 0) {
          const lastItem = cart[cart.length - 1];
          removeFromCart(lastItem.id);
          triggerToast(`Removed: ${lastItem.name}`, "error");
        }
        return;
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [
    isShortcutsHelpOpen,
    isCameraOpen,
    isPaymentModalOpen,
    isReceiptOpen,
    isDiscountModalOpen,
    isHistoryModalOpen,
    isStockModalOpen,
    isShiftModalOpen,
    isSettingsModalOpen,
    cart,
    searchTerm,
    totalAmount,
    filteredProducts,
    highlightedIndex,
    canDiscount,
    canManageStock,
    activeShift,
    handleOpenCashDrawer,
    handlePrintTestBill,
  ]);

  const formatLKR = (amount: number) => {
    return new Intl.NumberFormat("en-LK", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  return (
    <div className="flex flex-col h-screen h-[100dvh] w-screen overflow-hidden bg-background text-foreground">
      {/* Top POS Header Bar */}
      <header className="h-14 sm:h-16 px-3 sm:px-4 bg-card border-b border-border flex items-center justify-between shrink-0 select-none z-20">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <TenantLogo
              logoUrl={tenantLogoUrl}
              name={tenantName}
              size={36}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain p-0.5 bg-black/5 dark:bg-white/5 border border-brand-500/30 shadow-2xs shrink-0"
              fallbackClassName="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-500 shadow-2xs shrink-0"
              iconClassName="w-5 h-5 text-brand-500"
            />
            <div className="min-w-0">
              <span className="font-black text-xs sm:text-sm tracking-tight text-foreground uppercase truncate block max-w-[90px] xs:max-w-[130px] sm:max-w-[180px] md:max-w-xs">{tenantName}</span>
            </div>
          </div>

          <div className="hidden md:block w-px h-6 bg-border mx-1" />

          {/* Shift status button */}
          <button
            onClick={() => setIsShiftModalOpen(true)}
            className={`flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border text-[11px] sm:text-xs font-semibold transition-all shrink-0 cursor-pointer ${
              activeShift
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                : "bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">{activeShift ? `Shift #${activeShift.shift_number || activeShift.id} Active` : "Open Shift"}</span>
            <span className="xs:hidden">{activeShift ? `#${activeShift.shift_number || activeShift.id}` : "Shift"}</span>
          </button>
        </div>

        {/* Center / Right Header Navigation */}
        {/* Desktop View Header Actions */}
        <div className="hidden md:flex items-center gap-2">
          {/* Keyboard Shortcuts Guide */}
          <button
            onClick={() => setIsShortcutsHelpOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-border text-xs font-bold text-gray-400 hover:text-foreground transition-all cursor-pointer shadow-2xs"
            title="Keyboard Shortcuts Guide (?)"
          >
            <Keyboard className="w-4 h-4 text-brand-500" />
            <span className="hidden xl:inline text-[11px] font-semibold text-gray-400">Keys</span>
            <kbd className="hidden sm:inline text-[10px] bg-black/10 dark:bg-white/10 px-1 py-0.2 rounded font-sans font-bold">?</kbd>
          </button>

          {/* Open Cash Drawer Button */}
          <button
            onClick={handleOpenCashDrawer}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-border text-xs font-bold text-foreground transition-all cursor-pointer shadow-2xs"
            title="Open Cash Drawer (Space)"
          >
            <Vault className="w-4 h-4 text-brand-500" />
            <span className="hidden sm:inline">Drawer</span>
            <kbd className="hidden sm:inline text-[10px] bg-black/10 dark:bg-white/10 text-gray-400 px-1 py-0.2 rounded font-sans font-semibold">Space</kbd>
          </button>

          {/* Print Test Bill (Paper Roll Configuration) Button */}
          <button
            onClick={handlePrintTestBill}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-border text-xs font-bold text-foreground transition-all cursor-pointer shadow-2xs"
            title="Print Test Bill for Calibration (Enter on empty screen or Shift+F5)"
          >
            <Printer className="w-4 h-4 text-brand-500" />
            <span className="hidden sm:inline">Test Bill</span>
            <kbd className="hidden sm:inline text-[10px] bg-black/10 dark:bg-white/10 text-gray-400 px-1 py-0.2 rounded font-sans font-semibold">Enter</kbd>
          </button>

          {/* Stock Section */}
          <button
            onClick={() => setIsStockModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-border text-xs font-bold text-foreground transition-all cursor-pointer shadow-2xs relative"
            title="Manage Stock & Products (F9)"
          >
            <Package className="w-4 h-4 text-brand-500" />
            <span className="hidden sm:inline">Stock</span>
            {productSyncState.isSyncing && (
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            )}
            <kbd className="hidden sm:inline text-[10px] bg-black/10 dark:bg-white/10 text-gray-400 px-1 py-0.2 rounded font-sans font-semibold">F9</kbd>
          </button>

          {/* Live Product Sync Indicator on POS */}
          {productSyncState.isSyncing && (
            <button
              type="button"
              onClick={() => setIsStockModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 text-xs font-bold transition-all shadow-2xs animate-pulse cursor-pointer hover:bg-purple-500/25"
              title={
                productSyncState.progress && productSyncState.progress.total > 0
                  ? `Syncing products from WooCommerce (${productSyncState.progress.current}/${productSyncState.progress.total} • ${productSyncState.progress.percent}%). Click to open Stock.`
                  : "Syncing products from WooCommerce... Click to open Stock."
              }
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400 shrink-0" />
              <span className="text-xs">
                {productSyncState.progress && productSyncState.progress.total > 0
                  ? `Syncing (${productSyncState.progress.current}/${productSyncState.progress.total})`
                  : "Syncing Products..."}
              </span>
            </button>
          )}

          {/* Sync Completed Toast Badge on POS */}
          {syncCompletedNotice && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition-all shadow-2xs animate-in fade-in"
              title="Products freshly synced from WooCommerce"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-xs">Synced {syncCompletedNotice.total} Products</span>
            </div>
          )}

          {/* Sales History */}
          <button
            onClick={() => setIsHistoryModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-border text-xs font-bold text-foreground transition-all cursor-pointer shadow-2xs"
            title="View Sales History & Refunds (F8)"
          >
            <History className="w-4 h-4 text-brand-500" />
            <span className="hidden sm:inline">Orders</span>
            <kbd className="hidden sm:inline text-[10px] bg-black/10 dark:bg-white/10 text-gray-400 px-1 py-0.2 rounded font-sans font-semibold">F8</kbd>
          </button>

          {/* Special Offers & Promotions */}
          <button
            onClick={() => setIsSpecialOffersModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-border text-xs font-bold text-foreground transition-all cursor-pointer shadow-2xs relative"
            title="Special Offers, Deals & Promotions (F6)"
          >
            <Sparkles className="w-4 h-4 text-brand-500" />
            <span className="hidden sm:inline">Offers</span>
            {promotions.filter(p => p.active).length > 0 && (
              <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
            )}
            <kbd className="hidden sm:inline text-[10px] bg-black/10 dark:bg-white/10 text-gray-400 px-1 py-0.2 rounded font-sans font-semibold">F6</kbd>
          </button>

          {/* POS Settings (Managers/Admins only, blocked for cashiers) */}
          {canAccessPosSettings && (
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-border text-gray-400 hover:text-foreground transition-all cursor-pointer"
              title="POS & Stock Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          <div className="w-px h-6 bg-border mx-1" />

          {/* Exit POS back to dashboard (visible ONLY if NOT cashier-only) */}
          {!isCashierOnly && (
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border hover:bg-black/5 dark:hover:bg-white/5 text-xs font-bold text-gray-300 hover:text-foreground transition-all"
              title="Return to Framebooks ERP dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden md:inline">Exit POS</span>
            </Link>
          )}

          {/* Cashier Name & Logout */}
          <div className="flex items-center gap-2 pl-1">
            <div className="hidden xl:block text-right">
              <div className="text-xs font-bold text-foreground truncate max-w-[120px]">{userName}</div>
              <div className="text-[10px] text-gray-400 capitalize">{userRole}</div>
            </div>
            <button
              onClick={() => signOut()}
              className="p-2 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile View Quick Header Actions (Drawer, Offers, Menu) */}
        <div className="flex md:hidden items-center gap-1.5">
          {/* Quick Drawer Button on Mobile */}
          <button
            onClick={handleOpenCashDrawer}
            className="p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-border text-foreground transition-all cursor-pointer shadow-2xs"
            title="Open Cash Drawer"
          >
            <Vault className="w-4 h-4 text-brand-500" />
          </button>

          {/* Quick Offers Button on Mobile */}
          <button
            onClick={() => setIsSpecialOffersModalOpen(true)}
            className="p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-border text-foreground transition-all cursor-pointer shadow-2xs relative"
            title="Special Offers & Deals"
          >
            <Sparkles className="w-4 h-4 text-brand-500" />
            {promotions.filter(p => p.active).length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
            )}
          </button>

          {/* Mobile Actions Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-border text-foreground transition-all cursor-pointer shadow-2xs"
            title="More Options & Menu"
          >
            <Menu className="w-4 h-4 text-foreground" />
          </button>
        </div>
      </header>

      {/* Mobile Segmented View Switcher Tab Bar (Products vs Current Order) */}
      <div className="lg:hidden px-3 py-2 bg-card border-b border-border flex items-center gap-2 shrink-0 z-10 select-none">
        <button
          type="button"
          onClick={() => setMobileView("catalog")}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            mobileView === "catalog"
              ? "bg-brand-500 text-brand-950 shadow-xs"
              : "bg-black/5 dark:bg-white/5 text-gray-400 hover:text-foreground"
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Products</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileView("cart")}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            mobileView === "cart"
              ? "bg-brand-500 text-brand-950 shadow-xs"
              : "bg-black/5 dark:bg-white/5 text-gray-400 hover:text-foreground"
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>Order ({cart.reduce((a, b) => a + b.quantity, 0)})</span>
          {cart.length > 0 && (
            <span className={`text-[10px] font-black ${mobileView === "cart" ? "text-brand-950 opacity-80" : "text-brand-500"}`}>
              • LKR {formatLKR(totalAmount)}
            </span>
          )}
        </button>
      </div>

      {/* Floating Scan Toast Notification */}
      {scanToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top duration-200">
          <div
            className={`px-5 py-2.5 rounded-2xl shadow-2xl border text-xs font-bold flex items-center gap-2 ${
              scanToast.type === "success"
                ? "bg-brand-500 text-brand-900 border-brand-400"
                : "bg-red-600 text-white border-red-500"
            }`}
          >
            {scanToast.type === "success" ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            <span>{scanToast.text}</span>
          </div>
        </div>
      )}

      {/* Main Terminal Grid: Products on Left, Register Cart on Right */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Product Catalog & Search (Desktop 65% width, Full width on Mobile) */}
        <div className={`${mobileView === "catalog" ? "flex" : "hidden"} lg:flex flex-1 flex-col min-w-0 border-r-0 lg:border-r border-border bg-background relative overflow-hidden`}>
          {/* Continuous Camera Barcode Scanner (Centered & Blurred over Product Section Only) */}
          <CameraScannerModal
            isOpen={isCameraOpen}
            onClose={() => setIsCameraOpen(false)}
            onDetected={handleHardwareScan}
            title="Point Camera at Barcode or QR Scanner"
            continuous={true}
            overlayMode="section"
          />

          {/* Search & Category Filter Bar */}
          <div className="p-3 sm:p-4 border-b border-border bg-card space-y-2.5 sm:space-y-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Scan or search products..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-2xl pl-10 pr-12 sm:pr-16 py-2.5 text-xs sm:text-sm text-foreground outline-none focus:border-brand-500 transition-colors"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  {searchTerm ? (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="text-gray-400 hover:text-foreground cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  ) : (
                    <kbd className="hidden sm:inline text-[10px] bg-black/10 dark:bg-white/10 text-gray-400 px-1.5 py-0.5 rounded font-sans font-semibold border border-border/50">
                      /
                    </kbd>
                  )}
                </div>
              </div>

              <button
                onClick={() => {
                  if (!activeShift) {
                    playScanSound("error");
                    triggerToast("Please open a register shift before scanning items.", "error");
                    setIsShiftModalOpen(true);
                    return;
                  }
                  setIsCameraOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-border bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-gray-400 hover:text-foreground transition-all cursor-pointer shadow-2xs shrink-0"
                title="Continuous Camera Barcode Scanner (F2)"
              >
                <Barcode className="w-5 h-5 text-brand-500" />
                <kbd className="hidden sm:inline text-[10px] bg-black/10 dark:bg-white/10 text-gray-400 px-1.5 py-0.5 rounded font-sans font-semibold border border-border/50">
                  F2
                </kbd>
              </button>
            </div>

            {/* Shift Closed Warning Banner */}
            {!activeShift && (
              <div
                onClick={() => {
                  playScanSound("beep");
                  setIsShiftModalOpen(true);
                }}
                className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-3 text-amber-500 hover:bg-amber-500/15 transition-all cursor-pointer animate-in fade-in duration-200"
              >
                <div className="flex items-center gap-2.5 text-xs font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                  <span>Register shift is closed. You must open a shift to add products or process sales.</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    playScanSound("beep");
                    setIsShiftModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold rounded-xl text-xs whitespace-nowrap transition-colors shadow-xs"
                >
                  Open Shift
                </button>
              </div>
            )}

            {/* Category tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? "bg-brand-500 text-brand-950 shadow-xs"
                      : "bg-black/5 dark:bg-white/5 text-gray-400 hover:text-foreground hover:bg-black/10 dark:hover:bg-white/10"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Cards Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {loadingProducts ? (
              <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
                Loading products catalog...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center p-6">
                <Package className="w-12 h-12 text-gray-400 mb-3 opacity-40" />
                <h4 className="text-base font-bold text-foreground">No Products Found</h4>
                <p className="text-xs text-gray-400 max-w-sm mt-1">
                  {searchTerm
                    ? `No product matches "${searchTerm}". You can scan another code or add this product to stock.`
                    : "No products in this category."}
                </p>
                {canManageStock && !isWooConnected && searchTerm && (
                  <button
                    onClick={() => setIsStockModalOpen(true)}
                    className="mt-4 px-4 py-2 bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold rounded-xl text-xs transition-colors"
                  >
                    Add Product with code "{searchTerm}"
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredProducts.map((p, idx) => {
                  const inCartItem = cart.find((c) => c.id === p.id);
                  const isOutOfStock = p.quantity <= 0;
                  const isStockExceeded = !allowNegativeStock && Boolean(inCartItem && inCartItem.quantity >= p.quantity);
                  const isHighlighted = searchTerm.length > 0 && highlightedIndex === idx;

                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        if (!activeShift) {
                          playScanSound("error");
                          triggerToast("Please open a register shift before adding products.", "error");
                          setIsShiftModalOpen(true);
                          return;
                        }
                        const added = addToCart(p, 1);
                        if (added) {
                          playScanSound("beep");
                        }
                      }}
                      className={`group relative p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all duration-150 cursor-pointer ${
                        isHighlighted
                          ? "ring-2 ring-brand-500 border-brand-500 bg-brand-500/10 shadow-md"
                          : isStockExceeded
                          ? "bg-amber-500/5 border-amber-500/40 shadow-xs"
                          : inCartItem
                          ? "bg-brand-500/10 border-brand-500/40 shadow-xs"
                          : isOutOfStock && !allowNegativeStock
                          ? "bg-black/5 dark:bg-white/5 border-border/40 opacity-60"
                          : "bg-card border-border hover:border-brand-500/40 hover:bg-black/5 dark:hover:bg-white/5 shadow-2xs"
                      }`}
                    >
                      {/* Active in cart quantity badge */}
                      {inCartItem && (
                        <div
                          className={`absolute top-2 right-2 w-6 h-6 rounded-full font-black text-xs flex items-center justify-center shadow-md animate-in zoom-in duration-100 ${
                            isStockExceeded
                              ? "bg-amber-500 text-amber-950"
                              : "bg-brand-500 text-brand-900"
                          }`}
                          title={isStockExceeded ? `Maximum stock reached (${p.quantity} ${p.unit})` : `${inCartItem.quantity} in order`}
                        >
                          {inCartItem.quantity}
                        </div>
                      )}

                      <div>
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block truncate">
                          {p.category}
                        </span>
                        <h4 className="font-bold text-foreground text-xs line-clamp-2 mt-0.5 leading-snug">
                          {p.item_name}
                        </h4>
                        <span className="text-[10px] font-semibold text-brand-600 dark:text-brand-400 block mt-1">
                          {p.sku}
                        </span>
                      </div>

                      <div className="mt-3 pt-2 border-t border-border flex items-baseline justify-between">
                        <div className="font-bold text-sm text-foreground">
                          LKR {formatLKR(p.selling_price)}
                        </div>
                        <span
                          className={`text-[10px] font-medium ${
                            isOutOfStock
                              ? "text-red-500 font-bold"
                              : isStockExceeded
                              ? "text-amber-500 font-bold"
                              : p.is_low_stock
                              ? "text-amber-500 font-semibold"
                              : "text-gray-400"
                          }`}
                        >
                          {isOutOfStock ? "Out of Stock" : `${p.quantity} ${p.unit}`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mobile Floating Order Bar (Shown in catalog view when items are in cart) */}
          {cart.length > 0 && (
            <div className="lg:hidden p-2.5 sm:p-3 bg-card/95 backdrop-blur-md border-t border-border shadow-2xl shrink-0 z-30">
              <button
                type="button"
                onClick={() => setMobileView("cart")}
                className="w-full py-3 px-4 bg-brand-500 hover:bg-brand-400 text-brand-950 font-black rounded-2xl flex items-center justify-between shadow-lg shadow-brand-500/20 active:scale-[0.99] cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-brand-600/30 text-brand-950 text-xs font-black flex items-center justify-center">
                    {cart.reduce((a, b) => a + b.quantity, 0)}
                  </div>
                  <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wide">View Order</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-black">LKR {formatLKR(totalAmount)}</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Right: Cart / Register Drawer (Desktop 35% width, Full width on Mobile) */}
        <div className={`${mobileView === "cart" ? "flex" : "hidden"} lg:flex flex-1 lg:flex-none w-full lg:w-96 xl:w-[420px] bg-card flex-col shrink-0 select-none shadow-xl border-l-0 lg:border-l border-border overflow-hidden`}>
          {/* Mobile Top Return Bar */}
          <div className="lg:hidden px-3.5 py-2.5 border-b border-border bg-black/5 dark:bg-white/5 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={() => setMobileView("catalog")}
              className="flex items-center gap-1.5 text-xs font-bold text-foreground hover:text-brand-500 py-1 px-2.5 rounded-xl bg-card border border-border cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Add More Products</span>
            </button>
            <div className="text-xs font-bold text-brand-500">
              {cart.reduce((a, b) => a + b.quantity, 0)} items in order
            </div>
          </div>

          {/* Cart Header */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-brand-500" />
              <h3 className="font-bold text-sm text-foreground">Current Order</h3>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-400">
                {cart.reduce((a, b) => a + b.quantity, 0)}
              </span>
            </div>

            {cart.length > 0 && (
              <button
                onClick={startNewSale}
                className="text-xs text-red-500 hover:text-red-400 font-semibold flex items-center gap-1.5 cursor-pointer"
                title="Start new sale (F7)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>New Sale</span>
                <kbd className="text-[10px] bg-red-500/10 text-red-400 px-1 py-0.2 rounded font-sans font-semibold">F7</kbd>
              </button>
            )}
          </div>

          {/* Customer Selection Bar */}
          <div className="px-4 py-2.5 border-b border-border bg-black/5 dark:bg-white/5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 bg-brand-500/10 text-brand-500 rounded-lg shrink-0">
                <UserCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-foreground truncate">{customerName}</span>
                  {customerPhone && (
                    <span className="text-[10px] text-gray-400 font-medium shrink-0">({customerPhone})</span>
                  )}
                </div>
                <div className="text-[10px] text-gray-400">
                  {customerName === "Walk-in Customer" ? "Walk-in Customer" : "Registered Client"}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCustomerModalOpen(true)}
              className="px-2.5 py-1 bg-card border border-border hover:border-brand-500/50 hover:bg-brand-500/10 text-xs font-bold text-foreground hover:text-brand-500 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Assign or edit customer details (F3)"
            >
              <UserPlus className="w-3.5 h-3.5 text-brand-500" />
              <span>{customerName === "Walk-in Customer" ? "Assign Client" : "Change"}</span>
              <kbd className="text-[9px] bg-black/10 dark:bg-white/10 px-1 py-0.2 rounded font-sans font-bold text-gray-400">F3</kbd>
            </button>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 p-6">
                <ShoppingCart className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-xs font-semibold">Your cart is empty.</p>
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(true)}
                  className="mt-3 px-3 py-1.5 rounded-xl border border-border hover:bg-black/5 dark:hover:bg-white/5 text-xs font-bold text-foreground flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5 text-brand-500" />
                  <span>Start Sale with Customer [F3]</span>
                </button>
              </div>
            ) : (
              cart.map((item) => {
                const lineSubtotal = item.price * item.quantity;
                const lineDisc = item.discount
                  ? item.discountType === 'fixed'
                    ? Math.min(lineSubtotal, item.discount * item.quantity)
                    : (lineSubtotal * item.discount) / 100
                  : 0;

                return (
                  <div
                    key={item.id}
                    className="p-3 bg-black/5 dark:bg-white/5 border border-border rounded-2xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <h5 className="font-bold text-foreground truncate">{item.name}</h5>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <div className="text-[11px] text-gray-400 font-medium">
                          LKR {formatLKR(item.price)} × {item.quantity} ={" "}
                          <span className={`font-bold ${lineDisc > 0 ? "line-through text-gray-500" : "text-foreground"}`}>
                            LKR {formatLKR(lineSubtotal)}
                          </span>
                          {lineDisc > 0 && (
                            <span className="ml-1.5 font-bold text-emerald-500">
                              LKR {formatLKR(lineSubtotal - lineDisc)}
                            </span>
                          )}
                        </div>

                        {/* Special Item Discount Tag Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setDiscountingItem(item);
                            setIsItemDiscountModalOpen(true);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors flex items-center gap-1 cursor-pointer ${
                            lineDisc > 0
                              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                              : "border-border/60 text-gray-400 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                          }`}
                          title="Apply special discount to this item"
                        >
                          <Tag className="w-2.5 h-2.5" />
                          <span>{item.discount ? `-${item.discount}${item.discountType === 'fixed' ? ' LKR' : '%'}` : "Discount"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1">
                      <button
                        onClick={() => updateCartQty(item.id, -1)}
                        className="p-1 text-gray-400 hover:text-foreground rounded-lg transition-colors cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-bold w-6 text-center text-xs">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateCartQty(item.id, 1)}
                        className="p-1 text-gray-400 hover:text-foreground rounded-lg transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Cart Summary & Action Area */}
          <div className="p-4 border-t border-border bg-card space-y-3">
            {/* Active Promotional Deals Banner */}
            {(qualifiedPromotions.length > 0 || appliedPromotionIds.length > 0) && (
              <div className="p-2.5 bg-brand-500/10 border border-brand-500/30 rounded-2xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-bold text-foreground truncate">
                  <Sparkles className="w-3.5 h-3.5 text-brand-500 shrink-0 animate-pulse" />
                  <span className="truncate">
                    {appliedPromotionIds.length > 0
                      ? pendingManagerOffers.length > 0
                        ? `Offers Applied (-LKR ${formatLKR(promotionalDiscount)}) • ${pendingManagerOffers.length} Pending Approval`
                        : `Offers Applied (-LKR ${formatLKR(promotionalDiscount)})`
                      : pendingManagerOffers.length > 0
                      ? `${pendingManagerOffers.length} Special Offer(s) (Manager Approval on Checkout)`
                      : `${qualifiedPromotions.length} Special Offer(s) Available`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSpecialOffersModalOpen(true)}
                  className="text-xs font-bold text-brand-500 hover:underline cursor-pointer shrink-0 pl-2"
                >
                  Offers [F6]
                </button>
              </div>
            )}

            <div className="space-y-1.5 text-xs text-gray-400">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-foreground">LKR {formatLKR(subtotal)}</span>
              </div>

              {/* Combined Discounts Line */}
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={handleOpenDiscountModal}
                  className="text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1.5 text-xs cursor-pointer"
                  title="Apply General Order Discount (F4)"
                >
                  <Percent className="w-3 h-3" />
                  <span>
                    Discounts & Offers {discountPercent > 0 ? `(${discountPercent}%)` : discountFixed > 0 ? `(Fixed)` : ""}
                  </span>
                  <kbd className="text-[10px] bg-black/10 dark:bg-white/10 text-gray-400 px-1 py-0.2 rounded font-sans font-semibold">F4</kbd>
                </button>
                <span className="font-semibold text-emerald-500">
                  {discountAmount > 0 ? `-LKR ${formatLKR(discountAmount)}` : "LKR 0"}
                </span>
              </div>

              {taxAmount > 0 && (
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span className="font-semibold text-foreground">+LKR {formatLKR(taxAmount)}</span>
                </div>
              )}

              {/* Grand Total */}
              <div className="flex justify-between items-baseline pt-2 border-t border-border">
                <span className="font-bold text-sm text-foreground uppercase tracking-wider">Total</span>
                <span className="text-2xl font-black text-brand-500">
                  LKR {formatLKR(totalAmount)}
                </span>
              </div>
            </div>

            {/* Charge / Open Shift Button */}
            {!activeShift ? (
              <button
                onClick={() => {
                  playScanSound("beep");
                  setIsShiftModalOpen(true);
                }}
                className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-amber-950 font-black text-base uppercase tracking-wider transition-all duration-150 shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer flex items-center justify-center gap-2.5"
              >
                <Clock className="w-5 h-5" />
                <span>Open Shift to Start Sale</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setTenderedCash(totalAmount.toString());
                  handleOpenPaymentModal();
                }}
                disabled={cart.length === 0}
                className="w-full py-4 rounded-2xl bg-brand-500 hover:bg-brand-400 disabled:opacity-40 text-brand-950 font-black text-base uppercase tracking-wider transition-all duration-150 shadow-lg shadow-brand-500/20 active:scale-95 cursor-pointer flex items-center justify-center gap-2.5"
              >
                <CreditCard className="w-5 h-5" />
                <span>Charge LKR {formatLKR(totalAmount)}</span>
                {cart.length > 0 && (
                  <kbd className="text-[11px] bg-brand-600/30 text-brand-950 px-2 py-0.5 rounded-lg font-sans font-bold">F12 / Space</kbd>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Payment Checkout Modal */}
      {isPaymentModalOpen && (
        <div
          className="fixed inset-0 z-[9995] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsPaymentModalOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden p-5 sm:p-6 relative max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">Process Payment</h3>
                <p className="text-xs text-gray-400">Total Due: LKR {formatLKR(totalAmount)}</p>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-gray-400 hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {paymentError && (
              <div className="mb-4 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-500 flex items-start gap-2.5 text-xs animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium leading-relaxed">{paymentError}</div>
              </div>
            )}

            {/* Payment Method Selector */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              {[
                { method: "Cash" as const, key: "1" },
                { method: "Card" as const, key: "2" },
                { method: "Bank Transfer" as const, key: "3" },
              ].map(({ method, key }) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => {
                    setPaymentMethod(method);
                    if (method === "Cash") {
                      setTimeout(() => tenderedInputRef.current?.focus(), 50);
                    }
                  }}
                  className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    paymentMethod === method
                      ? "bg-brand-500 text-brand-950 border-brand-500 shadow-xs"
                      : "border-border text-gray-400 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  <kbd className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    paymentMethod === method ? "bg-brand-600/30 text-brand-950" : "bg-black/10 dark:bg-white/10 text-gray-400"
                  }`}>
                    {key}
                  </kbd>
                  <span>{method}</span>
                </button>
              ))}
            </div>

            {/* Cash Input & Change Due Section */}
            {paymentMethod === "Cash" && (
              <div className="space-y-4 mb-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Tendered Cash Amount
                    </label>
                    <span className="text-[11px] text-gray-400">Total: LKR {formatLKR(totalAmount)}</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                      LKR
                    </span>
                    <input
                      ref={tenderedInputRef}
                      type="number"
                      min="0"
                      step="any"
                      autoFocus
                      value={tenderedCash}
                      onChange={(e) => setTenderedCash(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl pl-16 pr-4 py-3 font-bold text-xl text-foreground outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                {/* Quick denomination chips */}
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { label: "Exact", val: totalAmount },
                    { label: "+500", val: totalAmount + 500 },
                    { label: "+1,000", val: totalAmount + 1000 },
                    { label: "+2,000", val: totalAmount + 2000 },
                    { label: "+5,000", val: totalAmount + 5000 },
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => setTenderedCash(chip.val.toString())}
                      className="px-3 py-1.5 rounded-xl border border-border text-xs font-bold hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {/* Change Due Display */}
                <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-border flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-gray-400 uppercase">Change Due to Customer</span>
                    <p className="text-[11px] text-gray-500">Tendered - Total Due</p>
                  </div>
                  <div className="text-2xl font-black text-emerald-500">
                    LKR {formatLKR(changeDue)}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="flex-1 py-3.5 rounded-xl border border-border font-semibold text-xs text-gray-400 hover:text-foreground flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Cancel</span>
                <kbd className="text-[10px] bg-black/5 dark:bg-white/5 text-gray-400 px-1 rounded">Esc</kbd>
              </button>
              <button
                type="button"
                onClick={handleExecuteCheckout}
                disabled={checkingOut || (paymentMethod === "Cash" && parsedTendered < totalAmount)}
                className="flex-2 py-3.5 bg-brand-500 hover:bg-brand-400 disabled:opacity-40 text-brand-950 font-bold text-sm rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{checkingOut ? "Processing Sale..." : "Complete Sale"}</span>
                <kbd className="text-[10px] bg-brand-600/30 text-brand-950 px-1.5 py-0.5 rounded font-bold">Enter</kbd>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discount Modal */}
      {isDiscountModalOpen && (
        <div
          className="fixed inset-0 z-[9996] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setIsDiscountModalOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-3xl w-full max-w-sm p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <h4 className="font-bold text-sm text-foreground">Apply Order Discount</h4>
              <button onClick={() => setIsDiscountModalOpen(false)} className="p-1 text-gray-400 hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleApplyOrderDiscount}
              className="space-y-4 text-xs"
            >
              {/* Cashier manager authorization notice */}
              {isCashier && (
                <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center gap-2 text-xs font-semibold">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Manager access code authorization required for cashiers</span>
                </div>
              )}

              <div className="flex rounded-xl bg-black/5 dark:bg-white/5 p-1 border border-border">
                <button
                  type="button"
                  onClick={() => setDraftDiscountType("percent")}
                  className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                    draftDiscountType === "percent" ? "bg-brand-500 text-brand-950 font-black shadow-xs" : "text-gray-400 hover:text-foreground"
                  }`}
                >
                  Percentage (%)
                </button>
                <button
                  type="button"
                  onClick={() => setDraftDiscountType("fixed")}
                  className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                    draftDiscountType === "fixed" ? "bg-brand-500 text-brand-950 font-black shadow-xs" : "text-gray-400 hover:text-foreground"
                  }`}
                >
                  Fixed Amount (LKR)
                </button>
              </div>

              {draftDiscountType === "percent" ? (
                <div>
                  <label className="block text-gray-400 font-semibold mb-1">Discount %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={draftDiscountPercent}
                    onChange={(e) => setDraftDiscountPercent(parseFloat(e.target.value) || 0)}
                    className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-3 py-2 text-base font-bold outline-none focus:border-brand-500"
                    autoFocus
                  />
                  <div className="flex gap-2 mt-2">
                    {[5, 10, 15, 20].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setDraftDiscountPercent(pct)}
                        className="flex-1 py-1 rounded-lg border border-border text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-gray-400 font-semibold mb-1">Fixed LKR Amount</label>
                  <input
                    type="number"
                    min="0"
                    value={draftDiscountFixed}
                    onChange={(e) => setDraftDiscountFixed(parseFloat(e.target.value) || 0)}
                    className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-3 py-2 text-base font-bold outline-none focus:border-brand-500"
                    autoFocus
                  />
                </div>
              )}

              <div className="pt-2 flex justify-between items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDiscountPercent(0);
                    setDiscountFixed(0);
                    setIsDiscountModalOpen(false);
                    triggerToast("Order discount removed", "success");
                  }}
                  className="px-3 py-1.5 rounded-xl border border-border text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs font-semibold cursor-pointer"
                >
                  Clear Discount
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsDiscountModalOpen(false)}
                    className="px-3 py-1.5 rounded-xl border border-border text-gray-400 hover:text-foreground text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Cancel</span>
                    <kbd className="text-[10px] bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-gray-400">Esc</kbd>
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-1.5 bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                  >
                    <span>{isCashier ? "Authorize with Manager Code" : "Apply"}</span>
                    <kbd className="text-[10px] bg-brand-600/30 text-brand-950 px-1.5 py-0.5 rounded font-bold">Enter</kbd>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shift Drawer Modal */}
      <ShiftModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        shift={activeShift}
        onShiftUpdated={(s) => {
          setActiveShift(s);
          if (s) {
            setIsCustomerModalOpen(true);
          }
        }}
      />

      {/* Stock Management Modal */}
      <StockManagementModal
        isOpen={isStockModalOpen}
        onClose={() => {
          setIsStockModalOpen(false);
          fetchProducts();
        }}
        canManageStock={canManageStock}
        isWooConnected={isWooConnected}
        onStockChanged={fetchProducts}
      />

      {/* Order History & Refunds Modal */}
      <OrderHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        canRefund={canRefund}
        canVoid={canVoid}
        tenantName={tenantName}
        customLayout={receiptLayout}
        receiptHeader={receiptSettings.header}
        receiptFooter={receiptSettings.footer}
      />

      {/* POS Settings Modal */}
      <PosSettingsModal
        isOpen={isSettingsModalOpen && canAccessPosSettings}
        onClose={() => setIsSettingsModalOpen(false)}
        canManageSettings={canAccessPosSettings}
        onSettingsSaved={() => fetchReceiptTemplate()}
      />

      {/* Customer / Client Selection Modal */}
      <CustomerSelectModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        currentCustomerName={customerName}
        currentCustomerPhone={customerPhone}
        onSelectCustomer={(client) => {
          setCustomerName(client.name);
          setCustomerPhone(client.phone || "");
          setCustomerId(client.id || null);
          triggerToast(`Customer assigned: ${client.name}`, "success");
        }}
      />

      {/* Special Offers & Promotions Modal */}
      <SpecialOffersModal
        isOpen={isSpecialOffersModalOpen}
        onClose={() => {
          setIsSpecialOffersModalOpen(false);
          fetchPromotions();
        }}
        products={products}
        cart={cart}
        appliedPromotionIds={appliedPromotionIds}
        onToggleApplyPromotion={handleToggleApplyPromotion}
        canManageOffers={canManageStock && !isCashierOnly}
      />

      {/* Manager Authorization Modal for Protected Offers */}
      <ManagerApprovalModal
        isOpen={Boolean(authorizingPromo)}
        onClose={() => {
          setAuthorizingPromo(null);
          if (pendingCheckoutAfterPromoRef.current) {
            pendingCheckoutAfterPromoRef.current = false;
            setPendingCheckoutAfterPromo(false);
            // If manager authorization was cancelled/skipped at checkout, proceed to payment
            setPaymentError(null);
            setIsPaymentModalOpen(true);
            setTimeout(() => tenderedInputRef.current?.focus(), 60);
          }
        }}
        promotion={authorizingPromo}
        onAuthorized={handleManagerAuthorized}
      />

      {/* Manager Authorization Modal for Direct Order Discount */}
      <ManagerApprovalModal
        isOpen={isAuthorizingOrderDiscount}
        onClose={() => {
          setIsAuthorizingOrderDiscount(false);
          setPendingOrderDiscount(null);
        }}
        actionTitle="Direct Order Discount"
        actionBadge={
          pendingOrderDiscount?.type === "percent"
            ? `${pendingOrderDiscount.percent}% OFF`
            : `LKR ${formatLKR(pendingOrderDiscount?.fixed || 0)} OFF`
        }
        actionDescription="Cashiers cannot apply direct discounts directly. Manager or supervisor access code authorization is required to apply this discount."
        onAuthorized={(_promo, managerName) => {
          if (pendingOrderDiscount) {
            setDiscountType(pendingOrderDiscount.type);
            setDiscountPercent(pendingOrderDiscount.percent);
            setDiscountFixed(pendingOrderDiscount.fixed);
            triggerToast(
              `Order discount (${pendingOrderDiscount.type === "percent" ? `${pendingOrderDiscount.percent}%` : `LKR ${formatLKR(pendingOrderDiscount.fixed)}`}) authorized by ${managerName}`,
              "success"
            );
          }
          setPendingOrderDiscount(null);
          setIsAuthorizingOrderDiscount(false);
        }}
      />

      {/* Manager Authorization Modal for Direct Item Discount */}
      <ManagerApprovalModal
        isOpen={isAuthorizingItemDiscount}
        onClose={() => {
          setIsAuthorizingItemDiscount(false);
          setPendingItemDiscount(null);
        }}
        actionTitle={`Item Discount: ${pendingItemDiscount?.itemName || "Item"}`}
        actionBadge={
          pendingItemDiscount?.discountType === "percent"
            ? `${pendingItemDiscount.discount}% OFF`
            : `LKR ${formatLKR(pendingItemDiscount?.discount || 0)} OFF`
        }
        actionDescription="Cashiers cannot apply line item discounts directly. Manager access code authorization is required."
        onAuthorized={(_promo, managerName) => {
          if (pendingItemDiscount) {
            setCart((prev) =>
              prev.map((it) => {
                if (it.id === pendingItemDiscount.itemId) {
                  return {
                    ...it,
                    discount: pendingItemDiscount.discount > 0 ? pendingItemDiscount.discount : undefined,
                    discountType: pendingItemDiscount.discountType,
                    discountReason: pendingItemDiscount.reason
                      ? `${pendingItemDiscount.reason} (Auth: ${managerName})`
                      : `Auth: ${managerName}`,
                  };
                }
                return it;
              })
            );
            triggerToast(
              `Item discount for "${pendingItemDiscount.itemName}" authorized by ${managerName}`,
              "success"
            );
          }
          setPendingItemDiscount(null);
          setIsAuthorizingItemDiscount(false);
        }}
      />

      {/* Line Item Special Discount Modal */}
      <ItemDiscountModal
        isOpen={isItemDiscountModalOpen}
        onClose={() => {
          setIsItemDiscountModalOpen(false);
          setDiscountingItem(null);
        }}
        item={discountingItem}
        onApplyDiscount={handleApplyItemDiscount}
        isCashier={isCashier}
      />

      {/* Receipt Thermal Preview Modal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => {
          setIsReceiptOpen(false);
          setCompletedOrder(null);
        }}
        order={completedOrder}
        tenantName={tenantName}
        tenantLogoUrl={tenantLogoUrl}
        receiptHeader={receiptSettings.header}
        receiptFooter={receiptSettings.footer}
        customLayout={receiptLayout}
        onNewSale={() => startNewSale()}
      />

      {/* POS Keyboard Shortcuts Cheat Sheet Modal */}
      {isShortcutsHelpOpen && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsShortcutsHelpOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h3 className="text-base font-bold text-foreground">Fast Checkout Keyboard Hotkeys</h3>
              </div>
              <button
                onClick={() => setIsShortcutsHelpOpen(false)}
                className="p-1.5 text-gray-400 hover:text-foreground rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-2 text-xs">
              <div className="p-2.5 bg-black/5 dark:bg-white/5 rounded-xl flex items-center justify-between">
                <span className="text-gray-400">Focus Product Search</span>
                <span className="flex items-center gap-1">
                  <kbd className="px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold border border-border">/</kbd>
                  <span className="text-gray-500">or</span>
                  <kbd className="px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold border border-border">F1</kbd>
                </span>
              </div>

              <div className="p-2.5 bg-black/5 dark:bg-white/5 rounded-xl flex items-center justify-between">
                <span className="text-gray-400">Add Selected Search Result to Cart</span>
                <kbd className="px-2 py-0.5 rounded bg-brand-500 text-brand-950 font-bold">Enter</kbd>
              </div>

              <div className="p-2.5 bg-black/5 dark:bg-white/5 rounded-xl flex items-center justify-between">
                <span className="text-gray-400">Continuous Camera Barcode Scanner</span>
                <span className="flex items-center gap-1">
                  <kbd className="px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold border border-border">F2</kbd>
                  <span className="text-gray-500">or</span>
                  <kbd className="px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold border border-border">C</kbd>
                </span>
              </div>

              <div className="p-2.5 bg-black/5 dark:bg-white/5 rounded-xl flex items-center justify-between">
                <span className="text-gray-400">Customer Details (Search / Save Client)</span>
                <span className="flex items-center gap-1">
                  <kbd className="px-2 py-0.5 rounded bg-brand-500 text-brand-950 font-bold">F3</kbd>
                  <span className="text-gray-500">or</span>
                  <kbd className="px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold border border-border">U</kbd>
                </span>
              </div>

              <div className="p-2.5 bg-black/5 dark:bg-white/5 rounded-xl flex items-center justify-between">
                <span className="text-gray-400">Open Cash Drawer</span>
                <span className="flex items-center gap-1">
                  <kbd className="px-2 py-0.5 rounded bg-brand-500 text-brand-950 font-bold">Space</kbd>
                  <span className="text-gray-500 text-[10px]">(Empty Screen) or</span>
                  <kbd className="px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold border border-border">F5</kbd>
                </span>
              </div>

              <div className="p-2.5 bg-black/5 dark:bg-white/5 rounded-xl flex items-center justify-between">
                <span className="text-gray-400">Print Test Bill (Paper Roll Config)</span>
                <span className="flex items-center gap-1">
                  <kbd className="px-2 py-0.5 rounded bg-brand-500 text-brand-950 font-bold">Enter</kbd>
                  <span className="text-gray-500 text-[10px]">(Empty Screen) or</span>
                  <kbd className="px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold border border-border">Shift+F5</kbd>
                </span>
              </div>

              <div className="p-2.5 bg-black/5 dark:bg-white/5 rounded-xl flex items-center justify-between">
                <span className="text-gray-400">Special Offers & Promotions</span>
                <span className="flex items-center gap-1">
                  <kbd className="px-2 py-0.5 rounded bg-brand-500 text-brand-950 font-bold">F6</kbd>
                  <span className="text-gray-500">or</span>
                  <kbd className="px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold border border-border">O</kbd>
                </span>
              </div>

              <div className="p-2.5 bg-black/5 dark:bg-white/5 rounded-xl flex items-center justify-between">
                <span className="text-gray-400">Charge / Open Checkout Modal</span>
                <span className="flex items-center gap-1">
                  <kbd className="px-2 py-0.5 rounded bg-brand-500 text-brand-950 font-bold">F12</kbd>
                  <span className="text-gray-500">or</span>
                  <kbd className="px-2 py-0.5 rounded bg-brand-500 text-brand-950 font-bold">Space</kbd>
                </span>
              </div>

              <div className="p-2.5 bg-black/5 dark:bg-white/5 rounded-xl flex items-center justify-between">
                <span className="text-gray-400">Select Payment Tender (Inside Checkout)</span>
                <span className="flex items-center gap-1">
                  <kbd className="px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold border border-border">1 Cash</kbd>
                  <kbd className="px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold border border-border">2 Card</kbd>
                  <kbd className="px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold border border-border">3 Bank</kbd>
                </span>
              </div>

              <div className="p-2.5 bg-black/5 dark:bg-white/5 rounded-xl flex items-center justify-between">
                <span className="text-gray-400">Complete Sale / Process Payment</span>
                <kbd className="px-2 py-0.5 rounded bg-brand-500 text-brand-950 font-bold">Enter</kbd>
              </div>

              <div className="p-2.5 bg-black/5 dark:bg-white/5 rounded-xl flex items-center justify-between">
                <span className="text-gray-400">Item Quantity Increment / Decrement</span>
                <span className="flex items-center gap-1">
                  <kbd className="px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold border border-border">+</kbd>
                  <kbd className="px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold border border-border">-</kbd>
                </span>
              </div>

              <div className="p-2.5 bg-black/5 dark:bg-white/5 rounded-xl flex items-center justify-between">
                <span className="text-gray-400">Remove Last Item / Clear Cart</span>
                <span className="flex items-center gap-1">
                  <kbd className="px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold border border-border">Backspace</kbd>
                  <kbd className="px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold border border-border">F7 (Clear)</kbd>
                </span>
              </div>

              <div className="p-2.5 bg-black/5 dark:bg-white/5 rounded-xl flex items-center justify-between">
                <span className="text-gray-400">Print Receipt (On Sale Completed)</span>
                <kbd className="px-2 py-0.5 rounded bg-brand-500 text-brand-950 font-bold">Enter / P</kbd>
              </div>

              <div className="p-2.5 bg-black/5 dark:bg-white/5 rounded-xl flex items-center justify-between">
                <span className="text-gray-400">Close Modal / End Camera Scan</span>
                <kbd className="px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold border border-border">Esc</kbd>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsShortcutsHelpOpen(false)}
                className="px-5 py-2.5 bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Actions Drawer / Bottom Sheet */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-[9990] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden max-h-[85vh] flex flex-col relative animate-in slide-in-from-bottom-5 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-black/5 dark:bg-white/5 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <TenantLogo
                  logoUrl={tenantLogoUrl}
                  name={tenantName}
                  size={32}
                  className="w-8 h-8 rounded-xl object-contain p-0.5 bg-black/5 dark:bg-white/5 border border-brand-500/30 shrink-0"
                  fallbackClassName="w-8 h-8 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-500 font-black text-xs shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-foreground truncate">{tenantName}</div>
                  <div className="text-[10px] text-gray-400 truncate">{userName} • {userRole}</div>
                </div>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 text-gray-400 hover:text-foreground rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Menu Actions List */}
            <div className="p-3 sm:p-4 overflow-y-auto space-y-2">
              {/* Shift Details */}
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsShiftModalOpen(true);
                }}
                className="w-full p-3 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-brand-500/10 border border-border hover:border-brand-500/30 flex items-center justify-between text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-500 shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold text-foreground group-hover:text-brand-500">
                    {activeShift ? `Shift #${activeShift.shift_number || activeShift.id} Details` : "Open Register Shift"}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
              </button>

              {/* Stock Management */}
              {canManageStock && (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsStockModalOpen(true);
                  }}
                  className="w-full p-3 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-brand-500/10 border border-border hover:border-brand-500/30 flex items-center justify-between text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-500/15 text-blue-500 shrink-0">
                      <Package className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-bold text-foreground group-hover:text-brand-500">Stock Management</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                </button>
              )}

              {/* Sales Orders & History */}
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsHistoryModalOpen(true);
                }}
                className="w-full p-3 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-brand-500/10 border border-border hover:border-brand-500/30 flex items-center justify-between text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/15 text-amber-500 shrink-0">
                    <History className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold text-foreground group-hover:text-brand-500">Sales Orders & History</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
              </button>

              {/* Special Offers & Deals */}
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsSpecialOffersModalOpen(true);
                }}
                className="w-full p-3 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-brand-500/10 border border-border hover:border-brand-500/30 flex items-center justify-between text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-brand-500/15 text-brand-500 shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold text-foreground group-hover:text-brand-500">Special Offers & Deals</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
              </button>

              {/* Customer / Client Assignment */}
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsCustomerModalOpen(true);
                }}
                className="w-full p-3 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-brand-500/10 border border-border hover:border-brand-500/30 flex items-center justify-between text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-500/15 text-purple-500 shrink-0">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold text-foreground group-hover:text-brand-500">Customer Details</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
              </button>

              {/* General Order Discount */}
              {canDiscount && (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleOpenDiscountModal();
                  }}
                  className="w-full p-3 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-brand-500/10 border border-border hover:border-brand-500/30 flex items-center justify-between text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-500 shrink-0">
                      <Percent className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-bold text-foreground group-hover:text-brand-500">Order Discount</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                </button>
              )}

              {/* Keyboard Shortcuts Guide */}
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsShortcutsHelpOpen(true);
                }}
                className="w-full p-3 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-brand-500/10 border border-border hover:border-brand-500/30 flex items-center justify-between text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gray-500/15 text-gray-400 shrink-0">
                    <Keyboard className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold text-foreground group-hover:text-brand-500">Keyboard Shortcuts Guide</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
              </button>

              {/* POS Settings (Managers/Admins only) */}
              {canAccessPosSettings && (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsSettingsModalOpen(true);
                  }}
                  className="w-full p-3 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-brand-500/10 border border-border hover:border-brand-500/30 flex items-center justify-between text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gray-500/15 text-gray-400 shrink-0">
                      <Settings className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-bold text-foreground group-hover:text-brand-500">POS & Stock Settings</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                </button>
              )}

              {/* Exit POS back to dashboard */}
              {!isCashierOnly && (
                <Link
                  href="/dashboard"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full p-3 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-black/10 border border-border flex items-center justify-between text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-card text-gray-300 shrink-0">
                      <ArrowLeft className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-bold text-foreground">Exit POS</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                </Link>
              )}

              {/* Log Out */}
              <button
                onClick={() => signOut()}
                className="w-full p-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 flex items-center justify-between text-left transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-red-500/20 text-red-500 shrink-0">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold">Sign Out</div>
                </div>
                <ChevronRight className="w-4 h-4 text-red-500 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
