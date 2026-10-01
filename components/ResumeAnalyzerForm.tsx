"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResumeAnalyzerForm() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!file || role.trim().length < 2 || jobDescription.trim().length < 10) {
      setError("Add the target role, full job description, and resume.");
      return;
    }
    const ext = file.name.toLowerCase().split(".").pop() || "";
    if (!["pdf", "docx", "txt", "md"].includes(ext)) {
      setError("Use PDF, DOCX, TXT, or MD.");
      return;
    }
    if (file.size <= 0 || file.size > 12_000_000) {
      setError("Resume must be between 1 byte and 12 MB.");
      return;
    }

    setBusy(true);
    try {
      const body = new FormData();
      body.append("role", role);
      body.append("jobDescription", jobDescription);
      body.append("resume", file);
      const response = await fetch("/api/analyze", { method: "POST", body });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Resume analysis failed.");
      router.push(`/interview/${payload.interviewId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resume analysis failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <div className="section-title">
        <div><span className="tag">Step 1</span><h2>Build your interview</h2></div>
        <span className="muted tiny">OpenAI analysis runs server-side</span>
      </div>
      <label className="label" htmlFor="role">Target role</label>
      <input id="role" className="input" value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. MLOps Engineer" />
      <label className="label" htmlFor="jd">Job description</label>
      <textarea id="jd" className="textarea" value={jobDescription} onChange={e => setJobDescription(e.target.value)} placeholder="Paste the complete job description..." />
      <label className="label" htmlFor="resume">Resume</label>
      <input id="resume" className="input" type="file" accept=".pdf,.docx,.txt,.md,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} />
      {file && <div className="success">Ready: {file.name}</div>}
      {error && <div className="error">{error}</div>}
      <button className="button primary wide" type="button" disabled={busy} onClick={submit}>
        {busy ? "Analyzing resume…" : "Analyze resume & start interview"}
      </button>
      <p className="muted tiny">The permanent OpenAI API key is never sent to the browser.</p>
    </div>
  );
}
