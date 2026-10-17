// TODO: post + view wanted requests
export default async function RequestsPage({ params }: { params: Promise<{ campus: string }> }) {
  const { campus } = await params;
  void campus;
  return null;
}
