import type { Metadata } from "next";
import { Suspense } from "react";
import { Sessions } from "@/components/pages/sessioni";

export const metadata: Metadata = { title: "Le mie sessioni" };

export default function Page() {
  return (
    <Suspense>
      <Sessions />
    </Suspense>
  );
}
