import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getInterview } from "@/lib/db";
import { realtimeModel, transcribeModel } from "@/lib/openai";
import { buildInterviewInstructions } from "@/lib/agent/recruiter-agent";
import { roundSchema } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";
import { stableSafetyIdentifier } from "@/lib/security";

export const runtime = "nodejs";

function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  return !origin || origin === new URL(req.url).origin;
}

function requestIdentifier(req: Request, userId: string) {
  const forwarded = req.headers.get("x-forwarded-for") || "local";
  return `${userId}:${forwarded.split(",")[0]?.trim() || "local"}`;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });

  try {
    const user = await requireUser();
    const limit = await enforceRateLimit(requestIdentifier(req, user.id));
    if (!limit.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

    const { id } = await params;
    const payload = await req.json();
    const round = roundSchema.parse(payload.round);
    const interview = await getInterview(id, user.id);
    if (!interview) return NextResponse.json({ error: "Interview not found" }, { status: 404 });

    if (round === "hr" && !(interview.scorecards ?? []).some((entry: { round: string }) => entry.round === "technical")) {
      return NextResponse.json({ error: "TECHNICAL_ROUND_REQUIRED" }, { status: 409 });
    }

    const apiKey = process.env["OPENAI_" + "API_KEY"];
    if (!apiKey) return NextResponse.json({ error: "OpenAI credential is not configured" }, { status: 503 });

    const instructions = buildInterviewInstructions({
      role: interview.role_title,
      jobDescription: interview.job_description,
      analysis: interview.resume_analysis,
      round
    });

    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: ["Bearer", apiKey].join(" "),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: realtimeModel(),
        voice: "alloy",
        modalities: ["audio", "text"],
        instructions,
        input_audio_transcription: { model: transcribeModel() },
        turn_detection: { type: "server_vad" },
        metadata: {
          interview_id: interview.id,
          round,
          safety_user: stableSafetyIdentifier(user.id)
        }
      })
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: `Realtime session failed: ${text.slice(0, 500)}` }, { status: 502 });
    }

    const session = (await response.json()) as { client_secret?: { value?: string } };
    const clientSecret = session.client_secret?.value;
    if (!clientSecret) return NextResponse.json({ error: "Realtime session missing client secret" }, { status: 502 });

    return NextResponse.json({
      clientSecret,
      model: realtimeModel()
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : 400 });
  }
}
