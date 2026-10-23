import assert from 'node:assert/strict';
import test from 'node:test';
import { EVENTS } from '../src/data/catalog';
import { createEmptySave } from '../src/core/state';
import { publicUrl, shareUrl } from '../src/core/share';

function withLocation(href: string, run: (outboundCalls: () => number) => void) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let calls = 0;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    location: { href, assign: () => { calls += 1; } },
    open: () => { calls += 1; },
  } });
  try { run(() => calls); }
  finally {
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
    else Reflect.deleteProperty(globalThis, 'window');
  }
}

test('sharing percent and Japanese copy round-trip through an X Web Intent URL', () => {
  withLocation('https://example.github.io/secret-start/?temporary=1#library', outboundCalls => {
    const save = { ...createEmptySave(), discoveredEventIds: EVENTS.slice(0, 37).map(event => event.eventId) };
    const result = new URL(shareUrl(save));
    assert.equal(result.origin, 'https://twitter.com');
    assert.equal(result.pathname, '/intent/tweet');
    assert.equal(result.searchParams.get('text'), 'SECRET START：37/173（21%）発見！ あなたは何個見つけた？ #SecretStart');
    assert.equal(result.searchParams.get('url'), 'https://example.github.io/secret-start/');
    assert.equal(result.hash, '', 'the hashtag belongs to the encoded text parameter');
    assert.equal(outboundCalls(), 0, 'constructing the link does not open or navigate a page');
  });
});

test('completion sharing uses the complete message only at 173 discoveries', () => {
  withLocation('https://example.github.io/secret-start/', () => {
    const complete = { ...createEmptySave(), discoveredEventIds: EVENTS.map(event => event.eventId) };
    const text = new URL(shareUrl(complete)).searchParams.get('text');
    assert.equal(text, 'SECRET START：全173演出を発見してコンプリート！ #SecretStart');
    const partial = { ...complete, discoveredEventIds: complete.discoveredEventIds.slice(0, 172) };
    assert.match(new URL(shareUrl(partial)).searchParams.get('text')!, /172\/173/);
  });
});

test('the public URL preserves a Pages subpath and removes temporary view state', () => {
  for (const [current, expected] of [
    ['https://example.github.io/secret-start#settings', 'https://example.github.io/secret-start/'],
    ['https://example.github.io/secret-start/index.html?debug=true#explorer', 'https://example.github.io/secret-start/index.html'],
    ['https://example.github.io/?source=x#home', 'https://example.github.io/'],
  ]) {
    withLocation(current, () => assert.equal(publicUrl(), expected));
  }
});
