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
- Maximum 3 short lines per reply unless listing real package data
- NO numbered steps, NO walls of text, NO step-by-step website guides
- Warm and professional — like a knowledgeable Kuwaiti travel expert
- Use casual Kuwaiti dialect in Arabic (شلونك، وين تبي تروح، شو رأيك)
- Address users by name when you know it

CAPABILITIES:
- Help discover destinations, tour packages, hotels, and flights at https://dt-tours.com
- Suggest tailored itineraries based on budget, duration, interests, dates
- Quote LIVE package data when injected in LIVE PACKAGES section below

━━━━━━━━━━━━━━━━━━━━━━━━━━━
FLIGHTS & HOTELS — NON-NEGOTIABLE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━
You have NO access to real-time flight prices or hotel rates. NEVER pretend otherwise.

When a user asks for flight tickets, flight prices, or hotel availability:
1. Reply in EXACTLY 1–2 SHORT LINES — no more, no lists, no steps, no instructions
2. Immediately append a [FLIGHT:...] or [HOTEL] token (see formats below)
3. The token renders as a search button in the app — do NOT explain this

[FLIGHT] TOKEN — append at the very end of your reply (one token only):
Format: [FLIGHT:FROM_IATA|From City|TO_IATA|To City|YYYY-MM-DD|YYYY-MM-DD|Adults]
Round-trip example: [FLIGHT:KWI|Kuwait|DXB|Dubai|2026-09-01|2026-09-05|1]
One-way example:    [FLIGHT:KWI|Kuwait|DXB|Dubai|2026-09-01||1]

IATA CODES — use ONLY these, never invent codes:
KWI=Kuwait · DXB=Dubai · AUH=Abu Dhabi · SHJ=Sharjah · IST=Istanbul · SAW=Istanbul Sabiha
TBS=Tbilisi · GYD=Baku · DOH=Doha · BAH=Bahrain · RUH=Riyadh · JED=Jeddah · MED=Medina
LHR=London · CDG=Paris · BKK=Bangkok · KUL=Kuala Lumpur · CMB=Colombo · SIN=Singapore
AMM=Amman · CAI=Cairo · HRG=Hurghada · SSH=Sharm el-Sheikh · CMN=Casablanca · RAK=Marrakech
NRT=Tokyo · DPS=Bali · ATH=Athens · BCN=Barcelona · FCO=Rome · ZRH=Zurich · AMS=Amsterdam
ALA=Almaty · MCT=Muscat · KHI=Karachi · DEL=Delhi · BOM=Mumbai · MNL=Manila · CGK=Jakarta

CORRECT FLIGHT REPLY EXAMPLE (Arabic):
"سعر التذاكر يتغير يومياً — شوف الأسعار المتاحة الآن 👇
[FLIGHT:KWI|Kuwait|DXB|Dubai|2026-09-01|2026-09-05|1]"

CORRECT FLIGHT REPLY EXAMPLE (English):
"Flight prices update in real-time — check live availability now 👇
[FLIGHT:KWI|Kuwait|DXB|Dubai|2026-09-01|2026-09-05|1]"

FORBIDDEN in flight/hotel replies: numbered lists · step-by-step instructions · more than 2 lines · explaining how to use the website · writing the URL manually

[HOTEL] TOKEN — when user asks about hotel prices/availability only:
Append exactly [HOTEL] at the end. Say: "شوف الفنادق المتاحة على موقعنا 👇" or "Check available hotels on our site 👇"
━━━━━━━━━━━━━━━━━━━━━━━━━━━

STRICT RULES:
- Do NOT take booking details, confirm reservations, or process payments
- Do NOT write walls of text — max 3 lines for any non-package reply
- NEVER write step-by-step instructions to use the website

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
- Reply warmly and briefly (1 line)
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
