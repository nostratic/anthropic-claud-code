import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface SuggestedStep {
  title: string;
  description: string;
  type: "step" | "decision" | "outcome";
  parentIndex: number | null;
  cost: number | null;
  timeEstimate: string | null;
  prerequisites: string | null;
  assumptions: string | null;
  kpis: string | null;
  consequences: string | null;
  points: number;
}

export interface SuggestedRoadmap {
  title: string;
  type: "linear" | "multipath";
  steps: SuggestedStep[];
}

export async function suggestRoadmap(
  title: string,
  description: string
): Promise<SuggestedRoadmap> {
  const prompt = `You are an expert conflict mediator and project manager. Create a detailed resolution roadmap for the following conflict.

Conflict Title: ${title}
Conflict Description: ${description}

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "title": "string (roadmap title)",
  "type": "linear",
  "steps": [
    {
      "title": "string",
      "description": "string",
      "type": "step",
      "parentIndex": null,
      "cost": null,
      "timeEstimate": "string or null",
      "prerequisites": "string or null",
      "assumptions": "string or null",
      "kpis": "string or null",
      "consequences": "string or null",
      "points": 10
    }
  ]
}

Guidelines:
- parentIndex is the 0-based index of the parent step (null for first step, 0 for second, 1 for third, etc. in linear)
- For multipath: use branching by having multiple steps point to the same parentIndex
- Last step(s) must have type "outcome"
- Decision steps that branch paths should have type "decision"
- Include 5-8 actionable, specific steps
- Add realistic time estimates (e.g., "2 days", "1 week", "30 minutes")
- points range 10-100 (higher = more impactful/complex)
- kpis should be measurable success criteria
- consequences should describe what happens if step is skipped`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from AI");
  }

  const text = content.text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in AI response");
  }

  return JSON.parse(jsonMatch[0]) as SuggestedRoadmap;
}
