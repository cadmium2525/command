import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright';
import { COMMANDS, EVENTS, TRUE_ENDING } from '../src/data/catalog';
import { SAVE_KEY } from '../src/core/storage';

// A static server restricted to a Pages project subpath: no Vite SPA fallback.
const root = resolve('dist');
const mount = process.env.BROWSER_TEST_MOUNT || '/secret-start/';
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const request = new URL(req.url || '/', 'http://localhost');
    if (!request.pathname.startsWith(mount)) { res.writeHead(404); res.end(); return; }
    const file = resolve(root, decodeURIComponent(request.pathname.slice(mount.length)) || 'index.html');
    if (!file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
let url = process.env.BROWSER_TEST_URL || '';
if (!url) {
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server address');
  url = `http://127.0.0.1:${address.port}${mount}`;
}
const channel = process.env.PLAYWRIGHT_CHANNEL;
const results: { name: string; status: 'PASS' | 'FAIL'; error?: string }[] = [];
const errors: string[] = [];
const failedRequests: string[] = [];
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const run = async (name: string, check: () => Promise<void>) => {
  try { await check(); results.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, status: 'FAIL', error: String(error) }); throw error; }
};
await mkdir('.qa', { recursive: true });
// Preserve the initial-screen release's evidence; never present it as a console revision run.
try {
  const previous = await readFile('.qa/browser-results.json', 'utf8');
  if (!JSON.parse(previous).uiRevision) {
    try { await writeFile('.qa/browser-results-initial-release.json', previous, { flag: 'wx' }); } catch {}
  }
} catch {}
try {
  browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && new URL(response.url()).origin === new URL(url).origin) failedRequests.push(`${response.status()} ${response.url()}`); });
  const dialog = page.locator('#info-dialog');
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{"attemptedCommands":[],"discoveredEventIds":[],"viewedEventIds":[],"favoriteEventIds":[],"settings":{}}'), SAVE_KEY);
  const rawSave = () => page.evaluate(key => localStorage.getItem(key), SAVE_KEY);
  const closeModal = async () => {
    if (await dialog.evaluate(element => (element as HTMLDialogElement).open)) {
      await dialog.locator('[data-action="close-modal"]').click();
      await page.waitForFunction(() => !document.querySelector<HTMLDialogElement>('#info-dialog')?.open);
      // closeModal uses history.back(); let its popstate complete before a new modal is opened.
      await page.waitForFunction(() => !location.hash || location.hash === '#home');
    }
  };
  const openModal = async (name: string) => {
    await closeModal();
    await page.locator(`.console-menu [data-modal="${name}"]`).click();
    await dialog.waitFor({ state: 'visible' });
  };
  const setCommand = async (command: string) => {
    await page.evaluate(command => {
      for (const symbol of command) document.querySelector<HTMLButtonElement>(`[data-symbol="${symbol}"]`)!.click();
      document.querySelector<HTMLButtonElement>('[data-action="start"]')!.click();
    }, command);
  };
  const leavePlayback = async () => {
    // A miss can change from skip to return between observation and click.
    await page.locator('[data-action="skip"],[data-action="return"]').first().click();
  };
  const waitForScene = () => page.locator('#anticipation').waitFor({ state: 'detached' });
  const replay = async (eventId: string) => {
    await dialog.locator(`.event-card [data-replay="${eventId}"]`).evaluate((button: HTMLButtonElement) => button.click());
    await waitForScene();
  };

  await run('ゲーム機だけの初期画面・3枠制限・削除・リセット・キーボードSTART', async () => {
    await page.goto(url); await page.locator('#game-canvas').waitFor();
    assert.equal(await page.locator('#app > main > .console').count(), 1);
    assert.equal(await page.locator('.site-header,.footer,.game-aside,.intro').count(), 0);
    assert.equal(await page.locator('dialog[open]').count(), 0);
    assert.equal(await page.locator('.console-menu [data-modal]').count(), 5);
    assert.equal(await page.locator('#start-button').isDisabled(), true);
    await page.locator('[data-symbol="U"]').click(); await page.keyboard.press('ArrowUp');
    assert.equal(await page.locator('#start-button').isDisabled(), true);
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('a');
    assert.equal(await page.locator('#input-count').textContent(), '3');
    assert.equal(await page.locator('#command-slots').textContent(), '↑↑↑');
    await page.keyboard.press('Backspace'); assert.equal(await page.locator('#input-count').textContent(), '2');
    await page.locator('[data-action="clear"]').click(); assert.equal(await page.locator('#input-count').textContent(), '0');
    await page.locator('[data-symbol="U"]').click(); await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter'); await page.locator('.scene-dialogue').waitFor();
    assert.equal((await saved()).discoveredEventIds.length, 1);
    await leavePlayback(); assert.equal(await page.locator('#input-count').textContent(), '0');
    // Reset the genuine first discovery so admin-preview checks start with an empty collection.
    await openModal('settings'); await dialog.locator('[data-action="reset"]').click();
    await page.locator('[data-action="reset-confirm"]').click(); await page.locator('[data-action="reset-confirm"]').click();
    await closeModal(); assert.equal((await saved()).discoveredEventIds.length, 0);
  });

  await run('5種類の情報はネイティブモーダル内・フォーカスとEscape復帰', async () => {
    for (const name of ['library', 'explorer', 'progress', 'settings', 'admin']) {
      const trigger = page.locator(`.console-menu [data-modal="${name}"]`);
      await trigger.click(); await dialog.waitFor({ state: 'visible' });
      assert.equal(await dialog.evaluate(element => element.matches(':modal')), true);
      assert.equal(await page.evaluate(() => !!document.activeElement?.closest('#info-dialog')), true);
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => !!document.activeElement?.closest('#info-dialog')), true);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector<HTMLDialogElement>('#info-dialog')?.open && (!location.hash || location.hash === '#home'));
      assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
    }
    await openModal('admin'); assert.equal(await dialog.locator('#admin-toggle').isChecked(), true); await closeModal();
  });

  await run('管理者モード初期ON・173全演出をプレビューしても収集記録は不変', async () => {
    await openModal('library'); assert.equal(await dialog.locator('.event-card').count(), 173);
    const original = await rawSave();
    for (const event of EVENTS) {
      await replay(event.eventId);
      assert.equal(await page.locator('.playing-title').textContent(), event.title);
      assert.ok((await page.locator('#scene-narration').textContent())!.length > 0);
      await leavePlayback(); await dialog.waitFor({ state: 'visible' });
    }
    assert.equal(await rawSave(), original);
    assert.equal((await saved()).discoveredEventIds.length, 0);
    await closeModal(); await openModal('explorer');
    assert.equal(await dialog.locator('.explorer-cell').count(), 216);
    assert.equal(await dialog.locator('.explorer-title').count(), 216);
    await closeModal();
  });

  await run('セリフは読める時間保持・前後移動・最後は明示的に戻るまで消えない', async () => {
    const event = EVENTS.find(item => item.category === 'remix')!;
    await openModal('library'); await replay(event.eventId);
    const first = await page.locator('#scene-narration').textContent();
    await page.waitForTimeout(900); assert.equal(await page.locator('#scene-narration').textContent(), first);
    await page.locator('[data-action="advance"]').click();
    assert.equal(await page.locator('#scene-narration').textContent(), event.timeline[1].text);
    await page.locator('[data-symbol="L"]').click(); assert.equal(await page.locator('#scene-narration').textContent(), event.timeline[0].text);
    for (let index = 0; index < event.timeline.length + 1 && await page.locator('[data-action="advance"]').count(); index++) await page.locator('[data-action="advance"]').click();
    await page.locator('[data-action="return"]').waitFor();
    assert.equal(await page.locator('#scene-narration').textContent(), event.timeline.at(-1)!.text);
    await page.waitForTimeout(3200);
    assert.equal(await page.locator('.scene-dialogue').count(), 1);
    assert.equal(await page.locator('[data-action="return"]').isVisible(), true);
    await page.screenshot({ path: '.qa/console-final-reading-390.png', fullPage: true });
    await page.locator('[data-action="transcript"]').click();
    assert.equal(await dialog.locator('.transcript li').count(), event.timeline.length);
    await closeModal(); await leavePlayback(); await closeModal();
    assert.equal((await saved()).discoveredEventIds.length, 0);
  });

  await run('モーダル閲覧中は演出停止・閉じると再開・ブラウザー戻るで閉じる', async () => {
    await openModal('library'); await replay(EVENTS[0].eventId);
    await openModal('progress');
    const before = await page.locator('.play-progress').getAttribute('aria-valuenow');
    const line = await page.locator('#scene-narration').textContent();
    await page.waitForTimeout(2900);
    assert.equal(await page.locator('.play-progress').getAttribute('aria-valuenow'), before);
    assert.equal(await page.locator('#scene-narration').textContent(), line);
    await page.goBack(); await dialog.waitFor({ state: 'hidden' });
    await page.waitForTimeout(500);
    assert.notEqual(await page.locator('.play-progress').getAttribute('aria-valuenow'), before);
    await leavePlayback(); await closeModal();
  });

  await run('管理者OFFを保持し通常の5発見・87発見解禁へ戻る', async () => {
    await openModal('admin'); await dialog.locator('#admin-toggle').uncheck(); await closeModal();
    await page.reload(); await page.locator('#game-canvas').waitFor();
    await openModal('admin'); assert.equal(await dialog.locator('#admin-toggle').isChecked(), false); await closeModal();
    await openModal('library'); assert.equal(await dialog.locator('.event-card').count(), 0); assert.match(await dialog.textContent() || '', /5個の発見/); await closeModal();
    await openModal('explorer'); assert.equal(await dialog.locator('.explorer-cell').count(), 0); assert.match(await dialog.textContent() || '', /87個の発見/); await closeModal();
  });

  await run('通常モード全216入力・5/87解禁・173完集で真エンディング', async () => {
    const boundaries = new Set<number>();
    for (const entry of COMMANDS) {
      await setCommand(entry.command); const snapshot = await saved(); const n = snapshot.discoveredEventIds.length;
      await leavePlayback();
      if (await page.locator('.playing-title').count() && await page.locator('.playing-title').textContent() === TRUE_ENDING.title) await leavePlayback();
      if ([4, 5, 86, 87].includes(n) && !boundaries.has(n)) {
        boundaries.add(n);
        await openModal('library'); assert.equal(await dialog.locator('.event-card').count(), n < 5 ? 0 : n); await closeModal();
        await openModal('explorer'); assert.equal(await dialog.locator('.explorer-cell').count(), n < 87 ? 0 : 216);
        if (n === 87) {
          const unknown = dialog.locator('.explorer-cell:not(.found):not(.miss)');
          assert.equal(await unknown.count(), 216 - snapshot.attemptedCommands.length);
          assert.equal(await dialog.locator('.explorer-title').count(), 0);
          for (const label of await unknown.allTextContents()) assert.match(label, /未入力/);
        }
        await closeModal();
      }
    }
    const snapshot = await saved();
    assert.equal(snapshot.attemptedCommands.length, 216); assert.equal(snapshot.discoveredEventIds.length, 173); assert.equal(snapshot.completionSeen, true);
    assert.deepEqual([...boundaries].sort((a, b) => a - b), [4, 5, 86, 87]);
    await openModal('progress'); assert.equal(await dialog.locator('[role="progressbar"]').getAttribute('aria-valuenow'), '173'); await closeModal();
  });

  await run('発見後リロード・探索216枠/43空振り・図鑑検索/分類/お気に入り', async () => {
    await page.reload(); assert.equal((await saved()).discoveredEventIds.length, 173);
    await openModal('explorer'); assert.equal(await dialog.locator('.explorer-cell.found').count(), 173); assert.equal(await dialog.locator('.explorer-cell.miss').count(), 43); await closeModal();
    await openModal('library'); assert.equal(await dialog.locator('.event-card').count(), 173);
    await dialog.locator('[data-favorite]').first().click(); await dialog.locator('#favorites-only').check(); assert.equal(await dialog.locator('.event-card').count(), 1);
    await dialog.locator('#favorites-only').uncheck(); await dialog.locator('#category').selectOption('minigame'); assert.equal(await dialog.locator('.event-card').count(), 13);
    await dialog.locator('#search').fill(EVENTS.find(event => event.mechanic === 'blocks')!.title); assert.equal(await dialog.locator('.event-card').count(), 1);
    await dialog.locator('#search').fill(''); await dialog.locator('#category').selectOption('all');
    await page.screenshot({ path: '.qa/console-library-390.png', fullPage: true }); await closeModal();
  });

  await run('既読自動スキップON/OFF・図鑑再視聴は常に再生', async () => {
    await openModal('settings'); await dialog.locator('[data-setting="autoSkip"]').check(); await closeModal();
    await setCommand(EVENTS[0].command); assert.equal(await page.locator('.scene-dialogue').count(), 0); assert.match(await page.locator('#console-notice').textContent() || '', /自動スキップ/);
    await openModal('library'); await replay(EVENTS[0].eventId); assert.equal(await page.locator('.scene-dialogue').count(), 1); await leavePlayback(); await closeModal();
    await openModal('settings'); await dialog.locator('[data-setting="autoSkip"]').uncheck(); await closeModal();
    await setCommand(EVENTS[0].command); assert.equal(await page.locator('.scene-dialogue').count(), 1); await leavePlayback();
  });

  await run('インベーダーは移動と発射で敵に命中・残機とウェーブを表示', async () => {
    const event = EVENTS.find(item => item.mechanic === 'invaders')!;
    await openModal('library'); await replay(event.eventId);
    assert.match(await page.locator('#scene-detail').textContent() || '', /残機 3.*ウェーブ 1/);
    await page.locator('[data-symbol="L"]').click(); await page.locator('[data-symbol="R"]').click(); await page.locator('[data-symbol="R"]').click();
    for (let shot = 0; shot < 4; shot++) { await page.locator('[data-symbol="A"]').click(); await page.waitForTimeout(220); }
    await page.waitForFunction(() => Number(document.querySelector('#scene-detail')?.textContent?.match(/スコア\s*(\d+)/)?.[1] || 0) > 0);
    await page.locator('[data-symbol="B"]').click(); await page.screenshot({ path: '.qa/console-invaders-390.png', fullPage: true });
    await leavePlayback(); await closeModal();
  });

  await run('落ちものブロックは移動/回転/落下/ハードドロップで盤面へ配置', async () => {
    const event = EVENTS.find(item => item.mechanic === 'blocks')!;
    await openModal('library'); await replay(event.eventId);
    assert.match(await page.locator('#scene-detail').textContent() || '', /配置 0/);
    for (const symbol of ['L', 'U', 'R', 'D', 'B', 'B']) await page.locator(`[data-symbol="${symbol}"]`).click();
    await page.waitForFunction(() => Number(document.querySelector('#scene-detail')?.textContent?.match(/配置\s*(\d+)/)?.[1] || 0) >= 2);
    assert.match(await page.locator('#scene-detail').textContent() || '', /消した列/);
    await page.screenshot({ path: '.qa/console-blocks-390.png', fullPage: true }); await leavePlayback(); await closeModal();
  });

  await run('設定3項目の保存と再読み込み・JSON書き出しと読み込み', async () => {
    await openModal('settings'); await dialog.locator('[data-setting="muted"]').check(); await dialog.locator('[data-setting="reducedMotion"]').check(); await dialog.locator('[data-setting="autoSkip"]').check();
    await page.reload(); await dialog.waitFor({ state: 'visible' });
    for (const key of ['muted', 'reducedMotion', 'autoSkip']) assert.equal(await dialog.locator(`[data-setting="${key}"]`).isChecked(), true);
    const downloadPromise = page.waitForEvent('download'); await dialog.locator('[data-action="export"]').click();
    await (await downloadPromise).saveAs('.qa/console-save-export.json');
    const exported = JSON.parse(await readFile('.qa/console-save-export.json', 'utf8')); assert.equal(exported.schemaVersion, 2); assert.equal(exported.discoveredEventIds.length, 173);
    await dialog.locator('#import-file').setInputFiles('.qa/console-save-export.json'); await page.waitForFunction(() => document.querySelector('#modal-notice')?.textContent?.includes('まとめました'));
    assert.equal((await saved()).discoveredEventIds.length, 173); await closeModal();
  });

  await run('共有は記録モーダルの明示クリックだけでX Intentを開く', async () => {
    await openModal('progress'); const intent = new URL((await dialog.locator('[data-share]').getAttribute('href'))!);
    assert.equal(intent.origin, 'https://twitter.com'); assert.equal(intent.pathname, '/intent/tweet'); assert.match(intent.searchParams.get('text')!, /全173/);
    assert.equal(new URL(intent.searchParams.get('url')!).pathname, new URL(url).pathname);
    assert.equal(context.pages().filter(item => item.url().startsWith('https://twitter.com/')).length, 0);
    await context.route('https://twitter.com/intent/tweet**', route => route.fulfill({ status: 200, contentType: 'text/html', body: 'Intent preview' }));
    const popupPromise = page.waitForEvent('popup'); await dialog.locator('[data-share]').click(); const popup = await popupPromise;
    await popup.waitForLoadState(); assert.equal(new URL(popup.url()).origin, 'https://twitter.com'); await popup.close(); await context.unroute('https://twitter.com/intent/tweet**');
    assert.doesNotMatch(await page.locator('body').textContent() || '', /投稿完了/); await closeModal();
  });

  await run('幅320/390/768/1280と横画面でゲーム機と全モーダルが操作可能', async () => {
    for (const size of [{ width: 320, height: 800 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1280, height: 900 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(size);
      const geometry = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, buttons: [...document.querySelectorAll<HTMLElement>('.console button')].map(button => ({ width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })) }));
      assert.equal(geometry.scroll, geometry.width, `${size.width}px horizontal overflow`);
      for (const button of geometry.buttons) assert.ok(button.width >= 44 && button.height >= 44, JSON.stringify(button));
      await page.screenshot({ path: `.qa/console-title-${size.width}x${size.height}.png`, fullPage: true });
      for (const name of ['library', 'explorer', 'progress', 'settings', 'admin']) {
        await openModal(name);
        assert.equal(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1), true, `${name}: modal horizontal overflow at ${size.width}`);
        assert.equal(await dialog.locator('.modal-close').isVisible(), true); await closeModal();
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
  });

  await run('二段階消去の取消/確定・別タブ反映・管理者設定は独立', async () => {
    const other = await context.newPage(); await other.goto(url); await other.locator('#game-canvas').waitFor();
    await openModal('settings'); await dialog.locator('[data-action="reset"]').click(); await page.locator('[data-action="reset-confirm"]').click(); await page.locator('[data-action="reset-cancel"]').click();
    assert.equal((await saved()).discoveredEventIds.length, 173);
    assert.equal(await dialog.locator('[data-action="reset"]').evaluate(element => element === document.activeElement), true);
    await dialog.locator('[data-action="reset"]').click(); await page.locator('[data-action="reset-confirm"]').click(); await page.locator('[data-action="reset-confirm"]').click();
    assert.equal((await saved()).discoveredEventIds.length, 0);
    await other.waitForFunction(key => JSON.parse(localStorage.getItem(key) || '{}').discoveredEventIds?.length === 0, SAVE_KEY);
    await other.locator('[data-action="sound"]').click(); assert.equal((await saved()).discoveredEventIds.length, 0); await other.close(); await closeModal();
    await openModal('admin'); assert.equal(await dialog.locator('#admin-toggle').isChecked(), false); await closeModal();
  });

  await run('破損保存で警告・元記録を退避して新しい発見を保存', async () => {
    await page.evaluate(key => localStorage.setItem(key, '{corrupt'), SAVE_KEY); await page.reload();
    assert.match(await page.locator('#console-notice').textContent() || '', /読み込めません/);
    await setCommand(EVENTS[0].command); assert.equal((await saved()).discoveredEventIds.length, 1); await leavePlayback();
    assert.equal(await page.evaluate(key => localStorage.getItem(`${key}.recovery`), SAVE_KEY), '{corrupt');
  });

  await run('Service Worker登録後は通信なしで再起動し新発見できる', async () => {
    if (new URL(url).hostname !== '127.0.0.1' && new URL(url).hostname !== 'localhost') {
      assert.equal(new URL(url).protocol, 'https:');
    }
    await page.evaluate(async () => { await navigator.serviceWorker.ready; }); await page.reload(); await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await context.setOffline(true); await page.reload(); await page.locator('#game-canvas').waitFor();
    await setCommand(EVENTS[2].command); assert.equal((await saved()).discoveredEventIds.length, 2); await leavePlayback(); await context.setOffline(false);
  });

  assert.deepEqual(errors, []); assert.deepEqual(failedRequests, []);
  console.log(`Browser checks: ${results.length}/${results.length} PASS; zero script errors or project 404s.`);
} finally {
  await writeFile('.qa/browser-results.json', JSON.stringify({ uiRevision: 'console-dialog-admin-reading-2026-10-24', completedAt: new Date().toISOString(), url, channel: channel || 'chromium', results, errors, failedRequests }, null, 2));
  await browser?.close(); if (server.listening) await new Promise<void>(done => server.close(() => done()));
}
