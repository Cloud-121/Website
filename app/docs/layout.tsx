import type { Metadata } from "next";
import { DocsSideNav } from "@/components/docs-sidenav";

export const metadata: Metadata = {
  title: {
    default: "Docs",
    template: "%s · Docs · Gulf Coast Mesh",
  },
  description:
    "Field guides, hardware recommendations, and setup walkthroughs for the Gulf Coast Mesh — synced from our community docs.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container pb-24">
      <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-12">
        <DocsSideNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
