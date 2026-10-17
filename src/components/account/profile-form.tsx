"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/shell/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadAvatar } from "@/lib/media/upload";
import { updateProfile } from "@/server/actions/campus";

export type ProfileFormValues = {
  displayName: string; bio: string | null; major: string | null; gradYear: number | null; avatarPath: string | null;
};

/** Edit name, bio, major, grad year and profile photo. */
export function ProfileForm({ initial }: { initial: ProfileFormValues }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [avatarPath, setAvatarPath] = useState(initial.avatarPath);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState(initial.displayName);

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setError(null); setUploading(true);
    const res = await uploadAvatar(file);
    setUploading(false);
    if (!res.ok) return setError(res.error);
    setAvatarPath(res.storagePath);
    setSaved(false);
  }

  return (
    <form className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const year = String(f.get("gradYear") ?? "").trim();
        setError(null); setSaved(false);
        start(async () => {
          const res = await updateProfile({
            displayName: String(f.get("displayName") ?? ""),
            bio: String(f.get("bio") ?? ""),
            major: String(f.get("major") ?? ""),
            gradYear: year === "" ? null : Number(year),
            avatarPath,
          });
          if (!res.ok) return setError(res.error);
          setSaved(true);
          router.refresh();
        });
      }}>
      <div className="flex items-center gap-4">
        <Avatar name={name} path={avatarPath} size="xl" />
        <div>
          <Label htmlFor="avatar-file" className="inline-flex h-9 cursor-pointer items-center rounded-md border border-border bg-card px-3 text-sm font-semibold hover:bg-muted">
            {uploading ? "Uploading…" : "Change photo"}
          </Label>
          <input id="avatar-file" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
            onChange={(e) => pickPhoto(e.target.files?.[0])} disabled={uploading} />
          <p className="mt-1 text-xs text-muted-foreground">JPG, PNG or WebP, up to 2 MB.</p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pf-name">Display name</Label>
        <Input id="pf-name" name="displayName" required minLength={2} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pf-major">Major</Label>
          <Input id="pf-major" name="major" maxLength={80} defaultValue={initial.major ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-year">Graduation year</Label>
          <Input id="pf-year" name="gradYear" type="number" inputMode="numeric" min={1950} max={2100} defaultValue={initial.gradYear ?? ""} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pf-bio">Bio</Label>
        <textarea id="pf-bio" name="bio" rows={3} maxLength={280} defaultValue={initial.bio ?? ""}
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-primary" />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {saved && <p role="status" className="text-sm text-success">Saved.</p>}
      <Button type="submit" disabled={pending || uploading}>{pending ? "Saving…" : "Save profile"}</Button>
    </form>
  );
}
