import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium, type Page } from 'playwright';
import { COMMANDS, EVENTS, TRUE_ENDING } from '../src/data/catalog';
import type { GameEvent } from '../src/data/types';
import { ARCADE_FAMILIES, FAMILY_LABELS } from '../src/events/arcade-types';
import { SAVE_KEY } from '../src/core/storage';

const REVISION = 'public-arcade-no-admin-2026-10-24';
// Serve only the project subpath; no development server or SPA fallback can hide 404s.
const root = resolve('dist');
const mount = process.env.BROWSER_TEST_MOUNT || '/secret-start/';
const mime: Record<string,string> = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css', '.webp':'image/webp', '.svg':'image/svg+xml' };
const server = createServer(async (req,res) => {
  try {
    const request = new URL(req.url || '/', 'http://localhost');
    if (!request.pathname.startsWith(mount)) { res.writeHead(404); res.end(); return; }
    const file = resolve(root, decodeURIComponent(request.pathname.slice(mount.length)) || 'index.html');
    if (!file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    res.writeHead(200, { 'content-type':mime[extname(file)] || 'application/octet-stream', 'cache-control':'no-store' });
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
const results: {name:string;status:'PASS'|'FAIL';error?:string}[] = [];
const errors: string[] = [], failedRequests: string[] = [], gamesStarted: string[] = [], commandsExercised: string[] = [];
const familyScreenshots: string[] = [];
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let currentPage: Page | undefined;
const run = async (name:string, check:()=>Promise<void>) => {
  try { await check(); results.push({ name,status:'PASS' }); console.log(`PASS ${name}`); }
  catch (error) {
    results.push({ name,status:'FAIL',error:String(error) });
    await currentPage?.screenshot({ path:'.qa/arcade-failure.png',fullPage:true }).catch(() => {});
    throw error;
  }
};
await mkdir('.qa', { recursive:true });
try {
  const previous = await readFile('.qa/browser-results.json','utf8');
  if (JSON.parse(previous).uiRevision !== REVISION) {
    try { await writeFile('.qa/browser-results-before-public-release.json',previous,{ flag:'wx' }); } catch {}
  }
} catch {}
try {
  browser = await chromium.launch({ headless:true,...(channel ? { channel } : {}) });
  const context = await browser.newContext({ viewport:{ width:390,height:844 },isMobile:true,hasTouch:true,reducedMotion:'reduce' });
  // A stale development preference must never open the published collection.
  await context.addInitScript(() => localStorage.setItem('secret-start.admin-preview','on'));
  const page = await context.newPage(); currentPage = page;
  page.setDefaultTimeout(10_000);
  page.on('pageerror',error => errors.push(error.message));
  page.on('response',response => {
    if (response.status() >= 400 && new URL(response.url()).origin === new URL(url).origin) failedRequests.push(`${response.status()} ${response.url()}`);
  });
  const dialog = page.locator('#info-dialog'), canvas = page.locator('#game-canvas'), result = page.locator('#game-result');
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{"attemptedCommands":[],"discoveredEventIds":[],"viewedEventIds":[],"favoriteEventIds":[],"settings":{}}'),SAVE_KEY);
  const rawSave = () => page.evaluate(key => localStorage.getItem(key),SAVE_KEY);
  const closeModal = async () => {
    if (await dialog.evaluate(element => (element as HTMLDialogElement).open)) {
      await dialog.locator('[data-action="close-modal"]').click();
      await page.waitForFunction(() => !document.querySelector<HTMLDialogElement>('#info-dialog')?.open && (!location.hash || location.hash === '#home'));
    }
  };
  const openModal = async (name:string) => {
    await closeModal(); await page.locator(`.console-menu [data-modal="${name}"]`).click(); await dialog.waitFor({ state:'visible' });
  };
  const waitForGame = async () => {
    await page.locator('.arcade-info').waitFor();
    await page.locator('#anticipation').waitFor({ state:'detached' });
  };
  const setCommand = async (command:string) => {
    await page.evaluate(value => {
      for (const key of value) document.querySelector<HTMLButtonElement>(`[data-symbol="${key}"]`)!.click();
      document.querySelector<HTMLButtonElement>('[data-action="start"]')!.click();
    },command);
    await waitForGame();
  };
  const replay = async (event:GameEvent) => {
    await dialog.locator(`.event-card [data-replay="${event.eventId}"]`).evaluate((button:HTMLButtonElement) => button.click());
    await waitForGame();
  };
  const startReadyGame = async () => {
    if (await canvas.getAttribute('data-phase') === 'ready') await page.locator('#start-button[data-action="advance"]').click();
    await page.waitForFunction(() => document.querySelector<HTMLCanvasElement>('#game-canvas')?.dataset.phase === 'playing');
  };
  const assertHiddenTitle = async (event:GameEvent) => {
    assert.equal(await result.isVisible(),false,event.eventId);
    assert.equal(await page.locator('#result-title').textContent(),'');
    assert.equal(await page.locator('.playing-title').textContent(),`MINI GAME · ${event.eventId===TRUE_ENDING.eventId?'アーケード・リミックス':FAMILY_LABELS[event.game.family]}`);
    assert.notEqual(await canvas.getAttribute('aria-label'),event.title);
    assert.equal((await page.locator('.arcade-info').textContent() || '').includes(event.title),false,event.eventId);
    assert.equal(await canvas.getAttribute('data-family'),event.game.family);
    assert.equal(await canvas.getAttribute('data-variant'),String(event.game.variant));
    assert.equal(await page.locator('#scene-narration').textContent(),event.game.rule);
  };
  const revealResult = async (event?:GameEvent) => {
    if (!await result.isVisible()) await page.locator('[data-action="skip"]').click();
    await result.waitFor({ state:'visible' });
    if (event) assert.equal(await page.locator('#result-title').textContent(),event.title);
  };
  const leaveGame = async (event?:GameEvent) => {
    await revealResult(event); await page.locator('#start-button[data-action="return"]').click();
  };
  const screenshot = async (name:string) => { await page.screenshot({ path:`.qa/arcade-${name}.png`,fullPage:true }); };

  await run('ゲーム機だけの初期画面・3枠制限・削除・リセット・キーボードSTART', async () => {
    await page.goto(url); await canvas.waitFor();
    assert.equal(await page.locator('#app > main > .console').count(),1);
    assert.equal(await page.locator('.site-header,.footer,.game-aside,.intro').count(),0);
    assert.equal(await page.locator('dialog[open]').count(),0);
    assert.equal(await page.locator('.console-menu [data-modal]').count(),4);
    assert.equal(await page.locator('[data-modal="admin"],#admin-toggle,[data-action="preview-ending"]').count(),0);
    assert.equal(await page.locator('#start-button').isDisabled(),true);
    await page.locator('[data-symbol="U"]').click(); await page.keyboard.press('ArrowUp');
    assert.equal(await page.locator('#start-button').isDisabled(),true);
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('a');
    assert.equal(await page.locator('#input-count').textContent(),'3');
    assert.equal(await page.locator('#command-slots').textContent(),'↑↑↑');
    await page.keyboard.press('Backspace'); assert.equal(await page.locator('#input-count').textContent(),'2');
    await page.locator('[data-action="clear"]').click(); assert.equal(await page.locator('#input-count').textContent(),'0');
    await page.locator('[data-symbol="U"]').click(); await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter'); await waitForGame();
    assert.equal((await saved()).discoveredEventIds.length,1);
    await assertHiddenTitle(EVENTS.find(event => event.command === 'UUU')!);
    await leaveGame(); assert.equal(await page.locator('#input-count').textContent(),'0');
    // A discovered game still cannot be replayed until the library is unlocked.
    await page.evaluate(eventId => { const button=document.createElement('button'); button.dataset.replay=eventId; document.querySelector('#app')!.append(button); button.click(); button.remove(); },EVENTS.find(event => event.command==='UUU')!.eventId);
    assert.equal(await page.locator('.arcade-info').count(),0);
    await openModal('settings'); await dialog.locator('[data-action="reset"]').click();
    await page.locator('[data-action="reset-confirm"]').click(); await page.locator('[data-action="reset-confirm"]').click();
    await closeModal(); assert.equal((await saved()).discoveredEventIds.length,0);
  });

  await run('4情報モーダル・フォーカス保持・Escape復帰・管理操作を表示しない', async () => {
    for (const name of ['library','explorer','progress','settings']) {
      const trigger=page.locator(`.console-menu [data-modal="${name}"]`);
      await trigger.click(); await dialog.waitFor({state:'visible'});
      assert.equal(await dialog.evaluate(element=>element.matches(':modal')),true);
      assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('#info-dialog')),true);
      await page.keyboard.press('Tab');
      // Native dialogs may pass through browser chrome when the close button is the only tab stop.
      // The background must remain inert even while document.activeElement is the body.
      assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('#info-dialog')||document.activeElement===document.body),true);
      await page.evaluate(()=>document.querySelector<HTMLButtonElement>('.console-menu button')!.focus());
      assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('.console')),false);
      if(await page.evaluate(()=>document.activeElement===document.body)){
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('#info-dialog')),true);
      }
      assert.equal(await page.locator('[data-modal="admin"],#admin-toggle,[data-action="preview-ending"]').count(),0);
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>!document.querySelector<HTMLDialogElement>('#info-dialog')?.open&&(!location.hash||location.hash==='#home'));
      assert.equal(await trigger.evaluate(element=>element===document.activeElement),true);
    }
  });

  await run('旧管理者フラグと#adminで解禁されず未発見再プレイと未解禁操作を拒否', async () => {
    await page.goto(`${url}#admin`); await page.reload(); await canvas.waitFor();
    assert.equal(await page.locator('dialog[open]').count(),0);
    assert.equal(await page.locator('[data-modal="admin"],#admin-toggle,[data-action="preview-ending"]').count(),0);
    assert.equal((await saved()).discoveredEventIds.length,0);
    await page.evaluate(()=>history.replaceState(null,'','#home'));
    await openModal('library'); assert.equal(await dialog.locator('.event-card').count(),0); assert.match(await dialog.textContent()||'',/5個の発見/); await closeModal();
    await openModal('explorer'); assert.equal(await dialog.locator('.explorer-cell').count(),0); assert.match(await dialog.textContent()||'',/87個の発見/); await closeModal();
    await openModal('progress'); assert.equal(await dialog.locator('[data-action="completion"]').count(),0); await closeModal();
    const original=await rawSave();
    // Exercise the production click guards using stale controls, without any debug hook.
    for (const dataset of [{replay:EVENTS[0].eventId},{command:EVENTS[0].command},{action:'completion'},{action:'preview-ending'},{modal:'admin'}]) {
      await page.evaluate(data=>{const button=document.createElement('button');Object.assign(button.dataset,data);document.querySelector('#app')!.append(button);button.click();button.remove();},dataset);
      assert.equal(await page.locator('.arcade-info').count(),0);
      assert.equal(await page.locator('dialog[open]').count(),0);
      assert.equal(await page.locator('#input-count').textContent(),'0');
    }
    assert.equal(await rawSave(),original);
  });

  await run('通常モード全216入力・173ゲーム/43空振り・全発見ボーナス', async () => {
    const boundaries = new Set<number>(); let bonusSeen = false;
    for (const entry of COMMANDS) {
      await setCommand(entry.command); commandsExercised.push(entry.command);
      const snapshot = await saved(),count = snapshot.discoveredEventIds.length;
      if (entry.eventId) {
        const event=EVENTS.find(item=>item.eventId===entry.eventId)!;
        await assertHiddenTitle(event); await startReadyGame(); gamesStarted.push(event.eventId);
        if(event.game.variant===0){await page.waitForTimeout(950);await screenshot(`family-${event.game.family}-390`);familyScreenshots.push(event.game.family);}
        await page.evaluate(()=>{for(const key of ['L','R','U','D','A','B'])document.querySelector<HTMLButtonElement>(`[data-symbol="${key}"]`)!.click();});
      }
      else { assert.equal(await result.isVisible(),true); assert.equal(await page.locator('#result-title').textContent(),'空振り'); }
      await leaveGame();
      if (await page.locator('.arcade-info').count()) {
        assert.equal(count,173,'completion must not start before all discoveries');
        assert.equal(bonusSeen,false,'automatic completion starts only once');
        await waitForGame(); await assertHiddenTitle(TRUE_ENDING); await screenshot('completion-ready-390');
        await leaveGame(TRUE_ENDING); bonusSeen = true;
      }
      if ([4,5,86,87].includes(count) && !boundaries.has(count)) {
        boundaries.add(count); await openModal('library'); assert.equal(await dialog.locator('.event-card').count(),count<5 ? 0 : count);
        if(count===5){
          const unknown=EVENTS.find(event=>!snapshot.discoveredEventIds.includes(event.eventId))!;
          await page.evaluate(eventId=>{const button=document.createElement('button');button.dataset.replay=eventId;document.querySelector('#app')!.append(button);button.click();button.remove();},unknown.eventId);
          assert.equal(await page.locator('.arcade-info').count(),0,'unfound game cannot be replayed after library unlock');
          assert.equal(await dialog.locator('.event-card').count(),5);
        }
        await closeModal();
        await openModal('explorer'); assert.equal(await dialog.locator('.explorer-cell').count(),count<87 ? 0 : 216);
        if (count===87) {
          const unknown = dialog.locator('.explorer-cell:not(.found):not(.miss)');
          assert.equal(await unknown.count(),216-snapshot.attemptedCommands.length); assert.equal(await dialog.locator('.explorer-title').count(),0);
          for (const label of await unknown.allTextContents()) assert.match(label,/未入力/);
        }
        await closeModal();
      }
    }
    const snapshot = await saved();
    assert.equal(gamesStarted.length,173); assert.equal(new Set(gamesStarted).size,173);
    assert.deepEqual([...familyScreenshots].sort(),[...ARCADE_FAMILIES].sort());
    assert.equal(commandsExercised.length,216); assert.equal(snapshot.attemptedCommands.length,216); assert.equal(snapshot.discoveredEventIds.length,173);
    assert.equal(snapshot.completionSeen,true); assert.equal(bonusSeen,true); assert.deepEqual([...boundaries].sort((a,b)=>a-b),[4,5,86,87]);
    await openModal('progress'); assert.equal(await dialog.locator('[role="progressbar"]').getAttribute('aria-valuenow'),'173'); await closeModal();
  });

  await run('1/3落ちものを実操作で積み上げ自然GAME OVER・タイトル保持・再挑戦', async () => {
    const event = EVENTS.find(item => item.game.family === 'blocks' && item.game.variant === 1)!;
    await openModal('library'); await replay(event); await assertHiddenTitle(event); await startReadyGame();
    await screenshot('one-third-playing-390');
    await page.keyboard.down('Enter');
    await page.evaluate(() => {
      for (let index=0; index<22 && document.querySelector<HTMLElement>('#game-result')!.hidden; index++) {
        for (const key of (index===0 ? ['L','L','A','B'] : ['L','L','B'])) document.querySelector<HTMLButtonElement>(`[data-symbol="${key}"]`)!.click();
      }
    });
    await result.waitFor({ state:'visible' });
    await page.keyboard.down('Enter'); await page.keyboard.up('Enter');
    assert.equal(await result.isVisible(),true,'holding Enter across game over must not dismiss the revealed title');
    assert.equal(await page.locator('#result-status').textContent(),'GAME OVER');
    assert.equal(await page.locator('#result-title').textContent(),event.title);
    assert.ok(Number(await canvas.getAttribute('data-score')) > 0);
    await screenshot('one-third-gameover-390');
    const score = await page.locator('#result-score').textContent(); await page.waitForTimeout(3300);
    assert.equal(await result.isVisible(),true); assert.equal(await page.locator('#result-score').textContent(),score);
    await page.locator('[data-action="retry"]').click(); await waitForGame(); await assertHiddenTitle(event);
    assert.equal(await canvas.getAttribute('data-score'),'0');
    await leaveGame(event); await closeModal(); assert.equal((await saved()).discoveredEventIds.length,173);
  });

  await run('操作モーダルにはルールだけ・ゲーム時計を停止・閉じると再開', async () => {
    await openModal('library'); await replay(EVENTS[0]); await startReadyGame();
    await page.waitForTimeout(250); await page.locator('.arcade-info [data-modal="rules"]').click(); await dialog.waitFor({ state:'visible' });
    assert.equal((await dialog.textContent() || '').includes(EVENTS[0].title),false);
    assert.ok((await dialog.textContent() || '').includes(EVENTS[0].game.rule));
    const before = await canvas.getAttribute('data-elapsed');
    await page.waitForTimeout(2300); assert.equal(await canvas.getAttribute('data-elapsed'),before);
    await page.goBack(); await dialog.waitFor({ state:'hidden' });
    await page.waitForFunction(value => document.querySelector<HTMLCanvasElement>('#game-canvas')?.dataset.elapsed !== value,before);
    await leaveGame(EVENTS[0]); await closeModal();
  });

  await run('巨大シューティングは移動と発射で得点・通常落ちものは回転と配置', async () => {
    const invaders = EVENTS.find(event => event.game.family === 'invaders' && event.game.variant === 1)!;
    await openModal('library'); await replay(invaders); await startReadyGame();
    await page.locator('[data-symbol="L"]').click(); await page.locator('[data-symbol="R"]').click();
    for (let index=0; index<4; index++) { await page.locator('[data-symbol="A"]').click(); await page.waitForTimeout(220); }
    await page.waitForFunction(() => Number(document.querySelector<HTMLCanvasElement>('#game-canvas')?.dataset.score || 0) > 0);
    await page.locator('[data-symbol="B"]').click(); await screenshot('giant-invaders-390'); await leaveGame(invaders);
    const blocks = EVENTS.find(event => event.game.family === 'blocks' && event.game.variant === 0)!;
    await replay(blocks); await startReadyGame();
    for (const key of ['ArrowLeft','ArrowUp','ArrowRight','ArrowDown','b']) await page.keyboard.press(key);
    await page.waitForFunction(() => Number(document.querySelector<HTMLCanvasElement>('#game-canvas')?.dataset.score || 0) > 0);
    await screenshot('blocks-placed-390'); await leaveGame(blocks); await closeModal();
  });


  await run('通常版は65秒後も続行・棒で4列消しても終了しない・完集はゲームが切り替わる', async () => {
    const completeFixture=await saved();
    const longContext=await browser!.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
    await longContext.addInitScript(({key,data})=>localStorage.setItem(key,JSON.stringify(data)),{key:SAVE_KEY,data:completeFixture});
    try{
      const longPage=await longContext.newPage();longPage.on('pageerror',e=>errors.push(e.message));await longPage.clock.install();await longPage.goto(url);
      const longDialog=longPage.locator('#info-dialog'),longCanvas=longPage.locator('#game-canvas'),longResult=longPage.locator('#game-result');
      const launch=async(event:GameEvent)=>{await longPage.locator('.console-menu [data-modal="library"]').click();await longDialog.locator(`[data-replay="${event.eventId}"]`).evaluate((e:HTMLButtonElement)=>e.click());await longPage.locator('#anticipation').waitFor({state:'detached'});await longPage.locator('#start-button[data-action="advance"]').click();};
      const exit=async()=>{if(!await longResult.isVisible())await longPage.locator('[data-action="skip"]').click();await longPage.locator('#start-button[data-action="return"]').click();await longDialog.locator('[data-action="close-modal"]').click();await longPage.waitForFunction(()=>!location.hash||location.hash==='#home');};
      const idleGame=EVENTS.find(e=>e.game.family==='fishing'&&e.game.variant===1)!;
      await launch(idleGame);await longPage.clock.runFor(65000);
      assert.equal(await longCanvas.getAttribute('data-phase'),'playing');assert.ok(Number(await longCanvas.getAttribute('data-elapsed'))>=64000);assert.equal(await longResult.isVisible(),false);assert.equal(await longPage.locator('.play-progress').isVisible(),false);
      await longPage.screenshot({path:'.qa/arcade-unlimited-65s-390.png',fullPage:true});await exit();
      const bars=EVENTS.find(e=>e.game.family==='blocks'&&e.game.variant===4)!;await launch(bars);
      await longPage.evaluate(()=>{for(let column=0;column<10;column++){for(const key of ['A',...Array(20).fill('L'),...Array(column).fill('R'),'B'])document.querySelector<HTMLButtonElement>(`[data-symbol="${key}"]`)!.click();}});
      assert.equal(await longResult.isVisible(),false);assert.ok(Number(await longCanvas.getAttribute('data-score'))>=400,'a four-line clear scores and the game continues');
      await longPage.screenshot({path:'.qa/arcade-blocks-four-lines-continues-390.png',fullPage:true});
      await longPage.evaluate(()=>{for(let i=0;i<30&&document.querySelector<HTMLElement>('#game-result')!.hidden;i++)document.querySelector<HTMLButtonElement>('[data-symbol="B"]')!.click();});
      assert.equal(await longPage.locator('#result-status').textContent(),'GAME OVER');await exit();
      await longPage.locator('.console-menu [data-modal="progress"]').click();await longDialog.locator('[data-action="completion"]').click();await longPage.locator('#anticipation').waitFor({state:'detached'});await longPage.locator('#start-button[data-action="advance"]').click();
      assert.match(await longPage.locator('#scene-detail').textContent()||'',/落ちもの/);await longPage.clock.runFor(14500);
      await longPage.screenshot({path:'.qa/arcade-completion-remix-transition-390.png',fullPage:true});await longPage.clock.runFor(4000);
      assert.equal(await longResult.isVisible(),false);assert.match(await longPage.locator('#scene-detail').textContent()||'',/シューティング/);assert.ok(Number(await longCanvas.getAttribute('data-score'))>0);
      await longPage.screenshot({path:'.qa/arcade-completion-remix-switch-390.png',fullPage:true});
    }finally{await longContext.close();}
  });



  await run('発見保持・探索216枠と43空振り・図鑑ジャンル18分類/検索/お気に入り', async () => {
    await page.reload(); assert.equal((await saved()).discoveredEventIds.length,173);
    await openModal('explorer'); assert.equal(await dialog.locator('.explorer-cell.found').count(),173); assert.equal(await dialog.locator('.explorer-cell.miss').count(),43); await closeModal();
    await openModal('library'); assert.equal(await dialog.locator('.event-card').count(),173);
    await dialog.locator('[data-favorite]').first().click(); await dialog.locator('#favorites-only').check(); assert.equal(await dialog.locator('.event-card').count(),1);
    await dialog.locator('#favorites-only').uncheck();
    for (const family of ARCADE_FAMILIES) { await dialog.locator('#category').selectOption(family); assert.equal(await dialog.locator('.event-card').count(),EVENTS.filter(event => event.game.family===family).length); }
    await dialog.locator('#category').selectOption('blocks'); await dialog.locator('#search').fill(EVENTS[0].title); assert.equal(await dialog.locator('.event-card').count(),1);
    await dialog.locator('#search').fill(''); await dialog.locator('#category').selectOption('all'); await screenshot('library-390'); await closeModal();
  });

  await run('既読自動スキップON/OFF・図鑑再プレイは常にゲームを開始', async () => {
    await openModal('settings'); await dialog.locator('[data-setting="autoSkip"]').check(); await closeModal();
    await page.evaluate(command => { for (const key of command) document.querySelector<HTMLButtonElement>(`[data-symbol="${key}"]`)!.click(); document.querySelector<HTMLButtonElement>('[data-action="start"]')!.click(); },EVENTS[0].command);
    assert.equal(await page.locator('.arcade-info').count(),0); assert.match(await page.locator('#console-notice').textContent() || '',/自動スキップ/);
    await openModal('library'); await replay(EVENTS[0]); await assertHiddenTitle(EVENTS[0]); await leaveGame(EVENTS[0]); await closeModal();
    await openModal('settings'); await dialog.locator('[data-setting="autoSkip"]').uncheck(); await closeModal();
    await setCommand(EVENTS[0].command); await assertHiddenTitle(EVENTS[0]); await leaveGame(EVENTS[0]);
  });

  await run('設定を再読み込み保持・JSON書き出しと読み込みで旧ID収集を保持', async () => {
    await openModal('settings');
    for (const key of ['muted','reducedMotion','autoSkip']) await dialog.locator(`[data-setting="${key}"]`).check();
    await page.reload(); await dialog.waitFor({ state:'visible' });
    for (const key of ['muted','reducedMotion','autoSkip']) assert.equal(await dialog.locator(`[data-setting="${key}"]`).isChecked(),true);
    const downloadPromise = page.waitForEvent('download'); await dialog.locator('[data-action="export"]').click(); await (await downloadPromise).saveAs('.qa/arcade-save-export.json');
    const exported = JSON.parse(await readFile('.qa/arcade-save-export.json','utf8'));
    assert.equal(exported.schemaVersion,2); assert.equal(exported.discoveredEventIds.length,173); assert.deepEqual(new Set(exported.discoveredEventIds),new Set(EVENTS.map(event => event.eventId)));
    await dialog.locator('#import-file').setInputFiles('.qa/arcade-save-export.json'); await page.waitForFunction(() => document.querySelector('#modal-notice')?.textContent?.includes('まとめました'));
    assert.equal((await saved()).discoveredEventIds.length,173); await closeModal();
  });

  await run('共有は記録画面の明示クリックでX Intentを開く・実投稿しない', async () => {
    await openModal('progress'); const intent = new URL((await dialog.locator('[data-share]').getAttribute('href'))!);
    assert.equal(intent.origin,'https://twitter.com'); assert.equal(intent.pathname,'/intent/tweet'); assert.match(intent.searchParams.get('text')!,/全173/);
    assert.equal(new URL(intent.searchParams.get('url')!).pathname,new URL(url).pathname); assert.equal(context.pages().filter(item => item.url().startsWith('https://twitter.com/')).length,0);
    await context.route('https://twitter.com/intent/tweet**',route => route.fulfill({ status:200,contentType:'text/html',body:'Intent preview' }));
    const popupPromise = page.waitForEvent('popup'); await dialog.locator('[data-share]').click(); const popup = await popupPromise; await popup.waitForLoadState();
    assert.equal(new URL(popup.url()).origin,'https://twitter.com'); await popup.close(); await context.unroute('https://twitter.com/intent/tweet**');
    assert.doesNotMatch(await page.locator('body').textContent() || '',/投稿完了/); await closeModal();
  });

  await run('幅320/390/768/1280と横画面のゲーム機・全モーダル・44px操作', async () => {
    for (const size of [{ width:320,height:800 },{ width:390,height:844 },{ width:768,height:1024 },{ width:1280,height:900 },{ width:844,height:390 }]) {
      await page.setViewportSize(size);
      const geometry = await page.evaluate(() => ({ width:innerWidth,scroll:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll<HTMLElement>('.console button')].filter(button => !button.hidden).map(button => ({ width:button.getBoundingClientRect().width,height:button.getBoundingClientRect().height })) }));
      assert.equal(geometry.scroll,geometry.width,`${size.width}px horizontal overflow`);
      for (const button of geometry.buttons) assert.ok(button.width>=44 && button.height>=44,JSON.stringify(button));
      await screenshot(`title-${size.width}x${size.height}`);
      for (const name of ['library','explorer','progress','settings']) {
        await openModal(name); assert.equal(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth+1),true,`${name} overflow at ${size.width}`); assert.equal(await dialog.locator('.modal-close').isVisible(),true); await closeModal();
      }
    }
    await page.setViewportSize({ width:390,height:844 });
  });

  await run('二段階消去の取消/確定・別タブ反映・消去後は通常の解禁条件', async () => {
    const other = await context.newPage(); await other.goto(url); await other.locator('#game-canvas').waitFor();
    await openModal('settings'); await dialog.locator('[data-action="reset"]').click(); await page.locator('[data-action="reset-confirm"]').click(); await page.locator('[data-action="reset-cancel"]').click();
    assert.equal((await saved()).discoveredEventIds.length,173); assert.equal(await dialog.locator('[data-action="reset"]').evaluate(element => element === document.activeElement),true);
    await dialog.locator('[data-action="reset"]').click(); await page.locator('[data-action="reset-confirm"]').click(); await page.locator('[data-action="reset-confirm"]').click();
    assert.equal((await saved()).discoveredEventIds.length,0); await other.waitForFunction(key => JSON.parse(localStorage.getItem(key) || '{}').discoveredEventIds?.length===0,SAVE_KEY);
    await other.locator('[data-action="sound"]').click(); assert.equal((await saved()).discoveredEventIds.length,0); await other.close(); await closeModal();
    await openModal('library'); assert.equal(await dialog.locator('.event-card').count(),0); await closeModal();
    assert.equal(await page.locator('[data-modal="admin"],#admin-toggle,[data-action="preview-ending"]').count(),0);
  });

  await run('破損保存を警告・原本を退避して新ゲームの発見を保存', async () => {
    await page.evaluate(key => localStorage.setItem(key,'{corrupt'),SAVE_KEY); await page.reload();
    assert.match(await page.locator('#console-notice').textContent() || '',/読み込めません/);
    await setCommand(EVENTS[0].command); assert.equal((await saved()).discoveredEventIds.length,1); await leaveGame(EVENTS[0]);
    assert.equal(await page.evaluate(key => localStorage.getItem(`${key}.recovery`),SAVE_KEY),'{corrupt');
  });

  await run('Service Worker登録後はオフライン再起動と新ゲームを起動可能', async () => {
    if (!['127.0.0.1','localhost'].includes(new URL(url).hostname)) assert.equal(new URL(url).protocol,'https:');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; }); await page.reload(); await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await context.setOffline(true);
    try { await page.reload(); await canvas.waitFor(); await setCommand(EVENTS[2].command); await assertHiddenTitle(EVENTS[2]); assert.equal((await saved()).discoveredEventIds.length,2); await leaveGame(EVENTS[2]); }
    finally { await context.setOffline(false); }
  });

  assert.deepEqual(errors,[]); assert.deepEqual(failedRequests,[]);
  console.log(`Browser checks: ${results.length}/${results.length} PASS; zero script errors or project 404s.`);
} finally {
  await writeFile('.qa/browser-results.json',JSON.stringify({ uiRevision:REVISION,completedAt:new Date().toISOString(),url,channel:channel || 'chromium',coverage:{ gamesStarted,commandsExercised,familyScreenshots },results,errors,failedRequests },null,2));
  await browser?.close(); if (server.listening) await new Promise<void>(done => server.close(() => done()));
}
