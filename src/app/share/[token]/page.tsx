import PublicTracker from "@/components/share/PublicTracker";

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicTracker token={token} />;
}
