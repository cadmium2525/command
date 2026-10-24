import './ui/styles.css';
import './ui/console-only.css';
import { EVENTS, COMMANDS, EVENT_BY_ID, TRUE_ENDING } from './data/catalog';
import { SYMBOL_LABELS, displayCommand } from './data/types';
import type { GameEvent, InputSymbol, SaveData } from './data/types';
import { createEmptySave, normalizeSave, recordAttempt, progress, toggleFavorite, mergeSaves } from './core/state';
import { browserStorage, loadSave, persistSave, SAVE_KEY, RECOVERY_KEY } from './core/storage';
import { AudioEngine } from './core/audio';
import { shareUrl } from './core/share';
import { ScenePlayer, drawTitle } from './events/player';
import { FAMILY_LABELS } from './events/arcade-types';

type Modal = 'library'|'explorer'|'progress'|'settings'|'help'|'admin'|'rules';
type Playback = {event:GameEvent|null;isNew:boolean;source:'command'|'library'|'completion'|'admin';command:string;returnModal?:Modal};
const app=document.querySelector<HTMLDivElement>('#app')!;
const storage=browserStorage(),loaded=loadSave(storage);
let save=loaded.data,warning=loaded.warning;
let inputs:InputSymbol[]=[],message='';
let active:Playback|null=null,player:ScenePlayer|null=null,titleCleanup:(()=>void)|null=null;
let timer:ReturnType<typeof setTimeout>|null=null,playbackComplete=false;
let activeModal:Modal|null=null,modalPushed=false,modalFocus:HTMLElement|null=null,resetFocus:HTMLElement|null=null,resetStep=0;
let search='',category='all',favoritesOnly=false;
let heldTimer:ReturnType<typeof setInterval>|null=null,heldDelay:ReturnType<typeof setTimeout>|null=null,lastPointerInput=0;
function stopHeld(){if(heldTimer!==null)clearInterval(heldTimer);if(heldDelay!==null)clearTimeout(heldDelay);heldTimer=null;heldDelay=null;}
const ADMIN_KEY='secret-start.admin-preview';
let adminEnabled=true;
try{adminEnabled=storage?.getItem(ADMIN_KEY)!=='off';}catch{}
const audio=new AudioEngine(),motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
const reducedMotion=()=>motionQuery.matches||save.settings.reducedMotion;
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const titles:Record<Modal,string>={library:'ひみつ図鑑',explorer:'探索一覧',progress:'探索の記録',settings:'設定',help:'遊び方',admin:'管理者モード',rules:'このゲームの操作'};
function icon(kind:string){
  const paths:Record<string,string>={sound:'<path d="M11 4 6 8H3v8h3l5 4zM15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',muted:'<path d="M11 4 6 8H3v8h3l5 4zM16 9l6 6m0-6-6 6"/>',settings:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',book:'<path d="M12 5C8 3 5 3 2 4v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-3-1-6-1-10 1zm0 0v15"/>',grid:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',progress:'<path d="M4 20V12h4v8m3 0V7h4v13m3 0V3h3v17M2 21h21"/>',admin:'<path d="m8 4-6 8 6 8m8-16 6 8-6 8m-3-17-2 18"/>',undo:'<path d="m8 5-6 5 6 5m-6-5h12a6 6 0 0 1 0 12"/>',delete:'<path d="M8 5h13v14H8L2 12zm5 4 5 6m0-6-5 6"/>',play:'<path d="m7 3 14 9-14 9z"/>',close:'<path d="m5 5 14 14m0-14L5 19"/>',x:'<path d="m4 3 16 18H16L1 3zm16 0L4 21"/>'};
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[kind]||paths.book}</svg>`;
}
function persist(){warning=persistSave(storage,save).warning;audio.muted=save.settings.muted;document.documentElement.classList.toggle('reduce-motion',reducedMotion());}
function cleanup(){stopHeld();player?.dispose();player=null;titleCleanup?.();titleCleanup=null;if(timer!==null){clearTimeout(timer);timer=null;}audio.stop();}
function announce(text:string){message=text;const el=document.querySelector('#console-notice');if(el)el.textContent=warning||message||'SYSTEM READY / 3つの入力を待っています';}
function share(){return `<a class="share-link" href="${esc(shareUrl(save))}" target="_blank" rel="noopener noreferrer" data-share="true">${icon('x')}発見をシェアする ↗</a>`;}
function navigation(){return `<nav class="console-menu" aria-label="ゲーム機のメニュー">${(['library','explorer','progress','settings','admin'] as Modal[]).map((key,i)=>`<button data-modal="${key}" aria-haspopup="dialog" aria-controls="info-dialog" aria-label="${titles[key]}を開く">${icon(['book','grid','progress','settings','admin'][i])}<span>${['図鑑','探索','記録','設定','管理'][i]}</span></button>`).join('')}</nav>`;}
function slots(){const value=active?.command?[...active.command] as InputSymbol[]:inputs;return [0,1,2].map((_,i)=>`<span class="command-slot ${value[i]?'':'empty'} ${!active&&inputs.length===i?'current':''}">${value[i]?SYMBOL_LABELS[value[i]]:'·'}</span>`).join('');}
function controls(){return `<div class="command-row"><span class="command-label mono">YOUR COMMAND<br><small><span id="input-count">${active?.command?3:inputs.length}</span> / 3 INPUTS</small></span><div id="command-slots" class="slots" role="group" aria-label="コマンド入力 3枠">${slots()}</div><button class="slot-back" data-action="delete" aria-label="1文字戻す" ${active?'disabled':''}>${icon('delete')}</button></div><div class="controller"><div class="dpad" role="group" aria-label="方向ボタン"><button class="key up" data-symbol="U" aria-label="上">↑</button><button class="key left" data-symbol="L" aria-label="左">←</button><i class="dpad-center" aria-hidden="true"></i><button class="key right" data-symbol="R" aria-label="右">→</button><button class="key down" data-symbol="D" aria-label="下">↓</button></div><div class="ab-wrap"><div class="ab-buttons" role="group" aria-label="アクションボタン"><button class="key round-key b" data-symbol="B" aria-label="B">B</button><button class="key round-key" data-symbol="A" aria-label="A">A</button></div><span class="ab-caption mono">${active?'ARCADE CONTROL':'FOLLOW YOUR CURIOSITY'}</span></div></div><div class="start-row"><button class="clear-button" data-action="${active?'skip':'clear'}">${icon('undo')}${active?'終了・タイトルを見る':'入力をリセット'}</button><button id="start-button" class="start-button" data-action="${active?'advance':'start'}" ${!active&&inputs.length!==3?'disabled':''}>${icon('play')}<span>${active?'A / 決定':'START'}</span></button></div>`;}
function renderGame(){
  cleanup();audio.muted=save.settings.muted;document.documentElement.classList.toggle('reduce-motion',reducedMotion());
  const event=active?.event;
  const overlay=!active?'<div class="title-overlay"><span class="screen-kicker mono">THERE IS ALWAYS ANOTHER WAY</span><h1 class="screen-title">SECRET<span>START</span></h1><span class="screen-subtitle mono">3 INPUTS. 173 STRANGE GAMES.</span><span class="screen-prompt mono">▸ ENTER YOUR SECRET</span><span class="screen-copyright mono">© 2026 SECRET START</span></div>':'<div class="anticipation" id="anticipation">OPENING . . .</div>';
  app.innerHTML=`<main class="console-page" id="main-content"><section class="console ${active?'is-playing':''}" aria-label="SECRET START ゲーム機"><div class="console-top"><span><i class="dot led"></i>SECRET START SYSTEM</span><button class="console-sound" data-action="sound" aria-label="${save.settings.muted?'音をオンにする':'音をオフにする'}" aria-pressed="${!save.settings.muted}">${icon(save.settings.muted?'muted':'sound')}</button></div><div class="screen-bezel"><div class="screen"><canvas id="game-canvas" width="320" height="200" role="img" aria-label="${event?esc(FAMILY_LABELS[event.game.family])+'のミニゲーム':'秘密のアーケードのタイトル画面'}"></canvas>${overlay}${active?'<section id="game-result" class="game-result" hidden aria-labelledby="result-title" aria-live="polite" aria-atomic="true"><span id="result-status" class="mono"></span><h1 id="result-title"></h1><p id="result-score" class="mono"></p></section>':''}</div></div>${active?`<section class="arcade-info" aria-label="ミニゲームの操作"><div class="arcade-heading"><span class="playing-title mono">${event?'MINI GAME · '+esc(FAMILY_LABELS[event.game.family]):'NO GAME'}</span><button data-modal="rules" aria-haspopup="dialog">操作</button></div><p id="scene-narration" class="arcade-rule">${event?esc(event.game.rule):'このコマンドは空振りでした。別の3つを試してみよう。'}</p><p id="scene-detail" class="arcade-controls">${event?esc(event.game.controls):''}</p><span id="reading-status" class="arcade-status" aria-live="polite">${event?'ゲームが終わるとタイトルが分かります。':'何も起こりませんでした。'}</span><div class="play-progress" role="progressbar" aria-label="ゲームの制限時間" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="play-progress"></span></div></section>`:`<div class="screen-status mono"><span id="console-notice" role="status" aria-live="polite">${esc(warning||message||'SYSTEM READY / 3つの入力を待っています')}</span><span class="signal" aria-hidden="true"><i></i><i></i><i></i></span></div>`}${controls()}${navigation()}<div class="console-bottom mono"><span>CURIOUS MINDS ONLY.</span><span class="speaker" aria-hidden="true">${'<i></i>'.repeat(7)}</span></div><span id="input-live" class="screen-reader-only" aria-live="polite" aria-atomic="true"></span></section></main><dialog id="info-dialog" class="info-dialog" aria-labelledby="modal-title"></dialog><dialog id="confirm-dialog" aria-labelledby="dialog-title"><h2 id="dialog-title"></h2><p id="dialog-description"></p><div class="dialog-actions"><button class="small-button" data-action="reset-cancel">やめる</button><button class="small-button danger" data-action="reset-confirm" id="reset-confirm"></button></div></dialog>`;
  document.querySelector<HTMLDialogElement>('#info-dialog')!.addEventListener('cancel',e=>{e.preventDefault();closeModal();});
  if(!active)titleCleanup=drawTitle(document.querySelector('#game-canvas')!,reducedMotion());
}
function panelHead(title:string,description:string){return `<h2 class="panel-title">${title}</h2><p class="panel-sub">${description}</p>`;}
function eventCards(admin=false){
  const found=EVENTS.filter(e=>(admin||adminEnabled||save.discoveredEventIds.includes(e.eventId))&&(category==='all'||category===e.game.family)&&(!favoritesOnly||save.favoriteEventIds.includes(e.eventId))&&(!search||`${e.title} ${displayCommand(e.command)}`.toLowerCase().includes(search.toLowerCase())));
  return found.length?found.map(e=>{const discovered=save.discoveredEventIds.includes(e.eventId);return `<article class="event-card"><span class="event-number">${discovered?'✓ 発見済み':'管理者プレビュー · 未発見'}</span><h3>${esc(e.title)}</h3><div class="event-command">${displayCommand(e.command)}</div><p class="event-meta">${FAMILY_LABELS[e.game.family]} · ${Math.round(e.durationMs/1000)}秒以内</p><div class="card-actions"><button class="small-button" data-replay="${e.eventId}" aria-label="${esc(e.title)}を再生">▶ ${e.category==='minigame'?'遊ぶ':'見る'}</button>${discovered?`<button class="favorite-button ${save.favoriteEventIds.includes(e.eventId)?'selected':''}" data-favorite="${e.eventId}" aria-pressed="${save.favoriteEventIds.includes(e.eventId)}" aria-label="${esc(e.title)}のお気に入り">${save.favoriteEventIds.includes(e.eventId)?'★':'☆'}</button>`:''}</div></article>`;}).join(''):'<p class="empty-state">この条件の演出は、まだ記録されていません。</p>';
}
function libraryContent(admin=false){
  if(!admin&&!adminEnabled&&!progress(save).libraryUnlocked)return panelHead('ひみつ図鑑','5個の発見でひらきます。管理者モードでは今すぐ全ミニゲームを遊べます。');
  return `${panelHead(admin?'全ミニゲームプレビュー':'ひみつ図鑑',admin||adminEnabled?`全173ミニゲームを確認できます。実際の発見記録は ${save.discoveredEventIds.length} / 173 です。`:`見つけた ${save.discoveredEventIds.length} 個の世界を、もう一度。`)}<div class="filters"><input class="search-input" id="search" type="search" value="${esc(search)}" placeholder="ゲーム名・コマンドで検索" aria-label="ゲームを検索"><select class="filter-select" id="category" aria-label="カテゴリで絞り込む"><option value="all">すべて</option>${Object.entries(FAMILY_LABELS).map(([k,v])=>`<option value="${k}" ${category===k?'selected':''}>${v}</option>`).join('')}</select><label class="filter-check"><input type="checkbox" id="favorites-only" ${favoritesOnly?'checked':''}>★ お気に入り</label></div><div id="library-cards" class="library-grid">${eventCards(admin)}</div>`;
}
function explorerContent(){
  if(!adminEnabled&&!progress(save).explorerUnlocked)return panelHead('探索一覧','87個の発見でひらきます。');
  return `${panelHead('探索一覧',adminEnabled?'管理者モード：内容も表示しています。選ぶと入力欄にセットします。':'？ 未入力 ／ ✓ 発見済み ／ — 空振り。選ぶと入力欄にセットします。')}<div class="explorer-grid">${COMMANDS.map(c=>{const attempted=save.attemptedCommands.includes(c.command),found=attempted&&!!c.eventId,result=!attempted?'未入力':found?'発見済み':'空振り',title=adminEnabled?(c.eventId?EVENT_BY_ID.get(c.eventId)!.title:'空振り'):'';return `<button class="explorer-cell ${found?'found':attempted?'miss':''}" data-command="${c.command}" aria-label="${displayCommand(c.command)} ${esc(title||result)} 入力欄にセット">${displayCommand(c.command)}<small>${found?'✓':attempted?'—':'？'} ${result}</small>${title?`<span class="explorer-title">${esc(title)}</span>`:''}</button>`;}).join('')}</div>`;
}
function progressContent(){const p=progress(save);return `${panelHead('探索の記録','プレビューでは、この発見数は増えません。')}<div class="progress-count mono">${p.discovered}<small>/ 173</small></div><div class="progress-caption"><span>見つけたひみつ</span><span>${p.percent}%</span></div><div class="progress-track" role="progressbar" aria-label="発見の進み具合" aria-valuemin="0" aria-valuemax="173" aria-valuenow="${p.discovered}"><span style="width:${p.percent}%"></span></div><div class="discovery-grid" aria-hidden="true">${EVENTS.map(e=>`<i class="discovery-dot ${save.discoveredEventIds.includes(e.eventId)?'found':''}"></i>`).join('')}</div><p class="panel-sub">入力済み ${p.attempted} / 216 コマンド</p>${warning?`<p class="save-warning">${esc(warning)}</p>`:''}<div class="settings-actions">${share()}${p.complete?'<button class="small-button" data-action="completion">コンプリートゲームを見る</button>':''}<button class="small-button" data-modal="help">遊び方</button></div>`;}
function settingsContent(){
  const rows=[['muted','音を消す','小さな電子音の消音。'],['reducedMotion','動きを控えめに','揺れや回転を控えめにします。端末の設定も反映します。'],['autoSkip','発見済みを自動スキップ','コマンドの再入力だけに適用。図鑑・プレビューは再生します。']] as const;
  return `${panelHead('設定','ゲーム終了後のタイトルは、自分で戻るまで表示されます。')}<div class="settings-list">${rows.map(([key,title,desc])=>`<div class="setting-row"><div class="setting-copy"><strong id="${key}-label">${title}</strong><p id="${key}-description">${desc}</p></div><label class="switch"><input type="checkbox" role="switch" data-setting="${key}" aria-labelledby="${key}-label" aria-describedby="${key}-description" ${save.settings[key]?'checked':''}></label></div>`).join('')}<div class="settings-actions"><button class="small-button" data-action="export">記録を書き出す ↓</button><button class="small-button" data-action="import">記録を読み込む ↑</button><input type="file" id="import-file" accept="application/json,.json" hidden><button class="small-button danger" data-action="reset">記録をすべて消去</button><button class="small-button" data-modal="help">遊び方</button></div><p class="settings-footnote">記録はこのブラウザに保存されます。ブラウザのデータ消去で失われる場合があるため、書き出して保管できます。</p>${warning?`<p class="save-warning">${esc(warning)}</p>`:''}</div>`;
}
function adminContent(){const games=[EVENTS.find(e=>e.game.family==='blocks'&&e.game.variant===1),EVENTS.find(e=>e.game.family==='blocks'&&e.game.variant===2),EVENTS.find(e=>e.game.family==='invaders'&&e.game.variant===1)].filter((e):e is GameEvent=>!!e);return `${panelHead('管理者モード','全173ミニゲームとコンプリートゲームを、収集状況に関係なく確認できます。')}<div class="setting-row"><div class="setting-copy"><strong id="admin-label">すべてのミニゲームを表示</strong><p>初期ON。実際の収集記録は書き換えません。</p></div><label class="switch"><input id="admin-toggle" type="checkbox" role="switch" aria-labelledby="admin-label" ${adminEnabled?'checked':''}></label></div>${adminEnabled?`<div class="settings-actions">${games.map(e=>`<button class="small-button" data-replay="${e.eventId}">▶ ${esc(e.title)}</button>`).join('')}<button class="small-button" data-action="preview-ending">コンプリートゲームを確認</button></div>${libraryContent(true)}`:'<p class="panel-sub">OFFの間は、通常の解禁条件に戻ります。</p>'}`;}
function helpContent(){return `${panelHead('遊び方','↑ ↓ ← → A B を3回押して START。')}<div class="help-content"><p>216通りのコマンドに、173本の少しおかしなミニゲームと43の空振りが隠れています。</p><p>操作説明を見て、下のボタンかキーボードで遊びます。準備画面はボタンで開始できます。ゲームオーバー・クリア・時間切れの後に、そのゲームのタイトルが現れます。</p><p>タイトルは自動では閉じません。「もう一度」で再挑戦、「タイトルへ」で入力画面に戻れます。途中でも「終了・タイトルを見る」で結果を開けます。クリアできなくても発見として記録されます。</p><p>矢印と A・B、Enterに対応。入力中はBackspaceで1字戻す、Deleteで全消去。Escapeはゲーム終了／モーダルを閉じます。</p><p>管理者モードは初期ONで全173本を選べます。プレビューでは収集記録は増えません。通常モードでは5発見で図鑑、87発見で探索一覧がひらきます。</p></div>`;}
function rulesContent(){const game=active?.event?.game;return `${panelHead(game?FAMILY_LABELS[game.family]:'このゲームの操作','閉じるとゲームを再開します。')}<div class="help-content"><p>${game?esc(game.rule):'このコマンドは空振りです。'}</p><p>${game?esc(game.controls):'タイトル画面で、別の3つを入力してください。'}</p><p>最後にゲーム名が表示されます。負けても発見として記録されます。</p></div>`;}
function fillModal(){if(!activeModal)return;const content=activeModal==='library'?libraryContent():activeModal==='explorer'?explorerContent():activeModal==='progress'?progressContent():activeModal==='settings'?settingsContent():activeModal==='help'?helpContent():activeModal==='admin'?adminContent():rulesContent();document.querySelector<HTMLDialogElement>('#info-dialog')!.innerHTML=`<div class="modal-header"><h1 id="modal-title">${titles[activeModal]}</h1><button class="modal-close" data-action="close-modal" aria-label="モーダルを閉じる">${icon('close')}</button></div><div id="modal-notice" class="modal-notice" role="status"></div><div class="modal-content">${content}</div>`;}
function openModal(kind:Modal,push=true){stopHeld();const dialog=document.querySelector<HTMLDialogElement>('#info-dialog')!;if(!dialog.open)modalFocus=document.activeElement as HTMLElement;activeModal=kind;fillModal();if(!dialog.open){dialog.showModal();if(push){history.pushState({modal:kind},'',`#${kind}`);modalPushed=true;}}else if(push)history.replaceState({modal:kind},'',`#${kind}`);player?.pause(true);audio.stop();document.querySelector<HTMLButtonElement>('.modal-close')?.focus();}
function closeModal(updateHistory=true){document.querySelector<HTMLDialogElement>('#info-dialog')?.close();activeModal=null;if(updateHistory){if(modalPushed)history.back();else history.replaceState(null,'','#home');}modalPushed=false;player?.pause(document.hidden);if(modalFocus?.isConnected)modalFocus.focus({preventScroll:true});}
function syncInputs(){document.querySelector('#command-slots')!.innerHTML=slots();document.querySelector('#input-count')!.textContent=String(inputs.length);document.querySelector<HTMLButtonElement>('#start-button')!.disabled=inputs.length!==3;document.querySelector('#input-live')!.textContent=inputs.length?`入力 ${displayCommand(inputs.join(''))}。${inputs.length} / 3`:'入力を消しました。';}
function input(symbol:InputSymbol){audio.unlock();if(active){if(playbackComplete)return;player?.input(symbol);audio.play('input');return;}if(inputs.length===3)return;inputs.push(symbol);audio.play('input');syncInputs();}
function start(){if(active||inputs.length!==3)return;const command=inputs.join(''),result=recordAttempt(save,command);save=result.save;persist();if(result.event&&!result.isNew&&save.settings.autoSkip){inputs=[];renderGame();announce('発見済みの演出を自動スキップしました。');return;}begin({event:result.event||null,isNew:result.isNew,source:'command',command});}
function begin(playback:Playback){
  if(activeModal){document.querySelector<HTMLDialogElement>('#info-dialog')?.close();activeModal=null;modalPushed=false;history.replaceState(null,'','#home');}
  active=playback;inputs=[];playbackComplete=false;message='';renderGame();audio.play('start');const token=active;
  timer=setTimeout(()=>{timer=null;if(active!==token)return;document.querySelector('#anticipation')?.remove();const canvas=document.querySelector<HTMLCanvasElement>('#game-canvas')!;
    if(!playback.event){titleCleanup=drawTitle(canvas,true);audio.play('miss');showPlaybackEnd();return;}
    if(playback.isNew)audio.play('new');
    player=new ScenePlayer(canvas,playback.event,{reducedMotion:reducedMotion(),onProgress:(p,detail)=>{
      const bar=document.querySelector<HTMLElement>('#play-progress');if(bar){const value=Math.round(p*100);bar.style.width=`${value}%`;bar.parentElement!.setAttribute('aria-valuenow',String(value));}
      const line=document.querySelector('#scene-detail');if(line&&line.textContent!==detail)line.textContent=detail;
    },onComplete:showPlaybackEnd});
    if(activeModal||document.hidden)player.pause(true);
  },reducedMotion()?120:350);
  document.querySelector<HTMLButtonElement>('#start-button')?.focus({preventScroll:true});
}
function showPlaybackEnd(){
  if(!active||playbackComplete)return;playbackComplete=true;audio.stop();
  if(active.event&&active.source!=='admin'&&active.source!=='completion'&&save.discoveredEventIds.includes(active.event.eventId)){save={...save,viewedEventIds:[...new Set([...save.viewedEventIds,active.event.eventId])]};persist();}
  const result=document.querySelector<HTMLElement>('#game-result');if(result){result.hidden=false;document.querySelector('#result-status')!.textContent=active.event?(player?.result?.status==='win'?'CLEAR':player?.result?.status==='lose'?'GAME OVER':'TIME UP'):'NO GAME';document.querySelector('#result-title')!.textContent=active.event?.title??'空振り';document.querySelector('#result-score')!.textContent=active.event?`SCORE ${player?.score??0}`:'TRY ANOTHER COMMAND';}
  document.querySelector('#game-canvas')?.setAttribute('aria-label',active.event?.title??'空振り');
  const status=document.querySelector('#reading-status');if(status)status.textContent='タイトルは自動では閉じません。';
  const button=document.querySelector<HTMLButtonElement>('#start-button');if(button){button.classList.add('return-button');button.dataset.action='return';button.innerHTML=`<span>${active.returnModal?'一覧へ戻る':'タイトルへ'}</span>`;button.setAttribute('aria-label','読み終えたので戻る');}
  const skip=document.querySelector<HTMLButtonElement>('[data-action="skip"]');if(skip){skip.dataset.action=active.event?'retry':'return';skip.textContent=active.event?'↻ もう一度':'戻る';}
}
function finishPlayback(){if(!active)return;const previous=active;active=null;if(previous.source==='command'&&progress(save).complete&&!save.completionSeen){complete();return;}inputs=[];playbackComplete=false;message=previous.source==='admin'?'プレビューを終了しました。収集記録は変わりません。':previous.isNew?`「${previous.event!.title}」を記録しました。`:previous.event?'次の3つを、試してみよう。':'空振りを記録しました。';renderGame();if(previous.returnModal)openModal(previous.returnModal,false);else document.querySelector<HTMLButtonElement>('[data-symbol="U"]')?.focus({preventScroll:true});}
function complete(preview=false){if(!preview&&!progress(save).complete)return;if(!preview){save={...save,completionSeen:true};persist();}begin({event:TRUE_ENDING,isNew:false,source:preview?'admin':'completion',command:'',returnModal:preview?'admin':undefined});}
function resetDialog(step:number){resetStep=step;const dialog=document.querySelector<HTMLDialogElement>('#confirm-dialog')!;if(!dialog.open)resetFocus=document.activeElement as HTMLElement;document.querySelector('#dialog-title')!.textContent=step===1?'探索の記録を消去しますか？':'本当に、すべて消去しますか？';document.querySelector('#dialog-description')!.textContent=step===1?'図鑑・入力履歴・お気に入り・設定が消えます。先に書き出して保管できます。':'この操作は取り消せません。最初から探し直すことになります。';document.querySelector('#reset-confirm')!.textContent=step===1?'次へ進む':'すべて消去する';if(!dialog.open)dialog.showModal();document.querySelector<HTMLButtonElement>('[data-action="reset-cancel"]')!.focus();}
function closeReset(){document.querySelector<HTMLDialogElement>('#confirm-dialog')!.close();resetStep=0;resetFocus?.focus();}
function modalNotice(text:string){const el=document.querySelector('#modal-notice');if(el)el.textContent=text;else announce(text);}
function exportSave(){const url=URL.createObjectURL(new Blob([JSON.stringify(save,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=`secret-start-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);modalNotice('記録を書き出しました。');}
app.addEventListener('click',e=>{
  const el=(e.target as Element).closest<HTMLElement>('button,a');if(!el)return;audio.unlock();
  if(el.dataset.modal){openModal(el.dataset.modal as Modal);return;}
  if(el.dataset.symbol){if(!active||!e.isTrusted||Date.now()-lastPointerInput>350)input(el.dataset.symbol as InputSymbol);return;}
  if(el.dataset.replay){const event=EVENT_BY_ID.get(el.dataset.replay),found=event&&save.discoveredEventIds.includes(event.eventId);if(event&&(found||adminEnabled))begin({event,isNew:false,source:adminEnabled?'admin':'library',command:event.command,returnModal:activeModal||'library'});return;}
  if(el.dataset.favorite){save=toggleFavorite(save,el.dataset.favorite);persist();const cards=document.querySelector('#library-cards');if(cards)cards.innerHTML=eventCards(activeModal==='admin');document.querySelector<HTMLButtonElement>(`[data-favorite="${el.dataset.favorite}"]`)?.focus();return;}
  if(el.dataset.command){const command=el.dataset.command;closeModal(false);history.replaceState(null,'','#home');active=null;inputs=[...command] as InputSymbol[];renderGame();syncInputs();announce(`${displayCommand(command)} をセットしました。`);document.querySelector<HTMLButtonElement>('#start-button')?.focus();return;}
  switch(el.dataset.action){
    case 'close-modal':closeModal();break;
    case 'sound':save.settings.muted=!save.settings.muted;persist();if(save.settings.muted)audio.stop();else audio.unlock();el.innerHTML=icon(save.settings.muted?'muted':'sound');el.setAttribute('aria-label',save.settings.muted?'音をオンにする':'音をオフにする');el.setAttribute('aria-pressed',String(!save.settings.muted));break;
    case 'start':start();break;
    case 'advance':player?.input('START');break;
    case 'return':finishPlayback();break;
    case 'skip':player?.reveal();break;
    case 'retry':if(active)begin({...active,isNew:false});break;
    case 'rules':openModal('rules');break;
    case 'delete':case 'clear':if(!active){if(el.dataset.action==='clear')inputs=[];else inputs.pop();audio.play('back');syncInputs();}break;
    case 'completion':complete();break;
    case 'preview-ending':if(adminEnabled)complete(true);break;
    case 'export':exportSave();break;
    case 'import':document.querySelector<HTMLInputElement>('#import-file')?.click();break;
    case 'reset':resetDialog(1);break;
    case 'reset-cancel':closeReset();break;
    case 'reset-confirm':if(resetStep===1){resetDialog(2);break;}if(resetStep===2){closeReset();save=createEmptySave();try{storage?.removeItem(SAVE_KEY);storage?.removeItem(RECOVERY_KEY);}catch{}persist();fillModal();modalNotice('探索の記録を消去しました。');}break;
  }
});
app.addEventListener('pointerdown',e=>{
  const el=(e.target as Element).closest<HTMLElement>('[data-symbol]');
  if(!el||!active?.event||playbackComplete||activeModal||e.button!==0)return;
  const symbol=el.dataset.symbol as InputSymbol,family=active.event.game.family;
  const repeat=(symbol==='L'||symbol==='R')&&['blocks','invaders','breakout','pong','runner','dodge','catch','maze','racer','lander','balance','fishing'].includes(family)
    ||symbol==='A'&&['invaders','lander'].includes(family)||(symbol==='U'||symbol==='D')&&['pong','lander','dodge','maze','blocks'].includes(family);
  e.preventDefault();stopHeld();lastPointerInput=Date.now();input(symbol);
  if(repeat)heldDelay=setTimeout(()=>{heldTimer=setInterval(()=>{lastPointerInput=Date.now();input(symbol);},90);},240);
});
window.addEventListener('pointerup',()=>{if(heldDelay!==null||heldTimer!==null)lastPointerInput=Date.now();stopHeld();});
window.addEventListener('pointercancel',stopHeld);
window.addEventListener('blur',stopHeld);
app.addEventListener('input',e=>{const el=e.target as HTMLInputElement;if(el.id==='search'){search=el.value;document.querySelector('#library-cards')!.innerHTML=eventCards(activeModal==='admin');}});
app.addEventListener('change',async e=>{
  const el=e.target as HTMLInputElement;
  if(el.dataset.setting){save.settings[el.dataset.setting as keyof SaveData['settings']]=el.checked;persist();if(save.settings.muted)audio.stop();player?.setReducedMotion(reducedMotion());const sound=document.querySelector('[data-action="sound"]');if(sound){sound.innerHTML=icon(save.settings.muted?'muted':'sound');sound.setAttribute('aria-label',save.settings.muted?'音をオンにする':'音をオフにする');sound.setAttribute('aria-pressed',String(!save.settings.muted));}return;}
  if(el.id==='admin-toggle'){adminEnabled=el.checked;try{storage?.setItem(ADMIN_KEY,adminEnabled?'on':'off');}catch{}fillModal();document.querySelector<HTMLInputElement>('#admin-toggle')?.focus();return;}
  if(el.id==='category'){category=el.value;document.querySelector('#library-cards')!.innerHTML=eventCards(activeModal==='admin');}
  if(el.id==='favorites-only'){favoritesOnly=el.checked;document.querySelector('#library-cards')!.innerHTML=eventCards(activeModal==='admin');}
  if(el.id==='import-file'&&el.files?.[0])try{if(el.files[0].size>1_000_000)throw new Error('size');const raw=JSON.parse(await el.files[0].text());if(!raw||typeof raw!=='object'||Array.isArray(raw)||(raw.schemaVersion!==1&&raw.schemaVersion!==2)||!Array.isArray(raw.discoveredEventIds??raw.discovered))throw new Error('format');save=mergeSaves(save,normalizeSave(raw));persist();fillModal();modalNotice('記録を読み込み、この端末の記録とまとめました。');}catch{modalNotice('SECRET STARTから書き出したJSONファイルを選んでください。');}
});
document.addEventListener('keydown',e=>{if(e.repeat&&(e.key==='Enter'||e.key==='Escape')){e.preventDefault();return;}const target=e.target as HTMLElement;if(document.querySelector('dialog[open]')||target.matches('input,select,textarea')||e.ctrlKey||e.metaKey||e.altKey)return;const keys:Record<string,InputSymbol>={ArrowUp:'U',ArrowDown:'D',ArrowLeft:'L',ArrowRight:'R',a:'A',A:'A',b:'B',B:'B'};if(keys[e.key]){e.preventDefault();if(!e.repeat||!!active)input(keys[e.key]);return;}if(e.key==='Enter'&&(target.matches('[data-symbol]')||!target.closest('button,a'))){e.preventDefault();audio.unlock();if(!active)start();else if(playbackComplete)finishPlayback();else player?.input('START');}if(e.key==='Backspace'&&!active){e.preventDefault();inputs.pop();syncInputs();}if(e.key==='Delete'&&!active){e.preventDefault();inputs=[];syncInputs();}if(e.key==='Escape'&&active){e.preventDefault();if(playbackComplete)finishPlayback();else player?.reveal();}});
window.addEventListener('popstate',()=>{const name=location.hash.slice(1) as Modal;if(Object.hasOwn(titles,name))openModal(name,false);else closeModal(false);});
window.addEventListener('storage',e=>{if(e.key!==SAVE_KEY&&e.key!==null)return;if(e.newValue===null){save=createEmptySave();active=null;inputs=[];activeModal=null;renderGame();announce('別のタブで記録が消去されました。');return;}try{save=mergeSaves(save,normalizeSave(JSON.parse(e.newValue)));if(activeModal)fillModal();}catch{}});
window.addEventListener('pagehide',cleanup);
window.addEventListener('pageshow',e=>{if(e.persisted){active=null;activeModal=null;inputs=[];renderGame();}});
document.addEventListener('visibilitychange',()=>{player?.pause(document.hidden||!!activeModal);if(document.hidden)audio.stop();});
motionQuery.addEventListener('change',()=>{player?.setReducedMotion(reducedMotion());document.documentElement.classList.toggle('reduce-motion',reducedMotion());if(!active){titleCleanup?.();titleCleanup=drawTitle(document.querySelector('#game-canvas')!,reducedMotion());}});
if(loaded.migrated)persist();renderGame();const initial=location.hash.slice(1) as Modal;if(Object.hasOwn(titles,initial))openModal(initial,false);
if('serviceWorker'in navigator&&import.meta.env.PROD)window.addEventListener('load',()=>{void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(()=>{});});
