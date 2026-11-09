/** Plain, accessible email templates. Each returns { subject, text, html }. */

const escape = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function layout(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#F8FAFC;font-family:Inter,Arial,sans-serif;color:#0F172A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px">
<tr><td style="padding:28px 32px">
<p style="margin:0 0 20px;font-weight:700;font-size:18px;color:#4F46E5">SkillBridge</p>
<h1 style="margin:0 0 16px;font-size:20px">${escape(title)}</h1>
${bodyHtml}
<p style="margin:28px 0 0;font-size:12px;color:#64748B">You received this email because of activity on your SkillBridge account.</p>
</td></tr></table></td></tr></table></body></html>`;
}

export function passwordResetEmail({ name, link, minutes }) {
  const subject = 'Reset your SkillBridge password';
  const text = `Hi ${name},

We received a request to reset your SkillBridge password.
Open this link to choose a new password (valid for ${minutes} minutes, one use only):

${link}

If you did not ask for this, you can ignore this email. Your password will not change.`;
  const html = layout(
    'Reset your password',
    `<p style="margin:0 0 12px">Hi ${escape(name)},</p>
<p style="margin:0 0 20px">We received a request to reset your password. This link works once and expires in ${minutes} minutes.</p>
<p style="margin:0 0 20px"><a href="${escape(link)}" style="display:inline-block;background:#4F46E5;color:#FFFFFF;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600">Choose a new password</a></p>
<p style="margin:0;font-size:13px;color:#475569">If you did not ask for this, ignore this email. Your password will not change.</p>`,
  );
  return { subject, text, html };
}

export function passwordChangedEmail({ name }) {
  const subject = 'Your SkillBridge password was changed';
  const text = `Hi ${name},

Your SkillBridge password was just changed and you were signed out on other devices.
If this was not you, reset your password immediately using "Forgot password" on the login page.`;
  const html = layout(
    'Your password was changed',
    `<p style="margin:0 0 12px">Hi ${escape(name)},</p>
<p style="margin:0">Your password was just changed and you were signed out on other devices. If this was not you, use <strong>Forgot password</strong> on the login page straight away.</p>`,
  );
  return { subject, text, html };
}
