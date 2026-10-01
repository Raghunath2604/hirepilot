import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthBar } from "@/components/AuthBar";
import { getUser } from "@/lib/auth";
import { getInterview } from "@/lib/db";
import type { ResumeAnalysis, Scorecard } from "@/lib/types";

export const dynamic = "force-dynamic";

function ScoreBlock({ score }: { score: Scorecard }) {
  return (
    <section className="panel section">
      <div className="top compact-top">
        <div><span className="tag">{score.round === "technical" ? "Technical" : "HR / Behavioral"}</span><h2>{score.overall.toFixed(1)} / 5</h2></div>
        <span className="muted tiny">Evidence-based coaching</span>
      </div>
      <div className="score-grid">{score.dimensions.map(dimension => <div className="kpi" key={dimension.name}><strong>{dimension.name}</strong><div className="score-number">{dimension.score.toFixed(1)}</div><p>{dimension.feedback}</p><span className="tiny muted">Evidence: {dimension.evidence}</span></div>)}</div>
      <div className="grid-2 section">
        <div><h3>Strengths</h3><ul className="clean-list">{score.strengths.map(item => <li key={item}>{item}</li>)}</ul></div>
        <div><h3>Gaps</h3><ul className="clean-list">{score.gaps.map(item => <li key={item}>{item}</li>)}</ul></div>
      </div>
      <div className="section"><h3>Next steps</h3><ul className="clean-list">{score.nextSteps.map(item => <li key={item}>{item}</li>)}</ul></div>
    </section>
  );
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) redirect("/");
  const { id } = await params;
  const interview = await getInterview(id, user.id);
  if (!interview) notFound();

  const analysis = interview.resume_analysis as ResumeAnalysis;
  const scorecards = (interview.scorecards ?? []) as Array<{ round: "technical" | "hr"; scorecard: Scorecard }>;
  const technical = scorecards.find(item => item.round === "technical")?.scorecard;
  const hr = scorecards.find(item => item.round === "hr")?.scorecard;

  return (
    <main className="shell">
      <header className="top">
        <div><span className="tag">Final report</span><h1>{interview.role_title}</h1><p className="muted">{new Date(interview.created_at).toLocaleString()}</p></div>
        <div className="actions"><Link className="button ghost" href="/dashboard">Dashboard</Link><AuthBar /></div>
      </header>
      <section className="panel">
        <span className="tag">Senior recruiter brief</span>
        <h2>ATS keywords and evidence</h2>
        <p>{analysis.summary}</p>
        <div className="chips">{analysis.atsKeywords.map(item => <span className="chip" key={item.keyword}>{item.keyword} • {item.importance}</span>)}</div>
        <div className="grid-2 section">
          <div><h3>Matched skills</h3><div className="chips">{analysis.matchedSkills.map(item => <span className="chip" key={item}>{item}</span>)}</div></div>
          <div><h3>Evidence gaps</h3>{analysis.gaps.length ? <ul className="clean-list">{interview.resume_analysis.gaps.map(item => <li key={item}>{item}</li>)}</ul> : <p className="muted">No material gaps flagged.</p>}</div>
        </div>
      </section>
      {technical ? <ScoreBlock score={technical} /> : <div className="panel section">Technical scorecard pending.</div>}
      {hr ? <ScoreBlock score={hr} /> : <div className="panel section">HR / Behavioral scorecard pending.</div>}
      <p className="muted tiny section">HirePilot is an interview-preparation tool. Scores summarize transcript evidence and are not employment decisions.</p>
    </main>
  );
}
