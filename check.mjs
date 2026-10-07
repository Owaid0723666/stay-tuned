// 自检：不开浏览器，把整局从头到尾走三遍，看结局对不对、中途会不会报错。运行：node check.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
const noop = () => {};
const ctx = new Proxy({}, {
  get: (t, k) => k in t ? t[k]
    : k === 'measureText' ? s => ({ width: String(s).length * 10 })
    : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) })
    : /Gradient$/.test(k) ? () => ({ addColorStop: noop }) : noop,
  set: (t, k, v) => (t[k] = v, true),
});
const mk = () => { const e = { on: {}, classList: { toggle: noop }, blur: noop, getContext: () => ctx, addEventListener(ev, fn) { e.on[ev] = fn; } }; return e; };
const els = {};
Object.assign(globalThis, {
  window: globalThis, location: { search: '?test=1&lang=zh' }, addEventListener: noop, requestAnimationFrame: noop,
  matchMedia: () => ({ matches: false }), screen: { width: 1280, height: 800 },
  document: { documentElement: mk(), addEventListener: noop, getElementById: id => els[id] ||= mk(), createElement: mk },
  Image: class { set src(v) { queueMicrotask(() => this.onload()); } },
});
(0, eval)(['text.js', 'audio.js', 'game.js'].map(f => readFileSync(new URL(f, import.meta.url), 'utf8')).join('\n'));
await new Promise(r => setTimeout(r, 10));
const G = globalThis.__game;

// play(s) 每一小步被叫一次，扮演玩家按键；跑到出结局为止
function run(play) {
  G.start();
  for (let i = 0; i < 20 * 400 && !G.S.end; i++) { play(G.S); G.tick(.05); G.draw(); }
  for (let i = 0; i < 80; i++) { G.tick(.05); G.draw(); }
  return G.S;
}
const id = s => ['free', 'intro', 'go3', 'mute', 'avoid5', 'eyes', 'power', 'fake5', 'fakeoff', 'dawn'][s.step];
const good = s => {
  const k = id(s);
  if (k === 'go3' && s.st > .5 && s.ch !== 3) G.chan(1);
  if (k === 'mute' && s.st > 5 && !s.muted) G.mute();
  if (k === 'avoid5' && s.st > 1) { if (s.muted) G.mute(); if (s.ch === 3) G.chan(1); else if (s.ch === 5) G.chan(-1); }
  if (k === 'eyes' && s.f.seq >= s.f.look && s.ch === 4) G.chan(-1);
  if (k === 'power' && s.st > 1 && s.power && !s.f.gone) G.power();
  if (k === 'power' && !s.power && s.f.offT >= 10) G.power();
};

let s = run(good);
assert.deepEqual([s.end.kind, s.strikes, s.got], ['dawn', 0, 6], '照着编号通告做、不理冒充的 → 天亮');

s = run(noop);
assert.deepEqual([s.end.kind, s.end.why, s.strikes], ['taken', 'strikes', 3], '什么都不做 → 违规三次被带走');

els.bLang.on.click({ currentTarget: els.bLang });   // 换成英文再跑一遍
s = run(s => { good(s); if (id(s) === 'fake5' && s.st > 2 && s.ch !== 5) G.chan(s.ch < 5 ? 1 : -1); });
assert.deepEqual([s.end.kind, s.end.why, s.got], ['taken', 'fake', 5], '照冒充的去了 5 频道 → 被带走');

s = run(s => { good(s); if (id(s) === 'fakeoff' && s.st > 2 && s.power) G.power(); });
assert.deepEqual([s.end.kind, s.end.why], ['taken', 'fake'], '照冒充的关了电视 → 被带走');
console.log('四种走法的结局都对');
