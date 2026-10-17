import { notFound } from "next/navigation";
import { CampusTheme } from "@/components/campus-theme";
import { getCampus } from "@/lib/tenant";
import { requireAccount } from "@/lib/auth";

// Requires a signed-in, onboarded account. Loads the tenant being viewed (may differ from
// the user's home campus — cross-campus browsing; RLS hides campuses you can't browse)
// and applies its theme as CSS variables (bg-campus / bg-primary).
export default async function CampusLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ campus: string }>;
}) {
  await requireAccount();
  const { campus: slug } = await params;
  const campus = await getCampus(slug);
  if (!campus) notFound();

  return <CampusTheme tenant={campus}>{children}</CampusTheme>;
}
