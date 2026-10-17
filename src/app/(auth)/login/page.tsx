import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { safeNext } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

// .edu email + password sign-in (POST /api/auth/signin)
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; created?: string; reset?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect(safeNext(sp.next));
  const notice = sp.created ? "Account created. Sign in to continue." : sp.reset ? "Password updated. Sign in with your new password." : undefined;
  return (
    <AuthShell>
      <SignInForm next={sp.next ? safeNext(sp.next) : undefined} notice={notice} />
    </AuthShell>
  );
}
