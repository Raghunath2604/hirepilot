import type { InterviewRound } from "./types";

export const recruiterInstructions = `You are HirePilot AI, a senior technical recruiter and interview coach. Use only the supplied resume and target job description as evidence. Extract role-relevant ATS keywords, map them to concrete resume evidence, identify skills the role requests that are not demonstrated, and create interview focus areas. Never invent credentials, employers, projects, dates, metrics, or technologies. Do not use protected characteristics and do not make hiring or ranking decisions.`;

export const scoreInstructions = (round: InterviewRound) => `You are a senior interview coach reviewing a completed ${round} round. Score only demonstrated evidence in the transcript on a 1-5 coaching scale. Return one scored entry for each substantive interviewer question you can identify, preserving question order and numbering from 1 to at most 8. Every question entry needs transcript evidence and actionable feedback. Also provide cross-question dimensions, strengths, gaps, and concrete next steps. Do not infer personality, intelligence, protected characteristics, accent, or background. Do not make a hiring decision.`;

export const atsSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    role: { type: "string" },
    summary: { type: "string" },
    resumeItems: { type: "array", items: { type: "object", additionalProperties: false, properties: { item:{type:"string"}, relevantKeywords:{type:"array",items:{type:"string"}}, evidence:{type:"string"} }, required:["item","relevantKeywords","evidence"] } },
    atsKeywords: { type: "array", items: { type: "object", additionalProperties: false, properties: { keyword:{type:"string"}, importance:{type:"string",enum:["critical","high","medium"]}, evidence:{type:"string"} }, required:["keyword","importance","evidence"] } },
    matchedSkills: { type: "array", items: { type:"string" } },
    gaps: { type: "array", items: { type:"string" } },
    projects: { type:"array", items:{type:"object",additionalProperties:false,properties:{name:{type:"string"},relevantKeywords:{type:"array",items:{type:"string"}},evidence:{type:"string"}},required:["name","relevantKeywords","evidence"] } },
    interviewFocus: { type:"array", items:{type:"string"} }
  },
  required:["role","summary","resumeItems","atsKeywords","matchedSkills","gaps","projects","interviewFocus"]
} as const;

export const scoreSchema = {
  type:"object",
  additionalProperties:false,
  properties:{
    round:{type:"string",enum:["technical","hr"]},
    overall:{type:"number",minimum:1,maximum:5},
    questions:{
      type:"array",
      items:{
        type:"object",
        additionalProperties:false,
        properties:{
          questionNumber:{type:"integer",minimum:1,maximum:8},
          question:{type:"string"},
          score:{type:"number",minimum:1,maximum:5},
          evidence:{type:"string"},
          feedback:{type:"string"}
        },
        required:["questionNumber","question","score","evidence","feedback"]
      }
    },
    dimensions:{
      type:"array",
      items:{
        type:"object",
        additionalProperties:false,
        properties:{name:{type:"string"},score:{type:"number",minimum:1,maximum:5},evidence:{type:"string"},feedback:{type:"string"}},
        required:["name","score","evidence","feedback"]
      }
    },
    strengths:{type:"array",items:{type:"string"}},
    gaps:{type:"array",items:{type:"string"}},
    nextSteps:{type:"array",items:{type:"string"}}
  },
  required:["round","overall","questions","dimensions","strengths","gaps","nextSteps"]
} as const;
