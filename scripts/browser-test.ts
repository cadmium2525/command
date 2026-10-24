import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium, type Page } from 'playwright';
import { COMMANDS, EVENTS, TRUE_ENDING } from '../src/data/catalog';
import type { GameEvent } from '../src/data/types';
import { ARCADE_FAMILIES, FAMILY_LABELS } from '../src/events/arcade-types';
import { SAVE_KEY } from '../src/core/storage';

const REVISION = 'one-viewport-paged-six-key-return-2026-10-24';
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
const layoutChecks: {viewport:string;state:string;pages?:number}[] = [];
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
  const page = await context.newPage(); currentPage = page;await page.clock.install();
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
  const firstModalPage = async (target:Page=page) => {
    const previous=target.locator('#info-dialog .pagination button[data-direction="-1"]');
    for(let count=0;await previous.count() && await previous.isEnabled();count++) {
      assert.ok(count<216,'pagination must have a finite first page'); await previous.click();
    }
  };
  const visitModalPages = async (visit:(index:number)=>Promise<void>,target:Page=page) => {
    await firstModalPage(target); let count=0;
    for(;;) {
      const pager=target.locator('#info-dialog .pagination');
      if(await pager.count()) assert.equal(await pager.getAttribute('data-current-page'),String(count));
      await visit(count); count++;
      const next=pager.locator('button[data-direction="1"]');
      if(!await next.count() || !await next.isEnabled()) break;
      assert.ok(count<216,'pagination must have a finite last page'); await next.click();
    }
    const pager=target.locator('#info-dialog .pagination');
    if(await pager.count()) assert.equal(Number(await pager.getAttribute('data-page-count')),count);
    return count;
  };
  const modalControl = async (selector:string,target:Page=page) => {
    await firstModalPage(target);
    for(let count=0;count<216;count++) {
      const control=target.locator('#info-dialog').locator(selector);
      if(await control.count()) return control;
      const next=target.locator('#info-dialog .pagination button[data-direction="1"]');
      if(!await next.count() || !await next.isEnabled()) break;
      await next.click();
    }
    throw new Error(`Control missing from every modal page: ${selector}`);
  };
  const resetLibraryFilters = async (target:Page=page,search='') => {
    const modal=target.locator('#info-dialog');
    await modal.locator('#category').selectOption('all');
    if(await modal.locator('#favorites-only').isChecked()) await modal.locator('#favorites-only').uncheck();
    await modal.locator('#search').fill(search);
  };
  const libraryTotal = () => dialog.locator('#library-cards').getAttribute('data-total-count').then(Number);
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
    await resetLibraryFilters(page,event.title);
    assert.equal(await libraryTotal(),1,`search must find ${event.eventId} across all pages`);
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
    assert.equal(await page.locator('#reading-status').isVisible(),false,'return prompt is reserved for the result');
  };
  const revealResult = async (event?:GameEvent) => {
    if (!await result.isVisible()) await page.locator('[data-action="skip"]').click();
    await result.waitFor({ state:'visible' });
    if (event) assert.equal(await page.locator('#result-title').textContent(),event.title);
  };
  const leaveGame = async (event?:GameEvent) => {
    await revealResult(event);
    assert.equal(await page.locator('#start-button').isVisible(),false,'the result has no dedicated title-return button');
    assert.equal(await page.locator('[data-action="return"]').count(),0);
    await page.clock.runFor(700); await page.locator('[data-symbol="A"]').click();
    await page.waitForFunction(()=>!document.querySelector<HTMLElement>('#game-result')||document.querySelector<HTMLElement>('#game-result')!.hidden);
  };
  const screenshot = async (name:string) => { await page.screenshot({ path:`.qa/arcade-${name}.png`,fullPage:true }); };
  const assertViewport = async (state:string) => {
    const geometry=await page.evaluate(()=>{
      const [visible]=[(element:HTMLElement)=>!!element.getClientRects().length&&getComputedStyle(element).visibility!=='hidden'];
      const [rect]=[(element:HTMLElement)=>{const box=element.getBoundingClientRect();return {left:box.left,top:box.top,right:box.right,bottom:box.bottom,width:box.width,height:box.height};}];
      const [union]=[(selector:string)=>{
        const boxes=[...document.querySelectorAll<HTMLElement>(selector)].filter(visible).map(rect);
        if(!boxes.length) throw new Error(`Missing controller set: ${selector}`);
        return {left:Math.min(...boxes.map(b=>b.left)),right:Math.max(...boxes.map(b=>b.right)),top:Math.min(...boxes.map(b=>b.top)),bottom:Math.max(...boxes.map(b=>b.bottom))};
      }];
      const selectors=['.console-page','.console','.controller','.screen-bezel','.screen','.arcade-info','#game-result','#info-dialog[open]','#confirm-dialog[open]','#info-dialog[open] .modal-content','#info-dialog[open] .modal-header','#info-dialog[open] .modal-page','#info-dialog[open] .page-body','#info-dialog[open] .library-viewport','#info-dialog[open] .explorer-viewport','#info-dialog[open] .library-grid','#info-dialog[open] .explorer-grid','#info-dialog[open] .settings-list','#info-dialog[open] .settings-actions','#info-dialog[open] .filters','#info-dialog[open] .pagination'];
      const containers=selectors.flatMap(selector=>[...document.querySelectorAll<HTMLElement>(selector)].filter(visible).map(element=>({selector,clientWidth:element.clientWidth,clientHeight:element.clientHeight,scrollWidth:element.scrollWidth,scrollHeight:element.scrollHeight,...rect(element)})));
      const buttons=[...document.querySelectorAll<HTMLButtonElement>('button')].filter(visible).map(element=>({label:element.getAttribute('aria-label')||element.textContent?.trim(),...rect(element)}));
      return {viewport:{width:innerWidth,height:innerHeight},document:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},body:{width:document.body.scrollWidth,height:document.body.scrollHeight},containers,buttons,canvas:rect(document.querySelector<HTMLCanvasElement>('#game-canvas')!),dpad:union('.dpad [data-symbol]'),ab:union('.ab-buttons [data-symbol]'),controller:rect(document.querySelector<HTMLElement>('.controller')!)};
    });
    const label=`${geometry.viewport.width}x${geometry.viewport.height} ${state}`;
    assert.ok(geometry.canvas.width>=160&&geometry.canvas.height>=100,`${label}: the playfield must remain visible and usable ${JSON.stringify(geometry.canvas)}`);
    assert.ok(Math.abs(geometry.canvas.width/geometry.canvas.height-1.6)<.02,`${label}: playfield aspect ratio changed`);
    for(const [name,box] of Object.entries({document:geometry.document,body:geometry.body})) {
      assert.ok(box.width<=geometry.viewport.width+1,`${label}: ${name} horizontal overflow ${JSON.stringify(box)}`);
      assert.ok(box.height<=geometry.viewport.height+1,`${label}: ${name} vertical overflow ${JSON.stringify(box)}`);
    }
    for(const box of geometry.containers) {
      assert.ok(box.scrollWidth<=box.clientWidth+1,`${label}: container horizontal scroll ${JSON.stringify(box)}`);
      assert.ok(box.scrollHeight<=box.clientHeight+1,`${label}: container vertical scroll/clipping ${JSON.stringify(box)}`);
      assert.ok(box.left>=-1&&box.right<=geometry.viewport.width+1&&box.top>=-1&&box.bottom<=geometry.viewport.height+1,`${label}: container outside viewport ${JSON.stringify(box)}`);
    }
    for(const box of geometry.buttons) {
      assert.ok(box.width>=43.99&&box.height>=43.99,`${label}: button below 44px ${JSON.stringify(box)}`);
      assert.ok(box.left>=-1&&box.right<=geometry.viewport.width+1&&box.top>=-1&&box.bottom<=geometry.viewport.height+1,`${label}: button outside viewport ${JSON.stringify(box)}`);
    }
    const {dpad,ab,controller}=geometry;
    const dpadX=(dpad.left+dpad.right)/2,abX=(ab.left+ab.right)/2,controllerX=(controller.left+controller.right)/2;
    assert.ok(Math.abs((dpad.top+dpad.bottom-ab.top-ab.bottom)/2)<=12,`${label}: Dpad/AB vertical centers differ ${JSON.stringify({dpad,ab})}`);
    assert.ok(dpadX<controllerX&&abX>controllerX,`${label}: the two control sets must flank the controller center`);
    assert.ok(Math.abs((Math.min(dpad.left,ab.left)+Math.max(dpad.right,ab.right))/2-controllerX)<=12,`${label}: control union is not horizontally centered ${JSON.stringify({dpad,ab,controller})}`);
    layoutChecks.push({viewport:`${geometry.viewport.width}x${geometry.viewport.height}`,state});
  };

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
    await openModal('settings'); await (await modalControl('[data-action="reset"]')).click();
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
        boundaries.add(count); await openModal('library');
        if(count<5) assert.equal(await dialog.locator('.event-card').count(),0);
        else { await resetLibraryFilters(); assert.equal(await libraryTotal(),count); assert.ok(await dialog.locator('.event-card').count()<=count); }
        if(count===5){
          const unknown=EVENTS.find(event=>!snapshot.discoveredEventIds.includes(event.eventId))!;
          await page.evaluate(eventId=>{const button=document.createElement('button');button.dataset.replay=eventId;document.querySelector('#app')!.append(button);button.click();button.remove();},unknown.eventId);
          assert.equal(await page.locator('.arcade-info').count(),0,'unfound game cannot be replayed after library unlock');
          assert.equal(await libraryTotal(),5);
        }
        await closeModal();
        await openModal('explorer');
        if(count<87) assert.equal(await dialog.locator('.explorer-cell').count(),0);
        else assert.equal(await dialog.locator('#explorer-cells').getAttribute('data-total-count'),'216');
        if (count===87) {
          let unknownCount=0;
          await visitModalPages(async()=>{
            const unknown=dialog.locator('.explorer-cell:not(.found):not(.miss)');
            unknownCount+=await unknown.count(); assert.equal(await dialog.locator('.explorer-title').count(),0);
            for(const label of await unknown.allTextContents()) assert.match(label,/未入力/);
          });
          assert.equal(unknownCount,216-snapshot.attemptedCommands.length);
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

  await run('終了後の6キーで復帰・終了をまたいだ長押しは離してから新しい入力が必要', async () => {
    const event=EVENTS.find(item=>item.game.family==='fishing'&&item.game.variant===1)!;
    for(const [symbol,key] of [['U','ArrowUp'],['D','ArrowDown'],['L','ArrowLeft'],['R','ArrowRight'],['A','a'],['B','b']]) {
      await openModal('library'); await replay(event); await startReadyGame();
      await page.keyboard.down(key); await revealResult(event);
      assert.equal(await page.locator('#start-button').isVisible(),false);
      assert.equal(await page.locator('[data-action="return"]').count(),0);
      assert.match(await page.locator('#reading-status').textContent()||'',/矢印.*A.*B/);
      assert.match(await result.locator('.result-prompt').textContent()||'',/↑.*↓.*←.*→.*A.*B/);
      await page.waitForTimeout(700); await page.keyboard.down(key);
      assert.equal(await result.isVisible(),true,`${symbol}: held/repeat input must preserve the result`);
      await page.keyboard.up(key); assert.equal(await result.isVisible(),true,`${symbol}: releasing does not dismiss`);
      await page.keyboard.press(key);
      await result.waitFor({state:'detached'}); await dialog.waitFor({state:'visible'});
      assert.equal(await page.locator('#input-count').textContent(),'0',`${symbol}: dismissing must not type a new command`);
      await closeModal();
    }
    await openModal('library');await replay(event);await startReadyGame();
    const button=await page.locator('[data-symbol="A"]').boundingBox();assert.ok(button);
    await page.mouse.move(button.x+button.width/2,button.y+button.height/2);await page.mouse.down();
    await page.locator('[data-action="skip"]').evaluate((element:HTMLButtonElement)=>element.click());
    await result.waitFor({state:'visible'});await page.waitForTimeout(700);
    assert.equal(await result.isVisible(),true,'a pointer held across finish must preserve the title');
    await page.mouse.up();assert.equal(await result.isVisible(),true,'the old pointer release/click must not dismiss');
    await page.locator('[data-symbol="A"]').click();await result.waitFor({state:'detached'});await closeModal();
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
      const launch=async(event:GameEvent)=>{await longPage.locator('.console-menu [data-modal="library"]').click();await resetLibraryFilters(longPage,event.title);await longDialog.locator(`[data-replay="${event.eventId}"]`).evaluate((e:HTMLButtonElement)=>e.click());await longPage.locator('#anticipation').waitFor({state:'detached'});await longPage.locator('#start-button[data-action="advance"]').click();};
      const exit=async()=>{if(!await longResult.isVisible())await longPage.locator('[data-action="skip"]').click();await longPage.clock.runFor(700);await longPage.locator('[data-symbol="A"]').click();await longDialog.locator('[data-action="close-modal"]').click();await longPage.waitForFunction(()=>!location.hash||location.hash==='#home');};
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
      await longPage.locator('.console-menu [data-modal="progress"]').click();await (await modalControl('[data-action="completion"]',longPage)).click();await longPage.locator('#anticipation').waitFor({state:'detached'});await longPage.locator('#start-button[data-action="advance"]').click();
      assert.ok((await longPage.locator('#scene-detail').textContent()||'').includes(EVENTS.find(event=>event.game.family==='blocks'&&event.game.variant===0)!.game.controls));await longPage.clock.runFor(14500);
      await longPage.screenshot({path:'.qa/arcade-completion-remix-transition-390.png',fullPage:true});await longPage.clock.runFor(4000);
      assert.equal(await longResult.isVisible(),false);
      assert.ok((await longPage.locator('#scene-detail').textContent()||'').includes(EVENTS.find(event=>event.game.family==='invaders'&&event.game.variant===0)!.game.controls));assert.ok(Number(await longCanvas.getAttribute('data-score'))>0);
      await longPage.screenshot({path:'.qa/arcade-completion-remix-switch-390.png',fullPage:true});
    }finally{await longContext.close();}
  });



  await run('発見保持・探索216枠と43空振り・図鑑ジャンル18分類/検索/お気に入り', async () => {
    await page.reload(); assert.equal((await saved()).discoveredEventIds.length,173);
    await openModal('explorer');
    assert.equal(await dialog.locator('#explorer-cells').getAttribute('data-total-count'),'216');
    assert.equal(await dialog.locator('#explorer-cells').getAttribute('data-found-count'),'173');
    assert.equal(await dialog.locator('#explorer-cells').getAttribute('data-miss-count'),'43');
    const commands:string[]=[];let foundCount=0,missCount=0;
    const explorerPages=await visitModalPages(async()=>{
      commands.push(...await dialog.locator('.explorer-cell').evaluateAll(elements=>elements.map(element=>(element as HTMLElement).dataset.command!)));
      foundCount+=await dialog.locator('.explorer-cell.found').count();missCount+=await dialog.locator('.explorer-cell.miss').count();
    });
    assert.ok(explorerPages>1);assert.equal(commands.length,216);assert.equal(new Set(commands).size,216);assert.deepEqual(new Set(commands),new Set(COMMANDS.map(entry=>entry.command)));assert.equal(foundCount,173);assert.equal(missCount,43);await closeModal();
    await openModal('library');await resetLibraryFilters();assert.equal(await libraryTotal(),173);
    const eventIds:string[]=[];
    const libraryPages=await visitModalPages(async()=>{eventIds.push(...await dialog.locator('.event-card [data-replay]').evaluateAll(elements=>elements.map(element=>(element as HTMLElement).dataset.replay!)));});
    assert.ok(libraryPages>1);assert.equal(eventIds.length,173);assert.equal(new Set(eventIds).size,173);assert.deepEqual(new Set(eventIds),new Set(EVENTS.map(event=>event.eventId)));
    await firstModalPage();
    await dialog.locator('[data-favorite]').first().click(); await dialog.locator('#favorites-only').check(); assert.equal(await libraryTotal(),1);assert.equal(await dialog.locator('.event-card').count(),1);
    await dialog.locator('#favorites-only').uncheck();
    for (const family of ARCADE_FAMILIES) {
      await dialog.locator('#category').selectOption(family);assert.equal(await libraryTotal(),EVENTS.filter(event => event.game.family===family).length);
      assert.equal(await dialog.locator('#library-pagination').getAttribute('data-current-page'),'0');
      assert.ok(await dialog.locator('.event-card').count()<=await libraryTotal());
    }
    await dialog.locator('#category').selectOption('blocks'); await dialog.locator('#search').fill(EVENTS[0].title); assert.equal(await libraryTotal(),1);assert.equal(await dialog.locator('.event-card').count(),1);
    await dialog.locator('#search').fill(''); await dialog.locator('#category').selectOption('all'); await screenshot('library-390'); await closeModal();
  });

  await run('既読自動スキップON/OFF・図鑑再プレイは常にゲームを開始', async () => {
    await openModal('settings'); await (await modalControl('[data-setting="autoSkip"]')).check(); await closeModal();
    await page.evaluate(command => { for (const key of command) document.querySelector<HTMLButtonElement>(`[data-symbol="${key}"]`)!.click(); document.querySelector<HTMLButtonElement>('[data-action="start"]')!.click(); },EVENTS[0].command);
    assert.equal(await page.locator('.arcade-info').count(),0); assert.match(await page.locator('#console-notice').textContent() || '',/自動スキップ/);
    await openModal('library'); await replay(EVENTS[0]); await assertHiddenTitle(EVENTS[0]); await leaveGame(EVENTS[0]); await closeModal();
    await openModal('settings'); await (await modalControl('[data-setting="autoSkip"]')).uncheck(); await closeModal();
    await setCommand(EVENTS[0].command); await assertHiddenTitle(EVENTS[0]); await leaveGame(EVENTS[0]);
  });

  await run('設定を再読み込み保持・JSON書き出しと読み込みで旧ID収集を保持', async () => {
    await openModal('settings');
    for (const key of ['muted','reducedMotion','autoSkip']) await (await modalControl(`[data-setting="${key}"]`)).check();
    await page.reload(); await dialog.waitFor({ state:'visible' });
    for (const key of ['muted','reducedMotion','autoSkip']) assert.equal(await (await modalControl(`[data-setting="${key}"]`)).isChecked(),true);
    const exportButton=await modalControl('[data-action="export"]');
    const downloadPromise = page.waitForEvent('download'); await exportButton.click(); await (await downloadPromise).saveAs('.qa/arcade-save-export.json');
    const exported = JSON.parse(await readFile('.qa/arcade-save-export.json','utf8'));
    assert.equal(exported.schemaVersion,2); assert.equal(exported.discoveredEventIds.length,173); assert.deepEqual(new Set(exported.discoveredEventIds),new Set(EVENTS.map(event => event.eventId)));
    await (await modalControl('#import-file')).setInputFiles('.qa/arcade-save-export.json'); await page.waitForFunction(() => document.querySelector('#modal-notice')?.textContent?.includes('まとめました'));
    assert.equal((await saved()).discoveredEventIds.length,173); await closeModal();
  });

  await run('共有は記録画面の明示クリックでX Intentを開く・実投稿しない', async () => {
    await openModal('progress'); const shareLink=await modalControl('[data-share]');const intent = new URL((await shareLink.getAttribute('href'))!);
    assert.equal(intent.origin,'https://twitter.com'); assert.equal(intent.pathname,'/intent/tweet'); assert.match(intent.searchParams.get('text')!,/全173/);
    assert.equal(new URL(intent.searchParams.get('url')!).pathname,new URL(url).pathname); assert.equal(context.pages().filter(item => item.url().startsWith('https://twitter.com/')).length,0);
    await context.route('https://twitter.com/intent/tweet**',route => route.fulfill({ status:200,contentType:'text/html',body:'Intent preview' }));
    const popupPromise = page.waitForEvent('popup'); await shareLink.click(); const popup = await popupPromise; await popup.waitForLoadState();
    assert.equal(new URL(popup.url()).origin,'https://twitter.com'); await popup.close(); await context.unroute('https://twitter.com/intent/tweet**');
    assert.doesNotMatch(await page.locator('body').textContent() || '',/投稿完了/); await closeModal();
  });

  await run('8画面サイズ・全状態と全モーダル全ページは縦横スクロールなし・44px・左右操作中心', async () => {
    const sizes=[{width:320,height:568},{width:390,height:667},{width:390,height:844},{width:768,height:1024},{width:1280,height:720},{width:844,height:390},{width:667,height:375},{width:568,height:320}];
    const idleGame=EVENTS.find(event=>event.game.family==='fishing'&&event.game.variant===1)!;
    const longestTitle=EVENTS.reduce((longest,event)=>event.title.length>longest.title.length?event:longest);
    const assertAllModalPages=async(name:string)=>{
      const pages=await visitModalPages(async index=>{
        assert.equal(await dialog.locator('.modal-close').isVisible(),true);
        await assertViewport(`${name} page ${index+1}`);
        if(index===0) await screenshot(`${name}-${page.viewportSize()!.width}x${page.viewportSize()!.height}`);
      });
      layoutChecks.push({viewport:`${page.viewportSize()!.width}x${page.viewportSize()!.height}`,state:`${name} all pages`,pages});
    };
    for(const size of sizes) {
      await page.setViewportSize(size);
      await page.evaluate(()=>new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done()))));
      await assertViewport('title');await screenshot(`title-${size.width}x${size.height}`);
      for(const name of ['library','explorer','progress','settings']) {
        await openModal(name);if(name==='library')await resetLibraryFilters();
        await assertAllModalPages(name);
        if(name==='settings') {
          const exportButton=await modalControl('[data-action="export"]');const download=page.waitForEvent('download');await exportButton.click();await download;
          assert.match(await dialog.locator('#modal-notice').textContent()||'',/書き出しました/);await assertViewport('settings export notice');
          await (await modalControl('#import-file')).setInputFiles('.qa/arcade-save-export.json');
          await page.waitForFunction(()=>document.querySelector('#modal-notice')?.textContent?.includes('まとめました'));await assertViewport('settings import notice');
        }
        await closeModal();
      }
      await openModal('settings');await (await modalControl('[data-modal="help"]')).click();await assertAllModalPages('help');await closeModal();
      await openModal('settings');await (await modalControl('[data-action="reset"]')).click();
      await assertViewport('reset confirmation 1');await page.locator('[data-action="reset-confirm"]').click();
      await assertViewport('reset confirmation 2');await page.locator('[data-action="reset-cancel"]').click();await closeModal();
      await openModal('library');await replay(idleGame);await startReadyGame();
      assert.equal(await page.locator('.command-row').count(),0,'active games reserve the space for the playfield');
      await assertViewport('playing');await screenshot(`playing-${size.width}x${size.height}`);
      await page.locator('.arcade-info [data-modal="rules"]').click();await assertAllModalPages('rules');await closeModal();
      await revealResult(idleGame);await assertViewport('result');await screenshot(`result-${size.width}x${size.height}`);await leaveGame(idleGame);await closeModal();
      if(longestTitle.eventId!==idleGame.eventId) {
        await openModal('library');await replay(longestTitle);await revealResult(longestTitle);
        await assertViewport('longest result title');await screenshot(`long-title-${size.width}x${size.height}`);await leaveGame(longestTitle);await closeModal();
      }
    }
    await page.setViewportSize({width:390,height:844});
  });

  await run('仮想キーボード相当の高さスタブ450/350px・検索DOMと入力を保持して1枚ずつ表示', async () => {
    // This desktop-browser test stubs visualViewport; it does not claim a physical mobile-keyboard test.
    await page.setViewportSize({width:390,height:844});await openModal('library');await resetLibraryFilters();
    const search=dialog.locator('#search'),originalSearch=await search.elementHandle();assert.ok(originalSearch);
    const originalCapacity=await dialog.locator('.event-card').count();assert.ok(originalCapacity>1);
    await search.focus();
    const assertVisualModal=async(height:number,offsetTop:number,state:string)=>{
      await assertViewport(`keyboard ${height}px ${state}`);
      const geometry=await page.evaluate(()=>{
        const [visible]=[(element:Element)=>!!element.getClientRects().length&&getComputedStyle(element).visibility!=='hidden'];
        return [...document.querySelectorAll<HTMLElement>('#info-dialog,#info-dialog *')].filter(visible).map(element=>{
          const rect=element.getBoundingClientRect();return {tag:element.tagName,id:element.id,className:element.getAttribute('class'),top:rect.top,bottom:rect.bottom,left:rect.left,right:rect.right,width:rect.width,height:rect.height,clientWidth:element.clientWidth,clientHeight:element.clientHeight,scrollWidth:element.scrollWidth,scrollHeight:element.scrollHeight};
        });
      });
      for(const box of geometry) {
        assert.ok(box.top>=offsetTop-1&&box.bottom<=offsetTop+height+1&&box.left>=-1&&box.right<=391,`${height}px ${state}: outside visual viewport ${JSON.stringify(box)}`);
        // Text fields may scroll their editable text horizontally while the surrounding layout stays fixed.
        if(!['INPUT','SELECT','OPTION'].includes(box.tag)) {
          assert.ok(box.scrollWidth<=box.clientWidth+1&&box.scrollHeight<=box.clientHeight+1,`${height}px ${state}: modal overflow ${JSON.stringify(box)}`);
        }
        if(box.tag==='BUTTON') assert.ok(box.width>=43.99&&box.height>=43.99,`${height}px ${state}: button below 44px ${JSON.stringify(box)}`);
      }
      assert.equal(await originalSearch.evaluate(element=>element===document.querySelector('#search')&&element===document.activeElement),true,'visual resize/input must preserve the focused search DOM node');
    };
    try {
      for(const [height,offsetTop] of [[450,0],[350,24]]) {
        await page.evaluate(value=>{
          Object.defineProperty(window.visualViewport!,'height',{configurable:true,value:value.height});
          Object.defineProperty(window.visualViewport!,'offsetTop',{configurable:true,value:value.offsetTop});
          window.visualViewport!.dispatchEvent(new Event('resize'));
        },{height,offsetTop});
        await page.waitForFunction(()=>document.documentElement.classList.contains('visual-keyboard'));
        assert.equal(await libraryTotal(),173);assert.equal(await dialog.locator('.event-card').count(),1);
        await assertVisualModal(height,offsetTop,'all discoveries');await screenshot(`keyboard-${height}-390`);
        await page.keyboard.type(EVENTS[0].title);
        assert.equal(await search.inputValue(),EVENTS[0].title);assert.equal(await libraryTotal(),1);assert.equal(await dialog.locator('.event-card').count(),1);
        await assertVisualModal(height,offsetTop,'typed title');
        await search.fill('見つからない検索語-viewport-test');
        assert.equal(await libraryTotal(),0);assert.equal(await dialog.locator('.event-card').count(),0);assert.equal(await dialog.locator('.empty-state').isVisible(),true);
        await assertVisualModal(height,offsetTop,'empty search');
        await search.fill('');assert.equal(await libraryTotal(),173);assert.equal(await dialog.locator('.event-card').count(),1);
      }
    } finally {
      await page.evaluate(()=>{
        delete (window.visualViewport as unknown as {height?:number;offsetTop?:number}).height;
        delete (window.visualViewport as unknown as {height?:number;offsetTop?:number}).offsetTop;
        window.visualViewport!.dispatchEvent(new Event('resize'));
      });
    }
    await page.waitForFunction(()=>!document.documentElement.classList.contains('visual-keyboard'));
    assert.equal(await originalSearch.evaluate(element=>element===document.querySelector('#search')&&element===document.activeElement),true);
    assert.equal(await dialog.locator('.event-card').count(),originalCapacity);assert.equal(await libraryTotal(),173);
    await assertViewport('keyboard dismissed');await closeModal();await originalSearch.dispose();
  });

  await run('二段階消去の取消/確定・別タブ反映・消去後は通常の解禁条件', async () => {
    const other = await context.newPage(); await other.goto(url); await other.locator('#game-canvas').waitFor();
    await openModal('settings'); await (await modalControl('[data-action="reset"]')).click(); await page.locator('[data-action="reset-confirm"]').click(); await page.locator('[data-action="reset-cancel"]').click();
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
  await writeFile('.qa/browser-results.json',JSON.stringify({ uiRevision:REVISION,completedAt:new Date().toISOString(),url,channel:channel || 'chromium',coverage:{ gamesStarted,commandsExercised,familyScreenshots,layoutChecks },results,errors,failedRequests },null,2));
  await browser?.close(); if (server.listening) await new Promise<void>(done => server.close(() => done()));
}
