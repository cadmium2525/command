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

type Modal = 'library'|'explorer'|'progress'|'settings'|'help'|'rules';
type Playback = {event:GameEvent|null;isNew:boolean;source:'command'|'library'|'completion';command:string;returnModal?:Modal};
const app=document.querySelector<HTMLDivElement>('#app')!;
const storage=browserStorage(),loaded=loadSave(storage);
let save=loaded.data,warning=loaded.warning;
let inputs:InputSymbol[]=[],message='';
let active:Playback|null=null,player:ScenePlayer|null=null,titleCleanup:(()=>void)|null=null;
let timer:ReturnType<typeof setTimeout>|null=null,playbackComplete=false;
let activeModal:Modal|null=null,modalPushed=false,modalFocus:HTMLElement|null=null,resetFocus:HTMLElement|null=null,resetStep=0;
let search='',category='all',favoritesOnly=false;
const modalPages:Record<Modal,number>={library:0,explorer:0,progress:0,settings:0,help:0,rules:0};
let returnReadyAt=0;
const activePointers=new Set<number>();
let heldTimer:ReturnType<typeof setInterval>|null=null,heldDelay:ReturnType<typeof setTimeout>|null=null,lastPointerInput=0;
function stopHeld(){if(heldTimer!==null)clearInterval(heldTimer);if(heldDelay!==null)clearTimeout(heldDelay);heldTimer=null;heldDelay=null;}
function canRepeat(symbol:InputSymbol,family:string){return (symbol==='L'||symbol==='R')&&['blocks','invaders','breakout','runner','dodge','catch','maze','racer','lander','balance','fishing'].includes(family)||symbol==='A'&&['invaders','lander'].includes(family)||(symbol==='U'||symbol==='D')&&['pong','dodge','maze','balance'].includes(family)||symbol==='D'&&['blocks','runner'].includes(family);}
const audio=new AudioEngine(),motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
const reducedMotion=()=>motionQuery.matches||save.settings.reducedMotion;
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const gameLabel=(event:GameEvent)=>event.eventId===TRUE_ENDING.eventId?'アーケード・リミックス':FAMILY_LABELS[event.game.family];
const titles:Record<Modal,string>={library:'ひみつ図鑑',explorer:'探索一覧',progress:'探索の記録',settings:'設定',help:'遊び方',rules:'このゲームの操作'};
function icon(kind:string){
  const paths:Record<string,string>={sound:'<path d="M11 4 6 8H3v8h3l5 4zM15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',muted:'<path d="M11 4 6 8H3v8h3l5 4zM16 9l6 6m0-6-6 6"/>',settings:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',book:'<path d="M12 5C8 3 5 3 2 4v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-3-1-6-1-10 1zm0 0v15"/>',grid:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',progress:'<path d="M4 20V12h4v8m3 0V7h4v13m3 0V3h3v17M2 21h21"/>',undo:'<path d="m8 5-6 5 6 5m-6-5h12a6 6 0 0 1 0 12"/>',delete:'<path d="M8 5h13v14H8L2 12zm5 4 5 6m0-6-5 6"/>',play:'<path d="m7 3 14 9-14 9z"/>',close:'<path d="m5 5 14 14m0-14L5 19"/>',x:'<path d="m4 3 16 18H16L1 3zm16 0L4 21"/>'};
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[kind]||paths.book}</svg>`;
}
function persist(){warning=persistSave(storage,save).warning;audio.muted=save.settings.muted;document.documentElement.classList.toggle('reduce-motion',reducedMotion());}
function cleanup(){stopHeld();player?.dispose();player=null;titleCleanup?.();titleCleanup=null;if(timer!==null){clearTimeout(timer);timer=null;}audio.stop();}
function announce(text:string){message=text;const el=document.querySelector('#console-notice');if(el)el.textContent=warning||message||'SYSTEM READY / 3つの入力を待っています';}
function share(){return `<a class="share-link" href="${esc(shareUrl(save))}" target="_blank" rel="noopener noreferrer" data-share="true">${icon('x')}発見をシェアする ↗</a>`;}
function navigation(){return `<nav class="console-menu" aria-label="ゲーム機のメニュー">${(['library','explorer','progress','settings'] as Modal[]).map((key,i)=>`<button data-modal="${key}" aria-haspopup="dialog" aria-controls="info-dialog" aria-label="${titles[key]}を開く">${icon(['book','grid','progress','settings'][i])}<span>${['図鑑','探索','記録','設定'][i]}</span></button>`).join('')}</nav>`;}
function slots(){const value=active?.command?[...active.command] as InputSymbol[]:inputs;return [0,1,2].map((_,i)=>`<span class="command-slot ${value[i]?'':'empty'} ${!active&&inputs.length===i?'current':''}">${value[i]?SYMBOL_LABELS[value[i]]:'·'}</span>`).join('');}
function controls(){
  const command=active?'':`<div class="command-row"><span class="command-label mono">YOUR COMMAND<br><small><span id="input-count">${inputs.length}</span> / 3 INPUTS</small></span><div id="command-slots" class="slots" role="group" aria-label="コマンド入力 3枠">${slots()}</div><button class="slot-back" data-action="delete" aria-label="1文字戻す">${icon('delete')}</button></div>`;
  return `${command}<div class="controller"><div class="dpad" role="group" aria-label="方向ボタン"><button class="key up" data-symbol="U" aria-label="上">↑</button><button class="key left" data-symbol="L" aria-label="左">←</button><i class="dpad-center" aria-hidden="true"></i><button class="key right" data-symbol="R" aria-label="右">→</button><button class="key down" data-symbol="D" aria-label="下">↓</button></div><div class="ab-wrap"><div class="ab-buttons" role="group" aria-label="アクションボタン"><button class="key round-key b" data-symbol="B" aria-label="B">B</button><button class="key round-key" data-symbol="A" aria-label="A">A</button></div><span class="ab-caption mono">${active?'ARCADE CONTROL':'FOLLOW YOUR CURIOSITY'}</span></div></div><div class="start-row"><button class="clear-button" data-action="${active?'skip':'clear'}">${icon('undo')}${active?'終了・タイトルを見る':'入力をリセット'}</button><button id="start-button" class="start-button" data-action="${active?'advance':'start'}" ${!active&&inputs.length!==3?'disabled':''}>${icon('play')}<span>${active?'A / 決定':'START'}</span></button></div>`;
}
function renderGame(){
  cleanup();audio.muted=save.settings.muted;document.documentElement.classList.toggle('reduce-motion',reducedMotion());
  const event=active?.event;
  const overlay=!active?'<div class="title-overlay"><span class="screen-kicker mono">THERE IS ALWAYS ANOTHER WAY</span><h1 class="screen-title">SECRET<span>START</span></h1><span class="screen-subtitle mono">3 INPUTS. 173 STRANGE GAMES.</span><span class="screen-prompt mono">▸ ENTER YOUR SECRET</span><span class="screen-copyright mono">© 2026 SECRET START</span></div>':'<div class="anticipation" id="anticipation">OPENING . . .</div>';
  app.innerHTML=`<main class="console-page" id="main-content"><section class="console ${active?'is-playing':''}" aria-label="SECRET START ゲーム機"><div class="console-top"><span><i class="dot led"></i>SECRET START SYSTEM</span><button class="console-sound" data-action="sound" aria-label="${save.settings.muted?'音をオンにする':'音をオフにする'}" aria-pressed="${!save.settings.muted}">${icon(save.settings.muted?'muted':'sound')}</button></div><div class="screen-bezel"><div class="screen"><canvas id="game-canvas" width="320" height="200" role="img" aria-label="${event?esc(gameLabel(event))+'のミニゲーム':'秘密のアーケードのタイトル画面'}"></canvas>${overlay}${active?'<section id="game-result" class="game-result" hidden aria-labelledby="result-title" aria-live="polite" aria-atomic="true"><span id="result-status" class="mono"></span><h1 id="result-title"></h1><p id="result-score" class="mono"></p><p class="result-prompt">↑ ↓ ← → ・ A ・ B で戻る</p></section>':''}</div></div>${active?`<section class="arcade-info" aria-label="ミニゲームの操作"><div class="arcade-heading"><span class="playing-title mono">${event?'MINI GAME · '+esc(gameLabel(event)):'NO GAME'}</span><button data-modal="rules" aria-haspopup="dialog">操作</button></div><p id="scene-detail" class="arcade-controls">${event?esc(event.game.controls):''}</p><span id="reading-status" class="arcade-status" aria-live="polite" hidden></span><div class="play-progress" ${event&&event.durationMs===0?'hidden':''} role="progressbar" aria-label="ゲームの制限時間" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="play-progress"></span></div></section>`:`<div class="screen-status mono"><span id="console-notice" role="status" aria-live="polite">${esc(warning||message||'SYSTEM READY / 3つの入力を待っています')}</span><span class="signal" aria-hidden="true"><i></i><i></i><i></i></span></div>`}${controls()}${navigation()}<div class="console-bottom mono"><span>CURIOUS MINDS ONLY.</span><span class="speaker" aria-hidden="true">${'<i></i>'.repeat(7)}</span></div><span id="input-live" class="screen-reader-only" aria-live="polite" aria-atomic="true"></span></section></main><dialog id="info-dialog" class="info-dialog" aria-labelledby="modal-title"></dialog><dialog id="confirm-dialog" aria-labelledby="dialog-title"><h2 id="dialog-title"></h2><p id="dialog-description"></p><div class="dialog-actions"><button class="small-button" data-action="reset-cancel">やめる</button><button class="small-button danger" data-action="reset-confirm" id="reset-confirm"></button></div></dialog>`;
  document.querySelector<HTMLDialogElement>('#info-dialog')!.addEventListener('cancel',e=>{e.preventDefault();closeModal();});
  if(!active)titleCleanup=drawTitle(document.querySelector('#game-canvas')!,reducedMotion());
}
function panelHead(title:string,description:string){return `<h2 class="panel-title">${title}</h2><p class="panel-sub">${description}</p>`;}
function pageSize(kind:'library'|'explorer'){
  const css=getComputedStyle(document.documentElement);
  const value=(axis:string,fallback:number)=>Math.max(1,parseInt(css.getPropertyValue(`--${kind}-${axis}`),10)||fallback);
  return value('cols',kind==='library'?2:3)*value('rows',kind==='library'?2:4);
}
function pageSlice<T>(kind:Modal,items:T[],size=1){
  const count=Math.max(1,Math.ceil(items.length/size));
  modalPages[kind]=Math.min(Math.max(0,modalPages[kind]),count-1);
  return items.slice(modalPages[kind]*size,(modalPages[kind]+1)*size);
}
function pageControls(kind:Modal,total:number,size=1){
  const count=Math.max(1,Math.ceil(total/size));
  modalPages[kind]=Math.min(Math.max(0,modalPages[kind]),count-1);
  const index=modalPages[kind],label=kind==='library'||kind==='explorer'?`<small>全${total}件</small>`:'';
  return `<div class="page-controls" data-current-page="${index}" data-page-count="${count}"><button class="small-button" data-page="${kind}" data-direction="-1" ${index===0?'disabled':''}>← 前へ</button><span class="page-indicator" aria-live="polite">${index+1} / ${count}${label}</span><button class="small-button" data-page="${kind}" data-direction="1" ${index===count-1?'disabled':''}>次へ →</button></div>`;
}
function pagination(kind:Modal,total:number,size=1){return `<div id="${kind}-pagination" class="pagination" data-current-page="${modalPages[kind]}" data-page-count="${Math.max(1,Math.ceil(total/size))}">${pageControls(kind,total,size)}</div>`;}
function filteredEvents(){return EVENTS.filter(e=>save.discoveredEventIds.includes(e.eventId)&&(category==='all'||category===e.game.family)&&(!favoritesOnly||save.favoriteEventIds.includes(e.eventId))&&(!search||`${e.title} ${displayCommand(e.command)}`.toLowerCase().includes(search.toLowerCase())));}
function eventCards(){
  const found=pageSlice('library',filteredEvents(),pageSize('library'));
  return found.length?found.map(e=>`<article class="event-card"><span class="event-number">✓ 発見済み</span><h3>${esc(e.title)}</h3><div class="event-command">${displayCommand(e.command)}</div><p class="event-meta">${FAMILY_LABELS[e.game.family]} · ${e.durationMs>0?`${Math.round(e.durationMs/1000)}秒`:e.game.playMode==='gag'?'ショートゲーム':'時間制限なし'}</p><div class="card-actions"><button class="small-button" data-replay="${e.eventId}" aria-label="${esc(e.title)}を再生">▶ 遊ぶ</button><button class="favorite-button ${save.favoriteEventIds.includes(e.eventId)?'selected':''}" data-favorite="${e.eventId}" aria-pressed="${save.favoriteEventIds.includes(e.eventId)}" aria-label="${esc(e.title)}のお気に入り">${save.favoriteEventIds.includes(e.eventId)?'★':'☆'}</button></div></article>`).join(''):'<p class="empty-state">この条件のゲームは、まだ記録されていません。</p>';
}
function updateLibrary(){
  const cards=document.querySelector<HTMLElement>('#library-cards'),pager=document.querySelector('#library-pagination');
  if(cards){cards.innerHTML=eventCards();cards.dataset.totalCount=String(filteredEvents().length);}
  if(pager){pager.innerHTML=pageControls('library',filteredEvents().length,pageSize('library'));pager.setAttribute('data-current-page',String(modalPages.library));pager.setAttribute('data-page-count',String(Math.max(1,Math.ceil(filteredEvents().length/pageSize('library')))));}
}
function libraryContent(){
  if(!progress(save).libraryUnlocked)return panelHead('ひみつ図鑑',`5個の発見でひらきます。あと ${5-save.discoveredEventIds.length} 個、別のゲームを見つけよう。`);
  const cards=eventCards(),total=filteredEvents().length;
  return `<section class="modal-page library-page">${panelHead('ひみつ図鑑',`見つけた ${save.discoveredEventIds.length} 個のゲームを、もう一度。`)}<div class="filters"><input class="search-input" id="search" type="search" value="${esc(search)}" placeholder="ゲーム名・コマンドで検索" aria-label="ゲームを検索"><select class="filter-select" id="category" aria-label="カテゴリで絞り込む"><option value="all">すべて</option>${Object.entries(FAMILY_LABELS).map(([k,v])=>`<option value="${k}" ${category===k?'selected':''}>${v}</option>`).join('')}</select><label class="filter-check"><input type="checkbox" id="favorites-only" ${favoritesOnly?'checked':''}>★ お気に入り</label></div><div class="library-viewport"><div id="library-cards" class="library-grid" data-total-count="${total}">${cards}</div></div>${pagination('library',total,pageSize('library'))}</section>`;
}
function explorerContent(){
  if(!progress(save).explorerUnlocked)return panelHead('探索一覧',`87個の発見でひらきます。あと ${87-save.discoveredEventIds.length} 個、別のゲームを見つけよう。`);
  const entries=pageSlice('explorer',COMMANDS,pageSize('explorer'));
  return `<section class="modal-page explorer-page">${panelHead('探索一覧','？ 未入力 ／ ✓ 発見済み ／ — 空振り。選ぶと入力欄にセットします。')}<div class="explorer-viewport"><div id="explorer-cells" class="explorer-grid" data-total-count="216" data-found-count="${save.discoveredEventIds.length}" data-miss-count="${save.attemptedCommands.filter(c=>!COMMANDS.find(entry=>entry.command===c)?.eventId).length}">${entries.map(c=>{const attempted=save.attemptedCommands.includes(c.command),found=attempted&&!!c.eventId,result=!attempted?'未入力':found?'発見済み':'空振り';return `<button class="explorer-cell ${found?'found':attempted?'miss':''}" data-command="${c.command}" aria-label="${displayCommand(c.command)} ${result} 入力欄にセット">${displayCommand(c.command)}<small>${found?'✓':attempted?'—':'？'} ${result}</small></button>`;}).join('')}</div></div>${pagination('explorer',216,pageSize('explorer'))}</section>`;
}
function progressContent(){
  const p=progress(save),pages=[
    `<p class="panel-sub">別々のゲームの発見を記録。クリアは不要です。</p><div class="progress-count mono">${p.discovered}<small>/ 173</small></div><div class="progress-caption"><span>見つけたひみつ</span><span>${p.percent}%</span></div><div class="progress-track" role="progressbar" aria-label="発見の進み具合" aria-valuemin="0" aria-valuemax="173" aria-valuenow="${p.discovered}"><span style="width:${p.percent}%"></span></div><div class="discovery-grid" aria-hidden="true">${EVENTS.map(e=>`<i class="discovery-dot ${save.discoveredEventIds.includes(e.eventId)?'found':''}"></i>`).join('')}</div><p class="panel-sub">入力済み ${p.attempted} / 216 コマンド</p><p class="panel-sub">${p.complete?'コンプリートゲーム解放！ 次のページから遊べます。':`全173種類の発見でコンプリートゲーム解放。あと ${173-p.discovered} 個。`}</p>`,
    `${panelHead('発見を持ち帰ろう','記録はこのブラウザーに保存されています。')}<div class="settings-actions">${share()}${p.complete?'<button class="small-button" data-action="completion">コンプリートゲームを遊ぶ</button>':''}<button class="small-button" data-modal="help">遊び方</button></div>${warning?`<p class="save-warning">${esc(warning)}</p>`:''}`
  ];
  return `<section class="modal-page progress-page"><div class="page-body">${pageSlice('progress',pages)[0]}</div>${pagination('progress',pages.length)}</section>`;
}
function settingsContent(){
  const rows=[['muted','音を消す','小さな電子音の消音。'],['reducedMotion','動きを控えめに','端末の設定も反映します。'],['autoSkip','発見済みを自動スキップ','図鑑からはいつでも遊べます。']] as const;
  const pages=[
    `<div class="settings-list">${rows.map(([key,title,desc])=>`<div class="setting-row"><div class="setting-copy"><strong id="${key}-label">${title}</strong><p id="${key}-description">${desc}</p></div><label class="switch"><input type="checkbox" role="switch" data-setting="${key}" aria-labelledby="${key}-label" aria-describedby="${key}-description" ${save.settings[key]?'checked':''}></label></div>`).join('')}</div>`,
    `${panelHead('記録の保管','書き出した記録は、別の端末にも読み込めます。')}<div class="settings-actions"><button class="small-button" data-action="export">記録を書き出す ↓</button><button class="small-button" data-action="import">記録を読み込む ↑</button><input type="file" id="import-file" accept="application/json,.json" hidden><button class="small-button danger" data-action="reset">記録をすべて消去</button><button class="small-button" data-modal="help">遊び方</button></div><p class="settings-footnote">記録はこのブラウザーに保存。データ消去に備えて書き出して保管できます。</p>${warning?`<p class="save-warning">${esc(warning)}</p>`:''}`
  ];
  return `<section class="modal-page settings-page"><div class="page-body">${pageSlice('settings',pages)[0]}</div>${pagination('settings',pages.length)}</section>`;
}
function helpContent(){
  const pages=[
    `${panelHead('3つ押して START','↑ ↓ ← → A B の組み合わせを試そう。')}<div class="help-content"><p>216通りのコマンドに、173本の少しおかしなミニゲームと43の空振りが隠れています。</p><p>方向キーとA/Bで遊びます。詳しいルールはゲーム中の「操作」から読めます。</p></div>`,
    `${panelHead('ゲームオーバーまで遊ぼう','準備画面はAまたはSTARTで開始。')}<div class="help-content"><p>通常版に一律の時間制限や小さな達成ノルマはありません。ゲームオーバーや敵・盤面の全攻略まで遊べます。</p><p>「おやつは３個まで」など、短さがタイトルのネタになっているゲームは固有の終了条件があります。</p></div>`,
    `${panelHead('最後にタイトルが現れます','タイトルは自動では閉じません。')}<div class="help-content"><p>読み終えたら、矢印・A・Bのどれかを新しく押して戻ります。「もう一度」なら同じゲームに再挑戦できます。</p><p>途中でも「終了・タイトルを見る」で終えられます。失敗・途中終了でも発見として記録されます。</p></div>`,
    `${panelHead('発見で開く新しい機能','同じゲームの再プレイでは発見数は増えません。')}<div class="help-content"><p>5種類で図鑑、87種類で探索一覧を解放。173種類すべてを見つけ、最後のゲームから戻ると完集ゲームが一度自動で始まります。</p><p>その後は「記録」から遊べます。キーボードは矢印・A/B・Enter、入力中のBackspace・Deleteにも対応します。</p></div>`,
    `${panelHead('コンプリートゲーム','5種類をつなぐアーケード・リミックス。')}<div class="help-content"><p>落ちもの・インベーダー・スネーク・ブロック崩し・ランナーが交代します。共通ライフ3で、なくなるまで遊べます。</p><p>TIMEは全体の経過時間。「交代まで」は次のゲームへの残り秒数です。モーダルを開くとゲームは一時停止します。</p></div>`
  ];
  return `<section class="modal-page help-page"><div class="page-body">${pageSlice('help',pages)[0]}</div>${pagination('help',pages.length)}</section>`;
}
function rulesContent(){
  const game=active?.event?.game,pages=[
    `${panelHead(active?.event?gameLabel(active.event):'このゲームの操作','閉じるとゲームを再開します。')}<div class="help-content"><p>${game?esc(game.rule):'このコマンドは空振りです。別の3つを試そう。'}</p></div>`,
    `${panelHead('ボタンの操作','下のボタン、またはキーボードで遊べます。')}<div class="help-content"><p>${game?esc(player?.instruction??game.controls):'タイトル画面で別のコマンドを入力してください。'}</p><p>終了後は矢印・A・Bで戻ります。負けても発見として記録されます。</p></div>`
  ];
  return `<section class="modal-page rules-page"><div class="page-body">${pageSlice('rules',pages)[0]}</div>${pagination('rules',pages.length)}</section>`;
}
function fillModal(){
  if(!activeModal)return;
  const content=activeModal==='library'?libraryContent():activeModal==='explorer'?explorerContent():activeModal==='progress'?progressContent():activeModal==='settings'?settingsContent():activeModal==='help'?helpContent():rulesContent();
  const dialog=document.querySelector<HTMLDialogElement>('#info-dialog')!;dialog.dataset.modal=activeModal;
  dialog.innerHTML=`<div class="modal-header"><h1 id="modal-title">${titles[activeModal]}</h1><button class="modal-close" data-action="close-modal" aria-label="モーダルを閉じる">${icon('close')}</button></div><div id="modal-notice" class="modal-notice" role="status"></div><div class="modal-content">${content}</div>`;
}
function openModal(kind:Modal,push=true){if(!Object.hasOwn(titles,kind))return;if(kind==='rules')modalPages.rules=0;stopHeld();const dialog=document.querySelector<HTMLDialogElement>('#info-dialog')!;if(!dialog.open)modalFocus=document.activeElement as HTMLElement;activeModal=kind;fillModal();if(!dialog.open){dialog.showModal();if(push){history.pushState({modal:kind},'',`#${kind}`);modalPushed=true;}}else if(push)history.replaceState({modal:kind},'',`#${kind}`);player?.pause(true);audio.stop();document.querySelector<HTMLButtonElement>('.modal-close')?.focus();}
function closeModal(updateHistory=true){document.querySelector<HTMLDialogElement>('#info-dialog')?.close();activeModal=null;if(updateHistory){if(modalPushed)history.back();else history.replaceState(null,'','#home');}modalPushed=false;player?.pause(document.hidden);if(modalFocus?.isConnected)modalFocus.focus({preventScroll:true});}
function syncInputs(){document.querySelector('#command-slots')!.innerHTML=slots();document.querySelector('#input-count')!.textContent=String(inputs.length);document.querySelector<HTMLButtonElement>('#start-button')!.disabled=inputs.length!==3;document.querySelector('#input-live')!.textContent=inputs.length?`入力 ${displayCommand(inputs.join(''))}。${inputs.length} / 3`:'入力を消しました。';}
function input(symbol:InputSymbol,allowReturn=true){audio.unlock();if(active){if(playbackComplete){if(allowReturn&&Date.now()>=returnReadyAt)finishPlayback();return;}player?.input(symbol);audio.play('input');return;}if(inputs.length===3)return;inputs.push(symbol);audio.play('input');syncInputs();}
function start(){if(active||inputs.length!==3)return;const command=inputs.join(''),result=recordAttempt(save,command);save=result.save;persist();if(result.event&&!result.isNew&&save.settings.autoSkip){inputs=[];renderGame();announce('発見済みの演出を自動スキップしました。');return;}begin({event:result.event||null,isNew:result.isNew,source:'command',command});}
function begin(playback:Playback){
  if(activeModal){document.querySelector<HTMLDialogElement>('#info-dialog')?.close();activeModal=null;modalPushed=false;history.replaceState(null,'','#home');}
  active=playback;inputs=[];playbackComplete=false;message='';renderGame();audio.play('start');const token=active;
  timer=setTimeout(()=>{timer=null;if(active!==token)return;document.querySelector('#anticipation')?.remove();const canvas=document.querySelector<HTMLCanvasElement>('#game-canvas')!;
    if(!playback.event){titleCleanup=drawTitle(canvas,true);audio.play('miss');showPlaybackEnd();return;}
    if(playback.isNew)audio.play('new');
    let controlFamily='';
    player=new ScenePlayer(canvas,playback.event,{reducedMotion:reducedMotion(),onProgress:(p,detail)=>{
      const family=player?.currentFamily??playback.event!.game.family;if(family!==controlFamily){stopHeld();controlFamily=family;}
      const bar=document.querySelector<HTMLElement>('#play-progress');if(bar){const value=Math.round(p*100);bar.style.width=`${value}%`;bar.parentElement!.setAttribute('aria-valuenow',String(value));}
      const line=document.querySelector('#scene-detail'),controls=playback.event!.eventId===TRUE_ENDING.eventId?(EVENTS.find(e=>e.game.family===family&&e.game.variant===0)?.game.controls??playback.event!.game.controls):playback.event!.game.controls;
      if(line)line.textContent=`${controls}　SCORE ${player?.score??0}`;
    },onComplete:showPlaybackEnd});
    if(activeModal||document.hidden)player.pause(true);
  },reducedMotion()?120:350);
  document.querySelector<HTMLButtonElement>('#start-button')?.focus({preventScroll:true});
}
function showPlaybackEnd(){
  if(!active||playbackComplete)return;playbackComplete=true;returnReadyAt=Date.now()+600;stopHeld();audio.stop();document.querySelector('.console')?.classList.add('is-complete');
  if(active.event&&active.source!=='completion'&&save.discoveredEventIds.includes(active.event.eventId)){save={...save,viewedEventIds:[...new Set([...save.viewedEventIds,active.event.eventId])]};persist();}
  const result=document.querySelector<HTMLElement>('#game-result');if(result){result.hidden=false;document.querySelector('#result-status')!.textContent=active.event?(player?.result?.status==='win'?'CLEAR':player?.result?.status==='lose'?'GAME OVER':player?.result?.status==='time'?'TIME UP':'FINISH'):'NO GAME';document.querySelector('#result-title')!.textContent=active.event?.title??'空振り';document.querySelector('#result-score')!.textContent=active.event?`SCORE ${player?.score??0}`:'TRY ANOTHER COMMAND';}
  document.querySelector('#game-canvas')?.setAttribute('aria-label',active.event?.title??'空振り');
  const status=document.querySelector<HTMLElement>('#reading-status');if(status){status.hidden=false;status.textContent='読み終えたら、矢印・A・Bのどれかで戻る。';}
  const button=document.querySelector<HTMLButtonElement>('#start-button');if(button)button.hidden=true;
  const skip=document.querySelector<HTMLButtonElement>('[data-action="skip"]');if(skip){if(active.event){skip.dataset.action='retry';skip.textContent='↻ もう一度';}else skip.hidden=true;}
}
function finishPlayback(){if(!active)return;const previous=active;active=null;if(previous.source==='command'&&progress(save).complete&&!save.completionSeen){complete();return;}inputs=[];playbackComplete=false;message=previous.isNew?`「${previous.event!.title}」を記録しました。`:previous.event?'次の3つを、試してみよう。':'空振りを記録しました。';renderGame();if(previous.returnModal)openModal(previous.returnModal,false);else document.querySelector<HTMLButtonElement>('[data-symbol="U"]')?.focus({preventScroll:true});}
function complete(){if(!progress(save).complete)return;save={...save,completionSeen:true};persist();begin({event:TRUE_ENDING,isNew:false,source:'completion',command:''});}
function resetDialog(step:number){resetStep=step;const dialog=document.querySelector<HTMLDialogElement>('#confirm-dialog')!;if(!dialog.open)resetFocus=document.activeElement as HTMLElement;document.querySelector('#dialog-title')!.textContent=step===1?'探索の記録を消去しますか？':'本当に、すべて消去しますか？';document.querySelector('#dialog-description')!.textContent=step===1?'図鑑・入力履歴・お気に入り・設定が消えます。先に書き出して保管できます。':'この操作は取り消せません。最初から探し直すことになります。';document.querySelector('#reset-confirm')!.textContent=step===1?'次へ進む':'すべて消去する';if(!dialog.open)dialog.showModal();document.querySelector<HTMLButtonElement>('[data-action="reset-cancel"]')!.focus();}
function closeReset(){document.querySelector<HTMLDialogElement>('#confirm-dialog')!.close();resetStep=0;resetFocus?.focus();}
function modalNotice(text:string){const el=document.querySelector('#modal-notice');if(el)el.textContent=text;else announce(text);}
function exportSave(){const url=URL.createObjectURL(new Blob([JSON.stringify(save,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=`secret-start-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);modalNotice('記録を書き出しました。');}
app.addEventListener('click',e=>{
  const el=(e.target as Element).closest<HTMLElement>('button,a');if(!el)return;audio.unlock();
  if(el.dataset.modal){openModal(el.dataset.modal as Modal);return;}
  if(el.dataset.symbol){if(!e.isTrusted||Date.now()-lastPointerInput>350)input(el.dataset.symbol as InputSymbol);return;}
  if(el.dataset.page&&Object.hasOwn(titles,el.dataset.page)){const kind=el.dataset.page as Modal;if(kind!==activeModal)return;modalPages[kind]+=Number(el.dataset.direction)||0;fillModal();const next=document.querySelector<HTMLButtonElement>(`[data-page="${kind}"][data-direction="${el.dataset.direction}"]:not(:disabled)`);(next??document.querySelector<HTMLButtonElement>(`[data-page="${kind}"]:not(:disabled)`))?.focus();return;}
  if(el.dataset.replay){const event=EVENT_BY_ID.get(el.dataset.replay);if(event&&progress(save).libraryUnlocked&&save.discoveredEventIds.includes(event.eventId))begin({event,isNew:false,source:'library',command:event.command,returnModal:'library'});return;}
  if(el.dataset.favorite){save=toggleFavorite(save,el.dataset.favorite);persist();updateLibrary();document.querySelector<HTMLButtonElement>(`[data-favorite="${el.dataset.favorite}"]`)?.focus();return;}
  if(el.dataset.command){const command=el.dataset.command;if(!progress(save).explorerUnlocked||!COMMANDS.some(c=>c.command===command))return;closeModal(false);history.replaceState(null,'','#home');active=null;inputs=[...command] as InputSymbol[];renderGame();syncInputs();announce(`${displayCommand(command)} をセットしました。`);document.querySelector<HTMLButtonElement>('#start-button')?.focus();return;}
  switch(el.dataset.action){
    case 'close-modal':closeModal();break;
    case 'sound':save.settings.muted=!save.settings.muted;persist();if(save.settings.muted)audio.stop();else audio.unlock();el.innerHTML=icon(save.settings.muted?'muted':'sound');el.setAttribute('aria-label',save.settings.muted?'音をオンにする':'音をオフにする');el.setAttribute('aria-pressed',String(!save.settings.muted));break;
    case 'start':start();break;
    case 'advance':player?.input('START');break;
    case 'skip':player?.reveal();break;
    case 'retry':if(active)begin({...active,isNew:false});break;
    case 'rules':openModal('rules');break;
    case 'delete':case 'clear':if(!active){if(el.dataset.action==='clear')inputs=[];else inputs.pop();audio.play('back');syncInputs();}break;
    case 'completion':complete();break;
    case 'export':exportSave();break;
    case 'import':document.querySelector<HTMLInputElement>('#import-file')?.click();break;
    case 'reset':resetDialog(1);break;
    case 'reset-cancel':closeReset();break;
    case 'reset-confirm':if(resetStep===1){resetDialog(2);break;}if(resetStep===2){closeReset();save=createEmptySave();try{storage?.removeItem(SAVE_KEY);storage?.removeItem(RECOVERY_KEY);}catch{}persist();fillModal();modalNotice('探索の記録を消去しました。');}break;
  }
});
app.addEventListener('pointerdown',e=>{
  const el=(e.target as Element).closest<HTMLElement>('[data-symbol]');
  if(el&&!active){lastPointerInput=0;return;}
  if(!el||!active||activeModal||e.button!==0)return;
  activePointers.add(e.pointerId);
  const session=active,wasComplete=playbackComplete;
  const symbol=el.dataset.symbol as InputSymbol,family=player?.currentFamily??active.event?.game.family??'';
  const repeat=canRepeat(symbol,family);
  e.preventDefault();stopHeld();lastPointerInput=Date.now();input(symbol);
  if(repeat&&!wasComplete&&!playbackComplete&&active===session)heldDelay=setTimeout(()=>{heldTimer=setInterval(()=>{lastPointerInput=Date.now();input(symbol,false);},90);},240);
});
window.addEventListener('pointerup',e=>{if(activePointers.delete(e.pointerId))lastPointerInput=Date.now();stopHeld();});
window.addEventListener('pointercancel',e=>{activePointers.delete(e.pointerId);stopHeld();});
window.addEventListener('blur',stopHeld);
app.addEventListener('input',e=>{const el=e.target as HTMLInputElement;if(el.id==='search'){search=el.value;modalPages.library=0;updateLibrary();}});
app.addEventListener('change',async e=>{
  const el=e.target as HTMLInputElement;
  if(el.dataset.setting){save.settings[el.dataset.setting as keyof SaveData['settings']]=el.checked;persist();if(save.settings.muted)audio.stop();player?.setReducedMotion(reducedMotion());const sound=document.querySelector('[data-action="sound"]');if(sound){sound.innerHTML=icon(save.settings.muted?'muted':'sound');sound.setAttribute('aria-label',save.settings.muted?'音をオンにする':'音をオフにする');sound.setAttribute('aria-pressed',String(!save.settings.muted));}return;}
  if(el.id==='category'){category=el.value;modalPages.library=0;updateLibrary();}
  if(el.id==='favorites-only'){favoritesOnly=el.checked;modalPages.library=0;updateLibrary();}
  if(el.id==='import-file'&&el.files?.[0])try{if(el.files[0].size>1_000_000)throw new Error('size');const raw=JSON.parse(await el.files[0].text());if(!raw||typeof raw!=='object'||Array.isArray(raw)||(raw.schemaVersion!==1&&raw.schemaVersion!==2)||!Array.isArray(raw.discoveredEventIds??raw.discovered))throw new Error('format');save=mergeSaves(save,normalizeSave(raw));persist();fillModal();modalNotice('記録を読み込み、この端末の記録とまとめました。');}catch{modalNotice('SECRET STARTから書き出したJSONファイルを選んでください。');}
});
document.addEventListener('keydown',e=>{if(e.repeat&&(e.key==='Enter'||e.key==='Escape')){e.preventDefault();return;}const target=e.target as HTMLElement;if(document.querySelector('dialog[open]')||target.matches('input,select,textarea')||e.ctrlKey||e.metaKey||e.altKey)return;const keys:Record<string,InputSymbol>={ArrowUp:'U',ArrowDown:'D',ArrowLeft:'L',ArrowRight:'R',a:'A',A:'A',b:'B',B:'B'};if(keys[e.key]){e.preventDefault();if(!e.repeat||active?.event&&canRepeat(keys[e.key],player?.currentFamily??active.event.game.family))input(keys[e.key],!e.repeat);return;}if(e.key==='Enter'&&(target.matches('[data-symbol]')||!target.closest('button,a'))){e.preventDefault();audio.unlock();if(!active)start();else if(playbackComplete){if(Date.now()>=returnReadyAt)finishPlayback();}else player?.input('START');}if(e.key==='Backspace'&&!active){e.preventDefault();inputs.pop();syncInputs();}if(e.key==='Delete'&&!active){e.preventDefault();inputs=[];syncInputs();}if(e.key==='Escape'&&active){e.preventDefault();if(playbackComplete){if(Date.now()>=returnReadyAt)finishPlayback();}else player?.reveal();}});
window.addEventListener('popstate',()=>{const name=location.hash.slice(1) as Modal;if(Object.hasOwn(titles,name))openModal(name,false);else closeModal(false);});
window.addEventListener('storage',e=>{if(e.key!==SAVE_KEY&&e.key!==null)return;if(e.newValue===null){save=createEmptySave();active=null;inputs=[];activeModal=null;renderGame();announce('別のタブで記録が消去されました。');return;}try{save=mergeSaves(save,normalizeSave(JSON.parse(e.newValue)));if(activeModal)fillModal();}catch{}});
window.addEventListener('pagehide',cleanup);
window.addEventListener('pageshow',e=>{if(e.persisted){active=null;activeModal=null;inputs=[];renderGame();}});
document.addEventListener('visibilitychange',()=>{player?.pause(document.hidden||!!activeModal);if(document.hidden)audio.stop();});
motionQuery.addEventListener('change',()=>{player?.setReducedMotion(reducedMotion());document.documentElement.classList.toggle('reduce-motion',reducedMotion());if(!active){titleCleanup?.();titleCleanup=drawTitle(document.querySelector('#game-canvas')!,reducedMotion());}});
function fitViewport(){
  const height=Math.min(innerHeight,window.visualViewport?.height??innerHeight),root=document.documentElement;
  root.style.setProperty('--app-height',`${height}px`);
  root.style.setProperty('--layout-height',`${innerHeight}px`);
  root.style.setProperty('--visual-top',`${window.visualViewport?.offsetTop??0}px`);
  root.classList.toggle('visual-keyboard',height<innerHeight-80);
  if(!activeModal)return;
  if(activeModal==='library'){updateLibrary();return;}
  const focused=document.activeElement as HTMLInputElement,identity=focused?.id,selection=focused?.type==='search'?[focused.selectionStart,focused.selectionEnd] as const:null;
  fillModal();
  const restored=identity?document.getElementById(identity) as HTMLInputElement|null:null;
  restored?.focus({preventScroll:true});if(restored&&selection)restored.setSelectionRange(...selection);
}
window.addEventListener('resize',fitViewport);window.visualViewport?.addEventListener('resize',fitViewport);fitViewport();
if(loaded.migrated)persist();renderGame();const initial=location.hash.slice(1);if(Object.hasOwn(titles,initial))openModal(initial as Modal,false);else if(initial&&initial!=='home')history.replaceState(null,'','#home');
if('serviceWorker'in navigator&&import.meta.env.PROD)window.addEventListener('load',()=>{void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(()=>{});});
