import { NextResponse } from "next/server";
import { z } from "zod";
import { geminiGenerateContent } from "@/lib/ai/gemini";
import { executeTool, geminiTools, type ToolName } from "@/lib/ai/tools";
import type { GeminiContent, GeminiContentPart } from "@/lib/ai/gemini";
import type { Json } from "@/types/database";

const requestSchema = z.object({
  message: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      }),
    )
    .optional(),
  orgId: z.string().optional(),
});

function toGeminiContents(input: {
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}): GeminiContent[] {
  const { systemPrompt, messages } = input;
  const contents: GeminiContent[] = [
    {
      role: "user",
      parts: [{ text: systemPrompt }],
    },
  ];

  for (const m of messages) {
    contents.push({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    });
  }

  return contents;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
  }

  const { message, messages: history, orgId } = parsed.data;
  const systemPrompt = [
    "You are the AI CFO for a robotic imaging enterprise.",
    "You must NOT guess financial data. Always use the provided tools to fetch real numbers from the database.",
    "Tool rules:",
    "If the user asks about a specific location/company name (e.g., 'Home Depot'), first resolve the matching organizations using `searchOrganizationsByName`.",
    "If the question spans multiple organizations, compute weighted results using real data (e.g., sum revenue and expenses across the orgs, then margin = (sum(revenue)-sum(expenses))/sum(revenue)*100). For time windows, use the user's requested months or default to 12 months.",
    "To answer 'burn rate', call `getBurnRate`.",
    "To answer 'Which projects are losing money?', call `getLosingProjects`.",
    "To answer travel-cost-per-survey changes over a timeframe, call `getExpenseTrends` with dateRange.months matching the request, then analyze the `travelCostPerSurvey` series.",
    "To audit technician expenses, call `detectAnomalies`.",
    "When you return numbers, include brief calculations (e.g., 'margin = (revenue-expenses)/revenue').",
    "If the request is ambiguous, ask a clarifying question.",
    "Keep answers concise but audit-friendly.",
    orgId ? `Default organization context (may be helpful): ${orgId}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const combinedMessages = history ?? [];
  combinedMessages.push({ role: "user", content: message });

  const contents: GeminiContent[] = toGeminiContents({
    systemPrompt,
    messages: combinedMessages,
  });

  const model = "gemini-3-flash-preview";
  const MAX_TOOL_STEPS = 8;

  const loopContents = [...contents];
  let finalText: string | undefined;

  for (let step = 0; step < MAX_TOOL_STEPS; step += 1) {
    const result = await geminiGenerateContent({
      apiKey: geminiApiKey,
      model,
      contents: loopContents,
      tools: geminiTools,
    });

    if (result.functionCalls.length === 0) {
      finalText = result.text;
      break;
    }

    // Push the model turn using rawParts — this preserves thought_signature
    // on each functionCall part, which thinking models require
    loopContents.push({
      role: "model",
      parts: (result.rawParts ?? []) as GeminiContentPart[],
    });

    // Batch all tool responses into a single user turn
    const responseParts: GeminiContentPart[] = await Promise.all(
      result.functionCalls.map(async (functionCall) => {
        const toolName = functionCall.name as ToolName;
        const toolResult = await executeTool(toolName, functionCall.args);
        return {
          functionResponse: {
            name: functionCall.name,
            id: functionCall.id,
            response: { result: toolResult as Json },
          },
        };
      }),
    );

    loopContents.push({
      role: "user",
      parts: responseParts,
    });
  }

  if (!finalText) {
    return NextResponse.json(
      { error: "AI did not return a final response. Try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ text: finalText });
}