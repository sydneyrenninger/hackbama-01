import { notFound } from "next/navigation";
import { getCampus } from "@/lib/tenant";

// Loads the tenant and exposes its theme as CSS variables for everything under /c/[campus]
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
