import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportScreen } from "@/components/report/report-screen";

export const metadata: Metadata = { title: "Report" };

export default function Page() {
  return (
    <Suspense>
      <ReportScreen />
    </Suspense>
  );
}
