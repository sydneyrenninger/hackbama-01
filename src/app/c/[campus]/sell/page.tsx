// TODO: create listing / upload reel
export default async function SellPage({ params }: { params: Promise<{ campus: string }> }) {
  const { campus } = await params;
  void campus;
  return null;
}
