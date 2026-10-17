// TODO: swipe deck of listings (buyers) / requests (sellers)
export default async function SwipePage({ params }: { params: Promise<{ campus: string }> }) {
  const { campus } = await params;
  void campus;
  return null;
}
