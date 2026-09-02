import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3";

function mockTriage(symptoms: string[]): {
  score: number;
  category: string;
  notes: string;
} {
  const text = symptoms.join(" ").toLowerCase();

  const redKeywords = [
    "chest pain",
    "severe bleeding",
    "unconscious",
    "stroke",
    "heart attack",
    "cardiac arrest",
    "difficulty breathing",
    "road accident",
    "trauma",
  ];

  const yellowKeywords = [
    "shortness of breath",
    "bleeding",
    "dizziness",
    "nausea",
    "allergic",
    "fracture",
    "fever",
    "infection",
  ];

  if (redKeywords.some((k) => text.includes(k))) {
    return {
      score: 9,
      category: "CRITICAL",
      notes: "Immediate life-threatening condition. Priority RED. Administer CPR if needed, control bleeding, keep airway clear.",
    };
  }

  if (yellowKeywords.some((k) => text.includes(k))) {
    return {
      score: 6,
      category: "URGENT",
      notes: "Significant condition requiring prompt attention. Priority YELLOW. Monitor vital signs, apply pressure to wounds.",
    };
  }

  return {
    score: 3,
    category: "NON-URGENT",
    notes: "Condition stable. Priority GREEN. Reassure patient, monitor for changes.",
  };
}

function formatPrompt(symptoms: string[]): string {
  return `You are an AI medical triage assistant. Based on the following patient symptoms, provide a JSON response with:
- "score": a number from 1 (non-urgent) to 10 (critical)
- "category": one of "CRITICAL", "URGENT", or "NON-URGENT"
- "notes": brief first-aid guidance (2-3 sentences)

Patient symptoms: ${symptoms.join(", ")}

Respond ONLY with a valid JSON object. No markdown, no explanation.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const symptoms: string[] = Array.isArray(body.symptoms)
      ? body.symptoms.map((s: unknown) => String(s).trim()).filter(Boolean)
      : typeof body.symptoms === "string"
      ? body.symptoms
          .split(/[,\n]/)
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [];

    if (symptoms.length === 0) {
      return NextResponse.json(
        { success: false, error: "Symptoms are required for AI triage." },
        { status: 400 }
      );
    }

    // Try Ollama/Llama 3 first
    try {
      const ollamaResponse = await axios.post(
        `${OLLAMA_URL}/api/generate`,
        {
          model: OLLAMA_MODEL,
          prompt: formatPrompt(symptoms),
          stream: false,
          options: {
            temperature: 0.3,
            num_predict: 300,
          },
        },
        { timeout: 10000 }
      );

      const rawText: string =
        ollamaResponse.data?.response || "";

      // Extract JSON from response
      const jsonMatch = rawText.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const score = Math.min(10, Math.max(1, Number(parsed.score) || 5));
        const category = ["CRITICAL", "URGENT", "NON-URGENT"].includes(
          parsed.category
        )
          ? parsed.category
          : score >= 8
          ? "CRITICAL"
          : score >= 5
          ? "URGENT"
          : "NON-URGENT";

        console.log("[AI TRIAGE] Ollama Llama 3 response:", {
          score,
          category,
          notes: parsed.notes,
        });

        return NextResponse.json(
          {
            success: true,
            score,
            category,
            notes: parsed.notes || "AI-generated triage guidance.",
            source: "ollama",
          },
          { status: 200 }
        );
      }
    } catch (ollamaError) {
      console.log(
        "[AI TRIAGE] Ollama unavailable, using mock fallback:",
        ollamaError instanceof Error ? ollamaError.message : "connection refused"
      );
    }

    // Fallback to mock triage
    const mockResult = mockTriage(symptoms);

    console.log("[AI TRIAGE] Mock fallback result:", mockResult);

    return NextResponse.json(
      {
        success: true,
        ...mockResult,
        source: "mock",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("AI triage error:", error);
    return NextResponse.json(
      { success: false, error: "AI triage service encountered an error." },
      { status: 500 }
    );
  }
}
