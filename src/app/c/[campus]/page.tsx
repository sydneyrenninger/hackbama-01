// TODO: campus home feed
export default async function CampusHome({ params }: { params: Promise<{ campus: string }> }) {
  const { campus } = await params;
  void campus;
  return null;
}
