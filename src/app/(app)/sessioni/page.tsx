import type { Metadata } from "next";
import { Sessions } from "@/components/pages/sessioni";

export const metadata: Metadata = { title: "Le mie sessioni" };

export default function Page() {
  return <Sessions />;
}
