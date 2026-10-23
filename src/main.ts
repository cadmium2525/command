import './ui/styles.css';
import { EVENTS, COMMANDS, EVENT_BY_ID, EVENT_BY_COMMAND, TRUE_ENDING } from './data/catalog';
import { CATEGORY_LABELS, SYMBOLS, SYMBOL_LABELS, displayCommand } from './data/types';
import type { GameEvent, InputSymbol, SaveData } from './data/types';
import { createEmptySave, normalizeSave, recordAttempt, progress, toggleFavorite, mergeSaves } from './core/state';
import { browserStorage, loadSave, persistSave, SAVE_KEY, RECOVERY_KEY } from './core/storage';
import { AudioEngine } from './core/audio';
import { shareUrl } from './core/share';
import { ScenePlayer, drawTitle } from './events/player';

type View = 'home' | 'library' | 'explorer' | 'settings' | 'help' | 'playing';
type Playback = { event: GameEvent | null; isNew: boolean; source: 'command' | 'library' | 'completion'; command: string };
const app = document.querySelector<HTMLDivElement>('#app')!;
const storage = browserStorage();
const loaded = loadSave(storage);
let save = loaded.data;
let warning = loaded.warning;
let view: View = 'home';
let inputs: InputSymbol[] = [];
let message = '';
let active: Playback | null = null;
let player: ScenePlayer | null = null;
let titleCleanup: (() => void) | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let search = '';
let category = 'all';
let favoritesOnly = false;
let resetStep = 0;
let lastFocus: HTMLElement | null = null;
const audio = new AudioEngine();
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const reducedMotion = () => motionQuery.matches || save.settings.reducedMotion;
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]!));
const icon = (kind: string) => {
  const paths: Record<string,string> = {
    sound:'<path d="M11 4 6 8H3v8h3l5 4z"/><path d="M15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',
    muted:'<path d="M11 4 6 8H3v8h3l5 4z"/><path d="m16 9 6 6m0-6-6 6"/>',
    settings:'<path d="m9 3-1 3-3 1-2 4 2 3 1 3 4 2 3-1 3-1 2-4-1-3-1-3-4-1z"/><circle cx="11" cy="11" r="3"/>',
    book:'<path d="M12 5C8 3 5 3 2 4v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-3-1-6-1-10 1zm0 0v15"/>',
    grid:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3"/>',
    back:'<path d="m10 5-7 7 7 7m-7-7h18"/>',
    undo:'<path d="m8 5-6 5 6 5m-6-5h12a6 6 0 0 1 0 12"/>',
    delete:'<path d="M8 5h13v14H8L2 12zm5 4 5 6m0-6-5 6"/>',
    play:'<path d="m7 3 14 9-14 9z"/>',
    help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3v.1"/>',
    x:'<path d="m4 3 16 18H16L1 3zm16 0L4 21"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[kind] || paths.help}</svg>`;
};

function persist() {
  const result = persistSave(storage, save);
  warning = result.warning;
  audio.muted = save.settings.muted;
  document.documentElement.classList.toggle('reduce-motion', reducedMotion());
}
function cleanup() {
  player?.dispose(); player = null;
  titleCleanup?.(); titleCleanup = null;
  if (timer !== null) { clearTimeout(timer); timer = null; }
  audio.stop();
}
function announce(text: string) {
  message = text;
  const el = document.querySelector('#notice');
  if (el) el.textContent = text;
  const warn = document.querySelector('#save-warning');
  if (warn) { warn.textContent = warning || ''; (warn as HTMLElement).hidden = !warning; }
}
function header() {
  return `<header class="site-header"><button class="brand" data-action="home" aria-label="SECRET START タイトルに戻る"><span class="brand-icon" aria-hidden="true">S</span><span>SECRET START</span></button><div class="header-right"><span class="header-caption">タイトル画面に、まだ知らない世界。</span><span class="offline-label"><i class="dot"></i> SOLO EXPLORATION</span><button class="icon-button" data-action="sound" aria-label="${save.settings.muted ? '音をオンにする' : '音をオフにする'}" aria-pressed="${!save.settings.muted}">${icon(save.settings.muted ? 'muted' : 'sound')}</button><button class="icon-button" data-action="settings" aria-label="設定を開く">${icon('settings')}</button></div></header>`;
}
function footer() {
  return '<footer class="footer"><span>© 2026 SECRET START &nbsp; / &nbsp; A LITTLE GAME ABOUT CURIOSITY.</span><span>3 INPUTS. 216 POSSIBILITIES. 173 SECRETS.</span></footer>';
}
function share(className = '') {
  return `<a class="share-link ${className}" href="${esc(shareUrl(save))}" target="_blank" rel="noopener noreferrer" data-share="true">${icon('x')}<span>発見をシェアする</span><span aria-hidden="true">↗</span></a>`;
}
function aside() {
  const p = progress(save);
  const hint = p.complete ? 'すべてのひみつが、あなたのものに。' : p.explorerUnlocked ? '探索一覧がひらきました。まだ見ぬコマンドを探してみよう。' : p.libraryUnlocked ? '図鑑を読み返すと、次のひみつが見えてくるかも。' : `あと${5-p.discovered}個の発見で、ひみつ図鑑がひらきます。`;
  return `<aside class="game-aside" aria-label="探索状況"><section class="progress-panel"><div class="aside-top"><span class="eyebrow">YOUR DISCOVERIES</span><span class="tiny-tag">${p.complete ? 'COMPLETE' : 'IN PROGRESS'}</span></div><div class="progress-count mono">${String(p.discovered).padStart(3,'0')}<small>/ 173</small></div><div class="progress-caption"><span>見つけたひみつ</span><span class="mono">${p.percent}%</span></div><div class="progress-track" role="progressbar" aria-label="発見の進み具合" aria-valuemin="0" aria-valuemax="173" aria-valuenow="${p.discovered}"><span style="width:${p.percent}%"></span></div><div class="discovery-grid" aria-hidden="true">${EVENTS.map(e=>`<i class="discovery-dot ${save.discoveredEventIds.includes(e.eventId)?'found':''}"></i>`).join('')}</div><p class="aside-message">${hint}</p><div class="attempt-stat"><span>入力したコマンド</span><strong class="mono">${String(p.attempted).padStart(3,'0')} / 216</strong></div></section><nav class="side-nav" aria-label="ゲームメニュー"><button class="side-button ${p.libraryUnlocked?'':'locked'}" data-action="library" aria-label="ひみつ図鑑${p.libraryUnlocked?'':' 5発見で解禁'}"><span class="nav-icon">${icon(p.libraryUnlocked?'book':'lock')}</span><span class="nav-text"><strong>ひみつ図鑑</strong><small>${p.libraryUnlocked ? `${p.discovered}個のひみつを記録済み` : '5個の発見でアンロック'}</small></span><span class="arrow">↗</span></button><button class="side-button ${p.explorerUnlocked?'':'locked'}" data-action="explorer" aria-label="探索一覧${p.explorerUnlocked?'':' 87発見で解禁'}"><span class="nav-icon">${icon(p.explorerUnlocked?'grid':'lock')}</span><span class="nav-text"><strong>探索一覧</strong><small>${p.explorerUnlocked ? '216個の入力結果を確認' : '87個の発見でアンロック'}</small></span><span class="arrow">↗</span></button></nav><div class="note"><span class="eyebrow">A SMALL HINT</span><p>上に行きたいときは、上へ。<br>同じボタンを3回押したら、<br>何かが起こるかもしれない。</p></div>${p.complete ? '<p class="complete-badge">✦ 173 / 173 ALL SECRETS FOUND<br><button class="text-link" data-action="completion">真エンディングをもう一度</button></p>' : ''}${p.libraryUnlocked ? share('aside-share') : ''}</aside>`;
}
function speaker() { return `<span class="speaker" aria-hidden="true">${'<i></i>'.repeat(7)}</span>`; }
function slots() { return [0,1,2].map((_,i)=>`<span class="command-slot ${inputs[i]?'':'empty'} ${inputs.length===i?'current':''}">${inputs[i]?SYMBOL_LABELS[inputs[i]]:'·'}</span>`).join(''); }
function controls() {
  return `<div class="command-row"><span class="command-label mono">YOUR COMMAND<br><small><span id="input-count">${inputs.length}</span> / 3 INPUTS</small></span><div id="command-slots" class="slots" role="group" aria-label="コマンド入力 3枠">${slots()}</div><button class="slot-back" data-action="delete" aria-label="1文字戻す">${icon('delete')}</button></div><div class="controller"><div class="dpad" role="group" aria-label="方向ボタン"><button class="key up" data-symbol="U" aria-label="上">↑</button><button class="key left" data-symbol="L" aria-label="左">←</button><i class="dpad-center" aria-hidden="true"></i><button class="key right" data-symbol="R" aria-label="右">→</button><button class="key down" data-symbol="D" aria-label="下">↓</button></div><div class="ab-wrap"><div class="ab-buttons" role="group" aria-label="アクションボタン"><button class="key round-key b" data-symbol="B" aria-label="B">B</button><button class="key round-key" data-symbol="A" aria-label="A">A</button></div><span class="ab-caption mono">FOLLOW YOUR CURIOSITY</span></div></div><div class="start-row"><button class="clear-button" data-action="clear">${icon('undo')}入力をリセット</button><button id="start-button" class="start-button" data-action="start" ${inputs.length!==3?'disabled':''}>${icon('play')}START</button></div>`;
}
function homeContent() {
  return `<section class="intro"><div><div class="eyebrow">AN UNEXPECTED ADVENTURE / NO. 001</div><h1>ひみつを、起動しよう。</h1></div><p>↑ ↓ ← → A B。好きなボタンを3回。<br>STARTの先に、何が待っているだろう。</p></section><div class="game-layout"><div class="game-main"><section class="console" aria-label="SECRET START ゲーム機"><div class="console-top"><span><i class="dot led"></i>SECRET START SYSTEM</span><span class="console-id mono">SS–001</span></div><div class="screen-bezel"><div class="screen"><canvas id="game-canvas" width="320" height="200" role="img" aria-label="星空の下、ひみつの扉があるピクセルアートのタイトル画面"></canvas><div class="title-overlay"><span class="screen-kicker mono">THERE IS ALWAYS ANOTHER WAY</span><div class="screen-title">SECRET<span>START</span></div><span class="screen-subtitle mono">3 INPUTS. A WHOLE NEW WORLD.</span><span class="screen-prompt mono">▸ ENTER YOUR SECRET</span><span class="screen-copyright mono">© 2026 SECRET START</span></div></div></div><div class="screen-status mono"><span>SYSTEM READY<span class="press-hint">/ 3つの入力を待っています</span></span><span class="signal" aria-hidden="true"><i></i><i></i><i></i></span></div>${controls()}<div class="console-bottom mono"><span>CURIOUS MINDS ONLY.</span>${speaker()}</div></section><div class="under-console"><span class="keyboard-hint">キーボード <kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> <kbd>A</kbd><kbd>B</kbd> ＋ <kbd>Enter</kbd> でも遊べます</span><button class="text-link" data-action="help">はじめての方へ ↗</button></div></div>${aside()}</div>`;
}
function playingContent() {
  const a = active!;
  const event = a.event;
  const skipLabel = !event ? 'タイトルに戻る' : a.source==='completion' ? 'スキップ' : !a.isNew && a.source==='command' ? '発見済み・スキップ' : 'スキップ';
  return `<section class="intro"><div><div class="eyebrow">${a.source==='completion'?'ALL SECRETS FOUND':a.source==='library'?'FROM YOUR COLLECTION':'A SECRET IS OPENING'}</div><h1>${event ? esc(event.title) : '……何も起こらない？'}</h1></div><p>${a.source==='completion' ? '173個のひみつを見つけた、あなたへ。' : `<span class="mono">${esc(displayCommand(a.command))}</span> がひらいた世界。`}</p></section><div class="game-layout"><div class="game-main"><section class="console" aria-label="演出再生中"><div class="console-top"><span><i class="dot led"></i>${a.source==='completion'?'TRUE ENDING':event?'SECRET DISCOVERED':'NO SIGNAL'}</span><span class="console-id mono">${event?esc(event.eventId.toUpperCase()):'— — —'}</span></div><div class="screen-bezel"><div class="screen"><canvas id="game-canvas" width="320" height="200" role="img" aria-label="${event?esc(event.title):'静かなタイトル画面'}の演出"></canvas><div class="anticipation" id="anticipation">${reducedMotion()?'OPENING...':'CONNECTING . . .'}</div></div></div><p id="scene-narration" class="scene-narration" aria-live="polite" aria-atomic="true">${event ? a.isNew?'新しいひみつを記録しました。':'ひみつの世界へ、もう一度。' : 'ボタンの音だけが、そっと響いた。'}</p>${event?.category==='minigame'?`<div class="scene-controls" role="group" aria-label="ミニゲーム操作">${SYMBOLS.map(s=>`<button data-game-symbol="${s}" aria-label="${SYMBOL_LABELS[s]}">${SYMBOL_LABELS[s]}</button>`).join('')}</div><p id="scene-detail" class="scene-detail" aria-live="polite"></p>`:''}<div class="play-progress" role="progressbar" aria-label="演出の再生状況" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="play-progress"></span></div><div class="play-meta"><span class="discovery-tag">${event ? a.source==='completion'?'✦ すべてのひみつの、その先へ':a.isNew?'✦ NEW SECRET · 記録済み':a.source==='library'?'↻ 図鑑からリプレイ':'✓ 発見済み · 記録は保存済み' : '空振り · 入力履歴に記録済み'}</span><button class="skip-button" data-action="skip">${skipLabel} ↗</button></div><div class="console-bottom mono"><span>EVERY SECRET HAS A STORY.</span>${speaker()}</div></section></div>${aside()}</div>`;
}
function panelHead(english: string, title: string, description: string) {
  return `<div class="panel-top"><div><div class="eyebrow">${english}</div><h1>${title}</h1><p class="panel-sub">${description}</p></div><button class="back-button" data-action="home">${icon('back')}タイトルへ</button></div>`;
}
function eventCards() {
  const found = EVENTS.filter(e=>save.discoveredEventIds.includes(e.eventId) && (category==='all'||category===e.category) && (!favoritesOnly||save.favoriteEventIds.includes(e.eventId)) && (!search || `${e.title} ${displayCommand(e.command)} ${e.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase())));
  return found.length ? found.map(e=>`<article class="event-card"><span class="event-number">SECRET ${String(EVENTS.indexOf(e)+1).padStart(3,'0')}</span><h2>${esc(e.title)}</h2><div class="event-command">${esc(displayCommand(e.command))}</div><div class="event-meta">${CATEGORY_LABELS[e.category]} · ${e.durationMs/1000}秒${save.viewedEventIds.includes(e.eventId)?' · 再生済み':''}</div><div class="card-actions"><button class="small-button" data-replay="${e.eventId}" aria-label="${esc(e.title)}を再生">▶ もう一度</button><button class="favorite-button ${save.favoriteEventIds.includes(e.eventId)?'selected':''}" data-favorite="${e.eventId}" aria-pressed="${save.favoriteEventIds.includes(e.eventId)}" aria-label="${esc(e.title)}をお気に入り${save.favoriteEventIds.includes(e.eventId)?'から外す':'にする'}">${save.favoriteEventIds.includes(e.eventId)?'★':'☆'}</button></div></article>`).join('') : '<p class="empty-state">この条件のひみつは、まだ記録されていません。</p>';
}
function libraryContent() {
  const p = progress(save);
  if (!p.libraryUnlocked) return lockedContent('ひみつ図鑑', '5個の発見でひらきます。');
  return `<section class="panel">${panelHead('THE SECRET ARCHIVE', 'ひみつ図鑑', `あなたが見つけた、${p.discovered}個の小さな世界。未発見のひみつは、まだ内緒。`)}${p.complete?'<div class="completion-banner"><span>✦ 全173演出を発見しました！ すべてのひみつの、その先へ。</span><button class="small-button" data-action="completion">真エンディングを見る</button></div>':''}<div class="filters"><input class="search-input" id="search" type="search" value="${esc(search)}" placeholder="ひみつの名前・コマンドで検索" aria-label="発見した演出を検索"><select class="filter-select" id="category" aria-label="カテゴリで絞り込む"><option value="all">すべての世界</option>${Object.entries(CATEGORY_LABELS).map(([k,v])=>`<option value="${k}" ${category===k?'selected':''}>${v}</option>`).join('')}</select><label class="filter-check"><input type="checkbox" id="favorites-only" ${favoritesOnly?'checked':''}>★ お気に入り</label>${share()}</div><div id="library-cards" class="library-grid">${eventCards()}</div></section>`;
}
function lockedContent(title: string, explanation: string) { return `<section class="panel">${panelHead('A LITTLE MORE EXPLORING',title,explanation)}<p class="empty-state">${icon('lock')} もう少し、ひみつを探してみよう。</p></section>`; }
function explorerContent() {
  if (!progress(save).explorerUnlocked) return lockedContent('探索一覧','87個の発見でひらきます。');
  return `<section class="panel">${panelHead('216 LITTLE POSSIBILITIES','探索一覧','未入力の先にあるものは、STARTを押してからのお楽しみ。')}<div class="explorer-legend"><span>？ 未入力</span><span>✓ 発見済み</span><span>— 空振り</span><span>コマンドを選ぶと入力欄にセットします。</span></div><div class="explorer-grid">${COMMANDS.map(c=>{
    const attempted = save.attemptedCommands.includes(c.command);
    // Deliberately derive presentation from attempted history before consulting the mapping.
    const discovered = attempted && !!c.eventId && save.discoveredEventIds.includes(c.eventId);
    const status = !attempted?'未入力':discovered?'発見済み':'空振り';
    return `<button class="explorer-cell ${!attempted?'':discovered?'found':'miss'}" data-command="${c.command}" aria-label="${displayCommand(c.command)} ${status} 入力欄にセット">${displayCommand(c.command)}<small>${!attempted?'？':discovered?'✓':'—'} ${status}</small></button>`;
  }).join('')}</div></section>`;
}
function settingsContent() {
  const rows = [
    ['muted','音を消す','小さな電子音も、静かに。最初の操作で音声が有効になります。'],
    ['reducedMotion','アニメーションを控えめに','揺れや点滅、大きな動きを抑えます。端末の設定も尊重します。'],
    ['autoSkip','発見済みの演出を自動スキップ','同じコマンドなら、すぐ次の探索へ。図鑑からは通常どおり再生します。'],
  ] as const;
  return `<section class="panel">${panelHead('MAKE YOURSELF AT HOME','設定','あなたのペースで、ひみつ探し。')}<div class="settings-list">${rows.map(([key,title,desc])=>`<div class="setting-row"><div class="setting-copy"><strong id="${key}-label">${title}</strong><p id="${key}-description">${desc}</p></div><label class="switch"><input type="checkbox" role="switch" data-setting="${key}" aria-labelledby="${key}-label" aria-describedby="${key}-description" ${save.settings[key]?'checked':''}></label></div>`).join('')}<div class="setting-row"><div class="setting-copy"><strong>探索の記録</strong><p>このブラウザに自動保存されます。端末を変えるときは、記録を書き出して持ち運べます。</p></div><span class="mono" style="font-size:13px;white-space:nowrap">${save.discoveredEventIds.length} / 173</span></div><div class="settings-actions"><button class="small-button" data-action="export">記録を書き出す ↓</button><button class="small-button" data-action="import">記録を読み込む ↑</button><input type="file" id="import-file" accept="application/json,.json" hidden><button class="small-button danger" data-action="reset">すべての記録を消去</button></div><p class="settings-footnote">ブラウザのデータ消去やプライベートモードの終了で記録が失われる場合があります。<br>音や画像が読み込めなくても、すべてのひみつを見つけられます。通信・ログイン・課金は必要ありません。</p></div></section>`;
}
function helpContent() {
  return `<section class="panel">${panelHead('A FIELD GUIDE FOR THE CURIOUS','はじめての方へ','このタイトル画面が、ゲームのすべてです。')}<div class="help-content"><div class="help-keys">↑ ↓ ← → A B</div><h2>3回押して、START。</h2><p>6つのボタンから好きなものを3回押して、STARTで確定。同じボタンを続けて押しても大丈夫。1字戻すボタンと入力リセットで、何度でも考え直せます。</p><h2>何が起こるかは、お楽しみ。</h2><p>216通りのコマンドのうち、173通りに固有のひみつが隠れています。空振りも探索の記録になります。ひみつを5個見つけると図鑑が、87個見つけると全コマンドの探索一覧がひらきます。</p><h2>あなたのペースで。</h2><p>長い演出も、いつでもスキップできます。発見は演出が始まる前に記録されるので安心。図鑑から何度でも見返せます。最後のひとつを見つけたとき、特別な扉がひらきます。</p><h2>キーボードでも。</h2><p>矢印キーと A・B を入力し、Enter で START。Backspace で1字戻す、Delete で入力リセット、Escape で演出をスキップできます。ミニゲームでも同じボタンを使います。</p><h2>共有は、気が向いたら。</h2><p>「発見をシェアする」でXの投稿画面がひらきます。投稿するかどうかは、あなたが決められます。ゲームから自動で投稿されることはありません。</p></div></section>`;
}
function render() {
  cleanup();
  audio.muted = save.settings.muted;
  document.documentElement.classList.toggle('reduce-motion', reducedMotion());
  const content = view==='home'?homeContent():view==='playing'&&active?playingContent():view==='library'?libraryContent():view==='explorer'?explorerContent():view==='settings'?settingsContent():helpContent();
  app.innerHTML = `${header()}<div class="status-area"><div id="save-warning" class="save-warning" role="status" ${warning?'':'hidden'}>${esc(warning||'')}</div><div id="notice" class="toast" role="status" aria-live="polite">${esc(message)}</div><div id="input-live" class="screen-reader-only" aria-live="polite" aria-atomic="true"></div></div><main class="page" id="main-content">${content}</main>${footer()}<dialog id="confirm-dialog" aria-labelledby="dialog-title"><h2 id="dialog-title"></h2><p id="dialog-description"></p><div class="dialog-actions"><button class="small-button" data-action="reset-cancel">やめる</button><button class="small-button danger" data-action="reset-confirm" id="reset-confirm"></button></div></dialog>`;
  if (view==='home') titleCleanup = drawTitle(document.querySelector('#game-canvas')!, reducedMotion());
}
function route(viewName: Exclude<View,'playing'>, push = true) {
  if (viewName==='library'&&!progress(save).libraryUnlocked) { announce('ひみつ図鑑は5個の発見でひらきます。'); return; }
  if (viewName==='explorer'&&!progress(save).explorerUnlocked) { announce('探索一覧は87個の発見でひらきます。'); return; }
  active = null; inputs = []; view = viewName;
  if (push && location.hash !== `#${viewName}`) history.pushState({view:viewName},'',`#${viewName}`);
  render();
  document.querySelector<HTMLElement>('main h1')?.setAttribute('tabindex','-1');
  document.querySelector<HTMLElement>('main h1')?.focus({preventScroll:true});
  window.scrollTo({top:0,behavior:'instant'});
}
function syncInputs() {
  document.querySelector('#command-slots')!.innerHTML = slots();
  document.querySelector('#input-count')!.textContent = String(inputs.length);
  document.querySelector<HTMLButtonElement>('#start-button')!.disabled = inputs.length!==3;
  document.querySelector('#input-live')!.textContent = inputs.length ? `入力 ${displayCommand(inputs.join(''))}。${inputs.length} / 3` : '入力を消しました。';
}
function input(symbol: InputSymbol) {
  audio.unlock();
  if (view==='playing') { player?.input(symbol); audio.play('input',SYMBOLS.indexOf(symbol)); return; }
  if (view!=='home'||inputs.length===3) return;
  inputs.push(symbol); audio.play('input',SYMBOLS.indexOf(symbol)); syncInputs();
}
function start() {
  if (view!=='home'||inputs.length!==3) return;
  const command = inputs.join('');
  const result = recordAttempt(save,command);
  save = result.save;
  persist(); // Discovery commits BEFORE anticipation, animation, navigation or skip.
  if (result.event&&!result.isNew&&save.settings.autoSkip) {
    inputs = []; audio.play('back'); render(); announce('発見済みの演出を自動スキップしました。'); return;
  }
  begin({ event:result.event||null, isNew:result.isNew, source:'command',command });
}
function begin(playback: Playback) {
  inputs = []; active = playback; view='playing'; message='';
  render(); audio.play('start');
  const heading=document.querySelector<HTMLElement>('main h1');
  heading?.setAttribute('tabindex','-1'); heading?.focus({preventScroll:true});
  const token = active;
  timer = setTimeout(()=>{
    timer = null;
    if (active!==token) return;
    document.querySelector('#anticipation')?.remove();
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
    if (!playback.event) {
      titleCleanup = drawTitle(canvas,true); audio.play('miss');
      timer = setTimeout(()=>finishPlayback(false),1400);
      return;
    }
    if (playback.isNew) audio.play('new');
    player = new ScenePlayer(canvas,playback.event,{
      reducedMotion:reducedMotion(),
      onBeat:(beat)=>{ const el=document.querySelector('#scene-narration'); if(el) el.textContent=beat.text; },
      onProgress:(p,detail)=>{
        const bar=document.querySelector<HTMLElement>('#play-progress');
        if(bar) { const percent=Math.min(100,Math.max(0,p*100)); bar.style.width=`${percent}%`; bar.parentElement!.setAttribute('aria-valuenow',String(Math.round(percent))); }
        const el=document.querySelector('#scene-detail'); if(el&&el.textContent!==detail) el.textContent=detail;
      },
      onComplete:()=>{
        if(playback.event?.category==='minigame') timer=setTimeout(()=>finishPlayback(true),1200);
        else finishPlayback(true);
      },
    });
  },reducedMotion()?150:450);
}
function finishPlayback(completed: boolean) {
  if (!active) return;
  const previous = active;
  active = null;
  if (completed&&previous.event&&previous.source!=='completion') {
    save = {...save, viewedEventIds:[...new Set([...save.viewedEventIds,previous.event.eventId])]};
    persist();
  }
  if (progress(save).complete&&!save.completionSeen&&previous.source!=='completion') { complete(); return; }
  view=previous.source==='library'?'library':'home';
  inputs=[];
  message=previous.source==='completion'?'すべてのひみつを見つけてくれて、ありがとう。図鑑と探索一覧はいつでも楽しめます。':previous.isNew?`✦「${previous.event!.title}」を図鑑に記録。${save.discoveredEventIds.length} / 173 発見。${save.discoveredEventIds.length===5?'ひみつ図鑑がひらきました！':save.discoveredEventIds.length===87?'探索一覧がひらきました！':''}`:previous.event?'記録済みのひみつでした。次の世界を探してみよう。':'空振りを記録しました。次の3つを、試してみよう。';
  render();
  const returnFocus=document.querySelector<HTMLElement>(view==='library'?'main h1':'[data-symbol="U"]');
  if(view==='library')returnFocus?.setAttribute('tabindex','-1');
  returnFocus?.focus({preventScroll:true});
}
function complete() {
  if (!progress(save).complete) return;
  save={...save,completionSeen:true}; persist();
  begin({event:TRUE_ENDING,isNew:false,source:'completion',command:''});
}
function resetDialog(step: number) {
  resetStep=step;
  const dialog=document.querySelector<HTMLDialogElement>('#confirm-dialog')!;
  if(!dialog.open) lastFocus=document.activeElement as HTMLElement;
  document.querySelector('#dialog-title')!.textContent=step===1?'探索の記録を消去しますか？':'本当に、すべて消去しますか？';
  document.querySelector('#dialog-description')!.textContent=step===1?'ひみつ図鑑・入力履歴・お気に入り・設定が消えます。先に記録を書き出して保管できます。':'この操作は取り消せません。173個のひみつを、最初から探し直すことになります。';
  document.querySelector('#reset-confirm')!.textContent=step===1?'次へ進む':'すべて消去する';
  if(!dialog.open) dialog.showModal();
  document.querySelector<HTMLButtonElement>('[data-action="reset-cancel"]')!.focus();
}
function closeReset() { document.querySelector<HTMLDialogElement>('#confirm-dialog')!.close(); resetStep=0; lastFocus?.focus(); }
function exportSave() {
  const blob=new Blob([JSON.stringify(save,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob); const anchor=document.createElement('a'); anchor.href=url; anchor.download=`secret-start-${new Date().toISOString().slice(0,10)}.json`; anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000); announce('探索の記録を書き出しました。大切に保管してください。');
}

app.addEventListener('click',e=>{
  const el=(e.target as Element).closest<HTMLElement>('button,a'); if(!el) return;
  audio.unlock();
  if(el.dataset.symbol) { input(el.dataset.symbol as InputSymbol); return; }
  if(el.dataset.gameSymbol) { input(el.dataset.gameSymbol as InputSymbol); return; }
  if(el.dataset.replay) { const event=EVENT_BY_ID.get(el.dataset.replay); if(event&&save.discoveredEventIds.includes(event.eventId)) begin({event,isNew:false,source:'library',command:event.command}); return; }
  if(el.dataset.favorite) {
    save=toggleFavorite(save,el.dataset.favorite); persist();
    document.querySelector('#library-cards')!.innerHTML=eventCards();
    document.querySelector<HTMLButtonElement>(`[data-favorite="${el.dataset.favorite}"]`)?.focus(); return;
  }
  if(el.dataset.command) { const command=el.dataset.command; route('home'); inputs=[...command] as InputSymbol[]; syncInputs(); announce(`${displayCommand(command)} をセットしました。STARTで確定します。`); document.querySelector<HTMLButtonElement>('#start-button')?.focus(); return; }
  const action=el.dataset.action;
  if(action==='home'||action==='library'||action==='explorer'||action==='settings'||action==='help') { route(action); return; }
  if(action==='sound') { save.settings.muted=!save.settings.muted; persist(); if(save.settings.muted)audio.stop(); else {audio.unlock();audio.play('input');} el.innerHTML=icon(save.settings.muted?'muted':'sound'); el.setAttribute('aria-label',save.settings.muted?'音をオンにする':'音をオフにする'); el.setAttribute('aria-pressed',String(!save.settings.muted)); const check=document.querySelector<HTMLInputElement>('[data-setting="muted"]'); if(check)check.checked=save.settings.muted; return; }
  if(action==='start') { start(); return; }
  if(action==='skip') { finishPlayback(false); return; }
  if((action==='delete'||action==='clear')&&view==='home') { if(action==='clear')inputs=[];else inputs.pop(); audio.play('back'); syncInputs(); return; }
  if(action==='completion') { complete(); return; }
  if(action==='export') { exportSave(); return; }
  if(action==='import') { document.querySelector<HTMLInputElement>('#import-file')!.click(); return; }
  if(action==='reset') { resetDialog(1); return; }
  if(action==='reset-cancel') { closeReset(); return; }
  if(action==='reset-confirm') {
    if(resetStep===1) {resetDialog(2);return;}
    if(resetStep===2) {
      closeReset(); save=createEmptySave();
      // Removal is an explicit cross-tab reset signal; following writes cannot union old discoveries back in.
      try{storage?.removeItem(SAVE_KEY);storage?.removeItem(RECOVERY_KEY);}catch{ /* persist reports unavailability below. */ }
      persist();inputs=[];message='探索の記録を消去しました。新しいひみつ探しを始めよう。';render();
    }return;
  }
});
app.addEventListener('input',e=>{
  const el=e.target as HTMLInputElement;
  if(el.id==='search') {search=el.value;document.querySelector('#library-cards')!.innerHTML=eventCards();}
});
app.addEventListener('change',async e=>{
  const el=e.target as HTMLInputElement;
  if(el.dataset.setting) {
    save.settings[el.dataset.setting as keyof SaveData['settings']]=el.checked;persist();
    if(save.settings.muted)audio.stop();
    const button=document.querySelector<HTMLElement>('[data-action="sound"]');
    if(button){button.innerHTML=icon(save.settings.muted?'muted':'sound');button.setAttribute('aria-label',save.settings.muted?'音をオンにする':'音をオフにする');button.setAttribute('aria-pressed',String(!save.settings.muted));}
    return;
  }
  if(el.id==='category') {category=el.value;document.querySelector('#library-cards')!.innerHTML=eventCards();}
  if(el.id==='favorites-only') {favoritesOnly=el.checked;document.querySelector('#library-cards')!.innerHTML=eventCards();}
  if(el.id==='import-file'&&el.files?.[0]) {
    try {
      if(el.files[0].size>1_000_000)throw new Error('size');
      const raw=JSON.parse(await el.files[0].text());
      if(!raw||typeof raw!=='object'||Array.isArray(raw)||(raw.schemaVersion!==1&&raw.schemaVersion!==2)||!Array.isArray(raw.discoveredEventIds??raw.discovered))throw new Error('format');
      save=mergeSaves(save,normalizeSave(raw));persist();render();announce('記録を読み込み、この端末の探索記録とまとめました。');
    }catch{announce('記録を読み込めませんでした。SECRET START から書き出したJSONファイルを選んでください。');}
  }
});
document.addEventListener('keydown',e=>{
  const target=e.target as HTMLElement;
  if(document.querySelector<HTMLDialogElement>('#confirm-dialog')?.open||target.matches('input,select,textarea')||e.ctrlKey||e.metaKey||e.altKey)return;
  const keys: Record<string,InputSymbol>={ArrowUp:'U',ArrowDown:'D',ArrowLeft:'L',ArrowRight:'R',a:'A',A:'A',b:'B',B:'B'};
  const symbol=keys[e.key];
  if(symbol&&(view==='home'||view==='playing')) {e.preventDefault();if(!e.repeat)input(symbol);return;}
  if(e.key==='Enter'&&(target.matches('[data-symbol],[data-game-symbol]')||!target.closest('button,a'))&&(view==='home'||view==='playing')) {e.preventDefault();audio.unlock();if(view==='home')start();else player?.input('START');}
  if(e.key==='Backspace'&&view==='home') {e.preventDefault();inputs.pop();syncInputs();audio.play('back');}
  if(e.key==='Delete'&&view==='home') {e.preventDefault();inputs=[];syncInputs();}
  if(e.key==='Escape'&&view==='playing') {e.preventDefault();finishPlayback(false);}
});
window.addEventListener('popstate',()=>{
  const hash=location.hash.slice(1);
  const next: Exclude<View,'playing'>=['library','explorer','settings','help'].includes(hash)?hash as Exclude<View,'playing'>:'home';
  if((next==='library'&&!progress(save).libraryUnlocked)||(next==='explorer'&&!progress(save).explorerUnlocked)){route('home',false);return;}
  route(next,false);
});
window.addEventListener('storage',e=>{
  if(e.key!==SAVE_KEY&&e.key!==null)return;
  if(e.newValue===null){save=createEmptySave();active=null;inputs=[];view='home';render();announce('別のタブで探索の記録が消去されました。');return;}
  try { const incoming=normalizeSave(JSON.parse(e.newValue)); save=mergeSaves(save,incoming); if(view!=='playing')render(); }catch{ /* Keep intact in-memory progress. */ }
});
window.addEventListener('pagehide',()=>{cleanup();audio.stop();});
window.addEventListener('pageshow',e=>{if(e.persisted){active=null;view='home';inputs=[];render();}});
document.addEventListener('visibilitychange',()=>{player?.pause(document.hidden);if(document.hidden)audio.stop();});
motionQuery.addEventListener('change',()=>{player?.setReducedMotion(reducedMotion());if(view==='home')render();document.documentElement.classList.toggle('reduce-motion',reducedMotion());});
audio.muted=save.settings.muted;
if(loaded.migrated)persist();
const initial=location.hash.slice(1);
if(['library','explorer','settings','help'].includes(initial))view=initial as View;
if((view==='library'&&!progress(save).libraryUnlocked)||(view==='explorer'&&!progress(save).explorerUnlocked))view='home';
render();
if('serviceWorker'in navigator&&import.meta.env.PROD)window.addEventListener('load',()=>{void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(()=>{});});
