import type { CSSProperties, ReactNode } from "react";
import { themeVars, type TenantTheme } from "@/lib/theme/colors";

/** Server component: applies a tenant's colors as CSS variables to its subtree. */
export function CampusTheme({ tenant, children, className }: { tenant: TenantTheme | null; children: ReactNode; className?: string }) {
  const style = tenant ? (themeVars(tenant) as CSSProperties) : undefined;
  return <div style={style} className={className}>{children}</div>;
}
