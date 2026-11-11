import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectsPage } from "@/components/pages/progetti";

export const metadata: Metadata = { title: "Progetti" };

export default function Page() {
  return (
    <Suspense>
      <ProjectsPage />
    </Suspense>
  );
}
