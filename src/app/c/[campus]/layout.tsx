import { notFound } from "next/navigation";
import { AppFrame } from "@/components/shell/app-frame";
import { getCampus } from "@/lib/tenant";

// Everything under /c/[campus] gets the app frame (theme, header, tabs).
// AppFrame requires an onboarded account; getCampus is RLS-filtered, so campuses you
// can't browse 404.
export default async function CampusLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ campus: string }>;
}) {
  const { campus: slug } = await params;
  const campus = await getCampus(slug);
  if (!campus) notFound();

  return <AppFrame campusSlug={campus.slug}>{children}</AppFrame>;
}
