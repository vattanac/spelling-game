import { useState, useEffect, useCallback, useRef } from "react";
import {
  playTone, playLetterPop, playCorrectLetter, playWrongSound,
  playWordComplete, playCheer, speakWord,
} from "./audio.js";

/* ================================================================
   SPELLING GAME PRO - Final Version
   Features:
   - Parent Setup: type words, paste multiple, quick presets, image OCR
   - Kid Profile: kid name, photo, parent name (persisted in localStorage)
   - AI Images: generates cartoon images for any word via Pollinations.ai
   - Kid Game: colorful letter-tap spelling with sounds & animations
   - Toast Notifications: feedback when words are added
   - Score History: persistent log of every test with per-word results
   ================================================================ */

// ===== HELPERS =====
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ===== EMOJI MAP =====
const EMOJI_MAP = {
  DOG:"🐶",CAT:"🐱",FROG:"🐸",FISH:"🐟",BEAR:"🐻",LION:"🦁",PIG:"🐷",COW:"🐮",
  FOX:"🦊",BEE:"🐝",DUCK:"🦆",HEN:"🐔",OWL:"🦉",BAT:"🦇",ANT:"🐜",BUG:"🐛",
  RAM:"🐏",YAK:"🐃",HORSE:"🐴",SHEEP:"🐑",BUNNY:"🐰",MOUSE:"🐭",SNAKE:"🐍",
  WHALE:"🐋",TIGER:"🐯",PANDA:"🐼",KOALA:"🐨",ZEBRA:"🦓",MONKEY:"🐵",TURTLE:"🐢",
  PENGUIN:"🐧",DOLPHIN:"🐬",OCTOPUS:"🐙",CHICKEN:"🐔",ELEPHANT:"🐘",GIRAFFE:"🦒",
  BUTTERFLY:"🦋",APPLE:"🍎",BANANA:"🍌",GRAPE:"🍇",MANGO:"🥭",LEMON:"🍋",
  ORANGE:"🍊",CHERRY:"🍒",PEACH:"🍑",MELON:"🍈",BERRY:"🫐",STAR:"⭐",MOON:"🌙",
  SUN:"☀️",TREE:"🌳",FLOWER:"🌸",RAIN:"🌧️",SNOW:"❄️",FIRE:"🔥",HEART:"❤️",
  BOOK:"📖",CAKE:"🎂",PIZZA:"🍕",CANDY:"🍬",BREAD:"🍞",CORN:"🌽",HOUSE:"🏠",
  BOAT:"⛵",PLANE:"✈️",TRAIN:"🚂",CAR:"🚗",BALL:"⚽",KITE:"🪁",DRUM:"🥁",
  BELL:"🔔",RING:"💍",KING:"👑",BABY:"👶",HAND:"✋",FOOT:"🦶",NOSE:"👃",
  EYE:"👁️",EAR:"👂",HAT:"🎩",SHOE:"👟",SOCK:"🧦",BIRD:"🐦",DEER:"🦌",
  GOAT:"🐐",CRAB:"🦀",WOLF:"🐺",SWAN:"🦢",
};
const getEmoji = (w) => EMOJI_MAP[w] || "📝";

// ===== AI IMAGE COMPONENT =====
// Uses Pollinations.ai (free, no API key) to generate kid-friendly images for ANY word
const imageCache = {};
function WordImage({ word, size = "lg" }) {
  const [imgSrc, setImgSrc] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!word) return;
    setLoaded(false);
    setError(false);

    if (imageCache[word]) {
      setImgSrc(imageCache[word]);
      setLoaded(true);
      return;
    }

    const prompt = encodeURIComponent(
      `cute cartoon illustration of "${word.toLowerCase()}" for children, colorful, simple, friendly, white background, no text, kid-friendly`
    );
    const url = `https://image.pollinations.ai/prompt/${prompt}?width=256&height=256&nologo=true&seed=${word.length}`;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageCache[word] = url;
      setImgSrc(url);
      setLoaded(true);
    };
    img.onerror = () => setError(true);
    img.src = url;
  }, [word]);

  const emoji = getEmoji(word);
  const sizeClasses = size === "lg"
    ? "w-32 h-32 md:w-40 md:h-40 text-6xl md:text-8xl"
    : "w-12 h-12 md:w-16 md:h-16 text-2xl md:text-3xl";

  return (
    <div className={`${sizeClasses} rounded-2xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-yellow-100 to-pink-100 shadow-inner relative`}>
      <span className={`${loaded ? "opacity-0 absolute" : "opacity-100"} transition-opacity duration-300`}>
        {emoji}
      </span>
      {imgSrc && !error && (
        <img
          src={imgSrc}
          alt={word}
          className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      )}
      {!loaded && !error && (
        <div className="absolute bottom-1 right-1 w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
      )}
    </div>
  );
}

const LETTER_COLORS = [
  "from-red-400 to-red-600","from-blue-400 to-blue-600","from-green-400 to-green-600",
  "from-yellow-400 to-amber-500","from-purple-400 to-purple-600","from-pink-400 to-pink-600",
  "from-cyan-400 to-cyan-600","from-orange-400 to-orange-600",
];
const CHEER = ["Super!","Amazing!","Fantastic!","Wonderful!","Brilliant!","Perfect!","Awesome!","Great!"];

// ===== TOAST NOTIFICATION =====
function Toast({ message, trigger }) {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState("");
  useEffect(() => {
    if (!trigger || !message) return;
    setText(message);
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2000);
    return () => clearTimeout(t);
  }, [trigger, message]);
  if (!visible) return null;
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none" style={{ animation: "toastSlide 0.3s ease-out" }}>
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-2">
        <span className="text-lg">✅</span> {text}
      </div>
    </div>
  );
}

// ===== CONFETTI =====
function Confetti({ trigger }) {
  const [pieces, setPieces] = useState([]);
  useEffect(() => {
    if (!trigger) return;
    const colors = ["#FF1744","#FFEA00","#00E676","#2979FF","#D500F9","#FF9100","#00BCD4","#FF6D00"];
    setPieces(Array.from({ length: 45 }, (_, i) => ({
      id: i + Date.now(), left: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.5, duration: 1.5 + Math.random() * 2,
      size: 6 + Math.random() * 8, rotation: Math.random() * 360,
    })));
    const t = setTimeout(() => setPieces([]), 4000);
    return () => clearTimeout(t);
  }, [trigger]);
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 999 }}>
      {pieces.map(p => (
        <div key={p.id} className="absolute" style={{
          left: p.left + "%", top: -10, width: p.size, height: p.size,
          background: p.color, borderRadius: 2,
          animation: `confFall ${p.duration}s linear ${p.delay}s forwards`,
          transform: `rotate(${p.rotation}deg)`,
        }} />
      ))}
    </div>
  );
}

// ===========================================================
//  PARENT SETUP SCREEN
// ===========================================================
function ParentSetup({ onStartGame, history, onViewHistory, profile, onProfileChange }) {
  const [words, setWords] = useState([]);
  const [input, setInput] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [toastKey, setToastKey] = useState(0);
  const kidPhotoRef = useRef(null);

  const showToast = (msg) => { setToastMsg(msg); setToastKey(k => k + 1); };

  const handleKidPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = 200;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        const smallDataUrl = canvas.toDataURL("image/jpeg", 0.7);
        onProfileChange({ ...profile, kidPhoto: smallDataUrl });
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const [imagePreview, setImagePreview] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState("");
  const [extractedWords, setExtractedWords] = useState([]);
  const [extractedText, setExtractedText] = useState("");
  const [ocrError, setOcrError] = useState("");
  const fileRef = useRef(null);
  const tesseractLoaded = useRef(false);

  // --- Tesseract v4 Loader ---
  const loadTesseract = () => new Promise((resolve, reject) => {
    if (window.Tesseract) return resolve(window.Tesseract);
    if (tesseractLoaded.current) {
      const ck = setInterval(() => { if (window.Tesseract) { clearInterval(ck); resolve(window.Tesseract); } }, 200);
      setTimeout(() => { clearInterval(ck); reject(new Error("Timeout")); }, 20000);
      return;
    }
    tesseractLoaded.current = true;
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@4.1.4/dist/tesseract.min.js";
    script.crossOrigin = "anonymous";
    script.onload = () => {
      const ck = setInterval(() => { if (window.Tesseract) { clearInterval(ck); resolve(window.Tesseract); } }, 200);
      setTimeout(() => { clearInterval(ck); reject(new Error("Timeout")); }, 20000);
    };
    script.onerror = () => { tesseractLoaded.current = false; reject(new Error("CDN failed")); };
    document.head.appendChild(script);
  });

  // --- Image Preprocessor ---
  const preprocessImage = (dataUrl) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const scale = Math.max(1, Math.min(3, 1500 / Math.max(img.width, img.height)));
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const val = gray < 140 ? 0 : 255;
        d[i] = d[i + 1] = d[i + 2] = val;
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.src = dataUrl;
  });

  // --- Word Helpers ---
  const addWord = () => {
    const w = input.trim().toUpperCase().replace(/[^A-Z]/g, "");
    if (w.length >= 2 && w.length <= 10 && !words.includes(w)) {
      setWords([...words, w]); setInput("");
      showToast(`"${w}" added!`);
    }
  };
  const addMultiple = (text) => {
    const nw = text.toUpperCase().split(/[\s,;.\n]+/).map(w => w.replace(/[^A-Z]/g, ""))
      .filter(w => w.length >= 2 && w.length <= 10 && !words.includes(w));
    if (nw.length > 0) {
      setWords(prev => [...prev, ...nw]);
      showToast(`${nw.length} word${nw.length > 1 ? "s" : ""} added!`);
    }
  };
  const removeWord = (idx) => setWords(words.filter((_, i) => i !== idx));

  // --- Image Upload + OCR ---
  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrError(""); setExtractedWords([]); setExtractedText("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target.result);
      setExtracting(true); setOcrProgress(0);
      setOcrStatus("Loading OCR engine...");
      runOCR(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const runOCR = async (dataUrl) => {
    try {
      setOcrStatus("Enhancing image..."); setOcrProgress(5);
      const processed = await preprocessImage(dataUrl);

      setOcrStatus("Loading OCR engine (first time takes a moment)..."); setOcrProgress(10);
      let Tess;
      try { Tess = await loadTesseract(); } catch (e1) {
        tesseractLoaded.current = false;
        const s2 = document.createElement("script");
        s2.src = "https://unpkg.com/tesseract.js@4.1.4/dist/tesseract.min.js";
        s2.crossOrigin = "anonymous";
        await new Promise((res, rej) => {
          s2.onload = () => {
            const ck = setInterval(() => { if (window.Tesseract) { clearInterval(ck); res(); } }, 200);
            setTimeout(() => { clearInterval(ck); rej(new Error("Timeout")); }, 20000);
          };
          s2.onerror = rej;
          document.head.appendChild(s2);
        });
        Tess = window.Tesseract;
      }
      if (!Tess) throw new Error("OCR engine not available");

      setOcrStatus("Reading words from image..."); setOcrProgress(20);
      const result = await Tess.recognize(processed, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setOcrProgress(Math.round(20 + m.progress * 75));
            setOcrStatus("Recognizing... " + Math.round(m.progress * 100) + "%");
          } else if (m.status === "loading tesseract core") {
            setOcrStatus("Loading OCR core..."); setOcrProgress(12);
          } else if (m.status === "initializing tesseract") {
            setOcrStatus("Initializing..."); setOcrProgress(15);
          } else if (m.status === "loading language traineddata") {
            setOcrStatus("Loading language data..."); setOcrProgress(18);
          }
        },
      });

      setOcrProgress(100); setOcrStatus("Done!");
      const rawText = result?.data?.text || "";
      const found = [...new Set(
        rawText.toUpperCase().split(/[\s,;.\n\r\t:!?()[\]{}"'0-9|_\-/\\]+/)
          .map(w => w.replace(/[^A-Z]/g, "")).filter(w => w.length >= 2 && w.length <= 12)
      )];

      if (found.length > 0) {
        setExtractedWords(found); setExtractedText(rawText); setOcrError("");
      } else {
        setExtractedText(rawText);
        setOcrError(rawText.trim()
          ? "Found text but no clear words. You can type them manually below."
          : "No text detected. Try a clearer photo, or type the words manually.");
      }
      setExtracting(false);
    } catch (err) {
      console.error("OCR error:", err);
      setOcrError("OCR failed (" + (err.message || "unknown") + "). Type the words manually below.");
      setExtracting(false);
    }
  };

  const addExtractedWord = (w) => {
    if (!words.includes(w)) { setWords([...words, w]); showToast(`"${w}" added!`); }
    setExtractedWords(prev => prev.filter(ew => ew !== w));
  };
  const addAllExtracted = () => {
    const newWords = extractedWords.filter(w => !words.includes(w));
    setWords(prev => [...prev, ...newWords]);
    setExtractedWords([]);
    if (newWords.length > 0) showToast(`${newWords.length} words added!`);
  };

  const loadPreset = (key) => {
    const p = {
      animals: ["DOG","CAT","FISH","BEAR","LION","PIG","COW","FOX","DUCK","BEE"],
      fruits: ["APPLE","BANANA","GRAPE","MANGO","LEMON","ORANGE","CHERRY","PEACH","MELON","BERRY"],
      nature: ["STAR","MOON","SUN","TREE","FLOWER","RAIN","SNOW","FIRE"],
      things: ["BALL","CAKE","BOOK","HOUSE","BOAT","TRAIN","BELL","HAT"],
      body: ["HAND","FOOT","NOSE","EAR","EYE"],
      verbs: ["RUN","JUMP","EAT","SWIM","FLY","SING","DANCE","READ","COOK","SLEEP"],
      adjectives: ["HAPPY","SAD","BIG","SMALL","HOT","COLD","FAST","SLOW","TALL","LOUD"],
    };
    const preset = p[key] || [];
    setWords(prev => [...new Set([...prev, ...preset])]);
    showToast(`${key.charAt(0).toUpperCase() + key.slice(1)} pack loaded!`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4 overflow-auto">
      <Toast message={toastMsg} trigger={toastKey} />
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Spelling Game Setup
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Add words for your child to practice</p>
        </div>

        {/* Profile Section */}
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
          <h3 className="font-bold text-purple-700 mb-3 text-sm">👨‍👩‍👧 Player Profile</h3>
          <div className="flex gap-4 items-start">
            {/* Kid Photo */}
            <div className="flex flex-col items-center gap-1">
              <div onClick={() => kidPhotoRef.current?.click()}
                className="w-20 h-20 rounded-full overflow-hidden border-2 border-dashed border-purple-300 flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 cursor-pointer hover:border-purple-500 transition-colors shadow-inner">
                {profile.kidPhoto ? (
                  <img src={profile.kidPhoto} alt="Kid" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl">📷</span>
                )}
              </div>
              <input ref={kidPhotoRef} type="file" accept="image/*" className="hidden" onChange={handleKidPhoto} />
              <span className="text-xs text-gray-400">Kid photo</span>
              {profile.kidPhoto && (
                <button onClick={() => onProfileChange({ ...profile, kidPhoto: "" })}
                  className="text-red-400 text-xs font-bold hover:text-red-600">Remove</button>
              )}
            </div>
            {/* Name fields */}
            <div className="flex-1 flex flex-col gap-2">
              <div>
                <label className="text-xs text-gray-500 font-bold mb-0.5 block">Kid's Name</label>
                <input value={profile.kidName} onChange={e => onProfileChange({ ...profile, kidName: e.target.value })}
                  placeholder="e.g. Emma"
                  className="w-full border-2 border-purple-200 rounded-xl px-3 py-2 text-lg font-bold focus:outline-none focus:border-purple-500 transition-colors"
                  maxLength={20} />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-bold mb-0.5 block">Parent's Name</label>
                <input value={profile.parentName} onChange={e => onProfileChange({ ...profile, parentName: e.target.value })}
                  placeholder="e.g. Mom / Dad / Teacher"
                  className="w-full border-2 border-purple-200 rounded-xl px-3 py-1.5 text-sm font-bold focus:outline-none focus:border-purple-500 transition-colors"
                  maxLength={20} />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
          <h3 className="font-bold text-purple-700 mb-2 text-sm">Quick Word Packs</h3>
          <div className="flex flex-wrap gap-2">
            {[
              { k: "animals", l: "🐾 Animals", c: "from-green-400 to-emerald-500" },
              { k: "fruits",  l: "🍎 Fruits",  c: "from-red-400 to-orange-500" },
              { k: "nature",  l: "🌿 Nature",  c: "from-cyan-400 to-blue-500" },
              { k: "things",  l: "🎈 Things",  c: "from-yellow-400 to-amber-500" },
              { k: "body",    l: "🖐️ Body",   c: "from-pink-400 to-rose-500" },
              { k: "verbs",   l: "🏃 Verbs",   c: "from-indigo-400 to-violet-500" },
              { k: "adjectives", l: "😊 Adjectives", c: "from-teal-400 to-emerald-500" },
            ].map(p => (
              <button key={p.k} onClick={() => loadPreset(p.k)}
                className={`bg-gradient-to-r ${p.c} text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-md hover:scale-105 active:scale-95 transition-transform`}>
                {p.l}
              </button>
            ))}
          </div>
        </div>

        {/* Type Words */}
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
          <h3 className="font-bold text-purple-700 mb-2 text-sm">Type Words</h3>
          <div className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addWord()}
              placeholder="Type a word..."
              className="flex-1 border-2 border-purple-200 rounded-xl px-3 py-2 text-lg font-bold focus:outline-none focus:border-purple-500 transition-colors"
              maxLength={10} />
            <button onClick={addWord}
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-xl font-bold shadow-md hover:scale-105 active:scale-95 transition-transform">
              + Add
            </button>
          </div>
          <p className="text-gray-400 text-xs mt-1">Press Enter or tap Add. Separate multiple with commas.</p>
          <textarea placeholder="Paste multiple words here (spaces, commas, or new lines)..."
            className="w-full mt-2 border-2 border-purple-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-500 resize-none" rows={2}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addMultiple(e.target.value); e.target.value = ""; } }} />
        </div>

        {/* Upload Image + OCR */}
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
          <h3 className="font-bold text-purple-700 mb-2 text-sm">📷 Upload Word List Image (Auto-Extract)</h3>
          <p className="text-gray-400 text-xs mb-2">Upload a photo of a word list and we'll automatically read the words!</p>
          <div className="flex gap-2 items-center">
            <button onClick={() => fileRef.current?.click()}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-2 rounded-xl font-bold shadow-md hover:scale-105 active:scale-95 transition-transform text-sm">
              📷 Upload Photo
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
            {imagePreview && !extracting && (
              <button onClick={() => { setImagePreview(null); setExtractedWords([]); setExtractedText(""); setOcrError(""); }}
                className="text-gray-400 text-xs hover:text-red-500 font-bold">✕ Clear</button>
            )}
          </div>

          {imagePreview && (
            <div className="mt-3">
              <img src={imagePreview} alt="Uploaded" className="w-full rounded-xl border-2 border-purple-200 max-h-48 object-contain bg-gray-50" />

              {extracting && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="animate-spin text-xl">🔍</div>
                    <p className="text-purple-600 text-sm font-bold">{ocrStatus}</p>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
                      style={{ width: ocrProgress + "%" }} />
                  </div>
                  <p className="text-gray-400 text-xs mt-1 text-center">{ocrProgress}%</p>
                </div>
              )}

              {ocrError && (
                <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-amber-700 text-xs font-bold mb-2">{ocrError}</p>
                  <div className="flex gap-2 mb-2">
                    <button onClick={() => { setExtracting(true); setOcrError(""); setOcrProgress(0); runOCR(imagePreview); }}
                      className="bg-blue-500 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-blue-600">🔄 Retry</button>
                  </div>
                  <div className="flex gap-2">
                    <input placeholder="Type words separated by spaces..."
                      className="flex-1 border-2 border-amber-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500"
                      onKeyDown={e => { if (e.key === "Enter") { addMultiple(e.target.value); e.target.value = ""; } }} />
                    <button onClick={e => { const inp = e.target.parentElement.querySelector("input"); addMultiple(inp.value); inp.value = ""; }}
                      className="bg-amber-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold">+ Add</button>
                  </div>
                </div>
              )}

              {!extracting && extractedWords.length > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-green-600 text-sm font-bold">✅ Found {extractedWords.length} words! Tap to add:</p>
                    <button onClick={addAllExtracted}
                      className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-bold hover:scale-105 active:scale-95 transition-transform shadow">
                      + Add All
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {extractedWords.map((w, i) => (
                      <button key={i} onClick={() => addExtractedWord(w)}
                        className="flex items-center gap-1 bg-gradient-to-r from-blue-100 to-cyan-100 hover:from-blue-200 hover:to-cyan-200 rounded-full px-3 py-1.5 border border-blue-200 transition-colors">
                        <span className="text-base">{getEmoji(w)}</span>
                        <span className="font-bold text-blue-800 text-sm">{w}</span>
                        <span className="text-green-600 text-xs font-bold ml-1">+</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!extracting && extractedText && (
                <details className="mt-2">
                  <summary className="text-gray-400 text-xs cursor-pointer hover:text-purple-500">Show raw text</summary>
                  <div className="mt-1 bg-gray-50 border border-gray-200 rounded-xl p-2 text-xs text-gray-600 whitespace-pre-wrap max-h-24 overflow-auto">{extractedText}</div>
                </details>
              )}

              {!extracting && !ocrError && (
                <div className="mt-2 bg-gray-50 border border-gray-200 rounded-xl p-2">
                  <p className="text-gray-500 text-xs font-bold mb-1">
                    {extractedWords.length > 0 ? "Missing a word? Add here:" : "Type words manually:"}
                  </p>
                  <div className="flex gap-2">
                    <input placeholder="Type words..."
                      className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-purple-500"
                      onKeyDown={e => { if (e.key === "Enter") { addMultiple(e.target.value); e.target.value = ""; } }} />
                    <button onClick={e => { const inp = e.target.parentElement.querySelector("input"); addMultiple(inp.value); inp.value = ""; }}
                      className="bg-purple-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold">+ Add</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Word List */}
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-purple-700 text-sm">Word List ({words.length} words)</h3>
            {words.length > 0 && (
              <button onClick={() => setWords([])} className="text-red-400 text-xs font-bold hover:text-red-600">Clear All</button>
            )}
          </div>
          {words.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">No words yet. Use presets, type, or upload an image!</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {words.map((w, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full px-2 py-1 group">
                  <WordImage word={w} size="sm" />
                  <span className="font-bold text-purple-800 text-sm">{w}</span>
                  <button onClick={() => removeWord(i)}
                    className="ml-1 text-red-400 hover:text-red-600 opacity-50 group-hover:opacity-100 font-bold text-xs">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Start / History */}
        <div className="flex gap-3">
          <button onClick={() => words.length >= 3 && onStartGame(words)} disabled={words.length < 3}
            className={`flex-1 py-3 rounded-2xl font-bold text-lg shadow-lg transition-all ${
              words.length >= 3 ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:scale-105 active:scale-95"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}>
            {words.length < 3 ? `Add ${3 - words.length} more word${3 - words.length > 1 ? "s" : ""}` : `🎮 Start Game (${words.length} words)`}
          </button>
          {history.length > 0 && (
            <button onClick={onViewHistory}
              className="bg-gradient-to-r from-amber-400 to-orange-500 text-white px-4 py-3 rounded-2xl font-bold shadow-lg hover:scale-105 active:scale-95 transition-transform">
              📊
            </button>
          )}
        </div>
      </div>
      <style>{`@keyframes toastSlide{0%{transform:translateY(-20px) translateX(-50%);opacity:0}100%{transform:translateY(0) translateX(-50%);opacity:1}}`}</style>
    </div>
  );
}

// ===========================================================
//  SPELLING GAME SCREEN
// ===========================================================
function SpellingGame({ words, onFinish, onBack, profile }) {
  const totalRounds = Math.min(words.length, 10);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [currentWord, setCurrentWord] = useState("");
  const [filled, setFilled] = useState([]);
  const [letterPool, setLetterPool] = useState([]);
  const [usedBtns, setUsedBtns] = useState(new Set());
  const [feedback, setFeedback] = useState(null);
  const [slotStates, setSlotStates] = useState([]);
  const [confettiKey, setConfettiKey] = useState(0);
  const [locked, setLocked] = useState(false);
  const [results, setResults] = useState([]);
  const [gameWords] = useState(() => shuffle(words).slice(0, totalRounds));
  const [shakeBtn, setShakeBtn] = useState(null);

  const setupRound = useCallback((idx) => {
    const word = gameWords[idx];
    setCurrentWord(word);
    const prefill = word.length >= 5;
    setFilled(prefill ? [word[0]] : []);
    setUsedBtns(new Set());
    setSlotStates(Array(word.length).fill("empty"));
    setLocked(false); setShakeBtn(null);

    const toPlace = prefill ? [...word].slice(1) : [...word];
    const allL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const dist = [];
    const maxD = Math.min(3, 8 - toPlace.length);
    while (dist.length < maxD) {
      const d = allL[Math.floor(Math.random() * 26)];
      if (![...word].includes(d) && !dist.includes(d)) dist.push(d);
    }
    setLetterPool(shuffle([...toPlace, ...dist]).map((l, i) => ({ letter: l, id: i })));
    speakWord(word);
  }, [gameWords]);

  useEffect(() => { setupRound(0); }, [setupRound]);

  const advanceRound = (newScore, newResults) => {
    const next = round + 1;
    if (next >= totalRounds) {
      onFinish({ score: newScore, total: totalRounds, results: newResults });
    } else {
      setRound(next); setLives(3); setupRound(next);
    }
  };

  const handleLetter = (btn) => {
    if (locked || usedBtns.has(btn.id)) return;
    playLetterPop();
    const nextIdx = filled.length;
    if (nextIdx >= currentWord.length) return;

    if (btn.letter === currentWord[nextIdx]) {
      playCorrectLetter();
      const nf = [...filled, btn.letter];
      setFilled(nf);
      setUsedBtns(new Set([...usedBtns, btn.id]));
      const ns = [...slotStates]; ns[nextIdx] = "filled"; setSlotStates(ns);

      if (nf.length === currentWord.length) {
        setLocked(true);
        ns.forEach((_, i) => ns[i] = "correct"); setSlotStates([...ns]);
        const ns2 = score + 1; setScore(ns2);
        playWordComplete(); setConfettiKey(k => k + 1); speakWord(currentWord);
        setFeedback({ text: "🎉 " + CHEER[Math.floor(Math.random() * CHEER.length)], color: "text-green-700", bg: "bg-green-100/95" });
        const nr = [...results, { word: currentWord, correct: true }]; setResults(nr);
        setTimeout(() => { setFeedback(null); advanceRound(ns2, nr); }, 2000);
      }
    } else {
      playWrongSound(); setShakeBtn(btn.id); setTimeout(() => setShakeBtn(null), 400);
      const nl = lives - 1; setLives(nl);
      setFeedback({ text: "❌ Try again!", color: "text-red-700", bg: "bg-red-100/95" });
      setTimeout(() => setFeedback(null), 800);

      if (nl <= 0) {
        setLocked(true);
        const ns = [...slotStates];
        for (let i = filled.length; i < currentWord.length; i++) ns[i] = "wrong";
        setSlotStates(ns);
        const nr = [...results, { word: currentWord, correct: false }]; setResults(nr);
        setTimeout(() => { setFeedback(null); advanceRound(score, nr); }, 2000);
      }
    }
  };

  const handleUndo = () => {
    if (locked) return;
    const pre = currentWord.length >= 5 ? 1 : 0;
    if (filled.length <= pre) return;
    const removed = filled[filled.length - 1];
    setFilled(filled.slice(0, -1));
    const ns = [...slotStates]; ns[filled.length - 1] = "empty"; setSlotStates(ns);
    for (const b of letterPool) {
      if (usedBtns.has(b.id) && b.letter === removed) {
        const nu = new Set(usedBtns); nu.delete(b.id); setUsedBtns(nu); break;
      }
    }
    playTone(300, 0.08, "sine", 0.1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-100 via-emerald-50 to-cyan-50 flex flex-col items-center relative overflow-hidden">
      <Confetti trigger={confettiKey} />
      <div className="w-full h-2 bg-gradient-to-r from-red-500 via-yellow-400 via-green-500 via-blue-500 to-purple-500" />

      {/* Top bar */}
      <div className="w-full flex justify-between items-center px-4 py-2">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="bg-white/70 backdrop-blur rounded-full px-3 py-1 shadow font-bold text-gray-500 text-sm hover:scale-105 active:scale-95 transition-transform">🏠</button>
          {profile?.kidPhoto && (
            <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white shadow">
              <img src={profile.kidPhoto} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          {profile?.kidName && (
            <span className="bg-white/70 backdrop-blur rounded-full px-2 py-0.5 shadow font-bold text-purple-600 text-xs">{profile.kidName}</span>
          )}
          <div className="bg-white/70 backdrop-blur rounded-full px-3 py-1 shadow font-bold text-pink-600 text-sm">⭐ {score}</div>
        </div>
        <div className="flex gap-1 text-lg">{[0,1,2].map(i => <span key={i}>{i < lives ? "❤️" : "🤍"}</span>)}</div>
        <div className="bg-white/70 backdrop-blur rounded-full px-3 py-1 shadow font-bold text-indigo-600 text-sm">{round + 1}/{totalRounds}</div>
      </div>

      {/* Game */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 w-full max-w-md px-4 pb-4">
        <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-4 shadow-lg w-full text-center">
          <div className="mb-1 flex justify-center animate-bounce" style={{ animationDuration: "2s" }}>
            <WordImage word={currentWord} size="lg" />
          </div>
          <button onClick={() => speakWord(currentWord)} className="text-3xl hover:scale-110 active:scale-90 transition-transform">🔊</button>
        </div>

        {/* Slots */}
        <div className="flex gap-2 justify-center flex-wrap">
          {currentWord.split("").map((letter, i) => {
            const st = slotStates[i]; const isFilled = i < filled.length;
            return (
              <div key={i} className={`w-11 h-14 md:w-14 md:h-16 rounded-xl flex items-center justify-center text-xl md:text-2xl font-bold transition-all duration-200 ${
                st === "correct" ? "border-green-500 bg-green-100 text-green-700 scale-105" :
                st === "wrong" ? "border-red-500 bg-red-100 text-red-700" :
                isFilled ? "border-purple-500 bg-purple-100 text-purple-700 scale-105" :
                "border-dashed border-purple-300 bg-white/50 text-gray-300"
              }`} style={{ borderWidth: 3 }}>
                {isFilled ? filled[i] : st === "wrong" ? letter : ""}
              </div>
            );
          })}
        </div>

        {/* Letters */}
        <div className="flex gap-2 justify-center flex-wrap">
          {letterPool.map((btn, idx) => {
            const used = usedBtns.has(btn.id);
            return (
              <button key={btn.id} onClick={() => handleLetter(btn)} disabled={used}
                className={`w-11 h-14 md:w-14 md:h-16 rounded-xl font-bold text-xl md:text-2xl text-white shadow-lg transition-all duration-150 bg-gradient-to-br ${LETTER_COLORS[idx % LETTER_COLORS.length]} ${
                  used ? "opacity-25 scale-85 cursor-not-allowed" : "hover:scale-110 active:scale-90 cursor-pointer"
                }`} style={{
                  textShadow: "1px 2px 2px rgba(0,0,0,0.2)",
                  animation: shakeBtn === btn.id ? "shake 0.4s ease" : undefined,
                }}>
                {btn.letter}
              </button>
            );
          })}
        </div>

        <button onClick={handleUndo}
          className="bg-white/70 backdrop-blur rounded-full px-5 py-2 font-bold text-purple-600 shadow hover:scale-105 active:scale-95 transition-transform text-sm">
          ↩ Undo
        </button>
      </div>

      {feedback && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 998 }}>
          <div className={`text-5xl md:text-7xl font-bold ${feedback.color} ${feedback.bg} px-12 py-6 rounded-3xl shadow-xl`} style={{ animation: "popIn 0.3s ease-out" }}>
            {feedback.text}
          </div>
        </div>
      )}

      <style>{`
        @keyframes popIn{0%{transform:scale(0.3);opacity:0}50%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
        @keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
        @keyframes confFall{0%{opacity:1;transform:translateY(0) rotate(0deg)}100%{opacity:0;transform:translateY(100vh) rotate(720deg)}}
      `}</style>
    </div>
  );
}

// ===========================================================
//  RESULTS SCREEN
// ===========================================================
function ResultsScreen({ data, onBack, onPlayAgain }) {
  const [confettiKey] = useState(Date.now());
  useEffect(() => { playCheer(); }, []);
  const { score, total, results, kidName, kidPhoto } = data;
  const pct = Math.round((score / total) * 100);
  const stars = pct >= 90 ? "🌟🌟🌟" : pct >= 70 ? "⭐⭐⭐" : pct >= 50 ? "⭐⭐" : "⭐";
  const displayName = kidName || "You";
  const msg = pct >= 90 ? `${displayName}, Spelling Champion!` : pct >= 70 ? `Great job, ${displayName}!` : pct >= 50 ? `Good job, ${displayName}!` : `Keep practicing, ${displayName}!`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-pink-50 flex flex-col items-center justify-center p-4 overflow-auto">
      <Confetti trigger={confettiKey} />
      <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-md w-full text-center">
        {kidPhoto && (
          <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-yellow-400 shadow-lg mx-auto mb-2">
            <img src={kidPhoto} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <h1 className="text-2xl md:text-3xl font-bold text-pink-600 mb-2">🎉 {msg}</h1>
        <div className="text-4xl md:text-5xl mb-2">{stars}</div>
        <div className="text-2xl font-bold text-orange-600 mb-4">⭐ {score}/{total} ({pct}%)</div>
        <div className="bg-gray-50 rounded-2xl p-3 mb-4 text-left max-h-48 overflow-auto">
          <h3 className="font-bold text-purple-700 text-sm mb-2">Word Results:</h3>
          {results.map((r, i) => (
            <div key={i} className={`flex items-center gap-2 py-1.5 px-2 rounded-lg mb-1 ${r.correct ? "bg-green-50" : "bg-red-50"}`}>
              <span className="text-lg">{r.correct ? "✅" : "❌"}</span>
              <WordImage word={r.word} size="sm" />
              <span className="font-bold text-gray-700">{r.word}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onPlayAgain}
            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 rounded-2xl font-bold text-lg shadow-lg hover:scale-105 active:scale-95 transition-transform">
            🔄 Play Again
          </button>
          <button onClick={onBack}
            className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-600 text-white py-3 rounded-2xl font-bold text-lg shadow-lg hover:scale-105 active:scale-95 transition-transform">
            ⚙️ Setup
          </button>
        </div>
      </div>
      <style>{`@keyframes confFall{0%{opacity:1;transform:translateY(0) rotate(0deg)}100%{opacity:0;transform:translateY(100vh) rotate(720deg)}}`}</style>
    </div>
  );
}

// ===========================================================
//  HISTORY SCREEN
// ===========================================================
function HistoryScreen({ history, onBack }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 overflow-auto">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl md:text-3xl font-bold text-indigo-700">📊 Score History</h1>
          <button onClick={onBack}
            className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 py-2 rounded-xl font-bold shadow hover:scale-105 active:scale-95 transition-transform text-sm">
            ← Back
          </button>
        </div>

        {history.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <p className="text-gray-400 text-lg">No games played yet!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...history].reverse().map((h, idx) => {
              const pct = Math.round((h.score / h.total) * 100);
              const stars = pct >= 90 ? "🌟🌟🌟" : pct >= 70 ? "⭐⭐⭐" : pct >= 50 ? "⭐⭐" : "⭐";
              return (
                <div key={idx} className="bg-white rounded-2xl shadow-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      {h.kidPhoto && (
                        <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-purple-300 shadow-sm">
                          <img src={h.kidPhoto} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div>
                        {h.kidName && <div className="font-bold text-purple-700 text-sm">{h.kidName}</div>}
                        <div className="text-gray-500 text-xs">
                          {h.parentName ? `by ${h.parentName} · ` : ""}
                          {new Date(h.date).toLocaleDateString("en-US", {
                            weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="text-lg">{stars}</div>
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="text-2xl font-bold text-pink-600">{h.score}/{h.total}</div>
                    <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${
                        pct >= 70 ? "bg-gradient-to-r from-green-400 to-emerald-500" :
                        pct >= 50 ? "bg-gradient-to-r from-yellow-400 to-amber-500" :
                        "bg-gradient-to-r from-red-400 to-orange-500"
                      }`} style={{ width: pct + "%" }} />
                    </div>
                    <div className="text-sm font-bold text-gray-500">{pct}%</div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {h.results.map((r, i) => (
                      <span key={i} className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${
                        r.correct ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}>
                        {r.correct ? "✓" : "✗"} {getEmoji(r.word)} {r.word}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================
//  MAIN APP
// ===========================================================
export default function App() {
  const [screen, setScreen] = useState("setup");
  const [gameWords, setGameWords] = useState([]);
  const [gameResult, setGameResult] = useState(null);
  const [profile, setProfile] = useState(() => {
    try { return JSON.parse(localStorage.getItem("spellingProfile") || '{"kidName":"","kidPhoto":"","parentName":""}'); } catch { return { kidName: "", kidPhoto: "", parentName: "" }; }
  });
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("spellingHistory") || "[]"); } catch { return []; }
  });

  const saveHistory = (h) => { try { localStorage.setItem("spellingHistory", JSON.stringify(h)); } catch(e) { console.warn("Storage full", e); } setHistory(h); };
  const saveProfile = (p) => { try { localStorage.setItem("spellingProfile", JSON.stringify(p)); } catch(e) { console.warn("Storage full", e); } setProfile(p); };

  const startGame = (w) => { setGameWords(w); setScreen("game"); };
  const finishGame = (r) => {
    const entry = { ...r, date: new Date().toISOString(), kidName: profile.kidName, kidPhoto: profile.kidPhoto, parentName: profile.parentName };
    setGameResult(entry);
    saveHistory([...history, entry]);
    setScreen("results");
  };

  return (
    <>
      {screen === "setup" && <ParentSetup onStartGame={startGame} history={history} onViewHistory={() => setScreen("history")} profile={profile} onProfileChange={saveProfile} />}
      {screen === "game" && <SpellingGame words={gameWords} onFinish={finishGame} onBack={() => setScreen("setup")} profile={profile} />}
      {screen === "results" && gameResult && <ResultsScreen data={gameResult} onBack={() => setScreen("setup")} onPlayAgain={() => setScreen("game")} />}
      {screen === "history" && <HistoryScreen history={history} onBack={() => setScreen("setup")} />}
    </>
  );
}
