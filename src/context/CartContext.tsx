"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface CartItem {
  id: string; // serviceId + "-" + tier
  serviceId: string;
  serviceTitle: string;
  categorySlug: string;
  categoryName: string;
  tier: string;
  price: string; // Original database price string in LKR (e.g. "150,000" or similar)
  duration: string;
  quantity: number;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (item: Omit<CartItem, "quantity">) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem("ft_cart");
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart));
      } catch (e) {
        console.error("Failed to parse cart data from localStorage", e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage when cartItems changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("ft_cart", JSON.stringify(cartItems));
    }
  }, [cartItems, isLoaded]);

  // Listen for storage changes from other tabs
  useEffect(() => {
    const syncCart = () => {
      const savedCart = localStorage.getItem("ft_cart");
      if (savedCart) {
        try {
          const parsed = JSON.parse(savedCart);
          setCartItems((current) => {
            if (JSON.stringify(current) === savedCart) {
              return current;
            }
            return parsed;
          });
        } catch (e) {
          console.error("Failed to sync cart data", e);
        }
      } else {
        setCartItems((current) => (current.length === 0 ? current : []));
      }
    };
    window.addEventListener("storage", syncCart);
    return () => {
      window.removeEventListener("storage", syncCart);
    };
  }, []);

  const addToCart = (newItem: Omit<CartItem, "quantity">) => {
    setCartItems((prevItems) => {
      const isNewItemDomain = newItem.categorySlug === "domain" || newItem.id.startsWith("domain-") || newItem.serviceId === "domain-reg";
      const hasDomain = prevItems.some((item) => item.categorySlug === "domain" || item.id.startsWith("domain-") || item.serviceId === "domain-reg");
      const hasOther = prevItems.some((item) => item.categorySlug !== "domain" && !item.id.startsWith("domain-") && item.serviceId !== "domain-reg");

      if (isNewItemDomain && hasOther) {
        alert("Domain registrations must be ordered separately. Clearing your cart to proceed with the domain registration.");
        return [{ ...newItem, quantity: 1 }];
      }
      if (!isNewItemDomain && hasDomain) {
        alert("Your cart contains a domain registration. Domains must be ordered separately. Clearing your cart to proceed with this service.");
        return [{ ...newItem, quantity: 1 }];
      }

      const existing = prevItems.find((item) => item.id === newItem.id);
      if (existing) {
        return prevItems.map((item) =>
          item.id === newItem.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevItems, { ...newItem, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCartItems((prevItems) => prevItems.filter((item) => item.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    setCartItems((prevItems) =>
      prevItems.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
