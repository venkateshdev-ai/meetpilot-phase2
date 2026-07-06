// Plain-inline-CSS HTML templates (no MJML/React-Email build step) so these
// render correctly in every mail client without extra tooling.

function shell(bodyHtml: string) {
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #0f172a;">
    <div style="width: 40px; height: 40px; border-radius: 12px; background: linear-gradient(135deg,#6d5bf8,#2e5aac); margin-bottom: 24px;"></div>
    ${bodyHtml}
    <p style="margin-top: 32px; font-size: 12px; color: #94a3b8;">MeetPilot — meeting copilot & workspace booking</p>
  </div>`;
}

export function inviteMemberEmail(input: {
  inviteeName: string;
  orgName: string;
  invitedByName: string;
  role: string;
  tempPassword: string;
  loginUrl: string;
}) {
  return {
    subject: `You've been added to ${input.orgName} on MeetPilot`,
    html: shell(`
      <h1 style="font-size: 20px; margin-bottom: 8px;">Welcome to ${input.orgName}</h1>
      <p style="font-size: 14px; line-height: 1.6;">
        Hi ${input.inviteeName}, ${input.invitedByName} just added you to <b>${input.orgName}</b>
        on MeetPilot as a <b>${input.role.replace("_", " ")}</b>.
      </p>
      <div style="background: #f1f5f9; border-radius: 10px; padding: 16px; margin: 20px 0; font-size: 14px;">
        <div style="margin-bottom: 6px;"><b>Email:</b> ${input.inviteeName}</div>
        <div><b>Temporary password:</b> <code>${input.tempPassword}</code></div>
      </div>
      <p style="font-size: 13px; color: #64748b;">
        Sign in and change this password from your profile page as soon as you can.
      </p>
      <a href="${input.loginUrl}" style="display: inline-block; margin-top: 16px; background: #6d5bf8; color: white; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600;">
        Sign in to MeetPilot
      </a>
    `),
  };
}

export function welcomeSignupEmail(input: { name: string; orgName: string }) {
  return {
    subject: `Welcome to MeetPilot`,
    html: shell(`
      <h1 style="font-size: 20px; margin-bottom: 8px;">You're in, ${input.name}</h1>
      <p style="font-size: 14px; line-height: 1.6;">
        Your account is live and you've joined <b>${input.orgName}</b>. Create your first meeting
        to start turning conversations into tracked action items.
      </p>
    `),
  };
}
