import type { Json } from "@/types/database";

type GeminiRole = "user" | "model";

export type GeminiContentPart =
  | { text: string }
  | { thought?: boolean; thoughtSignature?: string; text?: string } // thinking part
  | {
      functionCall: {
        name: string;
        id?: string;
        args: unknown;
        thought_signature?: string; // ← preserve this
      };
    }
  | {
      functionResponse: {
        name: string;
        response: { result: Json };
        id?: string;
      };
    };

export type GeminiContent = {
  role: GeminiRole;
  parts: GeminiContentPart[];
};

export interface FunctionCall {
  name: string;
  id?: string;
  args: unknown;
  thought_signature?: string; // ← carry it through
}

export interface GeminiGenerateResult {
  text?: string;
  functionCalls: FunctionCall[];
  rawParts?: unknown[]; // ← expose raw parts so callers can echo them back
  raw?: unknown;
}

export interface GeminiToolDeclaration {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractFunctionCalls(parts: unknown): FunctionCall[] {
  if (!Array.isArray(parts)) return [];
  const calls: FunctionCall[] = [];
  for (const part of parts) {
    if (!isObject(part)) continue;
    const fc = part.functionCall;
    if (!fc || !isObject(fc)) continue;
    const name = typeof fc.name === "string" ? fc.name : undefined;
    if (!name) continue;
    const id = typeof fc.id === "string" ? fc.id : undefined;
    // Preserve thought_signature — required by thinking models
    const thought_signature =
      typeof fc.thought_signature === "string" ? fc.thought_signature : undefined;
    calls.push({ name, id, args: fc.args, thought_signature });
  }
  return calls;
}

function extractText(parts: unknown): string | undefined {
  if (!Array.isArray(parts)) return undefined;
  for (const part of parts) {
    if (!isObject(part)) continue;
    if (typeof part.text === "string" && !part.thought) return part.text;
  }
  return undefined;
}

export async function geminiGenerateContent(params: {
  apiKey: string;
  model: string;
  contents: GeminiContent[];
  tools: Array<{ functionDeclarations: GeminiToolDeclaration[] }>;
}): Promise<GeminiGenerateResult> {
  const { apiKey, model, contents, tools } = params;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      tools,
      toolConfig: {
        functionCallingConfig: {
          mode: "AUTO",
        },
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Gemini request failed (${response.status}): ${text}`);
  }

  const json: unknown = await response.json();
  if (!isObject(json)) {
    throw new Error("Gemini response is not an object");
  }

  const candidates = json.candidates;
  const firstCandidate = Array.isArray(candidates) ? candidates[0] : undefined;
  const content = isObject(firstCandidate) ? firstCandidate.content : undefined;
  const parts = isObject(content) ? content.parts : undefined;
  const rawParts = Array.isArray(parts) ? parts : undefined;

  return {
    text: extractText(parts),
    functionCalls: extractFunctionCalls(parts),
    rawParts, // ← callers use this to build the next model turn
    raw: json,
  };
}