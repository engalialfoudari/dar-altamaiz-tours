import { Router } from "express";
import nodemailer from "nodemailer";

const router = Router();

router.post("/requests/submit", async (req, res) => {
  const { requestId, flightFrom, flightTo, hotels, dateFrom, dateTo, notes } =
    req.body as {
      requestId: string;
      flightFrom: string;
      flightTo: string;
      hotels: string[];
      dateFrom: string;
      dateTo: string;
      notes: string;
    };

  req.log.info(
    { requestId, flightFrom, flightTo, hotels, dateFrom, dateTo },
    "Special request received",
  );

  const mailTo = process.env["MAIL_TO"];
  const smtpHost = process.env["SMTP_HOST"];
  const smtpUser = process.env["SMTP_USER"];
  const smtpPass = process.env["SMTP_PASS"];
  const smtpPort = Number(process.env["SMTP_PORT"] ?? 587);

  if (!mailTo || !smtpHost || !smtpUser || !smtpPass) {
    req.log.warn(
      "SMTP env vars not configured — request logged but email not sent",
    );
    res.json({ ok: true, requestId });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const hotelsHtml =
    (hotels ?? []).length > 0
      ? (hotels as string[]).map((h) => `<li>${h}</li>`).join("")
      : "<li>Not specified</li>";

  await transporter.sendMail({
    from: `"Dar AlTamaiz App" <${smtpUser}>`,
    to: mailTo,
    subject: `طلب خاص ${requestId} — ${flightFrom} → ${flightTo}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:24px;border-radius:12px;">
        <h2 style="color:#0A1628;border-bottom:2px solid #C9A84C;padding-bottom:8px;">
          طلب خاص — ${requestId}
        </h2>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;">
          <tr><td style="padding:8px;font-weight:bold;width:160px;">رقم الطلب</td><td style="padding:8px;color:#C9A84C;font-weight:bold;">${requestId}</td></tr>
          <tr style="background:#fff;"><td style="padding:8px;font-weight:bold;">من / From</td><td style="padding:8px;">${flightFrom}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">إلى / To</td><td style="padding:8px;">${flightTo}</td></tr>
          <tr style="background:#fff;"><td style="padding:8px;font-weight:bold;">تاريخ المغادرة</td><td style="padding:8px;">${dateFrom}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">تاريخ العودة</td><td style="padding:8px;">${dateTo}</td></tr>
          <tr style="background:#fff;"><td style="padding:8px;font-weight:bold;vertical-align:top;">الفنادق</td><td style="padding:8px;"><ul style="margin:0;padding-left:16px;">${hotelsHtml}</ul></td></tr>
          <tr><td style="padding:8px;font-weight:bold;vertical-align:top;">ملاحظات</td><td style="padding:8px;">${notes || "—"}</td></tr>
        </table>
        <p style="margin-top:24px;font-size:12px;color:#888;">أُرسل من تطبيق دار التميز للسياحة</p>
      </div>
    `,
  });

  res.json({ ok: true, requestId });
});

export default router;
