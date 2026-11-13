import type { Metadata } from "next";
import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard/dashboard";

export const metadata: Metadata = { title: "Oggi" };

export default function Page() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}
