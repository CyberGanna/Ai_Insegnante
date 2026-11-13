import type { Metadata } from "next";
import { SettingsPage } from "@/components/pages/impostazioni";

export const metadata: Metadata = { title: "Impostazioni" };

export default function Page() {
  return <SettingsPage />;
}
