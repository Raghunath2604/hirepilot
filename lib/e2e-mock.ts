import type { InterviewRound, ResumeAnalysis, Scorecard } from "./types";

export function e2eMockEnabled() {
  return process.env.E2E_MOCK_AI === "true" && process.env.NODE_ENV !== "production";
}

export function mockResumeAnalysis(role: string): ResumeAnalysis {
  return {
    role,
    summary: `Demo recruiter analysis for ${role}. The candidate shows relevant engineering, MLOps, and production delivery evidence.`,
    resumeItems: [
      { item: "MLOps engineering experience", relevantKeywords: ["MLOps", "ML pipelines", "monitoring"], evidence: "Resume describes an AI Reliability Platform with drift detection, monitoring, retraining triggers, and deployment automation." },
      { item: "Backend and cloud engineering", relevantKeywords: ["Python", "FastAPI", "Docker", "Kubernetes"], evidence: "Resume lists Python, FastAPI, Docker and Kubernetes experience." },
    ],
    atsKeywords: [
      { keyword: "Python", importance: "critical", evidence: "Listed directly in the resume." },
      { keyword: "FastAPI", importance: "high", evidence: "Used in the PlagiaScan project." },
      { keyword: "Docker", importance: "high", evidence: "Listed as a production engineering skill." },
      { keyword: "Kubernetes", importance: "high", evidence: "Listed as a deployment skill." },
      { keyword: "CI/CD", importance: "high", evidence: "Resume describes CI/CD experience." },
      { keyword: "monitoring", importance: "high", evidence: "AI Reliability Platform includes model monitoring." },
    ],
    matchedSkills: ["Python", "FastAPI", "Docker", "Kubernetes", "PostgreSQL", "CI/CD", "Monitoring", "ML pipelines"],
    gaps: ["Add measurable production scale or latency metrics where available."],
    projects: [
      { name: "PlagiaScan", relevantKeywords: ["FastAPI", "React", "RoBERTa-BERT", "Qdrant"], evidence: "Semantic plagiarism detection platform with transformer models and vector retrieval." },
      { name: "AI Reliability Platform", relevantKeywords: ["MLOps", "drift detection", "retraining", "deployment"], evidence: "Platform monitors ML lifecycle health and automates operational responses." },
    ],
    interviewFocus: [
      "Explain production ML pipeline architecture and trade-offs.",
      "Describe model drift detection and response.",
      "Discuss deployment, observability, and incident debugging.",
    ],
  };
}

export function mockScore(round: InterviewRound): Scorecard {
  return {
    round,
    overall: 4,
    questions: [
      {
        questionNumber: 1,
        question: round === "technical" ? "Describe an MLOps architecture you have built." : "Tell me about a difficult project or incident you handled.",
        score: 4,
        evidence: "Candidate provided a concrete project example and explained the implementation.",
        feedback: "Add one measurable outcome and make the trade-off explicit.",
      },
      {
        questionNumber: 2,
        question: round === "technical" ? "How would you detect and respond to model drift?" : "How do you handle disagreement on a technical decision?",
        score: 4,
        evidence: "Candidate discussed a structured approach with relevant production context.",
        feedback: "Use a concise STAR structure and finish with the result.",
      },
    ],
    dimensions: [
      { name: "Technical depth", score: 4, evidence: "Relevant engineering concepts were explained.", feedback: "Go one level deeper into failure modes and trade-offs." },
      { name: "Clarity", score: 4, evidence: "Answers were understandable and structured.", feedback: "Lead with the conclusion, then give supporting detail." },
      { name: "Evidence", score: 4, evidence: "Project examples supported the answers.", feedback: "Quantify impact when possible." },
    ],
    strengths: ["Relevant MLOps project experience", "Good production-oriented thinking", "Clear technical communication"],
    gaps: ["More quantified outcomes would strengthen answers"],
    nextSteps: ["Practice 60-90 second STAR answers", "Prepare concrete production metrics", "Rehearse incident-response trade-offs"],
  };
}
