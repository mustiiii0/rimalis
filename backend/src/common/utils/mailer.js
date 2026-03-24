const { execFile } = require('node:child_process');
const sgMail = require('@sendgrid/mail');
const nodemailer = require('nodemailer');

let cachedTransport = null;
let cachedTransportKey = '';

function isProduction() {
  return String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
}

function getSendGridApiKey() {
  return String(process.env.SENDGRID_API_KEY || process.env.SENDGRID_KEY || '').trim();
}

function resolveSmtpConfig(override = {}) {
  const host = String(override.smtpHost || process.env.SMTP_HOST || '').trim();
  const portRaw = override.smtpPort ?? process.env.SMTP_PORT ?? '';
  const port = Number(portRaw || 587);
  const user = String(override.smtpUser || process.env.SMTP_USER || '').trim();
  const pass = String(
    override.smtpPass ||
      process.env.SMTP_PASS ||
      process.env.SMTP_PASSWORD ||
      ''
  ).trim();
  const secureEnv = String(override.smtpSecure ?? process.env.SMTP_SECURE ?? '')
    .trim()
    .toLowerCase();
  const secure = secureEnv ? secureEnv === 'true' : port === 465;

  const fromEmail = String(
    override.fromEmail ||
      override.supportEmail ||
      process.env.SMTP_FROM ||
      process.env.SUPPORT_EMAIL ||
      user ||
      'support@rimalis.se'
  ).trim();

  return { host, port, user, pass, secure, fromEmail };
}

function getSmtpTransport(config) {
  if (!config.host) return null;

  const key = JSON.stringify({
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
    pass: config.pass ? '1' : '0',
  });

  if (cachedTransport && cachedTransportKey === key) return cachedTransport;

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth:
      config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
  });

  cachedTransport = transport;
  cachedTransportKey = key;
  return transport;
}

async function sendViaSendGridApi({ toEmail, subject, bodyText, fromEmail }) {
  const apiKey = getSendGridApiKey();
  if (!apiKey) return { sent: false, reason: 'sendgrid-not-configured' };

  const from = String(fromEmail || process.env.SMTP_FROM || process.env.SUPPORT_EMAIL || '').trim();
  if (!from) return { sent: false, reason: 'missing-from-email' };

  try {
    sgMail.setApiKey(apiKey);
    await sgMail.send({
      to: toEmail,
      from,
      replyTo: from,
      subject,
      text: String(bodyText || ''),
    });
    return { sent: true, reason: 'delivered-via-sendgrid-api' };
  } catch (err) {
    const msg = err?.response?.body?.errors?.[0]?.message || err?.message || 'sendgrid-failed';
    return { sent: false, reason: 'sendgrid-failed', error: msg };
  }
}

async function sendViaSmtp({ toEmail, subject, bodyText, fromEmail, smtpOverride = {} }) {
  const smtpConfig = resolveSmtpConfig({ ...smtpOverride, fromEmail });
  const transport = getSmtpTransport(smtpConfig);
  if (!transport) return { sent: false, reason: 'smtp-not-configured' };

  try {
    const info = await transport.sendMail({
      from: smtpConfig.fromEmail,
      to: toEmail,
      replyTo: smtpConfig.fromEmail,
      subject,
      text: String(bodyText || ''),
    });
    return { sent: true, reason: 'delivered-via-smtp', messageId: info?.messageId };
  } catch (err) {
    return { sent: false, reason: 'smtp-failed', error: err?.message || 'smtp-failed' };
  }
}

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

async function sendSupportReplyEmail({
  smtpHost,
  smtpPort,
  smtpUser,
  smtpPass,
  smtpSecure,
  supportEmail,
  toEmail,
  subject,
  reply,
  originalMessage,
}) {
  if (!toEmail) return { sent: false, reason: 'missing-recipient' };

  const body = buildEmailText({ subject, reply, originalMessage, supportEmail });

  const sendgrid = await sendViaSendGridApi({
    toEmail,
    subject: `[Rimalis Support] ${subject}`,
    bodyText: body,
    fromEmail: supportEmail || undefined,
  });
  if (sendgrid.sent) return sendgrid;
  if (isProduction() && sendgrid.reason !== 'sendgrid-not-configured') return sendgrid;

  const smtp = await sendViaSmtp({
    toEmail,
    subject: `[Rimalis Support] ${subject}`,
    bodyText: body,
    fromEmail: supportEmail || undefined,
    smtpOverride: { smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure, supportEmail },
  });
  if (smtp.sent) return smtp;
  if (isProduction() && smtp.reason !== 'smtp-not-configured') return smtp;
  if (isProduction() && smtp.reason === 'smtp-not-configured') return smtp;

  const fromEmail = String(
    supportEmail ||
      smtpUser ||
      process.env.SMTP_FROM ||
      process.env.SUPPORT_EMAIL ||
      'support@rimalis.se'
  ).trim();
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
        resolve({
          sent: false,
          reason: smtp.reason === 'smtp-not-configured' ? 'no-mail-transport' : 'sendmail-failed',
        });
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
  const subject = '[Rimalis Admin] Verifieringskod';

  const sendgrid = await sendViaSendGridApi({
    toEmail,
    subject,
    bodyText: body,
    fromEmail: process.env.SMTP_FROM || process.env.SUPPORT_EMAIL || undefined,
  });
  if (sendgrid.sent) return sendgrid;
  if (isProduction() && sendgrid.reason !== 'sendgrid-not-configured') return sendgrid;

  const smtp = await sendViaSmtp({
    toEmail,
    subject,
    bodyText: body,
    fromEmail: process.env.SMTP_FROM || process.env.SUPPORT_EMAIL || undefined,
  });
  if (smtp.sent) return smtp;
  if (isProduction() && smtp.reason !== 'smtp-not-configured') return smtp;
  if (isProduction() && smtp.reason === 'smtp-not-configured') return smtp;

  const fromEmail = String(process.env.SMTP_FROM || process.env.SUPPORT_EMAIL || 'support@rimalis.se').trim();
  const emailPayload = [
    `From: ${fromEmail}`,
    `To: ${toEmail}`,
    `Reply-To: ${fromEmail}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body,
    '',
  ].join('\n');

  return new Promise((resolve) => {
    const child = execFile('/usr/sbin/sendmail', ['-t', '-i'], { timeout: 8000 }, (error) => {
      if (error) {
        resolve({
          sent: false,
          reason: smtp.reason === 'smtp-not-configured' ? 'no-mail-transport' : 'sendmail-failed',
        });
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
  const sendgrid = await sendViaSendGridApi({ toEmail, subject, bodyText, fromEmail });
  if (sendgrid.sent) return sendgrid;
  if (isProduction() && sendgrid.reason !== 'sendgrid-not-configured') return sendgrid;

  const smtp = await sendViaSmtp({ toEmail, subject, bodyText, fromEmail });
  if (smtp.sent) return smtp;
  if (isProduction() && smtp.reason !== 'smtp-not-configured') return smtp;
  if (isProduction() && smtp.reason === 'smtp-not-configured') return smtp;

  const sender = String(fromEmail || process.env.SMTP_FROM || process.env.SUPPORT_EMAIL || 'support@rimalis.se').trim();
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
        resolve({
          sent: false,
          reason: smtp.reason === 'smtp-not-configured' ? 'no-mail-transport' : 'sendmail-failed',
        });
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
