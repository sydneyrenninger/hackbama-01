import { AuthShell } from "@/components/auth/auth-shell";
import { SignupFlow } from "@/components/auth/signup-flow";

export default function SignupPage() {
  return (
    <AuthShell>
      <SignupFlow />
    </AuthShell>
  );
}
