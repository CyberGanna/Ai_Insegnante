import type { Metadata } from "next";
import { Suspense } from "react";
import { Progress } from "@/components/pages/progressi";

export const metadata: Metadata = { title: "Progressi" };

export default function Page() {
  return (
    <Suspense>
      <Progress />
    </Suspense>
  );
}
