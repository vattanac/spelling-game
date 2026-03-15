import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock factories ─────────────────────────────────────────────────────────────
function makeMockAudioContext(initialState = "running") {
  const makeOscillator = () => ({
    type: "",
    frequency: { value: 0 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  });
  const makeGain = () => ({
    connect: vi.fn(),
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
  });
  return {
    state: initialState,
    currentTime: 0,
    destination: {},
    createOscillator: vi.fn(makeOscillator),
    createGain: vi.fn(makeGain),
    resume: vi.fn().mockResolvedValue(undefined),
  };
}

function makeMockSpeechSynthesis() {
  return {
    speak: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn().mockReturnValue([]),
    speaking: false,
    onvoiceschanged: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

// Re-import the module fresh (with reset internal state) for each test
async function freshAudio() {
  vi.resetModules();
  const mod = await import("./audio.js");
  mod._resetForTesting();
  return mod;
}

// ── Test suite ─────────────────────────────────────────────────────────────────
describe("Audio Engine", () => {
  let mockCtx;
  let mockSpeech;

  beforeEach(() => {
    mockCtx = makeMockAudioContext();
    mockSpeech = makeMockSpeechSynthesis();

    vi.stubGlobal("AudioContext", vi.fn(function () { return mockCtx; }));
    vi.stubGlobal("webkitAudioContext", vi.fn(function () { return mockCtx; }));
    vi.stubGlobal("speechSynthesis", mockSpeech);
    vi.stubGlobal("SpeechSynthesisUtterance", vi.fn(function (text) {
      this.text = text; this.rate = 1; this.pitch = 1;
      this.volume = 1; this.lang = ""; this.voice = null;
      this.onstart = null; this.onend = null; this.onerror = null;
    }));
  });

  // ── ensureAudio ──────────────────────────────────────────────────────────────
  describe("ensureAudio", () => {
    it("creates AudioContext on first call", async () => {
      const { ensureAudio } = await freshAudio();
      ensureAudio();
      expect(global.AudioContext).toHaveBeenCalledTimes(1);
    });

    it("reuses the same AudioContext on repeated calls", async () => {
      const { ensureAudio } = await freshAudio();
      ensureAudio();
      ensureAudio();
      expect(global.AudioContext).toHaveBeenCalledTimes(1);
    });

    it("calls resume() when context is suspended", async () => {
      mockCtx.state = "suspended";
      const { ensureAudio } = await freshAudio();
      ensureAudio();
      expect(mockCtx.resume).toHaveBeenCalledTimes(1);
    });

    it("does not call resume() when context is running", async () => {
      mockCtx.state = "running";
      const { ensureAudio } = await freshAudio();
      ensureAudio();
      expect(mockCtx.resume).not.toHaveBeenCalled();
    });
  });

  // ── unlockAudio ──────────────────────────────────────────────────────────────
  describe("unlockAudio", () => {
    it("creates AudioContext and speaks a silent unlock utterance", async () => {
      const { unlockAudio } = await freshAudio();
      unlockAudio();
      expect(global.AudioContext).toHaveBeenCalledTimes(1);
      expect(mockSpeech.speak).toHaveBeenCalledTimes(1);
      const utterance = mockSpeech.speak.mock.calls[0][0];
      expect(utterance.volume).toBe(0);
    });

    it("is idempotent — second call is a no-op", async () => {
      const { unlockAudio } = await freshAudio();
      unlockAudio();
      unlockAudio();
      expect(global.AudioContext).toHaveBeenCalledTimes(1);
      expect(mockSpeech.speak).toHaveBeenCalledTimes(1);
    });
  });

  // ── playTone ─────────────────────────────────────────────────────────────────
  describe("playTone", () => {
    it("creates one oscillator and one gain node", async () => {
      const { playTone } = await freshAudio();
      playTone(440, 0.1);
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
      expect(mockCtx.createGain).toHaveBeenCalledTimes(1);
    });

    it("sets the requested frequency on the oscillator", async () => {
      const { playTone } = await freshAudio();
      playTone(880, 0.1);
      const osc = mockCtx.createOscillator.mock.results[0].value;
      expect(osc.frequency.value).toBe(880);
    });

    it("starts and schedules a stop for the oscillator", async () => {
      const { playTone } = await freshAudio();
      playTone(440, 0.1);
      const osc = mockCtx.createOscillator.mock.results[0].value;
      expect(osc.start).toHaveBeenCalledTimes(1);
      expect(osc.stop).toHaveBeenCalledTimes(1);
    });

    it("does not throw when AudioContext construction fails", async () => {
      vi.stubGlobal("AudioContext", vi.fn(function () { throw new Error("blocked"); }));
      vi.stubGlobal("webkitAudioContext", vi.fn(function () { throw new Error("blocked"); }));
      const { playTone, _resetForTesting } = await freshAudio();
      _resetForTesting();
      expect(() => playTone(440, 0.1)).not.toThrow();
    });
  });

  // ── playLetterPop ────────────────────────────────────────────────────────────
  describe("playLetterPop", () => {
    it("fires an oscillator", async () => {
      const { playLetterPop } = await freshAudio();
      playLetterPop();
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
    });
  });

  // ── playCorrectLetter ────────────────────────────────────────────────────────
  describe("playCorrectLetter", () => {
    it("plays an 880 Hz tone", async () => {
      const { playCorrectLetter } = await freshAudio();
      playCorrectLetter();
      const osc = mockCtx.createOscillator.mock.results[0].value;
      expect(osc.frequency.value).toBe(880);
    });
  });

  // ── playWrongSound ───────────────────────────────────────────────────────────
  describe("playWrongSound", () => {
    it("creates 4 oscillators for the descending tones", async () => {
      const { playWrongSound } = await freshAudio();
      playWrongSound();
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(4);
    });
  });

  // ── playWordComplete ─────────────────────────────────────────────────────────
  describe("playWordComplete", () => {
    it("creates 10 oscillators (4 melody + 6 sparkle)", async () => {
      const { playWordComplete } = await freshAudio();
      playWordComplete();
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(10);
    });
  });

  // ── speakWord ────────────────────────────────────────────────────────────────
  describe("speakWord", () => {
    it("calls speechSynthesis.speak synchronously with the lowercase word", async () => {
      mockSpeech.getVoices.mockReturnValue([{ lang: "en-US", name: "Samantha" }]);
      const { speakWord } = await freshAudio();
      speakWord("CAT");
      expect(mockSpeech.speak).toHaveBeenCalledTimes(1);
      const utterance = mockSpeech.speak.mock.calls[0][0];
      expect(utterance.text).toBe("cat");
    });

    it("cancels previous speech only when already speaking", async () => {
      mockSpeech.getVoices.mockReturnValue([{ lang: "en-US", name: "Samantha" }]);
      const { speakWord } = await freshAudio();

      // When nothing is playing, cancel should NOT be called
      speakWord("DOG");
      expect(mockSpeech.cancel).not.toHaveBeenCalled();
      expect(mockSpeech.speak).toHaveBeenCalledTimes(1);

      // When speech is active, cancel SHOULD be called
      mockSpeech.speaking = true;
      speakWord("CAT");
      expect(mockSpeech.cancel).toHaveBeenCalled();
    });

    it("sets correct rate, pitch, volume, and lang", async () => {
      mockSpeech.getVoices.mockReturnValue([{ lang: "en-US", name: "Samantha" }]);
      const { speakWord } = await freshAudio();
      speakWord("FISH");
      const utterance = mockSpeech.speak.mock.calls[0][0];
      expect(utterance.rate).toBe(0.85);
      expect(utterance.pitch).toBe(1.05);
      expect(utterance.volume).toBe(1);
      expect(utterance.lang).toBe("en-US");
    });

    it("selects a preferred English voice when available", async () => {
      const samantha = { lang: "en-US", name: "Samantha" };
      mockSpeech.getVoices.mockReturnValue([
        { lang: "fr-FR", name: "Thomas" },
        samantha,
        { lang: "en-US", name: "Alex" },
      ]);
      const { speakWord } = await freshAudio();
      speakWord("BEAR");
      const utterance = mockSpeech.speak.mock.calls[0][0];
      expect(utterance.voice).toBe(samantha);
    });

    it("speaks different words sequentially without dedup", async () => {
      mockSpeech.getVoices.mockReturnValue([{ lang: "en-US", name: "Samantha" }]);
      mockSpeech.speaking = false;

      const { speakWord } = await freshAudio();
      speakWord("BIRD");
      expect(mockSpeech.speak).toHaveBeenCalledTimes(1);

      // Different word should not be deduped
      speakWord("FISH");
      expect(mockSpeech.speak).toHaveBeenCalledTimes(2);
      const secondUtterance = mockSpeech.speak.mock.calls[1][0];
      expect(secondUtterance.text).toBe("fish");
    });

    it("does NOT retry if speech already started", async () => {
      vi.useFakeTimers();
      mockSpeech.getVoices.mockReturnValue([{ lang: "en-US", name: "Samantha" }]);

      const { speakWord } = await freshAudio();
      speakWord("LION");

      // Simulate onstart firing
      const utterance = mockSpeech.speak.mock.calls[0][0];
      if (utterance.onstart) utterance.onstart();

      vi.advanceTimersByTime(700);
      expect(mockSpeech.speak).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it("does nothing for empty word", async () => {
      mockSpeech.getVoices.mockReturnValue([{ lang: "en-US", name: "Samantha" }]);
      const { speakWord } = await freshAudio();
      speakWord("");
      expect(mockSpeech.speak).not.toHaveBeenCalled();
    });
  });
});
