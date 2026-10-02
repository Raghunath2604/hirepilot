import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getInterview, saveScore, saveTranscript } from "@/lib/db";
import { getOpenAI, analysisModel } from "@/lib/openai";
import { scoreInstructions, scoreSchema } from "@/lib/prompts";
import { scoreSchemaInput } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isSameOrigin, stableSafetyIdentifier } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const user = await requireUser();
    const body = scoreSchemaInput.parse(await req.json());
    const limit = await enforceRateLimit(`${user.id}:score`, 12, 60);
    if (!limit.success) return NextResponse.json({ error: "Too many scoring requests." }, { status: 429 });

    const interview = await getInterview(body.interviewId, user.id);
    if (!interview) return NextResponse.json({ error: "Interview not found." }, { status: 404 });
    await saveTranscript(body.interviewId, user.id, body.round, body.transcript);

    const transcript = body.transcript.map(x => `${x.role === "assistant" ? "INTERVIEWER" : "CANDIDATE"}: ${x.text}`).join("\n").slice(0, 100000);
    const response = await getOpenAI().responses.create({
      model: analysisModel(),
      store: false,
      safety_identifier: stableSafetyIdentifier(user.id),
      instructions: scoreInstructions(body.round),
      input: `Role: ${interview.role_title}\nResume analysis: ${JSON.stringify(interview.resume_analysis)}\nTranscript:\n${transcript}`,
      text: { format: { type: "json_schema", name: "scorecard", strict: true, schema: scoreSchema } },
    });

    const score = JSON.parse(response.output_text);
    await saveScore(body.interviewId, user.id, body.round, score);
    if (process.env.ZAPIER_WEBHOOK_URL) {
      void fetch(process.env.ZAPIER_WEBHOOK_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event:"interview.scorecard.created", interviewId:body.interviewId, role:interview.role_title, round:body.round, score }),
      }).catch(() => {});
    }
    return NextResponse.json({ score });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    return NextResponse.json({ error: "Unable to score this round." }, { status: 400 });
  }
}
