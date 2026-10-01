import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { InterviewRound, ResumeAnalysis, Scorecard, TranscriptItem } from "./types";

type MemoryInterview = {
  id: string;
  user_id: string;
  role_title: string;
  job_description: string;
  resume_text: string;
  resume_analysis: ResumeAnalysis;
  status: string;
  created_at: string;
  [key: string]: unknown;
};

let admin: SupabaseClient | null = null;
const memory = new Map<string, MemoryInterview>();

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env["SUPABASE_" + "SERVICE_ROLE_KEY"] || process.env["SUPABASE_" + "SECRET_KEY"];
  if (!url || !key) {
    if (process.env.NODE_ENV === "production") throw new Error("DATABASE_CONFIG");
    return null;
  }
  admin ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

export async function createInterview(input: {
  userId: string;
  role: string;
  jd: string;
  resumeFileName: string;
  analysis: ResumeAnalysis;
}) {
  const id = crypto.randomUUID();
  const row: MemoryInterview = {
    id,
    user_id: input.userId,
    role_title: input.role,
    job_description: input.jd,
    resume_text: `Uploaded resume: ${input.resumeFileName}`,
    resume_analysis: input.analysis,
    status: "created",
    created_at: new Date().toISOString(),
  };
  const db = getAdmin();
  if (!db) {
    memory.set(id, row);
    return row;
  }
  const { data, error } = await db.from("interviews").insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getInterview(id: string, userId: string) {
  const db = getAdmin();
  if (!db) {
    const row = memory.get(id);
    return row && row.user_id === userId ? row : null;
  }
  const { data, error } = await db.from("interviews")
    .select("*, scorecards(round, scorecard), interview_rounds(round, transcript, started_at, ended_at)")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function listInterviews(userId: string) {
  const db = getAdmin();
  if (!db) {
    return [...memory.values()]
      .filter(x => x.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const { data, error } = await db.from("interviews")
    .select("id, role_title, status, created_at, scorecards(round, scorecard)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveTranscript(
  id: string,
  userId: string,
  round: InterviewRound,
  transcript: TranscriptItem[],
) {
  const db = getAdmin();
  if (!db) {
    const row = memory.get(id);
    if (row?.user_id === userId) row[`transcript_${round}`] = transcript;
    return;
  }
  const interview = await getInterview(id, userId);
  if (!interview) throw new Error("NOT_FOUND");
  const { error } = await db.from("interview_rounds").upsert({
    interview_id: id,
    round,
    transcript,
    ended_at: new Date().toISOString(),
  }, { onConflict: "interview_id,round" });
  if (error) throw new Error(error.message);
}

export async function startRound(id: string, userId: string, round: InterviewRound) {
  const db = getAdmin();
  if (!db) {
    const row = memory.get(id);
    if (row?.user_id !== userId) throw new Error("NOT_FOUND");
    row.status = round === "technical" ? "technical" : "hr";
    return row;
  }

  const interview = await getInterview(id, userId);
  if (!interview) throw new Error("NOT_FOUND");

  const scorecards = Array.isArray(interview.scorecards) ? interview.scorecards : [];
  const hasTechnicalScore = scorecards.some(
    (entry: { round?: InterviewRound }) => entry.round === "technical",
  );
  if (round === "hr" && !hasTechnicalScore) throw new Error("TECHNICAL_ROUND_REQUIRED");

  const { error: roundError } = await db.from("interview_rounds").upsert({
    interview_id: id,
    round,
    transcript: [],
    started_at: new Date().toISOString(),
  }, { onConflict: "interview_id,round" });
  if (roundError) throw new Error(roundError.message);

  const { error } = await db.from("interviews")
    .update({ status: round === "technical" ? "technical" : "hr" })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function saveScore(
  id: string,
  userId: string,
  round: InterviewRound,
  scorecard: Scorecard,
) {
  const db = getAdmin();
  if (!db) {
    const row = memory.get(id);
    if (row?.user_id !== userId) throw new Error("NOT_FOUND");
    row[`score_${round}`] = scorecard;
    row.status = round === "technical" ? "technical_complete" : "completed";
    return;
  }

  const interview = await getInterview(id, userId);
  if (!interview) throw new Error("NOT_FOUND");
  const { error } = await db.from("scorecards").upsert(
    { interview_id: id, round, scorecard },
    { onConflict: "interview_id,round" },
  );
  if (error) throw new Error(error.message);

  const { error: statusError } = await db.from("interviews")
    .update({ status: round === "technical" ? "technical_complete" : "completed" })
    .eq("id", id)
    .eq("user_id", userId);
  if (statusError) throw new Error(statusError.message);
}

export async function deleteUserData(userId: string) {
  const db = getAdmin();
  if (!db) {
    for (const [id, row] of memory.entries()) {
      if (row.user_id === userId) memory.delete(id);
    }
    return;
  }
  const { error } = await db.from("interviews").delete().eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function purgeOldData(days: number) {
  const db = getAdmin();
  if (!db) return;
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const { error } = await db.from("interviews").delete().lt("created_at", cutoff);
  if (error) throw new Error(error.message);
}
