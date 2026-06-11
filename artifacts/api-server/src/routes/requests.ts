import { Router } from "express";
import nodemailer from "nodemailer";

const router = Router();

router.post("/requests/submit", async (req, res) => {
  const { requestId, flightFrom, flightTo, hotels, dateFrom, dateTo, notes } =
    req.body as {
      requestId: string;
      flightFrom: string;
      flightTo: string;
      hotels: Array<{ name: string; city: string } | string>;
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
    secure: false,
    requireTLS: true,
    auth: { user: smtpUser, pass: smtpPass },
    tls: { rejectUnauthorized: false },
  });

  try {
    await transporter.verify();
    req.log.info({ smtpHost, smtpPort }, "SMTP connection verified");
  } catch (verifyErr) {
    req.log.error({ err: verifyErr }, "SMTP verify() failed — aborting send");
    res.status(502).json({ ok: false, error: "SMTP connection failed" });
    return;
  }

  const hotelsHtml =
    (hotels ?? []).length > 0
      ? hotels
          .map((h) =>
            typeof h === "string" ? `<li>${h}</li>` : `<li>${h.name} — ${h.city}</li>`,
          )
          .join("")
      : "<li>Not specified</li>";

  try {
    const info = await transporter.sendMail({
      from: `"Dar AlTamaiz System" <${smtpUser}>`,
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

    req.log.info(
      { messageId: info.messageId, response: info.response },
      "Email sent successfully",
    );
    res.json({ ok: true, requestId, messageId: info.messageId });
  } catch (sendErr) {
    req.log.error({ err: sendErr }, "sendMail() failed");
    res.status(502).json({ ok: false, error: "Email delivery failed" });
  }
});

export default router;
