import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthBar } from "@/components/AuthBar";
import { InterviewRoom } from "@/components/InterviewRoom";
import { getUser } from "@/lib/auth";
import { getInterview } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) redirect("/");
  const { id } = await params;
  const interview = await getInterview(id, user.id);
  if (!interview) notFound();

  return (
    <main className="shell">
      <header className="top">
        <div className="brand"><div className="logo" aria-hidden="true">HP</div><div><strong>HirePilot AI</strong><div className="muted tiny">Protected voice interview room</div></div></div>
        <div className="actions"><Link className="button ghost" href="/dashboard">Dashboard</Link><AuthBar /></div>
      </header>
      <InterviewRoom interview={interview as never} />
    </main>
  );
}
