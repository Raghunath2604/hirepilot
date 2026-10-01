"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type AnalysisPreview = {
  summary: string;
  matchedSkills: string[];
  gaps: string[];
  interviewFocus: string[];
};

export default function Home() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resume, setResume] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<AnalysisPreview | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (!resume) throw new Error("Upload a resume file first");
      const formData = new FormData();
      formData.append("resume", resume);
      formData.append("role", role);
      formData.append("jobDescription", jobDescription);

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: formData
      });
      const data = (await response.json()) as { error?: string; interviewId?: string; analysis?: AnalysisPreview };
      if (!response.ok || !data.interviewId || !data.analysis) throw new Error(data.error || "Analysis failed");

      setPreview(data.analysis);
      router.push(`/interview/${data.interviewId}?round=technical`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <section className="panel hero">
        <form className="panel" onSubmit={handleSubmit}>
          <h1>Role-targeted resume analysis</h1>
          <p className="muted">Upload a resume and generate evidence-based interview preparation in one secure flow.</p>

          <label>
            Target role
            <input className="input" value={role} onChange={(event) => setRole(event.target.value)} maxLength={200} required />
          </label>

          <label>
            Full job description
            <textarea
              className="textarea"
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              maxLength={30000}
              required
            />
          </label>

          <label>
            Resume file (PDF, DOCX, TXT, MD)
            <input
              className="input"
              type="file"
              accept=".pdf,.docx,.txt,.md"
              onChange={(event) => setResume(event.target.files?.[0] || null)}
              required
            />
          </label>

          <div className="actions">
            <button className="button primary" type="submit" disabled={loading}>
              {loading ? "Analyzing..." : "Analyze & start technical round"}
            </button>
          </div>

          {error ? <p className="error">{error}</p> : null}
        </form>

        <div className="panel">
          <h2>Privacy & safety</h2>
          <ul className="muted">
            <li>Resume analysis is evidence-based and role-specific.</li>
            <li>No hiring decision or ranking is generated.</li>
            <li>Protected characteristics are excluded from scoring.</li>
            <li>You can delete all stored interview data from the dashboard.</li>
          </ul>

          {preview ? (
            <div className="section">
              <h3>Latest analysis snapshot</h3>
              <p className="muted">{preview.summary}</p>
              <div>
                <b>Matched skills</b>
                <div className="chips">{preview.matchedSkills.map((skill) => <span className="chip" key={skill}>{skill}</span>)}</div>
              </div>
              <div>
                <b>Gaps</b>
                <div className="chips">{preview.gaps.map((gap) => <span className="chip" key={gap}>{gap}</span>)}</div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
