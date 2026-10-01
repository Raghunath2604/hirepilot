import { existsSync, readFileSync } from "node:fs";

const required = [
  ["app/api/realtime-token/route.ts", "v1/realtime/client_secrets"],
  ["app/api/realtime-token/route.ts", "semantic_vad"],
  ["components/InterviewRoom.tsx", "https://api.openai.com/v1/realtime/calls"],
  ["components/InterviewRoom.tsx", "/api/realtime-token"],
  ["lib/types.ts", "ScorecardQuestion"],
  ["lib/prompts.ts", "questionNumber"],
];

for (const [file, marker] of required) {
  if (!existsSync(file)) throw new Error(`Missing required file: ${file}`);
  const source = readFileSync(file, "utf8");
  if (!source.includes(marker)) throw new Error(`Missing architecture marker "${marker}" in ${file}`);
}

if (existsSync("app/api/realtime/route.ts")) {
  throw new Error("Superseded /api/realtime relay still exists; use ephemeral Realtime client secrets.");
}

const source = [
  readFileSync("components/InterviewRoom.tsx", "utf8"),
  readFileSync("app/api/realtime-token/route.ts", "utf8"),
].join("\n");

if (!source.includes("OpenAI-Safety-Identifier")) {
  throw new Error("Realtime safety identifier is not configured.");
}

if (source.includes("sk-proj-") || /sk-[A-Za-z0-9_-]{20,}/.test(source)) {
  throw new Error("Potential OpenAI secret found in source.");
}

console.log("HirePilot architecture contract: OK");