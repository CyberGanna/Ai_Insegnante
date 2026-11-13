import type { Metadata } from "next";
import { Suspense } from "react";
import { FocusShell } from "@/components/app-shell";
import { ExamScreen } from "@/components/exam/exam-screen";

export const metadata: Metadata = { title: "Simulazione" };

export default function Page() {
  return (
    <FocusShell>
      <Suspense>
        <ExamScreen />
      </Suspense>
    </FocusShell>
  );
}
