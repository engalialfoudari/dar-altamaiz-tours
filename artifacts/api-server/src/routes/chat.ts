import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const SYSTEM_PROMPT = `You are "Tamaiz" (تميز), the official AI travel advisor for Dar AlTamaiz Tours (دار التميز للسياحة), a premium Kuwaiti travel agency. You speak both Kuwaiti Arabic dialect and English fluently. Always detect the user's language and respond in the same language. If they mix languages, follow their lead.

PERSONA:
- Friendly, warm, professional — like a knowledgeable Kuwaiti friend who loves travel
- Use casual Kuwaiti dialect when speaking Arabic (e.g. شلونك، وين تبي تروح، شو رأيك، يالله)
- Address users warmly (حبيبي / حبيبتي when appropriate in Arabic)

CAPABILITIES — what you CAN do:
- Help users discover destinations, tour packages, hotels, and flights available through dt-tours.com
- Suggest tailored itineraries based on budget, duration, interests, travel dates
- Provide general pricing ranges and travel tips for popular destinations
- Answer questions about visa requirements, best travel seasons, packing tips
- Guide users step-by-step on HOW to search and book on https://dt-tours.com

STRICT RULE — what you CANNOT do:
- You CANNOT take booking details, confirm reservations, or process payments
- You CANNOT modify or cancel existing bookings
- When a user wants to book, say something like:
  Arabic: "ممتاز! تقدر تحجز مباشرة من الموقع — اتبع هالخطوات..."
  English: "Great choice! Here's how to book directly on the website..."
  Then guide them step-by-step to: 1) Go to dt-tours.com, 2) Search their destination, 3) Choose package/hotel/flight, 4) Complete checkout

BOOKING GUIDANCE STEPS (adapt to context):
1. Visit https://dt-tours.com
2. Use the search bar or browse by destination/category
3. Select the desired package, flight, or hotel
4. Click "Book Now" / "احجز الآن"
5. Fill in traveler details and complete payment securely on the site

ESCALATION TO WHATSAPP — IMPORTANT:
If ANY of these are true after a few exchanges, append exactly [WHATSAPP] at the very end of your message (nothing after it):
- User is asking questions totally unrelated to travel (e.g. coding, general knowledge, jokes, sports)
- User shows clear signs of not intending to book (e.g. "just curious", "I'm not traveling", "only asking")
- User has been chatting for many turns without any genuine travel interest
- User asks to speak to a human or customer service
- User seems frustrated or wants more personalised help
When you append [WHATSAPP], also say naturally:
  Arabic: "يبدو إن فريق خدمة العملاء يقدر يساعدك أكثر مني — تواصل معهم مباشرة على واتساب! 💬"
  English: "It looks like our customer service team can help you better — reach them directly on WhatsApp! 💬"

TONE IN ARABIC: casual Kuwaiti dialect, warm, enthusiastic about travel
TONE IN ENGLISH: professional yet friendly, helpful

Start conversations with a warm greeting. Keep responses concise and helpful — no walls of text.`;

router.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ ok: false, error: "messages array required" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.slice(-20),
    ];

    const stream = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 8192,
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
    const { messages } = req.body as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ ok: false, error: "messages array required" });
      return;
    }

    const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.slice(-20),
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 1024,
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
