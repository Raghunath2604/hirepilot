"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type InterviewListItem = {
  id: string;
  role_title: string;
  status: string;
  created_at: string;
  scorecards?: Array<{ round: "technical" | "hr"; scorecard?: { overall?: number } }>;
};

export default function DashboardPage() {
  const [items, setItems] = useState<InterviewListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/interviews");
        const data = (await response.json()) as { interviews?: InterviewListItem[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Unable to load interviews");
        if (active) setItems(data.interviews || []);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unexpected error");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const averageScore = useMemo(() => {
    const scores = items.flatMap((item) => (item.scorecards || []).map((entry) => Number(entry.scorecard?.overall || 0))).filter(Boolean);
    if (!scores.length) return "-";
    return (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2);
  }, [items]);

  async function handleDeleteData() {
    if (!window.confirm("Delete all interviews, transcripts, and scorecards for this account?")) return;
    setDeleting(true);
    setError("");
    try {
      const response = await fetch("/api/privacy/delete", { method: "POST" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Deletion failed");
      setItems([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="shell">
      <section className="panel">
        <h1>Interview dashboard</h1>
        <p className="muted">Track round status, revisit transcripts, and access score reports.</p>

        <div className="stats">
          <div className="stat">
            <span className="muted">Interviews</span>
            <b>{items.length}</b>
          </div>
          <div className="stat">
            <span className="muted">Average coaching score</span>
            <b>{averageScore}</b>
          </div>
          <div className="stat">
            <span className="muted">Completed rounds</span>
            <b>{items.reduce((count, item) => count + (item.scorecards?.length || 0), 0)}</b>
          </div>
        </div>

        <div className="actions">
          <Link className="button primary" href="/">
            Start new interview
          </Link>
          <button className="button danger" onClick={handleDeleteData} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete my stored data"}
          </button>
        </div>

        {loading ? <p className="muted">Loading interviews...</p> : null}
        {error ? <p className="error">{error}</p> : null}

        {!loading && !items.length ? <p className="muted">No interviews yet. Start from the landing page.</p> : null}

        {items.length ? (
          <table className="table section">
            <thead>
              <tr>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.role_title}</td>
                  <td>{item.status}</td>
                  <td>{new Date(item.created_at).toLocaleString()}</td>
                  <td>
                    <div className="actions">
                      <Link className="button ghost" href={`/interview/${item.id}`}>
                        Open room
                      </Link>
                      <Link className="button ghost" href={`/report/${item.id}`}>
                        View report
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </main>
  );
}
