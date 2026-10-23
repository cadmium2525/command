import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright';
import { COMMANDS, EVENTS, TRUE_ENDING } from '../src/data/catalog';
import { SAVE_KEY } from '../src/core/storage';

// A real static server under a Pages-style project subpath. Never uses Vite's SPA fallback.
const root=resolve('dist');
const mount='/secret-start/';
const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||'/', 'http://localhost');
    if(!url.pathname.startsWith(mount)){res.writeHead(404);res.end();return;}
    const relative=decodeURIComponent(url.pathname.slice(mount.length))||'index.html';
    const file=resolve(root,relative);
    if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    const data=await readFile(file);
    res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(data);
  }catch{res.writeHead(404);res.end();}
});
await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
const address=server.address();
if(!address||typeof address==='string')throw new Error('server address');
const url=`http://127.0.0.1:${address.port}${mount}`;
const channel=process.env.PLAYWRIGHT_CHANNEL;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const results:{name:string;status:string}[]=[];
const run=async(name:string,fn:()=>Promise<void>)=>{await fn();results.push({name,status:'PASS'});console.log(`PASS ${name}`);};
await mkdir('.qa',{recursive:true});
try{
  browser=await chromium.launch({headless:true,...(channel?{channel}:{})});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const page=await context.newPage();
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const failedRequests:string[]=[];page.on('response',res=>{if(res.status()>=400&&res.url().startsWith(url))failedRequests.push(`${res.status()} ${res.url()}`);});
  const state=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'{}'),SAVE_KEY);
  const skip=()=>page.locator('[data-action="skip"]').click();
  const setCommand=async(command:string)=>{
    await page.evaluate(command=>{
      for(const symbol of command)document.querySelector<HTMLButtonElement>(`[data-symbol="${symbol}"]`)!.click();
      document.querySelector<HTMLButtonElement>('#start-button')!.click();
    },command);
  };
  await run('Pagesサブパスで初回起動・画像読み込み・3入力制限',async()=>{
    await page.goto(url);await page.locator('#game-canvas').waitFor();
    assert.equal(await page.locator('#start-button').isDisabled(),true);
    await page.locator('[data-symbol="U"]').click();
    await page.keyboard.press('ArrowUp');
    assert.equal(await page.locator('#start-button').isDisabled(),true);
    await page.keyboard.press('ArrowUp');await page.keyboard.press('a');
    assert.equal(await page.locator('#input-count').textContent(),'3');
    assert.equal(await page.locator('#command-slots').textContent(),'↑↑↑');
    await page.keyboard.press('Backspace');assert.equal(await page.locator('#input-count').textContent(),'2');
    await page.keyboard.press('ArrowUp');
    // Focus remains on the clicked D-pad button: Enter must still mean START.
    await page.keyboard.press('Enter');await page.locator('[data-action="skip"]').waitFor();
    assert.equal((await state()).discoveredEventIds.length,1);
    await skip();await page.locator('#start-button').waitFor();
    assert.equal(await page.locator('#input-count').textContent(),'0');
  });
  await run('新発見は開始前に保存・リロード保持・既読スキップ',async()=>{
    await setCommand(EVENTS[1].command);
    assert.equal((await state()).discoveredEventIds.length,2);
    await page.reload();await page.locator('#start-button').waitFor();
    assert.equal((await state()).discoveredEventIds.length,2);
    await setCommand(EVENTS[1].command);
    assert.match(await page.locator('[data-action="skip"]').textContent()||'',/発見済み/);
    await skip();
  });
  await run('全216コマンドをUI入力・5/87解禁・173完集で真エンディング',async()=>{
    const boundaries=new Set<number>();
    for(const item of COMMANDS){
      await setCommand(item.command);
      const snapshot=await state();
      const n=snapshot.discoveredEventIds.length;
      if([4,5,86,87].includes(n)&&!boundaries.has(n)){
        boundaries.add(n);
        const libraryLabel=await page.locator('[data-action="library"]').getAttribute('aria-label');
        const explorerLabel=await page.locator('[data-action="explorer"]').getAttribute('aria-label');
        assert.equal(libraryLabel?.includes('5発見'),n<5);
        assert.equal(explorerLabel?.includes('87発見'),n<87);
      }
      await skip();
      if(await page.locator('.intro h1').textContent()===TRUE_ENDING.title){
        await page.screenshot({path:'.qa/true-ending-start.png',fullPage:true});
        await skip();
      }
    }
    const saved=await state();
    assert.equal(saved.attemptedCommands.length,216);assert.equal(saved.discoveredEventIds.length,173);assert.equal(saved.completionSeen,true);
    assert.deepEqual([...boundaries].sort((a,b)=>a-b),[4,5,86,87]);
  });
  await run('探索一覧216枠・空振り43件・図鑑173件・お気に入り・再視聴',async()=>{
    await page.locator('[data-action="explorer"]').click();
    assert.equal(await page.locator('.explorer-cell').count(),216);
    assert.equal(await page.locator('.explorer-cell.miss').count(),43);
    assert.equal(await page.locator('.explorer-cell.found').count(),173);
    await page.screenshot({path:'.qa/explorer-390.png',fullPage:true});
    await page.locator('[data-action="home"]').first().click();
    await page.locator('[data-action="library"]').click();
    assert.equal(await page.locator('.event-card').count(),173);
    await page.locator('[data-favorite]').first().click();
    assert.equal((await state()).favoriteEventIds.length,1);
    await page.locator('#favorites-only').check();assert.equal(await page.locator('.event-card').count(),1);
    await page.locator('[data-replay]').first().click();
    assert.equal(await page.locator('[data-action="skip"]').textContent(),'スキップ ↗');
    await skip();assert.equal(await page.locator('.event-card').count(),1);
    await page.locator('#favorites-only').uncheck();
    await page.screenshot({path:'.qa/library-390.png',fullPage:true});
    const intent=new URL((await page.locator('[data-share]').getAttribute('href'))!);
    assert.equal(intent.origin,'https://twitter.com');assert.equal(intent.pathname,'/intent/tweet');
    assert.equal(intent.searchParams.get('url'),url);assert.match(intent.searchParams.get('text')!,/全173/);
  });
  await run('既読自動スキップON・図鑑は通常再生・ミニゲーム操作',async()=>{
    await page.locator('[data-action="settings"]').click();await page.locator('[data-setting="autoSkip"]').check();
    await page.locator('[data-action="home"]').first().click();await setCommand(EVENTS[0].command);
    assert.equal(await page.locator('#start-button').count(),1);assert.match(await page.locator('#notice').textContent()||'',/自動スキップ/);
    await page.locator('[data-action="library"]').click();
    const game=EVENTS.find(e=>e.mechanic==='clicker')!;
    await page.locator(`[data-replay="${game.eventId}"]`).click();
    await page.locator('#anticipation').waitFor({state:'detached'});
    await page.locator('[data-game-symbol="A"]').click();await page.locator('[data-game-symbol="B"]').click();
    assert.ok((await page.locator('#scene-detail').textContent())!.length>2);
    await page.screenshot({path:'.qa/minigame-390.png',fullPage:true});await skip();
  });
  await run('生成画像を使う真エンディング再視聴',async()=>{
    await page.locator('[data-action="completion"]').click();
    await page.locator('#anticipation').waitFor({state:'detached'});
    await page.screenshot({path:'.qa/true-ending-390.png',fullPage:true});
    await skip();
  });
  await run('320/390/768/1280幅と横画面・主操作44px以上',async()=>{
    for(const size of [{width:320,height:800},{width:390,height:844},{width:768,height:1024},{width:1280,height:900},{width:844,height:390}]){
      await page.setViewportSize(size);
      const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,controls:[...document.querySelectorAll<HTMLElement>('.console button')].map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}))}));
      assert.equal(geometry.scroll,geometry.width,`${size.width}px horizontal overflow`);
      for(const button of geometry.controls){assert.ok(button.w>=44&&button.h>=44,JSON.stringify(button));}
      await page.screenshot({path:`.qa/title-${size.width}x${size.height}.png`,fullPage:true});
    }
    await page.setViewportSize({width:390,height:844});
  });
  await run('設定の再読み込み保持・図鑑の検索とカテゴリ',async()=>{
    await page.locator('[data-action="settings"]').click();
    await page.locator('[data-setting="muted"]').check();await page.locator('[data-setting="reducedMotion"]').check();
    await page.reload();assert.equal(await page.locator('[data-setting="muted"]').isChecked(),true);assert.equal(await page.locator('[data-setting="autoSkip"]').isChecked(),true);assert.equal(await page.locator('[data-setting="reducedMotion"]').isChecked(),true);
    assert.equal(await page.locator('html').evaluate(e=>e.classList.contains('reduce-motion')),true);
    await page.locator('[data-setting="autoSkip"]').uncheck();
    await page.locator('[data-action="home"]').first().click();await page.locator('[data-action="library"]').click();
    await page.locator('#category').selectOption('minigame');assert.equal(await page.locator('.event-card').count(),13);
    await page.locator('#search').fill(EVENTS.find(e=>e.mechanic==='clicker')!.title);assert.equal(await page.locator('.event-card').count(),1);
    await page.locator('#search').fill('');await page.locator('#category').selectOption('all');assert.equal(await page.locator('.event-card').count(),173);
  });
  await run('記録を書き出し・形式を検証して再読み込み',async()=>{
    await page.locator('[data-action="settings"]').click();
    const downloadPromise=page.waitForEvent('download');await page.locator('[data-action="export"]').click();
    const download=await downloadPromise;await download.saveAs('.qa/save-export.json');
    const exported=JSON.parse(await readFile('.qa/save-export.json','utf8'));assert.equal(exported.discoveredEventIds.length,173);assert.equal(exported.schemaVersion,2);
    await page.locator('#import-file').setInputFiles('.qa/save-export.json');
    await page.waitForFunction(()=>document.querySelector('#notice')?.textContent?.includes('まとめました'));
    assert.equal((await state()).discoveredEventIds.length,173);
  });
  await run('X投稿画面は共有リンクの明示クリックだけで開く',async()=>{
    await page.locator('[data-action="home"]').first().click();
    assert.equal(context.pages().filter(p=>p.url().startsWith('https://twitter.com/')).length,0);
    // Intercept the intent screen: no request or post is sent to X during QA.
    await context.route('https://twitter.com/intent/tweet**',route=>route.fulfill({status:200,contentType:'text/html',body:'Intent preview'}));
    const popupPromise=page.waitForEvent('popup');await page.locator('[data-share]').click();const popup=await popupPromise;
    await popup.waitForLoadState();assert.equal(new URL(popup.url()).origin,'https://twitter.com');await popup.close();
    await context.unroute('https://twitter.com/intent/tweet**');
    assert.doesNotMatch(await page.locator('body').textContent()||'',/投稿完了/);
  });
  await run('画面切替とブラウザ戻るで演出を終了・入力を初期化',async()=>{
    await setCommand(EVENTS[0].command);await page.locator('#anticipation').waitFor({state:'detached'});
    await page.locator('[data-action="settings"]').click();assert.equal(await page.locator('#game-canvas').count(),0);
    await page.goBack();await page.locator('#start-button').waitFor();assert.equal(await page.locator('#input-count').textContent(),'0');
  });
  await run('二段階リセットの取消・別タブへの消去反映',async()=>{
    const other=await context.newPage();await other.goto(url);await other.locator('#start-button').waitFor();
    await page.locator('[data-action="settings"]').click();await page.locator('[data-action="reset"]').click();
    await page.locator('[data-action="reset-confirm"]').click();await page.locator('[data-action="reset-cancel"]').click();
    assert.equal((await state()).discoveredEventIds.length,173);
    assert.equal(await page.locator('[data-action="reset"]').evaluate(e=>e===document.activeElement),true);
    await page.locator('[data-action="reset"]').click();await page.locator('[data-action="reset-confirm"]').click();await page.locator('[data-action="reset-confirm"]').click();
    assert.equal((await state()).discoveredEventIds.length,0);
    await other.waitForFunction(()=>document.querySelector('.progress-count')?.textContent?.includes('000'));
    await other.locator('[data-action="sound"]').click();
    assert.equal((await state()).discoveredEventIds.length,0);await other.close();
  });
  await run('未入力枠に演出名・当たり外れを表示しない',async()=>{
    await page.locator('[data-action="home"]').first().click();
    // Replay the 87 discovered commands through UI to unlock an incomplete explorer.
    for(const event of EVENTS.slice(0,87)){await setCommand(event.command);await skip();}
    await page.locator('[data-action="explorer"]').click();
    const unknown=page.locator('.explorer-cell:not(.found):not(.miss)');assert.equal(await unknown.count(),129);
    for(const text of await unknown.allTextContents())assert.match(text,/未入力/);
    assert.equal(await unknown.locator('[data-event-id],[title]').count(),0);
    await page.screenshot({path:'.qa/explorer-unfinished-390.png',fullPage:true});
    await page.locator('[data-action="home"]').first().click();
  });
  await run('破損保存で起動・警告・新しい記録を安全に保存',async()=>{
    await page.evaluate(key=>localStorage.setItem(key,'{corrupt'),SAVE_KEY);await page.reload();
    assert.equal(await page.locator('#save-warning').isVisible(),true);
    await setCommand(EVENTS[0].command);assert.equal((await state()).discoveredEventIds.length,1);await skip();
    assert.equal(await page.evaluate(key=>localStorage.getItem(`${key}.recovery`),SAVE_KEY),'{corrupt');
  });
  await run('Service Worker登録・通信なしで再起動し新発見',async()=>{
    await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
    await page.reload();
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    await context.setOffline(true);await page.reload();await page.locator('#start-button').waitFor();
    await setCommand(EVENTS[2].command);assert.equal((await state()).discoveredEventIds.length,2);await skip();
    await context.setOffline(false);
  });
  assert.deepEqual(errors,[]);assert.deepEqual(failedRequests,[]);
  await writeFile('.qa/browser-results.json',JSON.stringify({url,channel:channel||'chromium',results,errors,failedRequests},null,2));
  console.log(`Browser checks: ${results.length}/${results.length} PASS; zero script errors or project 404s.`);
}finally{await browser?.close();await new Promise<void>(r=>server.close(()=>r()));}
