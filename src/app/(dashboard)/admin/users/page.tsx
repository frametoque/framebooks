import React from "react";
import { Metadata } from "next";
import { UsersClient } from "./UsersClient";
import { getUsersList } from "./actions";

export const metadata: Metadata = {
  title: "Users",
};

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const data = await getUsersList({
    search: params.search,
    plan: params.plan,
    status: params.status,
    role: params.role,
    banned: params.banned,
    page: params.page ? parseInt(params.page, 10) : 1,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder as any,
  });

  return <UsersClient initialData={data} searchParams={params} />;
}

