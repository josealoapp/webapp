type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

const resendEndpoint = "https://api.resend.com/emails";

function getFromAddress() {
  return process.env.EMAIL_FROM || "Josealo <onboarding@resend.dev>";
}

export function canSendEmail() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(payload: EmailPayload) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info(`Email not sent because RESEND_API_KEY is missing. To: ${payload.to}. Subject: ${payload.subject}`);
    return { skipped: true };
  }

  const response = await fetch(resendEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getFromAddress(),
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`email/send-failed${detail ? `|${detail.slice(0, 300)}` : ""}`);
  }

  return { skipped: false };
}

function shell(content: string, preview: string) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${preview}</title>
  </head>
  <body style="margin:0;background:#f4f2ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#171717;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preview}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f2ee;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e7e2da;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="background:#101010;padding:24px 28px;">
                <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0;">Josealo</div>
                <div style="margin-top:6px;font-size:13px;color:#c7c7c7;">Compra y vende cerca de ti</div>
              </td>
            </tr>
            ${content}
          </table>
          <div style="max-width:560px;margin-top:16px;font-size:12px;line-height:18px;color:#777;">
            Si no solicitaste este correo, puedes ignorarlo.
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(label: string, href: string) {
  return `<a href="${href}" style="display:inline-block;background:#fb923c;color:#111111;text-decoration:none;font-weight:800;font-size:15px;padding:14px 22px;border-radius:12px;">${label}</a>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getPublicAssetUrl(baseUrl: string, path: string) {
  return new URL(path, baseUrl).toString();
}

export function verificationEmailTemplate(input: { email?: string | null; name?: string | null; url: string }) {
  const name = escapeHtml(input.name?.trim() || "usuario");
  const email = escapeHtml(input.email?.trim() || "tu correo electronico");
  const appOrigin = new URL(input.url).origin;
  const logoUrl = getPublicAssetUrl(appOrigin, "/logo-alt.png");
  const backgroundUrl = getPublicAssetUrl(appOrigin, "/bg-image.png");
  const safeVerificationUrl = escapeHtml(input.url);
  const preview = "Confirma tu correo para activar tu cuenta en Josealo.";

  return {
    subject: "Verifica tu email en Josealo",
    html: `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>Josealo Email Verification</title>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#374151;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preview}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#ffffff;padding:28px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;margin:0 auto;overflow:hidden;background-color:#fff1e8;background-image:url('${backgroundUrl}');background-repeat:no-repeat;background-position:center bottom;background-size:100% auto;">
            <tr>
              <td align="center" style="padding:28px 20px 24px;background:#ffffff;text-align:center;">
                <img src="${logoUrl}" width="150" alt="Josealo" style="max-width:150px;height:auto;display:inline-block;border:0;outline:none;text-decoration:none;">
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border:18px solid rgba(255,255,255,0.72);background:rgba(255,255,255,0.78);">
                  <tr>
                    <td align="center" style="padding:48px 34px 44px;text-align:center;background:transparent;">
                      <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#374151;font-weight:700;">Hola ${name},</h1>
                      <p style="margin:0;font-size:16px;line-height:1.55;color:#374151;">
                        Por favor, confirma que tu correo electronico es<br>
                        ${email} y que lo ingresaste correctamente al<br>
                        crear tu cuenta en Josealo.
                      </p>
                      <a href="${safeVerificationUrl}" style="display:inline-block;margin:30px 0 26px;padding:16px 92px;background:#fd5e05;color:#ffffff;text-decoration:none;font-size:18px;font-weight:700;border-radius:8px;">Confirmar correo</a>
                      <p style="margin:0;font-size:16px;line-height:1.55;color:#374151;">
                        Algunos usuarios de Josealo podrian ver informacion publica de tu perfil,<br>
                        pero tu direccion de correo electronico permanecera privada.
                      </p>
                      <p style="margin:22px 0 0;font-size:12px;line-height:18px;color:#6b7280;word-break:break-all;">
                        Si el boton no funciona, copia y pega este enlace en tu navegador:<br>
                        ${safeVerificationUrl}
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:30px 20px 235px;text-align:center;background:transparent;border-top:1px solid rgba(255,255,255,0.85);">
                      <p style="margin:0;font-size:16px;line-height:1.55;color:#374151;">
                        Gracias por formar parte de Josealo!<br>
                        El equipo de Josealo
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
    text: `Verifica tu email en Josealo: ${input.url}`,
  };
}

export function passwordResetEmailTemplate(input: { url: string }) {
  const content = `
    <tr>
      <td style="padding:32px 28px 10px;">
        <div style="font-size:26px;line-height:32px;font-weight:800;color:#171717;">Restablece tu contrasena</div>
        <p style="margin:14px 0 0;font-size:16px;line-height:24px;color:#444;">
          Recibimos una solicitud para cambiar la contrasena de tu cuenta Josealo.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:22px 28px 8px;">
        ${button("Cambiar contrasena", input.url)}
      </td>
    </tr>
    <tr>
      <td style="padding:18px 28px 30px;">
        <p style="margin:0;font-size:13px;line-height:20px;color:#666;">
          Si el boton no funciona, copia y pega este enlace en tu navegador:
        </p>
        <p style="margin:10px 0 0;font-size:12px;line-height:18px;color:#555;word-break:break-all;">${input.url}</p>
      </td>
    </tr>`;

  return {
    subject: "Restablece tu contrasena de Josealo",
    html: shell(content, "Restablece tu contrasena de Josealo."),
    text: `Restablece tu contrasena de Josealo: ${input.url}`,
  };
}
