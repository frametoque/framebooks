import React from "react";
import { Metadata } from "next";
import { CouponsClient } from "./CouponsClient";
import { getCouponsList } from "./actions";

export const metadata: Metadata = {
  title: "Coupons & Discounts",
};

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  const coupons = await getCouponsList();

  return (
    <div className="space-y-6">
      <CouponsClient coupons={coupons} />
    </div>
  );
}
