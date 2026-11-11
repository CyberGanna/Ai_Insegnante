import type { Metadata } from "next";
import { ProjectsPage } from "@/components/pages/progetti";

export const metadata: Metadata = { title: "Progetti" };

export default function Page() {
  return <ProjectsPage />;
}
