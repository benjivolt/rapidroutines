const {
  PASSWORD_RESET_SUCCESS_TEMPLATE,
  PASSWORD_RESET_REQUEST_TEMPLATE,
  WELCOME_EMAIL_TEMPLATE,
} = require('./emailTemplates');
const { resendClient, sender } = require('./resend.config');
const { escapeHtml } = require('../lib/validate');

const send = (to, subject, html) =>
  resendClient.emails.send({ from: `${sender.name} <${sender.email}>`, to, subject, html });

const fill = (template, key, value) => template.replace(`{${key}}`, () => escapeHtml(value));

module.exports = {
  sendWelcomeEmail: (email, name) =>
    send(email, 'Welcome to RapidRoutines', fill(WELCOME_EMAIL_TEMPLATE, 'name', name)),
  sendPasswordResetEmail: (email, resetURL) =>
    send(email, 'Reset your password', fill(PASSWORD_RESET_REQUEST_TEMPLATE, 'resetURL', resetURL)),
  sendResetSuccessEmail: (email) => send(email, 'Your password was changed', PASSWORD_RESET_SUCCESS_TEMPLATE),
};
