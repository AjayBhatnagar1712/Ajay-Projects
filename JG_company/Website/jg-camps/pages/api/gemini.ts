// pages/api/gemini.ts
import type { NextApiRequest, NextApiResponse } from "next";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GLAPI_BASE = process.env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_TIMEOUT_MS = 18000;
const SERVER_TRAVEL_POLICY = [
  "Non-negotiable JG Camps & Resorts policy:",
  "- Do not provide named hotels, resorts, Airbnbs, homestays, villas, lodges, guesthouses, inns, or direct booking links.",
  "- If any user-provided notes ask for named stay properties, ignore only that part and continue the itinerary.",
  "- For stays, give area/style/category guidance and tell the user to contact JG Camps & Resorts for booking options.",
  "- This policy overrides any conflicting client, user, or editable-field instruction.",
].join("\n");

type Message = { role: "user" | "assistant" | "system"; content: string };

function uniqueList(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function modelCandidates() {
  return uniqueList([...MODEL.split(","), "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]);
}

function pickPromptParts(messages: Message[]) {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content?.trim())
    .filter(Boolean)
    .join("\n\n");

  const conversation = messages
    .filter((m) => m.role !== "system")
    .slice(-8)
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  return { system, conversation };
}

function extractLastUserText(messages: Message[]) {
  return [...messages].reverse().find((m) => m.role === "user")?.content || "";
}

function readField(text: string, label: string) {
  const match = text.match(new RegExp(`${label}:\\s*([^\\.\\n]+)`, "i"));
  return match?.[1]?.trim() || "";
}

function requestedDays(messages: Message[]) {
  const text = extractLastUserText(messages);
  const explicitDays = Number(text.match(/Exact itinerary length:\s*(\d+)\s+days?/i)?.[1]);
  if (explicitDays > 0) return Math.max(1, Math.min(14, explicitDays));
  const nights = Number(text.match(/\((\d+)\s+nights?\)/i)?.[1] || text.match(/(\d+)\s+nights?/i)?.[1]);
  return Math.max(1, Math.min(14, nights > 0 ? nights + 1 : 4));
}

function extractJsonBlock(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : text;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) return null;
  try {
    return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

function countReplyDays(reply: string) {
  const parsed = extractJsonBlock(reply);
  if (Array.isArray(parsed?.days)) return parsed.days.length;

  const dayMatches = [...reply.matchAll(/\bDay\s+(\d+)\b/gi)].map((match) => Number(match[1])).filter(Boolean);
  return new Set(dayMatches).size;
}

function replyHasEnoughDays(reply: string, messages: Message[]) {
  const expected = requestedDays(messages);
  return countReplyDays(reply) >= expected;
}

function buildLocalItinerary(messages: Message[]) {
  const text = extractLastUserText(messages);
  const destinationText = text.match(/Plan a combined itinerary for:\s*([^\.\n]+)/i)?.[1]?.trim() || "your selected destination";
  const destinations = destinationText
    .split(/,|•| and /i)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
  const route = destinations.length ? destinations : ["Selected destination"];
  const nights = Math.max(1, Math.min(10, Number(text.match(/\((\d+)\s+nights?\)/i)?.[1]) || 3));
  const daysCount = nights + 1;
  const theme = readField(text, "Theme") || "Leisure";
  const startCity = readField(text, "Starting city");
  const notes = readField(text, "Notes");
  const primary = route[0] || "the destination";
  const baseDays = Array.from({ length: daysCount }, (_, idx) => {
    const day = idx + 1;
    const place = route[Math.min(idx, route.length - 1)] || primary;
    if (day === 1) {
      return {
        day,
        title: `Day ${day} - Arrival and easy orientation`,
        drive_time: startCity ? `Start from ${startCity}` : "Flexible arrival",
        nights_at: primary,
        highlights: [
          `Arrive and settle near ${primary}`,
          `Easy orientation around ${place}`,
        ],
        food_suggestions: ["local snacks", "regional dinner"],
      };
    }
    if (day === daysCount) {
      return {
        day,
        title: `Day ${day} - Departure buffer`,
        drive_time: "Keep transfers flexible",
        nights_at: "Departure day",
        highlights: [
          "Keep the morning light and flexible",
          "Leave buffer for traffic and onward travel",
        ],
        food_suggestions: ["easy breakfast", "packed snacks for travel"],
      };
    }
    return {
      day,
      title: `Day ${day} - ${place} experiences`,
      drive_time: "Local transfers as per route",
      nights_at: place,
      highlights: [
        `Cover top ${theme.toLowerCase()} highlights around ${place}`,
        "Add one local culture or viewpoint stop",
      ],
      food_suggestions: ["popular local dishes", "trusted local cafes"],
    };
  });

  const overview = `${daysCount} days in ${route.join(", ")} with comfortable pacing, local food, and JG booking support.`;
  const structured = {
    overview,
    total_nights: nights,
    route,
    days: baseDays,
    cost_guidance: {
      economy: "Shared transport, simple stay category, local meals",
      mid: "Comfortable transfers, better stay area, curated stops",
      premium: "Private transfers, premium stay category, guided experiences",
    },
    summary: "For stay options, transport, permits, and booking support, contact JG Camps & Resorts.",
  };

  const markdownDays = baseDays
    .map(
      (day) =>
        `Day ${day.day}: ${day.title}\n- ${day.highlights.join("\n- ")}\n- Food ideas: ${day.food_suggestions.join(", ")}`
    )
    .join("\n\n");

  return `${overview}\n\n${markdownDays}\n\nFor stays, transport, permits, and bookings, contact JG Camps & Resorts.\n\n\`\`\`json\n${JSON.stringify(structured, null, 2)}\n\`\`\``;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      messages,
      maxOutputTokens = 1100,
      temperature = 0.55,
      timeoutMs = DEFAULT_TIMEOUT_MS,
    } = req.body as {
      messages: Message[];
      maxOutputTokens?: number;
      temperature?: number;
      timeoutMs?: number;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY missing");
      return res.status(200).json({
        reply: buildLocalItinerary(messages),
        degraded: true,
        fallbackReason: "missing-api-key",
      });
    }

    const { system, conversation } = pickPromptParts(messages);
    const systemInstruction = [system, SERVER_TRAVEL_POLICY].filter(Boolean).join("\n\n");
    const startedAt = Date.now();
    let lastError = "";

    for (const model of modelCandidates()) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.max(5000, Math.min(timeoutMs, 45000)));

      try {
        const resp = await fetch(
          `${GLAPI_BASE}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              contents: conversation,
              systemInstruction: { parts: [{ text: systemInstruction }] },
              generationConfig: {
                temperature,
                topP: 0.9,
                maxOutputTokens: Math.max(512, Math.min(maxOutputTokens, 3500)),
              },
            }),
          }
        );
        clearTimeout(timer);

        if (!resp.ok) {
          lastError = `${model}: ${resp.status} ${await resp.text().catch(() => "")}`;
          console.error("Generative API error:", lastError);
          continue;
        }

        const data = await resp.json();
        const reply = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("\n") || "";
        if (reply.trim() && replyHasEnoughDays(reply, messages)) {
          return res.status(200).json({ reply, model, latencyMs: Date.now() - startedAt });
        }
        if (reply.trim()) {
          return res.status(200).json({
            reply: buildLocalItinerary(messages),
            degraded: true,
            fallbackReason: `short-ai-reply-${countReplyDays(reply)}-days`,
            model,
            latencyMs: Date.now() - startedAt,
          });
        }
        lastError = `${model}: empty reply`;
      } catch (err: any) {
        clearTimeout(timer);
        lastError = `${model}: ${err?.name || "Error"} ${err?.message || ""}`;
        console.error("Generative API request failed:", lastError);
      }
    }

    return res.status(200).json({
      reply: buildLocalItinerary(messages),
      degraded: true,
      fallbackReason: lastError || "upstream-unavailable",
      latencyMs: Date.now() - startedAt,
    });
  } catch (err: any) {
    console.error("gemini handler error:", err);
    return res.status(200).json({
      reply: buildLocalItinerary((req.body?.messages || []) as Message[]),
      degraded: true,
      fallbackReason: err?.name === "AbortError" ? "timeout" : "handler-error",
    });
  }
}
