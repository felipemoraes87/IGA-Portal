import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RequestDetailLive } from "@/components/request-detail-live";
import { requirePageUser } from "@/lib/page-auth";
import { db } from "@/lib/db";

type Params = {
  params: Promise<{ id: string }>;
};

export default async function RequestDetailsPage({ params }: Readonly<Params>) {
  const user = await requirePageUser("USER");
  const { id } = await params;

  const request = await db.accessRequest.findUnique({
    where: { id },
    include: { targetUser: true },
  });

  if (!request) notFound();

  const canView =
    user.role === "ADMIN" ||
    request.requesterId === user.id ||
    request.targetUserId === user.id ||
    request.approverId === user.id ||
    (user.role === "MANAGER" && request.targetUser.managerId === user.id);
  if (!canView) notFound();

  return (
    <AppShell user={user} title="Detalhe da Solicitação" description="Atualização em tempo real a cada 5 segundos via polling.">
      <RequestDetailLive requestId={id} />
    </AppShell>
  );
}
