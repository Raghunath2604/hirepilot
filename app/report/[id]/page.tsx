"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Scorecard = {
  round: "technical" | "hr";
  scorecard: {
    overall: number;
    strengths: string[];
    gaps: string[];
    nextSteps: string[];
    dimensions: Array<{ name: string; score: number; evidence: string; feedback: string }>;
  };
};

type InterviewReport = {
  role_title: string;
  created_at: string;
  scorecards?: Scorecard[];
};

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch(`/api/interviews/${params.id}`);
        const data = (await response.json()) as { interview?: InterviewReport; error?: string };
        if (!response.ok || !data.interview) throw new Error(data.error || "Unable to load report");
        if (active) setReport(data.interview);
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
  }, [params.id]);

  if (loading) return <main className="shell"><p className="muted">Loading report...</p></main>;
  if (!report) return <main className="shell"><p className="error">{error || "Report not found"}</p></main>;

  return (
    <main className="shell">
      <section className="panel">
        <h1>Coaching report</h1>
        <p className="muted">{report.role_title} · {new Date(report.created_at).toLocaleString()}</p>
        <div className="actions">
          <Link className="button ghost" href={`/interview/${params.id}`}>
            Back to interview room
          </Link>
          <Link className="button ghost" href="/dashboard">
            Dashboard
          </Link>
        </div>

        {!report.scorecards?.length ? <p className="muted section">No rounds scored yet.</p> : null}

        {report.scorecards?.map((entry) => (
          <article className="panel section" key={entry.round}>
            <h2>{entry.round.toUpperCase()} round · Overall {entry.scorecard.overall.toFixed(2)} / 5</h2>

            <div className="stats">
              {entry.scorecard.dimensions.map((dimension) => (
                <div className="kpi" key={dimension.name}>
                  <b>{dimension.score.toFixed(1)}</b>
                  <p>{dimension.name}</p>
                  <p className="muted tiny">{dimension.feedback}</p>
                </div>
              ))}
            </div>

            <div className="section">
              <b>Strengths</b>
              <ul>{entry.scorecard.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
            <div className="section">
              <b>Gaps</b>
              <ul>{entry.scorecard.gaps.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
            <div className="section">
              <b>Next steps</b>
              <ul>{entry.scorecard.nextSteps.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
