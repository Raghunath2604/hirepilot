import { NextResponse } from "next/server";
import { getOpenAI, analysisModel } from "@/lib/openai";
import { requireUser } from "@/lib/auth";
import { atsSchema, recruiterInstructions } from "@/lib/prompts";
import { createInterview } from "@/lib/db";
import type { ResumeAnalysis } from "@/lib/types";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isSameOrigin, stableSafetyIdentifier } from "@/lib/security";
import { e2eMockEnabled, mockResumeAnalysis } from "@/lib/e2e-mock";

export const runtime = "nodejs";
export const maxDuration = 60;

const allowed = new Set(["pdf", "docx", "txt", "md"]);

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const user = await requireUser();
    const limit = await enforceRateLimit(`${user.id}:analyze`, 8, 60);
    if (!limit.success) return NextResponse.json({ error: "Too many analysis requests." }, { status: 429 });

    const form = await req.formData();
    const file = form.get("resume");
    const role = String(form.get("role") || "").trim().slice(0, 200);
    const jd = String(form.get("jobDescription") || "").trim().slice(0, 30000);
    if (!(file instanceof File) || role.length < 2 || jd.length < 10) {
      return NextResponse.json({ error: "Resume, target role, and job description are required." }, { status: 400 });
    }

    const maxBytes = Math.min(Number(process.env.MAX_RESUME_BYTES || 12000000), 12000000);
    if (file.size === 0 || file.size > maxBytes) return NextResponse.json({ error: "Resume is empty or too large." }, { status: 413 });

    const safeName = file.name.replace(/[\/\u0000]/g, "_").trim().slice(0, 255) || "resume";
    const ext = safeName.toLowerCase().split(".").pop() || "";
    if (!allowed.has(ext)) return NextResponse.json({ error: "Use PDF, DOCX, TXT, or MD." }, { status: 415 });

    if (e2eMockEnabled()) {
      const analysis = mockResumeAnalysis(role);
      const interview = await createInterview({ userId: user.id, role, jd, resumeFileName: safeName, analysis });
      return NextResponse.json({ interviewId: interview.id, analysis });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = ext === "pdf" ? "application/pdf" : ext === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/plain";

    const result = await getOpenAI().responses.create({
      model: analysisModel(),
      store: false,
      safety_identifier: stableSafetyIdentifier(user.id),
      instructions: recruiterInstructions,
      input: [{
        role: "user",
        content: [
          { type: "input_file", filename: safeName, file_data: `data:${mime};base64,${bytes.toString("base64")}` },
          { type: "input_text", text: `Target role: ${role}\n\nJob description:\n${jd}\n\nAnalyze the uploaded resume and return the structured recruiter analysis.` },
        ],
      }],
      text: { format: { type: "json_schema", name: "resume_analysis", strict: true, schema: atsSchema } },
    });

    const analysis = JSON.parse(result.output_text) as ResumeAnalysis;
    const interview = await createInterview({ userId: user.id, role, jd, resumeFileName: safeName, analysis });
    return NextResponse.json({ interviewId: interview.id, analysis });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const errorDetails = error instanceof Error ? error.message : String(error);
    const safeDetails = errorDetails.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted-key]").slice(0, 500);
    console.error("[api/analyze] request failed", {
      name: error instanceof Error ? error.name : "unknown",
      message: safeDetails,
      status: typeof error === "object" && error !== null && "status" in error ? error.status : undefined,
      code: typeof error === "object" && error !== null && "code" in error ? error.code : undefined,
    });

    return NextResponse.json({ error: "Resume analysis failed. Please try again." }, { status: 500 });
  }
}
