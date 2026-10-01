import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getInterview } from "@/lib/db";
import { getOpenAI, realtimeModel, transcribeModel } from "@/lib/openai";
import { buildInterviewInstructions } from "@/lib/agent/recruiter-agent";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isSameOrigin, stableSafetyIdentifier } from "@/lib/security";
import { roundSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const user = await requireUser();
    const limit = await enforceRateLimit(`${user.id}:realtime`, 12, 60);
    if (!limit.success) return NextResponse.json({ error: "Too many voice sessions. Try again shortly." }, { status: 429 });

    const form = await req.formData();
    const interviewId = String(form.get("interviewId") || "");
    const round = roundSchema.parse(String(form.get("round") || ""));
    const sdp = String(form.get("sdp") || "");
    if (!/^[0-9a-f-]{36}$/i.test(interviewId) || sdp.length < 100) {
      return NextResponse.json({ error: "Invalid voice request." }, { status: 400 });
    }

    const interview = await getInterview(interviewId, user.id);
    if (!interview) return NextResponse.json({ error: "Interview not found." }, { status: 404 });
    if ((round === "technical" && interview.status !== "technical") || (round === "hr" && interview.status !== "hr")) {
      return NextResponse.json({ error: "Round is not active." }, { status: 409 });
    }

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
          transcription: { model: transcribeModel(), language: "en" },
          turn_detection: {
            type: "server_vad",
            create_response: true,
            interrupt_response: true,
            prefix_padding_ms: 300,
            silence_duration_ms: 650,
          },
        },
        output: { voice: "marin", speed: 1.0 },
      },
      metadata: {
        hirepilot_interview_id: interviewId,
        hirepilot_user: stableSafetyIdentifier(user.id),
        hirepilot_round: round,
      },
    };

    const formBody = new FormData();
    formBody.append("sdp", new Blob([sdp], { type: "application/sdp" }));
    formBody.append("session", new Blob([JSON.stringify(session)], { type: "application/json" }));

    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env["OPENAI_" + "API_KEY"] || ""}` },
      body: formBody,
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ error: "Unable to establish the voice session." }, { status: 502 });

    return new Response(await response.text(), {
      status: 201,
      headers: { "Content-Type": "application/sdp", "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    return NextResponse.json({ error: "Unable to establish the voice session." }, { status: 400 });
  }
}
