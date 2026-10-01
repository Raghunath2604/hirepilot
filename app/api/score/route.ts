import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getInterview, saveScore, saveTranscript } from "@/lib/db";
import { getOpenAI, analysisModel } from "@/lib/openai";
import { scoreInstructions, scoreSchema } from "@/lib/prompts";
import { scoreSchemaInput } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  return !origin || origin === new URL(req.url).origin;
}

function requestIdentifier(req: Request, userId: string) {
  const forwarded = req.headers.get("x-forwarded-for") || "local";
  return `${userId}:${forwarded.split(",")[0]?.trim() || "local"}`;
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });

  try {
    const user = await requireUser();
    const limit = await enforceRateLimit(requestIdentifier(req, user.id));
    if (!limit.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

    const body = scoreSchemaInput.parse(await req.json());
    const maxMessages = Number(process.env.MAX_TRANSCRIPT_MESSAGES || 600);
    if (body.transcript.length > maxMessages) {
      return NextResponse.json({ error: "Transcript exceeds allowed size" }, { status: 413 });
    }

    const interview = await getInterview(body.interviewId, user.id);
    if (!interview) return NextResponse.json({ error: "Interview not found" }, { status: 404 });

    await saveTranscript(body.interviewId, user.id, body.round, body.transcript);
    const transcript = body.transcript
      .map((item) => `${item.role === "assistant" ? "INTERVIEWER" : "CANDIDATE"}: ${item.text}`)
      .join("\n");

    const response = await getOpenAI().responses.create({
      model: analysisModel(),
      store: false,
      instructions: scoreInstructions(body.round),
      input: `Role: ${interview.role_title}\nResume analysis: ${JSON.stringify(interview.resume_analysis)}\nTranscript:\n${transcript}`,
      text: { format: { type: "json_schema", name: "scorecard", strict: true, schema: scoreSchema } }
    });

    const score = JSON.parse(response.output_text);
    await saveScore(body.interviewId, user.id, body.round, score);

    const hook = process.env.ZAPIER_WEBHOOK_URL;
    if (hook) {
      void fetch(hook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "interview.scorecard.created",
          interviewId: body.interviewId,
          role: interview.role_title,
          round: body.round,
          score
        })
      }).catch(() => {});
    }

    return NextResponse.json({ score });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Scoring failed";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : 400 });
  }
}
