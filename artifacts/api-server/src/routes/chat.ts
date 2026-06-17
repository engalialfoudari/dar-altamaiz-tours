import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { scrapeDTToursSearch, type PackageResult } from "./search";

const router = Router();

const BOT_NAME = "D.T. Tours Ai";

const SYSTEM_PROMPT_BASE = `You are "${BOT_NAME}", the official AI travel assistant for Dar AlTamaiz Tours (دار التميز للسياحة), a premium Kuwaiti travel agency.

IDENTITY:
- Name: ${BOT_NAME}
- Always detect the user's language and respond in the same language
- If they mix Arabic and English, follow their lead

PERSONA:
- Concise and sharp — خير الكلام ما قل ودل (the best speech is brief and to the point)
- NO long paragraphs. Give direct, useful answers. Use bullet points when listing options
- Warm and professional — like a knowledgeable Kuwaiti travel expert
- Use casual Kuwaiti dialect in Arabic (شلونك، وين تبي تروح، شو رأيك)
- Address users by name when you know it

CAPABILITIES:
- Help discover destinations, tour packages, hotels, and flights at https://dt-tours.com
- Suggest tailored itineraries based on budget, duration, interests, dates
- Quote LIVE package data when injected in LIVE PACKAGES section below
- Guide users step-by-step on how to search and book on dt-tours.com

STRICT RULES:
- Do NOT take booking details, confirm reservations, or process payments
- Do NOT write walls of text — keep every reply short and actionable
- When user wants to book: guide them to dt-tours.com → Search → Select → Checkout

BOOKING STEPS (adapt to context):
1. Go to https://dt-tours.com
2. Click Holiday / Flight / Hotel tab
3. Enter destination and dates → Search
4. Pick your package → Book Now / احجز الآن
5. Fill traveler details and pay securely

WHATSAPP ESCALATION:
If ANY of these apply, append exactly [WHATSAPP] at the end of your message:
- User asks totally off-topic questions (coding, jokes, general knowledge, sports)
- User clearly has no travel intent ("just curious", "not traveling", "only asking")
- User wants to speak to a human / customer service
- User is frustrated or needs personalised assistance beyond AI scope
When appending [WHATSAPP], naturally say:
  Arabic: "فريق خدمة العملاء يقدر يساعدك أكثر — تواصل معهم على واتساب! 💬"
  English: "Our team can help you better — reach them on WhatsApp! 💬"

GOODBYE / END OF SESSION:
When the user says goodbye (وداع، باي، مع السلامة، شكرا بس، bye, thanks, goodbye, that's all):
- Reply warmly and briefly
- Append exactly [GOODBYE] at the very end of your message (nothing after it)`;

const SEARCH_KEYWORDS_AR = [
  "سعر", "أسعار", "كم سعر", "كم يكلف", "رخيص", "عروض", "عرض",
  "باقة", "باقات", "تور", "جولة", "ليالي", "ليلة", "فندق", "فنادق",
];
const SEARCH_KEYWORDS_EN = [
  "price", "prices", "cost", "how much", "cheap", "package", "packages",
  "tour", "holiday", "nights", "hotel", "hotels", "deal", "deals",
];

const DESTINATIONS: Array<[string, string[]]> = [
  ["Turkey", ["تركيا", "turkey", "istanbul", "استانبول", "antalya", "أنطاليا"]],
  ["Azerbaijan", ["أذربيجان", "azerbaijan", "baku", "باكو", "az"]],
  ["Georgia", ["جورجيا", "georgia", "tbilisi", "تبليسي"]],
  ["Maldives", ["المالديف", "maldives", "maldive"]],
  ["Thailand", ["تايلاند", "thailand", "bangkok", "بانكوك", "phuket", "فوكيت"]],
  ["Egypt", ["مصر", "egypt", "cairo", "القاهرة", "hurghada", "الغردقة", "sharm", "شرم"]],
  ["Malaysia", ["ماليزيا", "malaysia", "kuala lumpur", "كوالالمبور"]],
  ["Dubai", ["دبي", "dubai", "uae", "الإمارات"]],
  ["Spain", ["إسبانيا", "spain", "barcelona", "madrid"]],
  ["Italy", ["إيطاليا", "italy", "rome", "روما", "milan", "ميلان"]],
  ["London", ["لندن", "london", "uk", "england"]],
  ["Paris", ["باريس", "paris", "france", "فرنسا"]],
  ["Bali", ["بالي", "bali", "indonesia", "إندونيسيا"]],
  ["Morocco", ["المغرب", "morocco", "marrakech", "مراكش"]],
  ["Japan", ["اليابان", "japan", "tokyo", "طوكيو", "osaka"]],
  ["Sri Lanka", ["سريلانكا", "sri lanka", "colombo"]],
  ["Almaty", ["ألماتي", "almaty", "kazakhstan", "كازاخستان"]],
  ["Greece", ["اليونان", "greece", "athens", "أثينا", "santorini"]],
  ["Switzerland", ["سويسرا", "switzerland", "zurich", "زيورخ", "geneva"]],
  ["Netherlands", ["هولندا", "netherlands", "amsterdam"]],
];

function detectSearchDestination(message: string): string | null {
  const lower = message.toLowerCase();
  for (const [destName, keywords] of DESTINATIONS) {
    if (keywords.some((kw) => lower.includes(kw))) return destName;
  }
  return null;
}

function hasSearchIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    SEARCH_KEYWORDS_AR.some((kw) => lower.includes(kw)) ||
    SEARCH_KEYWORDS_EN.some((kw) => lower.includes(kw))
  );
}

function formatPackagesForPrompt(packages: PackageResult[], destination: string): string {
  if (packages.length === 0) return "";
  const lines = packages.map((p, i) => {
    const nights = p.nights ? ` · ${p.nights} nights` : "";
    return `${i + 1}. ${p.title}${nights} — ${p.price}\n   🔗 ${p.link}`;
  });
  return `\n\nLIVE PACKAGES from dt-tours.com for "${destination}":\n${lines.join("\n")}\n\nPresent these concisely. Include prices and booking links. If no relevant packages, say we have options available and guide to dt-tours.com.`;
}

function buildSystemPrompt(
  userName?: string,
  language?: string,
  livePackages?: string,
): string {
  let prompt = SYSTEM_PROMPT_BASE;

  if (userName) {
    prompt += `\n\nUSER CONTEXT:\n- Name: ${userName} — use their name naturally`;
    if (language === "ar") {
      prompt += `\n- GENDER ADAPTATION (Arabic): detect from name "${userName}" if masculine/feminine.
  Feminine name signals: ة، ى، اء، ين، ان (فاطمة, سارة, نورة, ريم, رهف, لولوة, مريم, هيا, دانة).
  Masculine signals: أحمد, محمد, عبدالله, خالد, يوسف, فهد, سعد, ناصر, جاسم, عمر, علي.
  Use correct Arabic gender forms. Default to masculine if ambiguous.`;
    } else {
      prompt += `\n- Language: English throughout.`;
    }
  }

  if (livePackages) {
    prompt += livePackages;
  }

  return prompt;
}

router.post("/chat", async (req, res) => {
  try {
    const { messages, userName, language } = req.body as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      userName?: string;
      language?: string;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ ok: false, error: "messages array required" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const lastUserMsg = messages[messages.length - 1]?.content ?? "";
    let livePackages: string | undefined;

    if (hasSearchIntent(lastUserMsg)) {
      const dest = detectSearchDestination(lastUserMsg);
      if (dest) {
        try {
          const results = await scrapeDTToursSearch(dest);
          if (results.length > 0) {
            livePackages = formatPackagesForPrompt(results, dest);
          }
        } catch {
          // Search failure is non-fatal
        }
      }
    }

    const systemPrompt = buildSystemPrompt(userName, language, livePackages);
    const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      ...messages.slice(-20),
    ];

    const stream = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 2048,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "Chat completion failed");
    res.write(`data: ${JSON.stringify({ error: "Chat failed, please try again." })}\n\n`);
    res.end();
  }
});

router.post("/chat/message", async (req, res) => {
  try {
    const { messages, userName, language } = req.body as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      userName?: string;
      language?: string;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ ok: false, error: "messages array required" });
      return;
    }

    const lastUserMsg = messages[messages.length - 1]?.content ?? "";
    let livePackages: string | undefined;

    if (hasSearchIntent(lastUserMsg)) {
      const dest = detectSearchDestination(lastUserMsg);
      if (dest) {
        try {
          const results = await scrapeDTToursSearch(dest);
          if (results.length > 0) {
            livePackages = formatPackagesForPrompt(results, dest);
          }
        } catch {
          // Search failure is non-fatal
        }
      }
    }

    const systemPrompt = buildSystemPrompt(userName, language, livePackages);
    const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      ...messages.slice(-20),
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 2048,
      messages: chatMessages,
      stream: false,
    });

    const content = response.choices[0]?.message?.content ?? "";
    res.json({ ok: true, content });
  } catch (err) {
    req.log.error({ err }, "Chat message failed");
    res.status(500).json({ ok: false, error: "Chat failed, please try again." });
  }
});

export default router;
