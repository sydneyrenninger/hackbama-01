import { requireAccount } from "@/lib/auth";

// TODO: my profile, my listings, my requests, edit profile, sign out
export default async function AccountPage() {
  const account = await requireAccount();
  void account;
  return null;
}
