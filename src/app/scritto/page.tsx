import type { Metadata } from "next";
import { Suspense } from "react";
import { FocusShell } from "@/components/app-shell";
import { WrittenScreen } from "@/components/exam/written-screen";

export const metadata: Metadata = { title: "Prova scritta" };

export default function Page() {
  return (
    <FocusShell>
      <Suspense>
        <WrittenScreen />
      </Suspense>
    </FocusShell>
  );
}
