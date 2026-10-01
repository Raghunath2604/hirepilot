import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getInterview } from "@/lib/db";
import { realtimeModel, transcribeModel } from "@/lib/openai";
import { buildInterviewInstructions } from "@/lib/agent/recruiter-agent";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isSameOrigin, stableSafetyIdentifier } from "@/lib/security";
import { roundSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const user = await requireUser();
    const limit = await enforceRateLimit(`${user.id}:realtime-token`, 12, 60);
    if (!limit.success) return NextResponse.json({ error: "Too many voice sessions. Try again shortly." }, { status: 429 });

    const body = await req.json();
    const interviewId = String(body?.interviewId || "");
    const round = roundSchema.parse(body?.round);

    if (!/^[0-9a-f-]{36}$/i.test(interviewId)) {
      return NextResponse.json({ error: "Invalid interview ID." }, { status: 400 });
    }

    const interview = await getInterview(interviewId, user.id);
    if (!interview) return NextResponse.json({ error: "Interview not found." }, { status: 404 });

    const activeStatus = round === "technical" ? "technical" : "hr";
    if (interview.status !== activeStatus) {
      return NextResponse.json({ error: "Round is not active." }, { status: 409 });
    }

    const apiKey = process.env["OPENAI_" + "API_KEY"];
    if (!apiKey) return NextResponse.json({ error: "Voice service is not configured." }, { status: 503 });

    const session = {
      type: "realtime",
      model: realtimeModel(),
      instructions: buildInterviewInstructions({
        role: interview.role_title,
        jobDescription: interview.job_description,
        analysis: interview.resume_analysis,
        round,
      }),
      output_modalities: ["audio"],
      audio: {
        input: {
          transcription: { model: transcribeModel() },
          turn_detection: {
            type: "semantic_vad",
            eagerness: "auto",
            create_response: true,
            interrupt_response: true,
          },
        },
        output: {
          voice: "marin",
          speed: 1.0,
        },
      },
      metadata: {
        hirepilot_interview_id: interviewId,
        hirepilot_user: stableSafetyIdentifier(user.id),
        hirepilot_round: round,
      },
    };

    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": stableSafetyIdentifier(user.id),
      },
      body: JSON.stringify({ session }),
      cache: "no-store",
    });

    if (!response.ok) return NextResponse.json({ error: "Unable to create the voice session." }, { status: 502 });

    const data = await response.json() as { value?: string; client_secret?: { value?: string } };
    const clientSecret = data.value || data.client_secret?.value;
    if (!clientSecret) return NextResponse.json({ error: "Voice service returned no session credential." }, { status: 502 });

    return NextResponse.json(
      { value: clientSecret, model: realtimeModel(), expires_in_seconds: 60 },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    return NextResponse.json({ error: "Unable to create the voice session." }, { status: 400 });
  }
}
