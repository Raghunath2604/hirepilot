import Link from "next/link";
import { AuthBar } from "@/components/AuthBar";
import { ResumeAnalyzerForm } from "@/components/ResumeAnalyzerForm";

export default function HomePage() {
  return (
    <main className="shell">
      <header className="top">
        <div className="brand">
          <div className="logo" aria-hidden="true">HP</div>
          <div><strong>HirePilot AI</strong><div className="muted tiny">Recruiter-grade interview practice</div></div>
        </div>
        <AuthBar />
      </header>

      <section className="hero section">
        <div className="panel hero-copy">
          <span className="tag">Senior recruiter + live voice coach</span>
          <h1>Turn your resume into a realistic interview.</h1>
          <p className="lead">HirePilot extracts ATS keywords, maps them to evidence, then runs adaptive Technical and HR/Behavioral voice rounds.</p>
          <div className="chips">
            <span className="chip">Evidence-backed ATS analysis</span>
            <span className="chip">~8 Technical questions</span>
            <span className="chip">~8 HR questions</span>
            <span className="chip">1–5 coaching scorecards</span>
          </div>
          <div className="actions"><Link className="button ghost" href="/dashboard">View history</Link></div>
        </div>
        <ResumeAnalyzerForm />
      </section>

      <section className="stats section">
        <div className="stat"><b>01</b><span className="muted">Resume + JD</span></div>
        <div className="stat"><b>02</b><span className="muted">Two live voice rounds</span></div>
        <div className="stat"><b>03</b><span className="muted">Evidence + next steps</span></div>
      </section>

      <p className="muted tiny section">Practice only. Scores are coaching feedback, not employment decisions. You can delete stored interview data from the dashboard.</p>
    </main>
  );
}
