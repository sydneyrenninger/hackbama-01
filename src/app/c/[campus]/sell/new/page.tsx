import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { NewPostForm } from "@/components/sell/new-post-form";
import { PageHeader } from "@/components/shell/page-header";
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
    <div className="mx-auto max-w-2xl space-y-8">
      <Link href={`/c/${slug}/sell`} className="eyebrow inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-card px-3 py-1.5 shadow-brut-sm transition-transform hover:-translate-x-0.5">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />Sell
      </Link>
      <PageHeader kicker="New post" title="Pin it to" accent="the board.">
        Add photos or a short video, then preview your post and write a caption.
      </PageHeader>
      {canPost && home ? (
        <NewPostForm campusSlug={slug} homeCampusName={home.name} authorName={ctx.profile.display_name} authorAvatarPath={ctx.profile.avatar_path} />
      ) : (
        <p className="rounded-2xl border-2 border-ink bg-pop p-4 font-bold shadow-brut-sm">
          Your campus isn&apos;t open for posting yet, so you can browse and make offers but not list items.
        </p>
      )}
    </div>
  );
}
