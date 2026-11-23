const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/;

const isString = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max;

module.exports = {
  PASSWORD_RULES:
    'Password must be 8-128 characters with an uppercase letter, a lowercase letter, a number and a symbol.',
  isEmail: (value) => isString(value, 254) && EMAIL_RE.test(value),
  isPassword: (value) => isString(value, 128) && PASSWORD_RE.test(value),
  isName: (value) => isString(value, 50) && value.trim().length > 0 && !/[<>]|https?:/i.test(value),
  isString,
  escapeHtml: (value) =>
    String(value).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    ),
};
