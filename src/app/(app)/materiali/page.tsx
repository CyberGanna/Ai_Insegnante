import type { Metadata } from "next";
import { Materials } from "@/components/pages/materiali";

export const metadata: Metadata = { title: "Materiali" };

export default function Page() {
  return <Materials />;
}
