const {
  EMAIL_CHANGED_TEMPLATE,
  PASSWORD_RESET_SUCCESS_TEMPLATE,
  PASSWORD_RESET_REQUEST_TEMPLATE,
  WELCOME_EMAIL_TEMPLATE,
} = require('./emailTemplates');
const { resendClient, sender } = require('./resend.config');
const { escapeHtml } = require('../lib/validate');

const send = async (to, subject, html) => {
  const result = await resendClient.emails.send({ from: `${sender.name} <${sender.email}>`, to, subject, html });
  if (result?.error) throw new Error(result.error.message || 'Email provider error');
  return result;
};

const fill = (template, key, value) => template.replace(`{${key}}`, () => escapeHtml(value));

module.exports = {
  sendWelcomeEmail: (email, name) =>
    send(email, 'Welcome to RapidRoutines', fill(WELCOME_EMAIL_TEMPLATE, 'name', name)),
  sendPasswordResetEmail: (email, resetURL) =>
    send(email, 'Reset your password', fill(PASSWORD_RESET_REQUEST_TEMPLATE, 'resetURL', resetURL)),
  sendResetSuccessEmail: (email) => send(email, 'Your password was changed', PASSWORD_RESET_SUCCESS_TEMPLATE),
  sendEmailChangedNotice: (email) => send(email, 'Your account email was changed', EMAIL_CHANGED_TEMPLATE),
};
