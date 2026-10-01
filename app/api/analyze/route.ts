import { NextResponse } from "next/server";
import { getOpenAI, analysisModel } from "@/lib/openai";
import { requireUser } from "@/lib/auth";
import { atsSchema, recruiterInstructions } from "@/lib/prompts";
import { createInterview } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import type { ResumeAnalysis } from "@/lib/types";

export const runtime = "nodejs";
const okExt = new Set(["pdf", "docx", "txt", "md"]);

function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  return !origin || origin === new URL(req.url).origin;
}

function requestIdentifier(req: Request, userId: string) {
  const forwarded = req.headers.get("x-forwarded-for") || "local";
  return `${userId}:${forwarded.split(",")[0]?.trim() || "local"}`;
}

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    const user = await requireUser();
    const limit = await enforceRateLimit(requestIdentifier(req, user.id));
    if (!limit.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

    const form = await req.formData();
    const file = form.get("resume");
    const role = String(form.get("role") || "").trim();
    const jd = String(form.get("jobDescription") || "").trim();
    const maxJdChars = Number(process.env.MAX_JD_CHARS || 30000);
    if (!(file instanceof File) || !role || !jd) {
      return NextResponse.json({ error: "Resume, role and job description are required" }, { status: 400 });
    }

    if (jd.length > maxJdChars) return NextResponse.json({ error: "Job description is too long" }, { status: 413 });
    if (file.size === 0 || file.size > Number(process.env.MAX_RESUME_BYTES || 12000000)) {
      return NextResponse.json({ error: "Invalid resume size" }, { status: 413 });
    }

    const ext = file.name.toLowerCase().split(".").pop() || "";
    if (!okExt.has(ext)) return NextResponse.json({ error: "Use PDF, DOCX, TXT or MD" }, { status: 415 });

    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = file.type || (ext === "pdf" ? "application/pdf" : "application/octet-stream");
    const out = await getOpenAI().responses.create({
      model: analysisModel(),
      store: false,
      instructions: recruiterInstructions,
      input: [
        {
          role: "user",
          content: [
            { type: "input_file", filename: file.name, file_data: `data:${mime};base64,${bytes.toString("base64")}` },
            {
              type: "input_text",
              text: `Target role: ${role}\n\nJob description:\n${jd.slice(0, maxJdChars)}\n\nAnalyze the uploaded resume and return the structured recruiter analysis.`
            }
          ]
        }
      ],
      text: { format: { type: "json_schema", name: "resume_analysis", strict: true, schema: atsSchema } }
    });

    const analysis = JSON.parse(out.output_text) as ResumeAnalysis;
    const interview = await createInterview({ userId: user.id, role, jd, resumeFileName: file.name, analysis });
    const accepts = req.headers.get("accept") || "";
    if (accepts.includes("application/json")) return NextResponse.json({ interviewId: interview.id, analysis });
    return NextResponse.redirect(new URL(`/interview/${interview.id}`, req.url), 303);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : 500 });
  }
}
