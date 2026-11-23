const { Resend } = require('resend');

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey && process.env.NODE_ENV === 'production') {
  throw new Error('RESEND_API_KEY is not set');
}

const consoleClient = {
  emails: {
    send: async ({ to, subject, html }) => {
      const links = [...String(html).matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
      console.log(`[email not sent: RESEND_API_KEY unset] to=${to} subject="${subject}"`, links.join(' '));
      return { data: null, error: null };
    },
  },
};

module.exports = {
  resendClient: apiKey ? new Resend(apiKey) : consoleClient,
  sender: {
    email: process.env.RESEND_SENDER_EMAIL || 'support@rapidroutines.org',
    name: 'RapidRoutines',
  },
};
