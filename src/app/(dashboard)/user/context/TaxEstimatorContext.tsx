"use client";

import React, { createContext, useContext, useState } from "react";

export type TaxEntityType = "corporate" | "individual" | "custom";
export type TaxProfitBasis = "this year" | "last year" | "custom";

interface TaxEstimatorContextType {
  taxEntityType: TaxEntityType;
  setTaxEntityType: (val: TaxEntityType) => void;
  taxProfitBasis: TaxProfitBasis;
  setTaxProfitBasis: (val: TaxProfitBasis) => void;
  customProfit: string;
  setCustomProfit: (val: string) => void;
  customRate: string;
  setCustomRate: (val: string) => void;
  additionalDeductions: string;
  setAdditionalDeductions: (val: string) => void;
}

const TaxEstimatorContext = createContext<TaxEstimatorContextType | undefined>(undefined);

export function TaxEstimatorProvider({ children }: { children: React.ReactNode }) {
  const [taxEntityType, setTaxEntityType] = useState<TaxEntityType>("corporate");
  const [taxProfitBasis, setTaxProfitBasis] = useState<TaxProfitBasis>("this year");
  const [customProfit, setCustomProfit] = useState<string>("");
  const [customRate, setCustomRate] = useState<string>("30");
  const [additionalDeductions, setAdditionalDeductions] = useState<string>("0");

  return (
    <TaxEstimatorContext.Provider
      value={{
        taxEntityType,
        setTaxEntityType,
        taxProfitBasis,
        setTaxProfitBasis,
        customProfit,
        setCustomProfit,
        customRate,
        setCustomRate,
        additionalDeductions,
        setAdditionalDeductions,
      }}
    >
      {children}
    </TaxEstimatorContext.Provider>
  );
}

export function useTaxEstimator() {
  const context = useContext(TaxEstimatorContext);
  if (!context) {
    throw new Error("useTaxEstimator must be used within a TaxEstimatorProvider");
  }
  return context;
}
