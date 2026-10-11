import React from "react";
import { Metadata } from "next";
import { AnnouncementsClient } from "./AnnouncementsClient";
import { getAnnouncementsList } from "./actions";

export const metadata: Metadata = {
  title: "Announcements",
};

export const dynamic = "force-dynamic";

export default async function AdminAnnouncementsPage() {
  const announcements = await getAnnouncementsList();

  return (
    <div className="space-y-6">
      <AnnouncementsClient announcements={announcements} />
    </div>
  );
}
