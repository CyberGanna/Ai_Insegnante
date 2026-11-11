import type { Metadata } from "next";
import { Progress } from "@/components/pages/progressi";

export const metadata: Metadata = { title: "Progressi" };

export default function Page() {
  return <Progress />;
}
