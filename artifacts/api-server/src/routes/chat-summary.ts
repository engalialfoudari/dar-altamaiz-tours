import { Router } from "express";
import nodemailer from "nodemailer";

const router = Router();

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

router.post("/chat/email-summary", async (req, res) => {
  const { messages, userEmail, userName, language } = req.body as {
    messages: ChatMessage[];
    userEmail: string;
    userName?: string;
    language?: string;
  };

  if (!userEmail?.trim() || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ ok: false, error: "userEmail and messages required" });
    return;
  }

  const smtpHost = process.env["SMTP_HOST"];
  const smtpUser = process.env["SMTP_USER"];
  const smtpPass = process.env["SMTP_PASS"];
  const smtpPort = Number(process.env["SMTP_PORT"] ?? 587);

  if (!smtpHost || !smtpUser || !smtpPass) {
    req.log.warn("SMTP not configured — cannot send chat summary");
    res.status(503).json({ ok: false, error: "Email service not configured" });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: false,
    requireTLS: true,
    auth: { user: smtpUser, pass: smtpPass },
    tls: { rejectUnauthorized: false },
  });

  try {
    await transporter.verify();
  } catch (verifyErr) {
    req.log.error({ err: verifyErr }, "SMTP verify failed");
    res.status(502).json({ ok: false, error: "SMTP connection failed" });
    return;
  }

  const isAr = language === "ar";
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const chatHtml = messages
    .filter((m) => m.content?.trim())
    .map((m) => {
      const isUser = m.role === "user";
      const bg = isUser ? "#f0f4ff" : "#fff9e6";
      const label = isUser ? (userName ?? "العميل") : "D.T. Tours Ai";
      const align = isAr && !isUser ? "right" : "left";
      const content = m.content.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
      return `
        <tr>
          <td style="padding:10px 16px 4px;">
            <strong style="color:${isUser ? "#001F5B" : "#D4AF37"};font-size:12px;">${label}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding:0 16px 14px;text-align:${align};font-size:14px;line-height:1.6;color:#222;">
            <div style="display:inline-block;background:${bg};border-radius:8px;padding:10px 14px;max-width:90%;">
              ${content}
            </div>
          </td>
        </tr>`;
    })
    .join("");

  const subject = isAr
    ? `ملخص محادثة مع D.T. Tours Ai — ${userName ?? ""} — ${dateStr}`
    : `Chat Summary with D.T. Tours Ai — ${userName ?? ""} — ${dateStr}`;

  const heading = isAr ? "ملخص محادثتك مع D.T. Tours Ai" : "Your Chat Summary with D.T. Tours Ai";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;background:#f9f9f9;border-radius:12px;overflow:hidden;">
      <div style="background:#0A1628;padding:24px 32px;border-bottom:3px solid #D4AF37;">
        <img src="https://dt-tours.com/extras/custom/TMX3372451534825527/images/TMX3372451534825527logo_dttours1.svg"
             alt="Dar AlTamaiz Tours" style="height:40px;" onerror="this.style.display='none'"/>
        <h2 style="color:#D4AF37;margin:12px 0 4px;font-size:18px;">${heading}</h2>
        ${userName ? `<p style="color:rgba(255,255,255,0.6);margin:0;font-size:13px;">${isAr ? `الاسم: ${userName}` : `Name: ${userName}`}</p>` : ""}
        <p style="color:rgba(255,255,255,0.4);margin:4px 0 0;font-size:12px;">${dateStr}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;background:#fff;">
        ${chatHtml}
      </table>
      <div style="background:#0A1628;padding:16px 32px;text-align:center;">
        <p style="color:rgba(255,255,255,0.4);font-size:11px;margin:0;">
          ${isAr ? "أُرسل من تطبيق دار التميز للسياحة" : "Sent from the Dar AlTamaiz Tours App"}
          &nbsp;·&nbsp;
          <a href="https://dt-tours.com" style="color:#D4AF37;text-decoration:none;">dt-tours.com</a>
        </p>
      </div>
    </div>`;

  try {
    const info = await transporter.sendMail({
      from: `"Dar AlTamaiz Tours" <${smtpUser}>`,
      to: userEmail.trim(),
      replyTo: "info@dt-tour.com",
      subject,
      html,
    });
    req.log.info({ messageId: info.messageId }, "Chat summary email sent");
    res.json({ ok: true, messageId: info.messageId });
  } catch (sendErr) {
    req.log.error({ err: sendErr }, "sendMail() failed for chat summary");
    res.status(502).json({ ok: false, error: "Email delivery failed" });
  }
});

export default router;
