import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { InterviewRound, ResumeAnalysis, Scorecard, TranscriptItem } from "./types";

type MemoryRound = {
  round: InterviewRound;
  transcript: TranscriptItem[];
  started_at?: string;
  ended_at?: string;
};

type MemoryInterview = {
  id: string;
  user_id: string;
  role_title: string;
  job_description: string;
  resume_text: string;
  resume_analysis: ResumeAnalysis;
  status: string;
  created_at: string;
  scorecards: Array<{ round: InterviewRound; scorecard: Scorecard }>;
  interview_rounds: MemoryRound[];
};

let admin: SupabaseClient | null = null;
const memory = new Map<string, MemoryInterview>();

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env["SUPABASE_" + "SERVICE_ROLE_KEY"] || process.env["SUPABASE_" + "SECRET_KEY"];
  if (!url || !key) return null;
  admin ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

function findMemoryRound(row: MemoryInterview, round: InterviewRound) {
  let existing = row.interview_rounds.find((entry) => entry.round === round);
  if (!existing) {
    existing = { round, transcript: [] };
    row.interview_rounds.push(existing);
  }
  return existing;
}

export async function createInterview(input: { userId: string; role: string; jd: string; resumeFileName: string; analysis: ResumeAnalysis }) {
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
    scorecards: [],
    interview_rounds: []
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

  const { data, error } = await db
    .from("interviews")
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
      .filter((entry) => entry.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((entry) => ({
        id: entry.id,
        role_title: entry.role_title,
        status: entry.status,
        created_at: entry.created_at,
        scorecards: entry.scorecards
      }));
  }

  const { data, error } = await db
    .from("interviews")
    .select("id, role_title, status, created_at, scorecards(round, scorecard)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveTranscript(id: string, userId: string, round: InterviewRound, transcript: TranscriptItem[]) {
  const db = getAdmin();
  if (!db) {
    const row = memory.get(id);
    if (row?.user_id !== userId) throw new Error("NOT_FOUND");
    const memoryRound = findMemoryRound(row, round);
    memoryRound.transcript = transcript;
    memoryRound.ended_at = new Date().toISOString();
    return;
  }

  const interview = await getInterview(id, userId);
  if (!interview) throw new Error("NOT_FOUND");

  const { error } = await db.from("interview_rounds").upsert(
    {
      interview_id: id,
      round,
      transcript,
      ended_at: new Date().toISOString()
    },
    { onConflict: "interview_id,round" }
  );

  if (error) throw new Error(error.message);
}

export async function startRound(id: string, userId: string, round: InterviewRound) {
  const db = getAdmin();
  if (!db) {
    const row = memory.get(id);
    if (row?.user_id !== userId) throw new Error("NOT_FOUND");
    if (round === "hr" && !row.scorecards.some((entry) => entry.round === "technical")) {
      throw new Error("TECHNICAL_ROUND_REQUIRED");
    }
    const now = new Date().toISOString();
    const memoryRound = findMemoryRound(row, round);
    memoryRound.started_at = now;
    row.status = round === "technical" ? "technical" : "hr";
    return row;
  }

  const interview = await getInterview(id, userId);
  if (!interview) throw new Error("NOT_FOUND");
  if (round === "hr" && !(interview.scorecards ?? []).some((x: any) => x.round === "technical")) {
    throw new Error("TECHNICAL_ROUND_REQUIRED");
  }

  const { error: roundError } = await db.from("interview_rounds").upsert(
    {
      interview_id: id,
      round,
      transcript: [],
      started_at: new Date().toISOString()
    },
    { onConflict: "interview_id,round" }
  );

  if (roundError) throw new Error(roundError.message);

  const status = round === "technical" ? "technical" : "hr";
  const { error } = await db.from("interviews").update({ status }).eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function saveScore(id: string, userId: string, round: InterviewRound, scorecard: Scorecard) {
  const db = getAdmin();
  if (!db) {
    const row = memory.get(id);
    if (row?.user_id !== userId) throw new Error("NOT_FOUND");
    row.scorecards = row.scorecards.filter((entry) => entry.round !== round);
    row.scorecards.push({ round, scorecard });
    row.status = round === "technical" ? "technical_complete" : "completed";
    return;
  }

  const interview = await getInterview(id, userId);
  if (!interview) throw new Error("NOT_FOUND");

  const { error } = await db.from("scorecards").upsert({ interview_id: id, round, scorecard }, { onConflict: "interview_id,round" });
  if (error) throw new Error(error.message);

  const status = round === "technical" ? "technical_complete" : "completed";
  const { error: statusError } = await db.from("interviews").update({ status }).eq("id", id).eq("user_id", userId);
  if (statusError) throw new Error(statusError.message);
}

export async function deleteUserData(userId: string) {
  const db = getAdmin();
  if (!db) {
    for (const [id, row] of memory.entries()) if (row.user_id === userId) memory.delete(id);
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
