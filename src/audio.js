// ===== AUDIO ENGINE =====
let audioCtx = null;
let audioUnlocked = false;

// Exported only for tests — do not use directly in app code
export function _resetForTesting() {
  audioCtx = null;
  audioUnlocked = false;
}

export function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  try {
    ensureAudio();
  } catch (e) {
    console.warn("[Audio] Could not create AudioContext:", e);
  }
  // Speak a silent utterance to unlock speechSynthesis on mobile/Chrome
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      const silent = new SpeechSynthesisUtterance("");
      silent.volume = 0;
      speechSynthesis.speak(silent);
    } catch (e) { /* ignore */ }
  }
}

// Use capture phase so this fires BEFORE React's event handlers.
if (typeof document !== "undefined") {
  ["click", "touchstart", "keydown"].forEach(evt =>
    document.addEventListener(evt, unlockAudio, { once: true, capture: true })
  );
}

export function playTone(freq, dur, type = "triangle", vol = 0.2) {
  try {
    const ctx = ensureAudio();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.connect(g); g.connect(ctx.destination);
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.start(); o.stop(ctx.currentTime + dur);
  } catch (e) {
    console.warn("[Audio] playTone failed:", e);
  }
}

export function playLetterPop() {
  playTone(600 + Math.random() * 300, 0.08, "sine", 0.15);
}

export function playCorrectLetter() {
  try {
    const ctx = ensureAudio();
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "triangle"; o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.start(t); o.stop(t + 0.15);
  } catch (e) {
    console.warn("[Audio] playCorrectLetter failed:", e);
  }
}

export function playWrongSound() {
  try {
    const ctx = ensureAudio();
    const t = ctx.currentTime;
    [350, 330, 311, 293].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sawtooth"; o.connect(g); g.connect(ctx.destination);
      o.frequency.value = f;
      g.gain.setValueAtTime(0.1, t + i * 0.15);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.15 + 0.18);
      o.start(t + i * 0.15); o.stop(t + i * 0.15 + 0.18);
    });
  } catch (e) {
    console.warn("[Audio] playWrongSound failed:", e);
  }
}

export function playWordComplete() {
  try {
    const ctx = ensureAudio();
    const t = ctx.currentTime;
    [{ f: 523, t: 0, d: 0.12 }, { f: 659, t: 0.1, d: 0.12 }, { f: 784, t: 0.2, d: 0.12 }, { f: 1047, t: 0.3, d: 0.4 }].forEach(n => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "triangle"; o.connect(g); g.connect(ctx.destination);
      o.frequency.value = n.f;
      g.gain.setValueAtTime(0.25, t + n.t); g.gain.linearRampToValueAtTime(0.3, t + n.t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + n.t + n.d);
      o.start(t + n.t); o.stop(t + n.t + n.d);
    });
    for (let i = 0; i < 6; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.connect(g); g.connect(ctx.destination);
      const st = t + 0.25 + i * 0.06;
      o.frequency.value = 2000 + Math.random() * 2500;
      g.gain.setValueAtTime(0.06, st); g.gain.exponentialRampToValueAtTime(0.001, st + 0.1);
      o.start(st); o.stop(st + 0.1);
    }
  } catch (e) {
    console.warn("[Audio] playWordComplete failed:", e);
  }
}

export function playCheer() {
  try {
    const ctx = ensureAudio();
    const t = ctx.currentTime;
    [523, 587, 659, 698, 784, 880, 988, 1047].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "triangle"; o.connect(g); g.connect(ctx.destination);
      o.frequency.value = f;
      const s = t + i * 0.08;
      g.gain.setValueAtTime(0.2, s); g.gain.exponentialRampToValueAtTime(0.001, s + 0.3);
      o.start(s); o.stop(s + 0.3);
    });
    setTimeout(() => {
      try {
        const ctx2 = ensureAudio();
        [523, 659, 784, 1047].forEach(f => {
          const o = ctx2.createOscillator(), g = ctx2.createGain();
          o.type = "triangle"; o.connect(g); g.connect(ctx2.destination);
          o.frequency.value = f;
          const ct = ctx2.currentTime;
          g.gain.setValueAtTime(0.18, ct); g.gain.exponentialRampToValueAtTime(0.001, ct + 0.8);
          o.start(ct); o.stop(ct + 0.8);
        });
      } catch (e) {}
    }, 700);
  } catch (e) {
    console.warn("[Audio] playCheer failed:", e);
  }
}

// ===== TEXT-TO-SPEECH =====
// Uses browser speechSynthesis directly (synchronous, works offline, respects user gesture)

let currentAudio = null;
let cachedVoices = [];
let voicesReady = false;

function loadVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const voices = speechSynthesis.getVoices();
  if (voices.length > 0) {
    cachedVoices = voices;
    voicesReady = true;
    console.log("[TTS] Voices loaded:", voices.length, "voices available");
    // Log first few voice names for debugging
    cachedVoices.slice(0, 5).forEach(v => console.log("[TTS]  -", v.name, v.lang));
  }
}

// Chrome loads voices asynchronously — must listen for voiceschanged
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  loadVoices(); // try immediately (works in Firefox/Safari)
  speechSynthesis.addEventListener("voiceschanged", loadVoices);
}

function getEnglishVoice() {
  if (!voicesReady) loadVoices();
  // Prefer high-quality English voices
  const preferred = ["Samantha", "Google US English", "Google UK English Female", "Microsoft Zira", "Alex"];
  for (const name of preferred) {
    const v = cachedVoices.find(v => v.name.includes(name));
    if (v) return v;
  }
  return cachedVoices.find(v => v.lang === "en-US")
    || cachedVoices.find(v => v.lang.startsWith("en-"))
    || cachedVoices[0]
    || null;
}

// Dedup: prevent rapid double-calls (React StrictMode) from canceling speech
let lastSpeakWord = "";
let lastSpeakTime = 0;

// IMPORTANT: speechSynthesis.speak() MUST be called synchronously from user gesture.
// Wrapping it in setTimeout or Promise breaks Chrome's gesture detection and speech fails.
export function speakWord(word) {
  if (!word) return;

  // Stop anything currently playing
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }

  if (!("speechSynthesis" in window)) {
    console.warn("[TTS] speechSynthesis not supported in this browser");
    return;
  }

  // Dedup: if same word requested within 300ms, skip (React StrictMode double-fires)
  const now = Date.now();
  if (word === lastSpeakWord && now - lastSpeakTime < 300) {
    console.log("[TTS] Skipping duplicate call for:", word.toLowerCase());
    return;
  }
  lastSpeakWord = word;
  lastSpeakTime = now;

  const text = word.toLowerCase();

  function doSpeak() {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.85;
    utterance.pitch = 1.05;
    utterance.volume = 1;
    utterance.lang = "en-US";

    const voice = getEnglishVoice();
    if (voice) {
      utterance.voice = voice;
      console.log("[TTS] Speaking:", text, "with voice:", voice.name);
    } else {
      console.log("[TTS] Speaking:", text, "with default voice (no voices loaded yet)");
    }

    utterance.onstart = () => console.log("[TTS] Speech started for:", text);
    utterance.onend = () => console.log("[TTS] Speech ended for:", text);
    utterance.onerror = (e) => console.warn("[TTS] Speech error for:", text, e.error);

    speechSynthesis.speak(utterance);
  }

  // Chrome bug: cancel() + speak() in the same sync block causes the new utterance
  // to also be canceled. Fix: if speech is active, cancel then use queueMicrotask
  // (which preserves user gesture context unlike setTimeout).
  // If nothing is playing, just speak directly without cancel.
  if (speechSynthesis.speaking || speechSynthesis.pending) {
    speechSynthesis.cancel();
    queueMicrotask(doSpeak);
  } else {
    doSpeak();
  }
}