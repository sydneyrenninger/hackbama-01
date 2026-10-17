// TODO: matches list + chat
export default async function MatchesPage({ params }: { params: Promise<{ campus: string }> }) {
  const { campus } = await params;
  void campus;
  return null;
}
