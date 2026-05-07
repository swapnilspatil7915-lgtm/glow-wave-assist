import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Settings as SettingsIcon, ShieldCheck, ShieldAlert, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { matchCommand, type CommandId, COMMANDS } from "@/lib/commands";
import { runCommand } from "@/lib/actions";
import { useSpeech } from "@/hooks/use-speech";
import { Slider } from "@/components/ui/slider";
import { Cpu, CloudSun, CalendarClock, Send } from "lucide-react";

export const Route = createFileRoute("/")({ component: Index });

type OrbState = "idle" | "listening" | "processing" | "speaking" | "activated" | "offline" | "standby";
type VoiceGender = "female" | "male" | "jarvis";

const WAKE_PHRASES = ["hello sp", "hello s p", "hello especie", "hello speech"];
const OFF_PHRASES = ["off app", "turn off app", "shut down", "shutdown", "band karo", "bandh karo", "stop assistant"];

interface Prefs {
  alwaysListening: boolean;
  appControl: boolean;
  voiceResponse: boolean;
  volume: number; // 0-1
  silent: boolean;
  voiceGender: VoiceGender;
  onboarded: boolean;
  contacts: { name: string; number: string }[];
}

const DEFAULT_PREFS: Prefs = {
  alwaysListening: true,
  appControl: true,
  voiceResponse: true,
  volume: 0.9,
  silent: false,
  voiceGender: "jarvis",
  onboarded: false,
  contacts: [
    { name: "Mom", number: "+10000000000" },
    { name: "Dad", number: "+10000000001" },
  ],
};

function loadPrefs(): Prefs {
  if (typeof localStorage === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem("assistantPrefs");
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function hasWake(text: string) {
  const n = normalize(text);
  return WAKE_PHRASES.some((p) => n.includes(p));
}
function hasOff(text: string) {
  const n = normalize(text);
  return OFF_PHRASES.some((p) => n.includes(p));
}

function playChime() {
  try {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.1);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.2);
    setTimeout(() => ctx.close(), 350);
  } catch { /* noop */ }
}

function pickVoice(gender: VoiceGender): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const femaleHints = ["female", "samantha", "victoria", "zira", "google uk english female", "karen", "tessa", "fiona"];
  const maleHints = ["male", "daniel", "alex", "david", "google uk english male", "fred", "rishi"];
  const jarvisHints = ["daniel", "google uk english male", "alex", "david"];
  const hints = gender === "female" ? femaleHints : gender === "jarvis" ? jarvisHints : maleHints;
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  for (const h of hints) {
    const v = en.find((v) => v.name.toLowerCase().includes(h));
    if (v) return v;
  }
  return en[0] ?? voices[0];
}

function Particles() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dots = useMemo(
    () =>
      Array.from({ length: 28 }).map((_, i) => ({
        left: Math.random() * 100,
        size: 1 + Math.random() * 2.5,
        delay: Math.random() * 12,
        duration: 14 + Math.random() * 18,
        opacity: 0.3 + Math.random() * 0.5,
        key: i,
      })),
    [],
  );
  if (!mounted) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {dots.map((d) => (
        <span
          key={d.key}
          className="animate-particle absolute bottom-[-10vh] rounded-full bg-cyan-300/60"
          style={{
            left: `${d.left}%`,
            width: d.size,
            height: d.size,
            opacity: d.opacity,
            animationDelay: `${d.delay}s`,
            animationDuration: `${d.duration}s`,
            boxShadow: "0 0 8px rgba(0,229,255,0.8)",
          }}
        />
      ))}
    </div>
  );
}

function Waveform({ active, color }: { active: boolean; color: string }) {
  const bars = Array.from({ length: 22 });
  return (
    <div className="flex h-10 items-center justify-center gap-[3px]">
      {bars.map((_, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full ${active ? "animate-siri-wave" : ""}`}
          style={{
            height: active ? "100%" : "20%",
            background: color,
            animationDelay: `${(i % 11) * 0.07}s`,
            opacity: active ? 0.85 : 0.3,
            boxShadow: active ? `0 0 6px ${color}` : "none",
          }}
        />
      ))}
    </div>
  );
}

function getStateColors(state: OrbState): { glow: string; core: [string, string, string] } {
  switch (state) {
    case "speaking":
      return { glow: "124,77,255", core: ["#B388FF", "#7C4DFF", "#1A0F3D"] };
    case "processing":
      return { glow: "255,213,79", core: ["#FFE082", "#FFC107", "#3D2A00"] };
    case "activated":
      return { glow: "0,230,118", core: ["#B9F6CA", "#00E676", "#003D1F"] };
    case "offline":
      return { glow: "120,120,120", core: ["#888", "#444", "#111"] };
    case "standby":
      return { glow: "0,150,180", core: ["#5FC7DC", "#0288A3", "#001E2E"] };
    case "listening":
    case "idle":
    default:
      return { glow: "0,229,255", core: ["#B2EBFF", "#00E5FF", "#001E2E"] };
  }
}

function Orb({ state }: { state: OrbState }) {
  const ringClass =
    state === "activated" ? "animate-orb-burst" : "animate-orb-breath";
  const { glow, core } = getStateColors(state);
  const showRipples = state === "listening" || state === "activated" || state === "speaking" || state === "processing";

  return (
    <div className="relative flex h-72 w-72 items-center justify-center">
      {showRipples && (
        <>
          <span className="absolute inset-0 rounded-full animate-orb-ripple" style={{ border: `1px solid rgba(${glow},0.6)` }} />
          <span className="absolute inset-0 rounded-full animate-orb-ripple" style={{ border: `1px solid rgba(${glow},0.4)`, animationDelay: "0.8s" }} />
          <span className="absolute inset-0 rounded-full animate-orb-ripple" style={{ border: `1px solid rgba(${glow},0.25)`, animationDelay: "1.6s" }} />
        </>
      )}
      <span className="absolute inset-6 rounded-full blur-2xl" style={{ background: `radial-gradient(circle, rgba(${glow},0.55), transparent 70%)` }} />
      <span
        className={`relative h-44 w-44 rounded-full ${ringClass}`}
        style={{
          background: `radial-gradient(circle at 30% 30%, ${core[0]} 0%, ${core[1]} 45%, ${core[2]} 100%)`,
          boxShadow: `0 0 80px 10px rgba(${glow},0.55), inset 0 0 40px rgba(255,255,255,0.15)`,
        }}
      >
        <span
          className="flex h-full w-full items-center justify-center text-5xl font-light tracking-tight text-white"
          style={{ textShadow: `0 0 18px rgba(${glow},0.9), 0 0 4px rgba(255,255,255,0.6)`, fontFamily: "'SF Pro Display', system-ui, sans-serif" }}
        >
          SP
        </span>
      </span>
      <span className="absolute h-52 w-52 rounded-full" style={{ border: `1px solid rgba(${glow},0.35)` }} />
    </div>
  );
}

function Onboarding({ prefs, onSave }: { prefs: Prefs; onSave: (p: Prefs) => void }) {
  const [local, setLocal] = useState(prefs);
  const Toggle = ({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!value)}
      className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${value ? "border-cyan-400/60 bg-cyan-400/10" : "border-white/10 bg-white/5"}`}
    >
      <div>
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-cyan-200/60">{desc}</div>
      </div>
      <div className={`h-6 w-11 rounded-full p-0.5 transition ${value ? "bg-cyan-400" : "bg-white/15"}`}>
        <div className={`h-5 w-5 rounded-full bg-white shadow transition ${value ? "translate-x-5" : ""}`} />
      </div>
    </button>
  );

  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden px-6 text-white"
      style={{ background: "radial-gradient(ellipse at top, #0A0F1F 0%, #000000 70%)" }}
    >
      <Particles />
      <div className="relative z-10 w-full max-w-md space-y-5">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/70">Voice Control Access</p>
          <h1 className="mt-2 text-2xl font-light" style={{ textShadow: "0 0 18px rgba(0,229,255,0.45)" }}>
            Welcome, Sir.
          </h1>
          <p className="mt-1 text-xs text-cyan-200/60">Configure your assistant before activation.</p>
        </div>
        <div className="space-y-3">
          <Toggle
            label="🎤 Allow Always Listening"
            desc="Background mic for the wake phrase."
            value={local.alwaysListening}
            onChange={(v) => setLocal({ ...local, alwaysListening: v })}
          />
          <Toggle
            label="📱 Allow App Control Commands"
            desc="Open camera, torch, music, etc."
            value={local.appControl}
            onChange={(v) => setLocal({ ...local, appControl: v })}
          />
          <Toggle
            label="🔊 Allow Voice Responses"
            desc="Spoken replies. Off = text only."
            value={local.voiceResponse}
            onChange={(v) => setLocal({ ...local, voiceResponse: v })}
          />
        </div>
        <button
          onClick={() => onSave({ ...local, onboarded: true })}
          className="w-full rounded-2xl border border-cyan-400/60 bg-cyan-400/10 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/20"
          style={{ boxShadow: "0 0 30px rgba(0,229,255,0.25)" }}
        >
          Start Assistant
        </button>
      </div>
    </main>
  );
}

function Index() {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const savePrefs = useCallback((p: Prefs) => {
    setPrefs(p);
    if (typeof localStorage !== "undefined") localStorage.setItem("assistantPrefs", JSON.stringify(p));
  }, []);

  const [orbState, setOrbState] = useState<OrbState>("standby");
  const [activated, setActivated] = useState(false);
  const [poweredOff, setPoweredOff] = useState(false);
  const [interim, setInterim] = useState("");
  const [lastFinal, setLastFinal] = useState("");
  const [lastCommand, setLastCommand] = useState<string>("");
  const [now, setNow] = useState("");
  const [micPermission, setMicPermission] = useState<"granted" | "denied" | "prompt" | "unknown">("unknown");
  const [showSettings, setShowSettings] = useState(false);
  const [typed, setTyped] = useState("");
  const [memUsage, setMemUsage] = useState<number | null>(null);
  const [weather, setWeather] = useState<{ temp: number; code: number; city: string } | null>(null);
  const [nextEvent, setNextEvent] = useState<{ title: string; time: string }>({ title: "Focus block", time: "" });

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const torchStreamRef = useRef<MediaStream | null>(null);
  const torchOnRef = useRef(false);
  const activatedRef = useRef(false);
  const poweredOffRef = useRef(false);
  const speakingRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCmdRef = useRef<{ id: CommandId | null; at: number }>({ id: null, at: 0 });
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  // System memory (Chrome only) — non-intrusive widget
  useEffect(() => {
    const perf = performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } };
    const sample = () => {
      if (perf.memory) {
        setMemUsage(Math.round((perf.memory.usedJSHeapSize / perf.memory.jsHeapSizeLimit) * 100));
      }
    };
    sample();
    const id = setInterval(sample, 5000);
    return () => clearInterval(id);
  }, []);

  // Local weather via open-meteo (no API key)
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
          const j = await r.json();
          setWeather({
            temp: Math.round(j.current_weather?.temperature ?? 0),
            code: j.current_weather?.weathercode ?? 0,
            city: "Local",
          });
        } catch { /* noop */ }
      },
      () => {},
      { timeout: 5000 },
    );
  }, []);

  // Next "event" — placeholder, derived from current hour
  useEffect(() => {
    const h = new Date().getHours();
    const upcoming =
      h < 9 ? { title: "Morning briefing", time: "09:00" }
      : h < 12 ? { title: "Deep work", time: "11:00" }
      : h < 14 ? { title: "Lunch break", time: "13:00" }
      : h < 18 ? { title: "Focus block", time: "16:00" }
      : { title: "Wind down", time: "21:00" };
    setNextEvent(upcoming);
  }, [now]);

  useEffect(() => {
    const nav = navigator as Navigator & { permissions?: { query: (d: { name: string }) => Promise<{ state: string; onchange: (() => void) | null }> } };
    nav.permissions?.query({ name: "microphone" }).then((p) => {
      setMicPermission(p.state as "granted" | "denied" | "prompt");
      p.onchange = () => setMicPermission(p.state as "granted" | "denied" | "prompt");
    }).catch(() => setMicPermission("unknown"));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const sync = () => window.speechSynthesis.getVoices();
    sync();
    window.speechSynthesis.onvoiceschanged = sync;
  }, []);

  const openCamera = useCallback(() => cameraInputRef.current?.click(), []);
  const toggleTorch = useCallback(async () => {
    try {
      if (torchOnRef.current && torchStreamRef.current) {
        torchStreamRef.current.getTracks().forEach((t) => t.stop());
        torchStreamRef.current = null;
        torchOnRef.current = false;
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const track = stream.getVideoTracks()[0];
      const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
      if (!caps.torch) {
        stream.getTracks().forEach((t) => t.stop());
        toast.error("Torch not supported", { description: "Chrome Android only." });
        return;
      }
      await track.applyConstraints({ advanced: [{ torch: true } as MediaTrackConstraintSet] });
      torchStreamRef.current = stream;
      torchOnRef.current = true;
    } catch (e) {
      toast.error("Camera blocked", { description: String(e) });
    }
  }, []);
  const playMusic = useCallback(async () => {
    if (!audioRef.current) {
      audioRef.current = new Audio("https://cdn.pixabay.com/download/audio/2022/03/15/audio_1718e0f3a8.mp3?filename=lofi-study-112191.mp3");
      audioRef.current.loop = true;
    }
    await audioRef.current.play();
  }, []);
  const pauseMusic = useCallback(() => audioRef.current?.pause(), []);

  const speechRef = useRef<{ stop: () => void; start: () => void } | null>(null);

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      const p = prefsRef.current;
      if (!p.voiceResponse || p.silent || typeof window === "undefined" || !window.speechSynthesis) {
        resolve();
        return;
      }
      speakingRef.current = true;
      try { speechRef.current?.stop(); } catch { /* noop */ }
      setOrbState("speaking");

      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice(p.voiceGender);
      if (v) u.voice = v;
      u.rate = p.voiceGender === "jarvis" ? 1.0 : 1.05;
      u.pitch = p.voiceGender === "female" ? 1.1 : p.voiceGender === "jarvis" ? 0.85 : 0.9;
      u.volume = p.volume;
      u.onend = () => {
        speakingRef.current = false;
        setTimeout(() => {
          if (!poweredOffRef.current && prefsRef.current.alwaysListening) {
            setOrbState(activatedRef.current ? "listening" : "standby");
            try { speechRef.current?.start(); } catch { /* noop */ }
          } else if (!poweredOffRef.current) {
            setOrbState(activatedRef.current ? "listening" : "standby");
          }
          resolve();
        }, 180);
      };
      u.onerror = () => {
        speakingRef.current = false;
        resolve();
      };
      playChime();
      setTimeout(() => window.speechSynthesis.speak(u), 250);
    });
  }, []);

  const executeCommand = useCallback(
    async (id: CommandId, label: string) => {
      const now = Date.now();
      // Dedupe: ignore same command within 4s
      if (lastCmdRef.current.id === id && now - lastCmdRef.current.at < 4000) return;
      lastCmdRef.current = { id, at: now };

      if (!prefsRef.current.appControl) {
        await speak("App control disabled.");
        return;
      }
      setOrbState("processing");
      setLastCommand(label);

      // Short Jarvis-style replies
      const ack: Partial<Record<CommandId, string>> = {
        camera: "Opening camera.",
        torch: torchOnRef.current ? "Torch off." : "Torch on.",
        music_play: "Playing.",
        music_pause: "Paused.",
        whatsapp: "Opening WhatsApp.",
        maps: "Opening Maps.",
        youtube: "Opening YouTube.",
        gmail: "Opening Gmail.",
        browser: "Opening browser.",
        call: "Calling.",
        sms: "Messages.",
        time: `It's ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`,
        stop: "Stopped.",
      };
      const ctx = { openCamera, toggleTorch, playMusic, pauseMusic };
      try {
        await runCommand(id, ctx);
        await speak(ack[id] ?? "Done.");
      } catch (e) {
        await speak("Didn't catch that.");
        toast.error("Action failed", { description: String(e) });
      }
    },
    [openCamera, toggleTorch, playMusic, pauseMusic, speak],
  );

  const handleFinal = useCallback(
    (text: string) => {
      if (speakingRef.current) return;
      setLastFinal(text);
      setInterim("");
      if (poweredOffRef.current) return;
      if (!activatedRef.current) {
        if (hasWake(text)) {
          activatedRef.current = true;
          setActivated(true);
          setOrbState("activated");
          speak("Yes?");
        }
        return;
      }
      if (hasOff(text)) {
        poweredOffRef.current = true;
        activatedRef.current = false;
        setPoweredOff(true);
        setActivated(false);
        setOrbState("offline");
        try { speechRef.current?.stop(); } catch { /* noop */ }
        speak("Shutting down.");
        return;
      }
      // Call <name> — match any contact name in the transcript
      const norm = normalize(text);
      if (/\b(call|dial|phone|ring)\b/.test(norm)) {
        const contacts = prefsRef.current.contacts ?? [];
        const match = contacts.find((c) => {
          const n = normalize(c.name);
          return n && new RegExp(`\\b${n}\\b`).test(norm);
        });
        if (match) {
          lastCmdRef.current = { id: "call", at: Date.now() };
          setOrbState("processing");
          setLastCommand(`Call ${match.name}`);
          window.location.href = `tel:${match.number}`;
          speak(`Calling ${match.name}.`);
          return;
        }
      }
      const result = matchCommand(text);
      if (result.command) {
        executeCommand(result.command.id, result.command.label);
      }
    },
    [executeCommand, speak],
  );

  const handleError = useCallback((err: string) => {
    if (err === "not-allowed") {
      setMicPermission("denied");
      setOrbState("offline");
      toast.error("Microphone blocked", { description: "Allow mic permission in your browser." });
    }
  }, []);

  const speech = useSpeech({
    onFinal: handleFinal,
    onInterim: (t) => { if (!speakingRef.current) setInterim(t); },
    onError: handleError,
  });

  useEffect(() => {
    speechRef.current = { stop: speech.stop, start: speech.start };
  }, [speech.stop, speech.start]);

  useEffect(() => {
    if (!prefs.onboarded) return;
    if (!speech.supported) {
      setOrbState("offline");
      return;
    }
    if (poweredOff || speakingRef.current) return;
    if (!prefs.alwaysListening && !activatedRef.current) {
      // Don't auto-listen in standby if user disabled it
      setOrbState("standby");
      return;
    }
    if (!speech.listening) {
      restartTimerRef.current = setTimeout(() => {
        if (!speakingRef.current && !poweredOffRef.current) speech.start();
      }, 350);
    } else {
      setOrbState((s) => (s === "offline" || s === "idle" ? (activatedRef.current ? "listening" : "standby") : s));
    }
    return () => {
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    };
  }, [speech.listening, speech.supported, speech.start, poweredOff, prefs.onboarded, prefs.alwaysListening]);

  const powerOn = useCallback(() => {
    poweredOffRef.current = false;
    setPoweredOff(false);
    setOrbState("standby");
    setTimeout(() => speech.start(), 200);
  }, [speech]);

  const toggleSilent = useCallback(() => {
    savePrefs({ ...prefsRef.current, silent: !prefsRef.current.silent });
  }, [savePrefs]);

  const manualListen = useCallback(() => {
    if (poweredOffRef.current) {
      powerOn();
      return;
    }
    if (!activatedRef.current) {
      activatedRef.current = true;
      setActivated(true);
      setOrbState("activated");
      speak("Yes?");
    }
    try { speech.start(); } catch { /* noop */ }
  }, [powerOn, speech, speak]);

  if (!prefs.onboarded) {
    return <Onboarding prefs={prefs} onSave={savePrefs} />;
  }

  const headline =
    poweredOff
      ? "Assistant OFF"
      : orbState === "speaking"
        ? "Speaking…"
        : orbState === "processing"
          ? "Command received ✔️"
          : orbState === "offline"
            ? "Offline 🔒"
            : orbState === "activated"
              ? "Yes?"
              : activated
                ? "Listening…"
                : "Standby";

  const hint = poweredOff
    ? "Tap orb or say \"hello sp\""
    : activated
      ? "Try: open camera • torch • play music • say \"off app\""
      : "Say \"hello sp\" to activate";

  const waveColor = orbState === "speaking" ? "#B388FF" : orbState === "processing" ? "#FFC107" : orbState === "standby" ? "#0288A3" : "#00E5FF";

  return (
    <main
      className={`relative flex min-h-screen flex-col overflow-hidden text-white transition-all duration-700 ${poweredOff ? "grayscale brightness-50" : ""}`}
      style={{ background: "radial-gradient(ellipse at top, #0A0F1F 0%, #000000 70%)" }}
    >
      <Particles />

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) toast.success("Photo captured", { description: f.name });
          e.target.value = "";
        }}
      />

      <header className="relative z-10 grid grid-cols-3 items-center px-6 pt-5 text-xs">
        <span className="text-cyan-300/70 tracking-[0.3em] uppercase">Jarvis</span>
        <span className="text-center text-base font-medium tabular-nums">{now}</span>
        <span className="flex items-center justify-end gap-2 text-right">
          <span className="text-cyan-200/80 capitalize">{prefs.voiceGender}</span>
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${poweredOff ? "bg-rose-500" : "bg-emerald-400 animate-pulse"}`}
            style={{ boxShadow: poweredOff ? "0 0 10px rgba(244,63,94,0.8)" : "0 0 10px rgba(52,211,153,0.8)" }}
          />
        </span>
      </header>

      {/* System stat widgets — glassmorphism */}
      <div className="relative z-10 mx-auto mt-3 flex w-full max-w-md flex-wrap items-center justify-center gap-2 px-4">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] backdrop-blur-xl">
          <Cpu className="h-3.5 w-3.5 text-cyan-300" />
          <span className="text-cyan-100/80">Memory</span>
          <span className="tabular-nums text-white">{memUsage != null ? `${memUsage}%` : "—"}</span>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] backdrop-blur-xl">
          <CloudSun className="h-3.5 w-3.5 text-cyan-300" />
          <span className="text-cyan-100/80">{weather?.city ?? "Weather"}</span>
          <span className="tabular-nums text-white">{weather ? `${weather.temp}°` : "—"}</span>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] backdrop-blur-xl">
          <CalendarClock className="h-3.5 w-3.5 text-cyan-300" />
          <span className="text-cyan-100/80">{nextEvent.time || "Next"}</span>
          <span className="text-white">{nextEvent.title}</span>
        </div>
      </div>

      <section className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 px-6">
        <button
          type="button"
          onClick={poweredOff ? powerOn : manualListen}
          className={`rounded-full outline-none ${poweredOff ? "cursor-pointer opacity-60 scale-75" : "cursor-pointer"} transition-transform duration-700`}
          aria-label={poweredOff ? "Restart assistant" : "Listen now"}
        >
          <Orb state={orbState} />
        </button>

        <div className="flex flex-col items-center gap-3 text-center">
          <h1
            key={headline}
            className="animate-fade-up text-2xl font-light tracking-wide"
            style={{ textShadow: "0 0 18px rgba(0,229,255,0.45)" }}
          >
            {headline}
          </h1>
          <p className="text-xs text-cyan-200/50">{hint}</p>
        </div>

        <Waveform active={!poweredOff && orbState !== "idle" && orbState !== "offline"} color={waveColor} />

        <div className="min-h-[2.5rem] w-full max-w-md text-center">
          {interim && <p className="text-sm italic text-cyan-200/70">&ldquo;{interim}&rdquo;</p>}
          {!interim && lastFinal && <p className="text-sm text-white/80">&ldquo;{lastFinal}&rdquo;</p>}
        </div>

        {lastCommand && (
          <p className="text-[11px] uppercase tracking-[0.25em] text-cyan-300/50">
            Last: <span className="text-cyan-200/80">{lastCommand}</span>
          </p>
        )}
      </section>

      {/* Floating mute chip */}
      <button
        onClick={toggleSilent}
        className="fixed bottom-24 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/10 bg-white/5 p-3 backdrop-blur-md transition hover:bg-white/10"
        aria-label={prefs.silent ? "Unmute voice" : "Mute voice"}
      >
        {prefs.silent ? <VolumeX className="h-5 w-5 text-rose-300" /> : <Volume2 className="h-5 w-5 text-cyan-200" />}
      </button>

      <footer className="relative z-10 flex items-center justify-between px-6 pb-6">
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 backdrop-blur-md transition hover:bg-white/10"
          aria-label="Settings"
        >
          <SettingsIcon className="h-5 w-5 text-cyan-200" />
        </button>

        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs backdrop-blur-md">
          {micPermission === "granted" ? (
            <>
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span className="text-emerald-300/90">Mic granted</span>
            </>
          ) : micPermission === "denied" ? (
            <>
              <MicOff className="h-4 w-4 text-rose-400" />
              <span className="text-rose-300/90">Mic blocked</span>
            </>
          ) : (
            <>
              <Mic className="h-4 w-4 text-cyan-300" />
              <span className="text-cyan-200/80">{speech.supported ? "Mic ready" : "Unsupported"}</span>
              <ShieldAlert className="h-4 w-4 text-cyan-300/60" />
            </>
          )}
        </div>
      </footer>

      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl border border-white/10 bg-[#0A0F1F]/95 p-5 text-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-base font-medium text-cyan-200">Settings</p>
              <button className="text-xs text-cyan-300/70 hover:text-cyan-200" onClick={() => setShowSettings(false)}>Close</button>
            </div>

            {/* Permissions */}
            <p className="mb-2 text-xs uppercase tracking-widest text-cyan-300/60">Permissions</p>
            <div className="mb-4 space-y-2">
              {[
                { key: "alwaysListening" as const, label: "🎤 Always Listening" },
                { key: "appControl" as const, label: "📱 App Control" },
                { key: "voiceResponse" as const, label: "🔊 Voice Responses" },
              ].map((row) => (
                <button
                  key={row.key}
                  onClick={() => savePrefs({ ...prefs, [row.key]: !prefs[row.key] })}
                  className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3"
                >
                  <span className="text-white">{row.label}</span>
                  <span className={`h-5 w-9 rounded-full p-0.5 transition ${prefs[row.key] ? "bg-cyan-400" : "bg-white/15"}`}>
                    <span className={`block h-4 w-4 rounded-full bg-white transition ${prefs[row.key] ? "translate-x-4" : ""}`} />
                  </span>
                </button>
              ))}
            </div>

            {/* Voice style */}
            <p className="mb-2 text-xs uppercase tracking-widest text-cyan-300/60">Voice Style</p>
            <div className="mb-4 grid grid-cols-3 gap-2">
              {(["jarvis", "male", "female"] as VoiceGender[]).map((g) => (
                <button
                  key={g}
                  onClick={() => { savePrefs({ ...prefs, voiceGender: g }); speak(g === "jarvis" ? "At your service." : `Hello.`); }}
                  className={`rounded-xl border p-3 text-center transition ${prefs.voiceGender === g ? "border-cyan-400 bg-cyan-400/10" : "border-white/10 bg-white/5"}`}
                >
                  <div className="text-lg">{g === "jarvis" ? "🤖" : g === "female" ? "👩" : "👨"}</div>
                  <div className="text-xs capitalize text-white">{g}</div>
                </button>
              ))}
            </div>

            {/* Volume */}
            <p className="mb-2 text-xs uppercase tracking-widest text-cyan-300/60">Voice Volume</p>
            <div className="mb-3 flex items-center gap-3">
              <Volume2 className="h-4 w-4 text-cyan-300" />
              <Slider
                value={[Math.round(prefs.volume * 100)]}
                onValueChange={(v) => savePrefs({ ...prefs, volume: (v[0] ?? 0) / 100 })}
                max={100}
                step={5}
              />
              <span className="w-10 text-right text-xs tabular-nums text-cyan-200/80">{Math.round(prefs.volume * 100)}%</span>
            </div>
            <button
              onClick={toggleSilent}
              className={`mb-4 w-full rounded-xl border p-3 text-sm transition ${prefs.silent ? "border-rose-400/60 bg-rose-400/10 text-rose-200" : "border-white/10 bg-white/5 text-white"}`}
            >
              {prefs.silent ? "🔕 Silent Mode ON" : "🔔 Silent Mode OFF"}
            </button>

            {/* Commands */}
            <p className="mb-2 text-xs uppercase tracking-widest text-cyan-300/60">Voice commands</p>
            <p className="mb-2 text-xs uppercase tracking-widest text-cyan-300/60">Contacts</p>
            <div className="mb-3 space-y-2">
              {prefs.contacts.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={c.name}
                    onChange={(e) => {
                      const next = [...prefs.contacts];
                      next[i] = { ...next[i], name: e.target.value };
                      savePrefs({ ...prefs, contacts: next });
                    }}
                    placeholder="Name"
                    className="w-1/3 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-400/60"
                  />
                  <input
                    value={c.number}
                    onChange={(e) => {
                      const next = [...prefs.contacts];
                      next[i] = { ...next[i], number: e.target.value };
                      savePrefs({ ...prefs, contacts: next });
                    }}
                    placeholder="+1..."
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-400/60"
                  />
                  <button
                    onClick={() => savePrefs({ ...prefs, contacts: prefs.contacts.filter((_, j) => j !== i) })}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-rose-300 hover:bg-white/10"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => savePrefs({ ...prefs, contacts: [...prefs.contacts, { name: "", number: "" }] })}
                className="w-full rounded-lg border border-cyan-400/40 bg-cyan-400/5 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-400/10"
              >
                + Add contact
              </button>
              <p className="text-[11px] text-cyan-200/50">Say "call [name]" to dial. e.g. "call dad", "call priya".</p>
            </div>

            <p className="mb-3 text-xs text-cyan-200/60">
              Wake phrase: <span className="text-cyan-300">"hello sp"</span>
            </p>
            <ul className="max-h-[30vh] space-y-1.5 overflow-y-auto text-xs text-white/70">
              {COMMANDS.map((c) => (
                <li key={c.id} className="flex justify-between gap-3">
                  <span className="text-white">{c.label}</span>
                  <span className="text-cyan-200/60">"{c.phrases?.[0] ?? c.keywords[0]}"</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => savePrefs({ ...prefs, onboarded: false })}
              className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 p-2 text-xs text-cyan-200/70 hover:bg-white/10"
            >
              Re-run onboarding
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
