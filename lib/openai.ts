import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAI() {
  const key = process.env["OPENAI_" + "API_KEY"];
  if (!key) throw new Error("OpenAI credential is not configured");
  client ??= new OpenAI({ apiKey: key });
  return client;
}
export function analysisModel() { return process.env["OPENAI_" + "ANALYSIS_MODEL"] || "gpt-5.2"; }
export function realtimeModel() { return process.env["OPENAI_" + "REALTIME_MODEL"] || "gpt-realtime-2.1"; }
export function transcribeModel() { return process.env["OPENAI_" + "TRANSCRIBE_MODEL"] || "gpt-4o-mini-transcribe"; }
