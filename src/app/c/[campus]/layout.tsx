import { notFound } from "next/navigation";
import { getCampus } from "@/lib/tenant";
import { requireAccount } from "@/lib/auth";

// Requires a signed-in, onboarded account. Loads the tenant being viewed (may differ from
// the user's home campus — cross-campus browsing) and exposes its theme as CSS variables.
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

  return (
    <div
      style={
        {
          "--campus-primary": campus.theme.primary,
          "--campus-secondary": campus.theme.secondary,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
