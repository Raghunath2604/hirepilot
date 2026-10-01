export type InterviewRound = "technical" | "hr";
export type Importance = "critical" | "high" | "medium";

export type ResumeAnalysis = {
  role: string;
  summary: string;
  resumeItems: Array<{ item: string; relevantKeywords: string[]; evidence: string }>;
  atsKeywords: Array<{ keyword: string; importance: Importance; evidence: string }>;
  matchedSkills: string[];
  gaps: string[];
  projects: Array<{ name: string; relevantKeywords: string[]; evidence: string }>;
  interviewFocus: string[];
};

export type TranscriptItem = {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: number;
};

export type ScorecardQuestion = {
  questionNumber: number;
  question: string;
  score: number;
  evidence: string;
  feedback: string;
};

export type Scorecard = {
  round: InterviewRound;
  overall: number;
  questions: ScorecardQuestion[];
  dimensions: Array<{ name: string; score: number; evidence: string; feedback: string }>;
  strengths: string[];
  gaps: string[];
  nextSteps: string[];
};

export type InterviewRecord = {
  id: string;
  role_title: string;
  job_description: string;
  resume_text: string;
  resume_analysis: ResumeAnalysis;
  status: string;
  created_at: string;
  scorecards?: Array<{ round: InterviewRound; scorecard: Scorecard }>;
};
