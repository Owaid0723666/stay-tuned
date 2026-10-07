// 所有声音都是现算出来的，不带声音文件。
// 电视里的声音走 tv 这一路（静音、关机会掐掉），屋里的声音走 room 这一路（掐不掉）。
const Snd = (() => {
  let ac, tv, room, noise;
  const lv = {};
  const now = () => ac.currentTime;

  function init() {
    if (ac) { ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    const master = ac.createGain(); master.gain.value = 0.8; master.connect(ac.destination);
    tv = ac.createGain(); tv.connect(master);
    room = ac.createGain(); room.connect(master);
    noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    const src = ac.createBufferSource(); src.buffer = noise; src.loop = true;
    lv.static = bus(src, tv); src.start();
    lv.hum = bus(osc('sawtooth', 60), tv, 'lowpass', 200);
    lv.bars = bus(osc('sine', 1000), tv);
    lv.alert = ac.createGain(); lv.alert.gain.value = 0; lv.alert.connect(tv);
    osc('sine', 740).connect(lv.alert); osc('sine', 1015).connect(lv.alert);
    lv.drone = ac.createGain(); lv.drone.gain.value = 0; lv.drone.connect(room);
    osc('sine', 46).connect(lv.drone); osc('sine', 49.5).connect(lv.drone); osc('triangle', 92.6).connect(lv.drone);
  }
  function osc(type, f) { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; }
  function bus(src, out, ftype, ff) {
    const g = ac.createGain(); g.gain.value = 0;
    if (ftype) { const f = ac.createBiquadFilter(); f.type = ftype; f.frequency.value = ff; src.connect(f); f.connect(g); } else src.connect(g);
    g.connect(out); return g;
  }
  // 一小段带头带尾的声音
  function blip(out, { type = 'sine', f = 440, f2, dur = 0.2, vol = 0.2, useNoise, filter, ff = 800, at = 0 }) {
    if (!ac) return;
    const t = now() + at, g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let s;
    if (useNoise) { s = ac.createBufferSource(); s.buffer = noise; s.loop = true; }
    else { s = ac.createOscillator(); s.type = type; s.frequency.setValueAtTime(f, t); if (f2) s.frequency.exponentialRampToValueAtTime(f2, t + dur); }
    if (filter) { const fl = ac.createBiquadFilter(); fl.type = filter; fl.frequency.value = ff; s.connect(fl); fl.connect(g); } else s.connect(g);
    g.connect(out); s.start(t); s.stop(t + dur + 0.05);
  }

  return {
    init,
    // 切到别的页面、锁屏时停声，回来再接上
    pause(stop) { if (ac) stop ? ac.suspend() : ac.resume(); },
    level(name, v) { if (ac) lv[name].gain.setTargetAtTime(v, now(), 0.04); },
    tvGate(open) { if (ac) tv.gain.setTargetAtTime(open ? 1 : 0, now(), 0.015); },
    // 应急广播的提示音，响 dur 秒；dur 给 0 就是立刻掐掉
    alert(dur) {
      if (!ac) return;
      const g = lv.alert.gain; g.cancelScheduledValues(now()); g.setValueAtTime(dur ? 0.11 : 0, now());
      if (dur) g.setValueAtTime(0, now() + dur);
    },
    note(f) { blip(tv, { type: 'triangle', f, dur: 0.32, vol: 0.07 }); },
    click() { blip(tv, { useNoise: true, filter: 'highpass', ff: 3000, dur: 0.05, vol: 0.2 }); },
    thunk() { blip(room, { f: 90, f2: 40, dur: 0.12, vol: 0.5 }); },
    tick() { blip(room, { useNoise: true, filter: 'bandpass', ff: 2400, dur: 0.035, vol: 0.22 }); },
    knock() { for (let i = 0; i < 3; i++) blip(room, { f: 110, f2: 55, dur: 0.16, vol: 0.6, at: 0.25 + i * 0.3 }); },
    sting() { blip(room, { type: 'sawtooth', f: 58, f2: 44, dur: 2.2, vol: 0.4, filter: 'lowpass', ff: 300 }); },
    scare() {
      blip(room, { useNoise: true, dur: 1.5, vol: 0.4 });
      blip(room, { type: 'sawtooth', f: 110, f2: 70, dur: 1.5, vol: 0.28 });
      blip(room, { type: 'sawtooth', f: 117, f2: 61, dur: 1.5, vol: 0.28 });
      blip(room, { type: 'square', f: 1900, f2: 700, dur: 1.1, vol: 0.08 });
    },
  };
})();
