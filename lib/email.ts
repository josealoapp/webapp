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

export function verificationEmailTemplate(input: { name?: string | null; url: string }) {
  const name = input.name?.trim() || "tu cuenta";
  const content = `
    <tr>
      <td style="padding:32px 28px 10px;">
        <div style="font-size:26px;line-height:32px;font-weight:800;color:#171717;">Verifica tu email</div>
        <p style="margin:14px 0 0;font-size:16px;line-height:24px;color:#444;">
          Hola ${name}, confirma este correo para activar tu cuenta y continuar configurando tu perfil en Josealo.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:22px 28px 8px;">
        ${button("Verificar email", input.url)}
      </td>
    </tr>
    <tr>
      <td style="padding:18px 28px 30px;">
        <p style="margin:0;font-size:13px;line-height:20px;color:#666;">
          Este link expira pronto por seguridad. Si el boton no funciona, copia y pega este enlace en tu navegador:
        </p>
        <p style="margin:10px 0 0;font-size:12px;line-height:18px;color:#555;word-break:break-all;">${input.url}</p>
      </td>
    </tr>`;

  return {
    subject: "Verifica tu email en Josealo",
    html: shell(content, "Confirma tu email para activar tu cuenta en Josealo."),
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
