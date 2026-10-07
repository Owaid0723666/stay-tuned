// 游戏本体：一台老电视、五个频道、一串按顺序来的通告。
(() => {
'use strict';
const W = 640, H = 480;
const cv = document.getElementById('screen'), g = cv.getContext('2d');
const $ = id => document.getElementById(id);
const q = new URLSearchParams(location.search);
let lang = q.get('lang') || ((navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en');
if (!TEXT[lang]) lang = 'en';
let T = TEXT[lang];
const font = () => lang === 'zh' ? '"SimHei","Microsoft YaHei","PingFang SC","Heiti SC",sans-serif' : '"Courier New",Courier,monospace';

// ---------- 手机：横着玩。竖着拿的时候把整个画面转 90 度，量好长边短边交给样式去排 ----------
const root = document.documentElement;
const phone = q.has('m') || (matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) <= 540);
function fit() {
  const w = innerWidth, h = innerHeight, port = h > w;
  root.classList.toggle('port', port);
  root.style.setProperty('--vw', (port ? h : w) + 'px'); root.style.setProperty('--vh', (port ? w : h) + 'px');
}
if (phone) { root.classList.add('phone'); fit(); addEventListener('resize', fit); }
document.addEventListener('visibilitychange', () => Snd.pause(document.hidden));

// ---------- 图片：哪张没下下来，那个画面就显示「信号中断」，游戏照常能玩 ----------
const IMG = {}, NAMES = ['road', 'house', 'room', 'profile', 'stare', 'manq', 'face'];
let pending = NAMES.length, isReady = false;
for (const n of NAMES) {
  const im = new Image();
  im.onload = () => { IMG[n] = im; if (--pending <= 0) ready(); };
  im.onerror = () => { if (--pending <= 0) ready(); };
  im.src = 'img/' + n + '.jpg';
}
setTimeout(ready, 4000);

// ---------- 状态 ----------
const fresh = () => ({
  on: false, t: 0, ch: 2, power: true, powT: 9, muted: false, strikes: 0, step: 0, st: 0, f: {},
  on5: 0, sw: 0, osd: 0, glitch: 0, inv: false, flash: 0, note: null, corrupt: 0, got: 0,
  ack: false, ackN: 0, msgStr: null, msgT: 0, dawn: false, beat: 0, ni: 0, end: null, endT: 0, shown: false,
});
let S = fresh();
const cur = () => STEPS[S.step];
// 条件连续成立 need 秒才算数，免得路过一下就判过
function stay(s, dt, cond, need) { s.f.h = cond && s.power ? (s.f.h || 0) + dt : 0; return s.f.h > need; }

// ---------- 一关一关的通告。n 是通告编号；没有 n 的是冒充的，照做就完蛋 ----------
// tick 返回 'ok' 过关、'fail' 记一次违规、'taken' 直接被带走、'next' 只是往下走、'end' 天亮
const STEPS = [
  { id: 'free', tick: s => s.st > 26 && 'next' },
  { id: 'intro', full: true, enter() { Snd.alert(4.5); }, tick: s => s.st > 16 && 'next' },
  { id: 'go3', n: 1, msg: () => T.m.go3,
    tick(s, dt) { if (stay(s, dt, s.ch === 3, .6)) return 'ok'; if (s.st > 12) return 'fail'; } },
  { id: 'mute', n: 2, msg: s => s.st > 6 ? T.m.muteNow : T.m.mute,
    tick(s, dt) {
      if (s.st < 6) return;
      if (!s.f.toned) { s.f.toned = true; Snd.alert(8); }
      if (s.power && s.muted) s.f.mt = (s.f.mt || 0) + dt;
      if (s.power && !s.muted) { s.f.bad = (s.f.bad || 0) + dt; if (s.f.bad > 1.6) { Snd.alert(0); return 'fail'; } }
      if (s.st >= 14) return 'ok';
    } },
  { id: 'avoid5', n: 3, msg: () => T.m.avoid5, enter(s) { s.f.slip = true; s.corrupt = 1; },
    tick(s, dt) { if (stay(s, dt, s.ch === 4, .8)) return 'ok'; if (s.st > 18) return 'fail'; } },
  { id: 'eyes', n: 4, msg: () => T.m.eyes, enter(s) { s.f.seq = 0; s.f.look = 13 + Math.random() * 4; },
    tick(s, dt) {
      const on4 = s.power && s.ch === 4;
      if (s.f.seq < s.f.look) {
        if (on4) { s.f.seq += dt; if (s.f.seq >= s.f.look) Snd.sting(); }
        else { s.f.away = (s.f.away || 0) + dt; if (s.f.away > 8) return 'fail'; }
        return;
      }
      if (!on4) return 'ok';
      s.f.lookT = (s.f.lookT || 0) + dt;
      if (s.f.lookT > 2.8) { s.flash = .35; return 'fail'; }
    } },
  { id: 'power', n: 5, msg: () => T.m.power,
    tick(s, dt) {
      if (!s.f.gone) {
        if (s.power) s.f.seen = true;
        else if (s.f.seen) { s.f.gone = true; s.f.offT = 0; }
        if (!s.f.gone) return s.st > 10 ? 'fail' : undefined;
      }
      if (s.power) return s.f.offT >= 8.5 ? 'ok' : 'fail';
      const k = Math.floor(s.f.offT); s.f.offT += dt;
      if (Math.floor(s.f.offT) > k) Snd.tick();
      if (s.f.offT > 15) { s.power = true; s.powT = 0; return 'fail'; }
    } },
  { id: 'fake5', msg: s => T.m.fake5[s.st < 5 ? 0 : s.st < 11 ? 1 : 2], enter(s) { s.corrupt = 2; s.on5 = -2; },
    tick: s => s.st > 18 && 'ok' },
  { id: 'fakeoff', msg: s => T.m.fakeoff[s.st < 6 ? 0 : 1],
    tick(s, dt) {
      if (s.power) s.f.seen = true;
      else if (s.f.seen) { s.f.offT = (s.f.offT || 0) + dt; if (s.f.offT > 1.8) return 'taken'; }
      if (s.st > 14) return 'ok';
    } },
  { id: 'dawn', n: 6, msg: s => s.st < 6 ? T.m.dawn : null, enter(s) { s.corrupt = 0; },
    tick(s) {
      if (s.st > 6 && !s.dawn) { s.dawn = true; s.ch = 3; s.power = true; s.muted = false; s.sw = .3; }
      if (s.st > 16) return 'end';
    } },
];

function advance(r) {
  const s = S, c = cur();
  if (r === 'taken') return finish('taken', 'fake');
  if (r === 'end') return finish('dawn');
  if (r === 'fail') { strike(); if (s.end) return; }
  s.ack = r === 'ok' && !!c.n; s.ackN = c.n;
  s.step++; s.f = {};
  const nx = cur();
  s.st = nx.msg ? -1.8 : 0;   // 两条通告之间空一小会儿
  if (nx.n) s.got = nx.n;
  if (nx.enter) nx.enter(s);
}
function strike() {
  const s = S;
  s.strikes++; s.glitch = .8; s.inv = true; s.note = { text: T.strike(s.strikes), t: 3.2 }; Snd.knock();
  if (s.strikes >= 3) finish('taken', 'strikes');
}
function finish(kind, why) {
  S.end = { kind, why }; S.endT = 0; Snd.alert(0);
  if (kind === 'taken') Snd.scare();
  syncAudio();
}
function showEnd() {
  const e = S.end; S.shown = true;
  $('eTitle').textContent = e.kind === 'dawn' ? T.endDawn : T.endTaken;
  $('eWhy').textContent = e.kind === 'dawn' ? T.whyDawn : e.why === 'fake' ? T.whyFake : T.whyStrikes;
  $('eReached').textContent = T.reached(S.got);
  $('end').hidden = false;
}

// ---------- 每一帧往前走一点 ----------
function tick(dt) {
  const s = S;
  if (!s.on) return;
  if (s.end) { s.endT += dt; if (!s.shown && s.endT > (s.end.kind === 'taken' ? 2.8 : 2.2)) showEnd(); return; }
  s.t += dt; s.st += dt; s.powT += dt; s.msgT += dt;
  s.sw = Math.max(0, s.sw - dt); s.osd = Math.max(0, s.osd - dt); s.glitch = Math.max(0, s.glitch - dt); s.flash = Math.max(0, s.flash - dt);
  if (s.note && (s.note.t -= dt) <= 0) s.note = null;

  // 「别看 5 频道」这条从第 3 号通告起一直算数；刚发通告那几秒留给人读
  const rule5 = s.corrupt >= 1 && !(cur().id === 'avoid5' && s.st < 4);
  if (rule5 && s.power && s.ch === 5) {
    s.on5 += dt;
    if (s.corrupt === 2 && s.on5 > 1.2) return finish('taken', 'fake');
    if (s.corrupt === 1 && s.on5 > 3.2) { s.on5 = 0; s.ch = 3; s.sw = .3; strike(); if (s.end) return; }
  } else s.on5 = 0;

  if (s.st >= 0) { s.ack = false; const r = cur().tick(s, dt); if (r) advance(r); }
  if (s.end) return;
  const m = s.st >= 0 && cur().msg ? cur().msg(s) : null;
  if (m !== s.msgStr) { s.msgStr = m; s.msgT = 0; }
  music(dt);
}

const TUNE = [262, 330, 392, 494, 440, 392, 330, 294];
function music(dt) {
  const s = S;
  const playing = s.power && !cur().full && s.sw <= 0 && (s.ch === 3 || s.ch === 6) && !(s.dawn && s.st > 12);
  s.beat -= dt;
  if (playing && s.beat <= 0) {
    s.beat = s.corrupt === 2 ? .52 : .36;
    Snd.note(TUNE[s.ni++ % 8] * (s.corrupt === 2 ? .84 + Math.random() * .04 : s.corrupt === 1 ? .944 : 1));
  }
  syncAudio();
}
function syncAudio() {
  const s = S, c = cur(), live = s.on && !s.end && s.power, picOn = live && !c.full && s.sw <= 0;
  Snd.tvGate(live && !s.muted);
  Snd.level('hum', live ? .04 : 0);
  Snd.level('static', !live ? 0 : s.sw > 0 ? .3 : picOn && s.ch === 5 ? .2 : picOn && s.ch === 4 ? .025 : .01);
  Snd.level('bars', picOn && s.ch === 2 ? .03 : 0);
  const near = c.id === 'power' && s.f.gone ? Math.min(1, s.f.offT / 14) * .16 : 0;
  Snd.level('drone', s.end || !s.on ? 0 : Math.min(.3, s.strikes * .06 + (s.corrupt === 2 ? .12 : 0) + near));
}

// ---------- 遥控 ----------
function chan(d) {
  const s = S; if (!s.on || s.end || !s.power || s.dawn) return;
  let c = s.ch + d; if (c > 6) c = 2; if (c < 2) c = 6;
  if (s.f.slip && d > 0 && s.ch === 3) { c = 5; s.f.slip = false; }   // 旋钮打滑：想去 4，落在了 5
  s.ch = c; s.sw = .24; s.osd = 2.5; Snd.click();
}
function power() { const s = S; if (!s.on || s.end || s.dawn) return; s.power = !s.power; s.powT = 0; Snd.thunk(); }
function mute() { const s = S; if (!s.on || s.end || s.dawn || !s.power) return; s.muted = !s.muted; s.osd = 2.5; }
addEventListener('keydown', e => {
  if (!S.on || S.end || e.repeat) return;
  const k = e.key;
  if (k === 'ArrowUp' || k === 'ArrowRight') chan(1);
  else if (k === 'ArrowDown' || k === 'ArrowLeft') chan(-1);
  else if (k === 'm' || k === 'M') mute();
  else if (k === ' ' || k === 'p' || k === 'P') power();
  else return;
  e.preventDefault();
});
const tap = (id, fn) => $(id).addEventListener('click', e => { Snd.pause(false); fn(); e.currentTarget.blur(); });
tap('bUp', () => chan(1)); tap('bDown', () => chan(-1)); tap('bMute', mute); tap('bPower', power);
tap('bStart', start); tap('bAgain', start);
tap('bLang', () => { lang = lang === 'zh' ? 'en' : 'zh'; applyLang(); });

function applyLang() {
  T = TEXT[lang]; root.lang = lang;
  $('tTitle').textContent = T.title; $('tSub').textContent = T.sub; $('tTurn').textContent = T.turn; $('tWarn').textContent = phone ? T.warnPhone : T.warn;
  $('bLang').textContent = T.lang; $('bStart').textContent = isReady ? T.start : T.loading; $('keys').textContent = T.keys;
  $('bUp').textContent = T.bUp; $('bDown').textContent = T.bDown; $('bMute').textContent = T.bMute;
  $('bPower').textContent = T.bPower; $('bAgain').textContent = T.again;
}
function start() {
  try { Snd.init(); } catch (e) { /* 没声音也能玩 */ }
  // 安卓手机顺手全屏并锁成横屏；苹果手机不让，就靠上面那套转 90 度
  if (phone) try { root.requestFullscreen().then(() => screen.orientation.lock('landscape')).catch(() => {}); } catch (e) { /* 照常玩 */ }
  S = fresh(); S.on = true; S.powT = 0;
  $('menu').hidden = true; $('end').hidden = true;
}
function ready() {
  if (isReady) return;
  isReady = true; $('bStart').disabled = false; applyLang();
  // 给做游戏的人跳关用：?dbg=关名,频道,快进几秒,第几秒按电源,已违规几次
  const dbg = q.get('dbg');
  if (!dbg) return;
  const [id, ch, ff, offAt, st] = dbg.split(',');
  start();
  S.step = Math.max(0, STEPS.findIndex(x => x.id === id)); S.corrupt = S.step >= 4 ? 1 : 0; S.strikes = +st || 0;
  if (cur().n) S.got = cur().n;
  if (cur().enter) cur().enter(S);
  if (ch) S.ch = +ch;
  for (let t = 0; t < (+ff || 0); t += .05) { if (offAt && Math.abs(t - offAt) < .025) power(); tick(.05); }
}

// ---------- 画画用的零件 ----------
function vt(str, x, y, size, col = '#f1eee4', align = 'left') {
  g.font = `bold ${size}px ${font()}`; g.textAlign = align; g.textBaseline = 'alphabetic';
  g.fillStyle = 'rgba(255,40,60,.5)'; g.fillText(str, x - 1.5, y);
  g.fillStyle = 'rgba(40,220,255,.5)'; g.fillText(str, x + 1.5, y);
  g.fillStyle = col; g.fillText(str, x, y);
}
function wrap(str, maxW, size) {
  g.font = `bold ${size}px ${font()}`;
  const toks = str.match(/[⺀-￯]|[^\s⺀-￯]+|\s+/g) || [], lines = [];
  let line = '';
  for (const tk of toks) {
    if (line.trim() && !/^[。，、！？：）」]$/.test(tk) && g.measureText(line + tk).width > maxW) { lines.push(line.trimEnd()); line = tk.trim() ? tk : ''; }
    else line += tk;
  }
  if (line.trim()) lines.push(line);
  return lines;
}
// 一段会自动换行的字；shown 是已经打出来的字数，用来做逐字出现
function para(str, x, y, maxW, size, lh, col, shown = 1e9) {
  for (const ln of wrap(str, maxW, size)) {
    if (shown <= 0) break;
    vt(ln.slice(0, shown), x, y, size, col); shown -= ln.length; y += lh;
  }
  return y;
}
const NZ = [0, 1, 2, 3].map(() => {
  const c = document.createElement('canvas'); c.width = 320; c.height = 240;
  const x = c.getContext('2d'), d = x.createImageData(320, 240);
  for (let i = 0; i < d.data.length; i += 4) { d.data[i] = d.data[i + 1] = d.data[i + 2] = Math.random() * 255 | 0; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0); return c;
});
function snow(a) {
  g.globalAlpha = a; g.imageSmoothingEnabled = false;
  g.drawImage(NZ[Math.random() * 4 | 0], -(Math.random() * 40 | 0), -(Math.random() * 30 | 0), W + 40, H + 30);
  g.imageSmoothingEnabled = true; g.globalAlpha = 1;
}
function invert() { g.globalCompositeOperation = 'difference'; g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
function pic(name, z = 1) {
  const im = IMG[name];
  if (!im) { snow(1); vt(T.noSignal, W / 2, H / 2, 24, '#fff', 'center'); return false; }
  const w = W * z, h = H * z; g.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
  g.fillStyle = 'rgba(8,14,26,.18)'; g.fillRect(0, 0, W, H);
  return true;
}
// 一个人形的黑影，(x, y) 是脚底正中
function figure(x, y, sc, a, col, eyes = 0) {
  g.save(); g.translate(x, y); g.scale(sc, sc); g.globalAlpha = a; g.fillStyle = col;
  g.beginPath(); g.ellipse(0, -150, 25, 34, 0, 0, 7); g.fill();
  g.beginPath(); g.moveTo(-13, -122); g.lineTo(13, -122); g.quadraticCurveTo(20, -104, 60, -96); g.quadraticCurveTo(80, -90, 84, 0);
  g.lineTo(-84, 0); g.quadraticCurveTo(-80, -90, -60, -96); g.quadraticCurveTo(-20, -104, -13, -122); g.fill();
  if (eyes) { g.globalAlpha = a * eyes; g.fillStyle = '#fff'; g.fillRect(-11, -155, 3, 3); g.fillRect(8, -155, 3, 3); }
  g.restore();
}
const clock = () => {
  if (S.dawn) return '05:58';
  const t = 2 * 3600 + 47 * 60 + S.t | 0, p = n => String(n | 0).padStart(2, '0');
  return `${p(t / 3600)}:${p(t / 60 % 60)}:${p(t % 60)}`;
};

// ---------- 五个频道 ----------
const CH = {
  // 2 频道：收台后的彩条
  2() {
    ['#b4b4b4', '#b4b414', '#14b4b4', '#14b414', '#b414b4', '#b41414', '#1414b4'].forEach((c, i) => { g.fillStyle = c; g.fillRect(i * W / 7, 0, W / 7 + 1, H); });
    g.fillStyle = '#0a0a0a'; g.fillRect(110, 84, 420, 156);
    vt(T.st + ' · 2', W / 2, 126, 26, '#fff', 'center');
    vt(S.corrupt === 2 ? T.ch2bad : T.ch2a, W / 2, 162, 18, '#fff', 'center');
    vt(T.ch2b, W / 2, 190, 16, '#b9b9b9', 'center');
    vt(clock(), W / 2, 224, 18, '#ffb000', 'center');
  },
  // 3 频道：天气
  3() {
    const s = S, gr = g.createLinearGradient(0, 0, 0, H);
    if (s.dawn) {
      gr.addColorStop(0, '#1d3a66'); gr.addColorStop(.7, '#b9773f'); gr.addColorStop(1, '#e8b25a'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      vt(T.wxDawnTitle, 40, 62, 28, '#fff'); vt(clock(), W - 40, 62, 20, '#fff', 'right');
      vt(T.wxDawn1, W / 2, 220, 44, '#fff', 'center');
      if (s.st > 12) vt(T.wxDawn2, W / 2, 300, 28, '#fff', 'center');
      return;
    }
    gr.addColorStop(0, '#0d2150'); gr.addColorStop(1, '#050c22'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    vt(T.wxTitle, 40, 62, 28, '#fff'); vt(clock(), W - 40, 62, 20, '#ffb000', 'right');
    for (let i = 0; i < 4; i++) {
      const y = 126 + i * 52, home = i === 3 && s.corrupt >= 1, col = home ? '#ffb4a8' : '#e8ecf5';
      g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(40, y + 16, W - 80, 1);
      vt(home ? T.wxHome : T.towns[i], 56, y, 22, col);
      g.fillStyle = '#dfe6f5';
      if (i === 1) { g.beginPath(); g.arc(380, y - 8, 11, 0, 7); g.fill(); g.fillStyle = '#0b1b46'; g.beginPath(); g.arc(386, y - 11, 10, 0, 7); g.fill(); }
      else for (let k = 0; k < 3; k++) g.fillRect(364 + k * 4, y - 16 + k * 8, 28, 3);
      vt(home ? T.homeT[s.corrupt - 1] : T.temps[i], W - 56, y, 22, col, 'right');
    }
    const crawl = s.corrupt >= 1 ? T.wxCrawlBad : T.wxCrawl;
    if (!s.msgStr && s.st >= 0) {   // 底下有通告框的时候，滚动字幕让位
      g.fillStyle = '#a8231a'; g.fillRect(0, H - 64, W, 34);
      g.font = `bold 18px ${font()}`;
      vt(crawl, W - (s.t * 80) % (g.measureText(crawl).width + W), H - 40, 18, '#fff');
    }
    // 只有照做关了声音的人，才看得到这一行
    if (cur().id === 'mute' && s.f.mt > 2) vt(T.wxMuteHint, W / 2, 94, 15, `rgba(255,255,255,${Math.min(.8, (s.f.mt - 2) / 3)})`, 'center');
  },
  // 4 频道：深夜影院，一张张旧照片
  4() {
    const s = S, c = cur(); let name, cap, z;
    if (c.id === 'eyes' && s.st >= 0) {
      const k = s.f.seq;
      if (k >= s.f.look) { name = 'stare'; cap = T.mv[4]; z = 1.02 + (s.f.lookT || 0) * .16; }
      else if (k >= 8) { name = 'profile'; cap = T.mv[3]; z = 1.02 + (k - 8) * .012; }
      else { const i = k / 4 | 0; name = ['road', 'house'][i]; cap = T.mv[i]; z = 1.04 + (k % 4) * .012; }
    } else if (s.corrupt === 2) { name = 'room'; cap = T.mvBad; z = 1.08; }
    else { const i = (s.t / 6 | 0) % 3; name = ['road', 'house', 'room'][i]; cap = T.mv[i]; z = 1.04 + (s.t % 6) * .01; }
    if (!pic(name, z)) return;
    if (s.corrupt === 2) figure(W * .56, 366, .9, .93, '#040404', .8);
    vt(T.mvTag, 36, 50, 18, '#d8d8d8');
    g.font = `bold 20px ${font()}`;
    const tw = g.measureText(cap).width;
    g.fillStyle = 'rgba(0,0,0,.62)'; g.fillRect(W / 2 - tw / 2 - 12, 282, tw + 24, 34);
    vt(cap, W / 2, 306, 20, '#fff', 'center');
  },
  // 5 频道：雪花。看得越久，里面那个东西越近
  5() {
    const s = S; snow(1);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, W, H);
    if (s.corrupt < 1) return;
    const k = Math.min(1, Math.max(0, s.on5) / (s.corrupt === 2 ? 1.2 : 3.2));
    figure(W / 2, H + 20, 1 + k * 1.7, .3 + k * .55, '#000', k > .5 ? 1 : 0);
    snow(.4);
  },
  // 6 频道：社区公告
  6() {
    const s = S;
    g.fillStyle = '#2a1c10'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#c9a15a'; g.lineWidth = 2; g.strokeRect(24, 24, W - 48, 296);
    vt(T.bbTitle, W / 2, 70, 28, '#ffd98a', 'center');
    const i = (s.t / 7 | 0) % 3, bad = s.corrupt === 2 || (s.corrupt === 1 && i === 2), pg = bad ? T.bbBad : T.bb[i];
    const photo = (i === 2 || s.corrupt === 2) && IMG.manq, x = photo ? 270 : 70, w = photo ? 320 : 500;
    if (photo) { g.drawImage(IMG.manq, 48, 104, 200, 150); g.strokeStyle = '#c9a15a'; g.lineWidth = 1; g.strokeRect(48.5, 104.5, 200, 150); }
    vt(pg[0], x, 134, 24, '#ffd98a');
    para(pg[2], x, para(pg[1], x, 176, w, 17, 26, '#f1eee4') + 6, w, 17, 26, '#f1eee4');
    vt(`${i + 1}/3`, W - 44, 306, 14, '#c9a15a', 'right');
  },
};

function drawIntro() {
  const s = S;
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#b01010'; g.fillRect(0, 40, W, 64);
  if (s.st > 4.5 || (s.st * 2 | 0) % 2 === 0) vt(T.introHead, W / 2, 84, 34, '#fff', 'center');
  vt(T.ebs, W / 2, 140, 18, '#ffb000', 'center');
  const cps = lang === 'zh' ? 14 : 32, at = [1.5, 4, 8, 11];
  let y = 190;
  T.intro.forEach((ln, i) => { if (s.st > at[i]) y = para(ln, 60, y, W - 120, 22, 30, '#f1eee4', (s.st - at[i]) * cps) + 12; });
}
function drawNotice() {
  const s = S, c = cur(); let head, body, col = '#ffb000', shown = 1e9, jit = 0;
  if (s.st < 0) { if (!s.ack) return; head = `${T.ebs} · ${T.notice(s.ackN)}`; body = T.ack; }
  else {
    body = s.msgStr; if (!body) return;
    head = c.n ? `${T.ebs} · ${T.notice(c.n)}` : T.ebs;
    if (!c.n) { col = '#e9e9e9'; jit = Math.random() * 2 - 1; }
    shown = s.msgT * (lang === 'zh' ? 16 : 36);
  }
  const x = 28, y = H - 152, w = W - 56, h = 128;
  g.fillStyle = 'rgba(0,0,0,.9)'; g.fillRect(x, y, w, h);
  g.strokeStyle = col; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2);
  vt(head, x + 16, y + 28, 16, col);
  para(body, x + 16 + jit, y + 58, w - 32, 19, 25, '#f1eee4', shown);
}
// 关机后的黑屏：玻璃上映出你自己，还有你身后的东西
function drawOff() {
  const s = S, c = cur();
  g.fillStyle = '#030303'; g.fillRect(0, 0, W, H);
  if (s.powT < .28) { const k = 1 - s.powT / .28; g.fillStyle = '#fff'; g.fillRect(W / 2 - W * k / 2, H / 2 - 1 - 6 * k * k, W * k, 2 + 12 * k * k); return; }
  const gr = g.createRadialGradient(W * .3, H * .25, 10, W * .3, H * .25, 380);
  gr.addColorStop(0, 'rgba(70,76,92,.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  let near = s.strikes * .12;
  if (c.id === 'power' && s.f.gone) near += Math.max(0, s.f.offT - 3) / 12 * .8;
  if (c.id === 'fakeoff' && s.f.offT) near = .6 + s.f.offT * .4;
  near = Math.min(1.2, near);
  const v = 14 + near * 34 | 0;
  if (near > 0) figure(W / 2 + 130 - near * 70, H + 30, .9 + near * .9, 1, `rgb(${v},${v},${v + 3})`, near > .75 ? .7 : 0);
  figure(W / 2, H + 60, 1.5, 1, '#16161a');
}
function drawEnd() {
  const s = S;
  if (s.end.kind === 'dawn') { CH[3](); g.fillStyle = `rgba(0,0,0,${Math.min(.45, s.endT / 4)})`; g.fillRect(0, 0, W, H); post(false); return; }
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  if (s.endT >= 1.5) return;
  const z = 1.15 + s.endT * .7, w = W * z, h = H * z;
  g.save(); g.translate((Math.random() - .5) * 14, (Math.random() - .5) * 10);
  if (IMG.face) g.drawImage(IMG.face, (W - w) / 2, (H - h) / 2 - 10, w, h);
  else { snow(1); figure(W / 2, H + 220, 3.4, 1, '#000', 1); }
  g.restore();
  if (s.endT < .1) invert();
  post(true);
}
// 录像带那层毛病：横向撕裂、底边抖动、雪花、一条慢慢往下走的亮带
function post(heavy = S.glitch > 0) {
  const c = S.corrupt, n = heavy ? 10 : Math.random() < .03 + c * .04 ? 2 : 0;
  for (let i = 0; i < n; i++) {
    const y = Math.random() * (H - 50) | 0, h = 3 + Math.random() * (heavy ? 46 : 12) | 0;
    g.drawImage(cv, 0, y, W, h, (Math.random() - .5) * (heavy ? 130 : 22), y, W, h);
  }
  for (let y = H - 10; y < H; y += 2) g.drawImage(cv, 0, y, W, 2, (Math.random() - .5) * 36, y, W, 2);
  if (S.inv) { invert(); S.inv = false; }
  snow(.07 + c * .03 + (heavy ? .22 : 0));
  const by = (performance.now() / 22) % (H + 160) - 80, gr = g.createLinearGradient(0, by, 0, by + 80);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.05)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, by, W, 80);
}

let ledStr = '';
function draw() {
  const s = S, live = s.on && !s.end && s.power, v = live ? String(s.ch) : '--';
  if (v !== ledStr) $('led').textContent = ledStr = v;
  $('bMute').classList.toggle('on', live && s.muted);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  if (!s.on) { snow(1); g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 0, W, H); return; }
  if (s.end) return drawEnd();
  if (!s.power) return drawOff();
  if (s.sw > 0) snow(1);
  else if (cur().full) drawIntro();
  else { CH[s.ch](); drawNotice(); }
  if (s.flash > 0 && IMG.face) { g.globalAlpha = .88; g.drawImage(IMG.face, -40, -30, W + 80, H + 60); g.globalAlpha = 1; }
  if (s.note) { g.fillStyle = 'rgba(120,0,0,.93)'; g.fillRect(0, 248, W, 40); vt(s.note.text, W / 2, 275, 19, '#fff', 'center'); }
  if (s.osd > 0) vt('CH ' + s.ch, W - 36, 104, 26, '#35f04a', 'right');
  if (s.muted) vt(T.mute, 36, 104, 20, '#35f04a');
  post();
  if (s.powT < .4) { g.fillStyle = `rgba(0,0,0,${1 - s.powT / .4})`; g.fillRect(0, 0, W, H); }
}

let last = 0;
function frame(ts) {
  const dt = Math.min(.1, (ts - last) / 1000 || 0); last = ts;
  tick(dt); draw();
  requestAnimationFrame(frame);
}
applyLang();
requestAnimationFrame(frame);
if (q.has('test')) window.__game = { tick, draw, chan, power, mute, start, get S() { return S; } };   // 只给 check.mjs 用
})();
