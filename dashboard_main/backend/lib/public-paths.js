const PUBLIC_DIRS = ['chatbot', 'css', 'exercise-tracker', 'fonts', 'images', 'js', 'media', 'repbot', 'vendor'];
const PUBLIC_PAGES = ['index', 'about', 'faq', 'contact-us', 'testimonials'];

const decode = (rawPath) => {
  try {
    return decodeURIComponent(rawPath);
  } catch {
    return null;
  }
};

const isSafePath = (rawPath) => {
  const decoded = decode(rawPath);
  if (decoded === null || !decoded.startsWith('/') || /[\\\0]/.test(decoded)) return false;
  return !decoded
    .split('/')
    .slice(1)
    .some((segment) => segment.startsWith('.'));
};

const isPublicPath = (rawPath) => {
  if (!isSafePath(rawPath)) return false;
  const [first, ...rest] = decode(rawPath).split('/').slice(1);
  if (first === 'dashboard' || PUBLIC_DIRS.includes(first)) return true;
  if (rest.some(Boolean)) return false;
  return first === '' || PUBLIC_PAGES.includes(first.replace(/\.html$/i, '').toLowerCase());
};

module.exports = { PUBLIC_DIRS, PUBLIC_PAGES, isSafePath, isPublicPath };
