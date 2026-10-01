import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthBar } from "@/components/AuthBar";
import { DeleteDataButton } from "@/components/DeleteDataButton";
import { requireUser } from "@/lib/auth";
import { listInterviews } from "@/lib/db";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  role_title: string;
  status: string;
  created_at: string;
  scorecards?: Array<{ round: string; scorecard: unknown }>;
};

export default async function DashboardPage() {
  let user;
  try { user = await requireUser(); } catch { redirect("/"); }
  const interviews = (await listInterviews(user.id)) as Row[];

  return (
    <main className="shell">
      <header className="top">
        <div><span className="tag">Dashboard</span><h1>Your interview history</h1><p className="muted">Private to your authenticated account.</p></div>
        <AuthBar />
      </header>
      <div className="actions section"><Link className="button primary" href="/">Start a new interview</Link></div>
      <div className="panel section">
        {interviews.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Role</th><th>Status</th><th>Created</th><th>Scores</th><th /></tr></thead>
              <tbody>
                {interviews.map(item => (
                  <tr key={item.id}>
                    <td><strong>{item.role_title}</strong></td>
                    <td><span className="tag">{item.status}</span></td>
                    <td className="muted">{new Date(item.created_at).toLocaleString()}</td>
                    <td>{item.scorecards?.length ?? 0}</td>
                    <td><Link className="button ghost" href={item.status === "completed" ? `/report/${item.id}` : `/interview/${item.id}`}>{item.status === "completed" ? "Report" : "Open"}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="center"><h2>No interviews yet</h2><p className="muted">Create one from the home page.</p><Link className="button primary" href="/">Create interview</Link></div>
        )}
      </div>
      <div className="panel section">
        <h3>Privacy controls</h3>
        <p className="muted">Remove all interviews, transcripts, and scorecards owned by this account.</p>
        <DeleteDataButton />
      </div>
    </main>
  );
}
