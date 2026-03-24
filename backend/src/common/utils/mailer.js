const { execFile } = require('node:child_process');

function buildEmailText({ subject, reply, originalMessage, supportEmail }) {
  return [
    'Hej!',
    '',
    'Vi har svarat på ditt meddelande:',
    '',
    reply,
    '',
    '---',
    `Ärende: ${subject}`,
    '',
    'Ditt ursprungliga meddelande:',
    originalMessage || '-',
    '',
    supportEmail ? `Kontakt: ${supportEmail}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

async function sendSupportReplyEmail({ smtpHost, smtpPort, smtpUser, supportEmail, toEmail, subject, reply, originalMessage }) {
  if (!toEmail) return { sent: false, reason: 'missing-recipient' };

  const fromEmail = supportEmail || smtpUser || 'support@rimalis.se';
  const body = buildEmailText({ subject, reply, originalMessage, supportEmail });
  const emailPayload = [
    `From: ${fromEmail}`,
    `To: ${toEmail}`,
    `Reply-To: ${fromEmail}`,
    `Subject: [Rimalis Support] ${subject}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body,
    '',
  ].join('\n');

  return new Promise((resolve) => {
    const child = execFile('/usr/sbin/sendmail', ['-t', '-i'], { timeout: 8000 }, (error) => {
      if (error) {
        resolve({ sent: false, reason: 'sendmail-failed' });
        return;
      }
      resolve({ sent: true, reason: 'delivered-via-sendmail' });
    });

    try {
      child.stdin.write(emailPayload);
      child.stdin.end();
    } catch (_err) {
      resolve({ sent: false, reason: 'sendmail-write-failed' });
    }
  });
}

async function sendAdminTwoFactorEmail({ toEmail, userName, code, ttlMinutes }) {
  if (!toEmail) return { sent: false, reason: 'missing-recipient' };
  const fromEmail = 'support@rimalis.se';
  const body = [
    `Hej ${userName || 'admin'},`,
    '',
    'Din verifieringskod för admin-inloggning är:',
    '',
    `Kod: ${code}`,
    '',
    `Koden är giltig i ${ttlMinutes} minuter.`,
    '',
    'Om du inte försökte logga in, ignorera detta mejl.',
  ].join('\n');
  const emailPayload = [
    `From: ${fromEmail}`,
    `To: ${toEmail}`,
    `Reply-To: ${fromEmail}`,
    'Subject: [Rimalis Admin] Verifieringskod',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body,
    '',
  ].join('\n');

  return new Promise((resolve) => {
    const child = execFile('/usr/sbin/sendmail', ['-t', '-i'], { timeout: 8000 }, (error) => {
      if (error) {
        resolve({ sent: false, reason: 'sendmail-failed' });
        return;
      }
      resolve({ sent: true, reason: 'delivered-via-sendmail' });
    });

    try {
      child.stdin.write(emailPayload);
      child.stdin.end();
    } catch (_err) {
      resolve({ sent: false, reason: 'sendmail-write-failed' });
    }
  });
}

async function sendTransactionalEmail({ toEmail, subject, bodyText, fromEmail }) {
  if (!toEmail) return { sent: false, reason: 'missing-recipient' };
  const sender = fromEmail || 'support@rimalis.se';
  const emailPayload = [
    `From: ${sender}`,
    `To: ${toEmail}`,
    `Reply-To: ${sender}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    String(bodyText || ''),
    '',
  ].join('\n');

  return new Promise((resolve) => {
    const child = execFile('/usr/sbin/sendmail', ['-t', '-i'], { timeout: 8000 }, (error) => {
      if (error) {
        resolve({ sent: false, reason: 'sendmail-failed' });
        return;
      }
      resolve({ sent: true, reason: 'delivered-via-sendmail' });
    });

    try {
      child.stdin.write(emailPayload);
      child.stdin.end();
    } catch (_err) {
      resolve({ sent: false, reason: 'sendmail-write-failed' });
    }
  });
}

module.exports = { sendSupportReplyEmail, sendAdminTwoFactorEmail, sendTransactionalEmail };
