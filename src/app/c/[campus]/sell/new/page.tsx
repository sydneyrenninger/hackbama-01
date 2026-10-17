import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { NewPostForm } from "@/components/sell/new-post-form";
import { getAppContext } from "@/server/queries/context";

// New post: a photo listing or a reel. Always posts to your home campus (RLS enforces it).
export default async function NewPostPage({ params }: { params: Promise<{ campus: string }> }) {
  const { campus: slug } = await params;
  const ctx = await getAppContext();
  if (!ctx) redirect("/login");
  if (!ctx.profile) redirect("/login");
  if (!ctx.tenants.some((t) => t.slug === slug)) notFound();

  const home = ctx.homeTenant;
  const canPost = home?.status === "active" && ctx.memberships.some((m) => m.tenant_id === home.id);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link href={`/c/${slug}/sell`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden />Sell
      </Link>
      <div>
        <h1 className="font-display text-3xl font-bold">New post</h1>
        <p className="mt-1 text-muted-foreground">Add photos or a short video, set a price, and tag it so buyers can find it.</p>
      </div>
      {canPost && home ? (
        <NewPostForm campusSlug={slug} homeCampusName={home.name} />
      ) : (
        <p className="rounded-md bg-secondary p-4 text-secondary-foreground">
          Your campus isn&apos;t open for posting yet, so you can browse and make offers but not list items.
        </p>
      )}
    </div>
  );
}
