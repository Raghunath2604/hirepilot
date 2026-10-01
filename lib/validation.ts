import { z } from "zod";

export const roundSchema = z.enum(["technical", "hr"]);

export const interviewCreateSchema = z.object({
  role: z.string().trim().min(2).max(200),
  jobDescription: z.string().trim().min(10).max(30000),
  resumeFileName: z.string().trim().min(1).max(255),
  analysis: z.object({
    role: z.string(),
    summary: z.string(),
    resumeItems: z.array(z.object({
      item: z.string(),
      relevantKeywords: z.array(z.string()),
      evidence: z.string(),
    })),
    atsKeywords: z.array(z.object({
      keyword: z.string(),
      importance: z.enum(["critical", "high", "medium"]),
      evidence: z.string(),
    })),
    matchedSkills: z.array(z.string()),
    gaps: z.array(z.string()),
    projects: z.array(z.object({
      name: z.string(),
      relevantKeywords: z.array(z.string()),
      evidence: z.string(),
    })),
    interviewFocus: z.array(z.string()),
  }),
});

export const scoreSchemaInput = z.object({
  interviewId: z.string().uuid(),
  round: roundSchema,
  transcript: z.array(z.object({
    id: z.string().min(1).max(120),
    role: z.enum(["user", "assistant"]),
    text: z.string().trim().min(1).max(12000),
    at: z.number().int().nonnegative(),
  })).min(2).max(600),
});
