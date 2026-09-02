import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const OLLAMA_URL = process.env.OLLAMA_API_BASE || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3";

interface GuideRequest {
  symptoms: string[];
  patientName?: string;
  priority?: string;
  context?: string;
}

function ruleBasedGuide(data: GuideRequest): {
  instructions: string[];
  calmingMessage: string;
  checklist: string[];
} {
  const text = data.symptoms.join(" ").toLowerCase();

  // Determine emergency type for tailored advice
  if (text.includes("chest pain") || text.includes("heart")) {
    return {
      calmingMessage:
        "Help is on the way. Stay calm — you're doing the right thing by calling for help. The ambulance is on its way.",
      instructions: [
        "Help the patient sit in a comfortable position, ideally semi-reclined.",
        "Loosen any tight clothing around the neck and chest.",
        "If the patient has prescribed nitroglycerin, assist them in taking it.",
        "Keep the patient calm and still — do not let them walk around.",
        "Monitor breathing and stay with the patient at all times.",
        "If the patient becomes unconscious and stops breathing, begin CPR immediately: 30 chest compressions followed by 2 rescue breaths.",
      ],
      checklist: [
        "Unlock your front door so paramedics can enter quickly.",
        "Gather any current medications the patient is taking.",
        "Have the patient's ID and insurance documents ready.",
        "Move pets to a safe room to avoid interference.",
        "Clear a path from the entrance to the patient.",
        "Turn on exterior lights to help the ambulance find your location.",
      ],
    };
  }

  if (text.includes("breathing") || text.includes("asthma")) {
    return {
      calmingMessage:
        "Breathing difficulties can be frightening, but help is arriving soon. Keep the patient as calm as possible.",
      instructions: [
        "Help the patient sit upright — do NOT let them lie down.",
        "Loosen any tight clothing around the neck and chest.",
        "If the patient has an inhaler, assist them in using it.",
        "Open a window for fresh air if possible.",
        "Encourage slow, steady breathing: in through the nose, out through the mouth.",
        "If the patient's lips turn blue, this is an emergency — keep them awake and alert.",
      ],
      checklist: [
        "Unlock your front door for paramedic access.",
        "Bring the patient's inhaler or respiratory medications.",
        "Clear the path from entrance to patient.",
        "Remove any strong-smelling products from the area.",
        "Keep children and other family members calm and away.",
      ],
    };
  }

  if (text.includes("bleeding") || text.includes("accident") || text.includes("trauma")) {
    return {
      calmingMessage:
        "Stay calm — you're helping by keeping pressure on the wound. The ambulance team will take over shortly.",
      instructions: [
        "Apply firm, direct pressure to the wound using a clean cloth or gauze.",
        "Do NOT remove the cloth if it soaks through — add more layers on top.",
        "If possible, elevate the injured area above the heart level.",
        "Keep the patient warm with a blanket to prevent shock.",
        "Do not give the patient anything to eat or drink.",
        "Monitor for signs of shock: pale skin, rapid breathing, confusion.",
      ],
      checklist: [
        "Unlock your front door for paramedic access.",
        "Apply a tourniquet only if bleeding is life-threatening and cannot be controlled by pressure.",
        "Gather any medications the patient is currently taking.",
        "Have the patient's ID ready.",
        "Clear a path from the entrance.",
        "Note the time when bleeding started for the paramedics.",
      ],
    };
  }

  if (text.includes("stroke") || text.includes("facial drooping") || text.includes("slurred speech")) {
    return {
      calmingMessage:
        "Time is critical for stroke patients. Help is on the way — every minute counts.",
      instructions: [
        "Note the exact time symptoms first appeared — tell paramedics.",
        "Help the patient lie down with their head slightly elevated.",
        "If the patient is vomiting or unconscious, turn them on their side.",
        "Do NOT give the patient any food, water, or medication.",
        "Keep the patient calm and still.",
        "Loosen any tight clothing.",
      ],
      checklist: [
        "Unlock your front door immediately.",
        "Write down the time symptoms started.",
        "Bring a list of all current medications.",
        "Have the patient's ID and insurance ready.",
        "Clear the entrance path.",
        "Turn on exterior lights.",
      ],
    };
  }

  // Default generic emergency guide
  return {
    calmingMessage:
      "Help is on the way. Stay calm — you're doing everything right. The ambulance team will be with you soon.",
    instructions: [
      "Stay with the patient and keep them calm.",
      "If the patient is conscious, ask them to describe what they're feeling.",
      "Do not move the patient unless they are in immediate danger.",
      "Monitor the patient's breathing and responsiveness.",
      "If the patient loses consciousness, check for breathing and be ready to perform CPR.",
      "Keep the patient warm with a blanket if available.",
    ],
    checklist: [
      "Unlock your front door so paramedics can enter quickly.",
      "Gather the patient's current medications and medical history.",
      "Have the patient's ID and insurance documents ready.",
      "Move pets to a safe room.",
      "Clear a path from the entrance to the patient.",
      "Turn on exterior lights to help the ambulance find your location.",
      "Prepare any known allergies or medical conditions list.",
    ],
  };
}

function formatGuidePrompt(data: GuideRequest): string {
  return `You are an AI emergency medical assistant. A patient is experiencing: ${data.symptoms.join(", ")}.
${data.priority ? `Priority level: ${data.priority}.` : ""}

Generate a JSON response with:
- "calmingMessage": a brief, reassuring message (1-2 sentences)
- "instructions": array of 5-6 specific first-aid steps to take right now
- "checklist": array of 5-6 preparation items (unlocking doors, gathering documents, etc.)

Keep instructions clear, actionable, and calming. Use simple language anyone can follow.
Respond ONLY with a valid JSON object. No markdown.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawSymptoms = body.symptoms;
    const symptoms: string[] = Array.isArray(rawSymptoms)
      ? rawSymptoms.map((s: unknown) => String(s).trim()).filter(Boolean)
      : typeof rawSymptoms === "string"
      ? rawSymptoms
          .split(/[,\n]/)
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [];

    if (symptoms.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Symptoms are required for emergency guidance.",
        },
        { status: 400 }
      );
    }

    // Try Ollama/Llama 3 first
    try {
      const ollamaResponse = await axios.post(
        `${OLLAMA_URL}/api/generate`,
        {
          model: OLLAMA_MODEL,
          prompt: formatGuidePrompt({ ...body, symptoms }),
          stream: false,
          options: {
            temperature: 0.4,
            num_predict: 600,
          },
        },
        { timeout: 15000 }
      );

      const rawText: string = ollamaResponse.data?.response || "";

      // Extract JSON from response
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        console.log("[AI GUIDE] Ollama Llama 3 response generated.");

        return NextResponse.json(
          {
            success: true,
            instructions: Array.isArray(parsed.instructions)
              ? parsed.instructions
              : [],
            calmingMessage: parsed.calmingMessage || "Help is on the way.",
            checklist: Array.isArray(parsed.checklist)
              ? parsed.checklist
              : [],
            source: "ollama",
          },
          { status: 200 }
        );
      }
    } catch (ollamaError) {
      console.log(
        "[AI GUIDE] Ollama unavailable, using mock fallback:",
        ollamaError instanceof Error
          ? ollamaError.message
          : "connection refused"
      );
    }

    // Fallback to rule-based emergency guide when Ollama is unavailable
    const guideResult = ruleBasedGuide(body);

    console.log("[AI GUIDE] Rule-based fallback result generated.");

    return NextResponse.json(
      {
        success: true,
        ...guideResult,
        source: "rule-based",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("AI guide error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "AI emergency guide service encountered an error.",
      },
      { status: 500 }
    );
  }
}
