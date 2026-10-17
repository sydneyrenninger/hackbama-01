// TODO: vertical reels feed (listings where is_reel = true)
export default async function ReelsPage({ params }: { params: Promise<{ campus: string }> }) {
  const { campus } = await params;
  void campus;
  return null;
}
