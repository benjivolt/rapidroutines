const { Resend } = require('resend');

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is not set');
}

module.exports = {
  resendClient: new Resend(process.env.RESEND_API_KEY),
  sender: {
    email: process.env.RESEND_SENDER_EMAIL || 'support@rapidroutines.org',
    name: 'RapidRoutines',
  },
};
