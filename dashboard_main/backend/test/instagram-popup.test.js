const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// Load the actual exported-page script; unrelated ready handlers stay dormant.
function renderPost(post) {
  let click;
  const popup = { innerHTML: '' };
  const feed = { querySelector: (selector) => selector === '.popup-is-initialized' ? popup : { style: {} } };
  const account = { getAttribute: (name) => name === 'data-connected-acc-type' ? 'business' : '' };
  const item = { dataset: { postdata: JSON.stringify(post) }, getAttribute: () => '123', closest: () => account };
  const container = { addEventListener: (_, handler) => { click = handler; }, closest: () => account };
  const chain = new Proxy(() => chain, { get: (_, name) => name === 'length' ? 0 : chain });
  const context = vm.createContext({
    document: { readyState: 'loading', addEventListener() {}, querySelectorAll: () => [], querySelector: () => ({ classList: { contains: () => true } }) },
    window: { addEventListener() {}, location: { origin: 'https://rapidroutines.example' } },
    Element: class Element { matches() {} closest() {} },
    navigator: { userAgent: 'Node test' },
    jQuery: chain,
    eplocalize: { is_pro_plugin_active: true },
    URL,
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../../js/front.js'), 'utf8'), context);
  context.container = container;
  vm.runInContext('epGlobals.instaPopup(container)', context);
  click({ target: { closest: (selector) => selector === '.insta-gallery-item' ? item : feed } });
  return popup.innerHTML;
}

const post = {
  id: '123', username: 'athlete', caption: 'A workout #fitness', media_type: 'IMAGE',
  media_url: 'https://images.example/workout.jpg', permalink: 'https://www.instagram.com/p/123/?a=1&b=2',
  profile_picture_url: 'https://images.example/avatar.jpg', show_likes_count: 'true', like_count: 3,
  show_comments_count: 'true', comments_count: 2, popup_follow_button: 'true', popup_follow_button_text: 'Follow',
};

test('Instagram popup preserves media, captions, hashtag links and encoded sharing URLs', () => {
  const html = renderPost(post);
  assert.ok(html.includes('src="https://images.example/workout.jpg"'));
  assert.equal(html.match(/class="tag-wrapper"><a[^>]*href="([^"]+)"/)?.[1], 'https://www.instagram.com/explore/tags/fitness');
  assert.ok(html.includes('A workout '));
  assert.ok(html.includes('u=https%3A%2F%2Fwww.instagram.com%2Fp%2F123%2F%3Fa%3D1%26b%3D2'));
});

test('Instagram popup treats post text as text and rejects executable media/link URLs', () => {
  const payload = '"><img src=x onerror=alert(1)>';
  const html = renderPost({ ...post, id: payload, username: payload, caption: payload + ' #fitness',
    media_url: 'javascript:alert(1)', profile_picture_url: 'data:text/html,bad', permalink: 'javascript:alert(1)',
    like_count: payload, comments_count: payload, popup_follow_button_text: payload });
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('javascript:'));
  assert.ok(!html.includes('data:text/html'));
  assert.ok(html.includes('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;'));
});

test('Instagram carousel escapes child captions and validates child URLs', () => {
  const html = renderPost({ ...post, media_type: 'CAROUSEL_ALBUM', children: { data: [
    { media_type: 'VIDEO', media_url: 'javascript:alert(1)', caption: '" onerror="bad' },
    { media_type: 'IMAGE', media_url: 'https://images.example/second.jpg', caption: '<script>bad</script>' },
  ] } });
  assert.ok(!html.includes('javascript:'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('alt="&quot; onerror=&quot;bad"'));
  assert.ok(html.includes('https://images.example/second.jpg'));
});
