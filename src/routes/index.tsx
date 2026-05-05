import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Settings as SettingsIcon, ShieldCheck, ShieldAlert, Mic, MicOff } from "lucide-react";
import { matchCommand, type CommandId, COMMANDS } from "@/lib/commands";
import { runCommand } from "@/lib/actions";
import { useSpeech } from "@/hooks/use-speech";

export const Route = createFileRoute("/")({ component: Index });

type OrbState = "idle" | "listening" | "activated" | "offline";

const WAKE_PHRASES = ["khul ja sim sim", "khulja sim sim", "khul ja simsim", "open sesame"];
const OFF_PHRASES = ["off app", "turn off app", "shut down", "shutdown", "band karo", "bandh karo", "stop assistant"];

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

function Particles() {
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

function Waveform({ active }: { active: boolean }) {
  const bars = Array.from({ length: 22 });
  return (
    <div className="flex h-10 items-center justify-center gap-[3px]">
      {bars.map((_, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full bg-cyan-300 ${active ? "animate-siri-wave" : ""}`}
          style={{
            height: active ? "100%" : "20%",
            animationDelay: `${(i % 11) * 0.07}s`,
            opacity: active ? 0.85 : 0.3,
            boxShadow: active ? "0 0 6px rgba(0,229,255,0.8)" : "none",
          }}
        />
      ))}
    </div>
  );
}

function Orb({ state }: { state: OrbState }) {
  const ringClass =
    state === "activated"
      ? "animate-orb-burst"
      : state === "listening"
        ? "animate-orb-breath"
        : "animate-orb-breath";

  const glowColor = state === "activated" ? "124,77,255" : "0,229,255";

  return (
    <div className="relative flex h-72 w-72 items-center justify-center">
      {/* Outer ripples */}
      {(state === "listening" || state === "activated") && (
        <>
          <span
            className="absolute inset-0 rounded-full animate-orb-ripple"
            style={{ border: `1px solid rgba(${glowColor},0.6)` }}
          />
          <span
            className="absolute inset-0 rounded-full animate-orb-ripple"
            style={{ border: `1px solid rgba(${glowColor},0.4)`, animationDelay: "0.8s" }}
          />
          <span
            className="absolute inset-0 rounded-full animate-orb-ripple"
            style={{ border: `1px solid rgba(${glowColor},0.25)`, animationDelay: "1.6s" }}
          />
        </>
      )}

      {/* Glow halo */}
      <span
        className="absolute inset-6 rounded-full blur-2xl"
        style={{ background: `radial-gradient(circle, rgba(${glowColor},0.55), transparent 70%)` }}
      />

      {/* Main orb */}
      <span
        className={`relative h-44 w-44 rounded-full ${ringClass}`}
        style={{
          background:
            state === "activated"
              ? "radial-gradient(circle at 30% 30%, #B388FF 0%, #7C4DFF 45%, #1A0F3D 100%)"
              : "radial-gradient(circle at 30% 30%, #B2EBFF 0%, #00E5FF 40%, #001E2E 100%)",
          boxShadow: `0 0 80px 10px rgba(${glowColor},0.55), inset 0 0 40px rgba(255,255,255,0.15)`,
        }}
      />

      {/* Inner ring */}
      <span
        className="absolute h-52 w-52 rounded-full"
        style={{ border: `1px solid rgba(${glowColor},0.35)` }}
      />
    </div>
  );
}

function Index() {
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [activated, setActivated] = useState(false);
  const [poweredOff, setPoweredOff] = useState(false);
  const [interim, setInterim] = useState("");
  const [lastFinal, setLastFinal] = useState("");
  const [lastCommand, setLastCommand] = useState<string>("");
  const [now, setNow] = useState("");
  const [micPermission, setMicPermission] = useState<"granted" | "denied" | "prompt" | "unknown">("unknown");
  const [showSettings, setShowSettings] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const torchStreamRef = useRef<MediaStream | null>(null);
  const torchOnRef = useRef(false);
  const activatedRef = useRef(false);
  const poweredOffRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clock
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  // Mic permission status
  useEffect(() => {
    const nav = navigator as Navigator & { permissions?: { query: (d: { name: string }) => Promise<{ state: string; onchange: (() => void) | null }> } };
    nav.permissions?.query({ name: "microphone" }).then((p) => {
      setMicPermission(p.state as "granted" | "denied" | "prompt");
      p.onchange = () => setMicPermission(p.state as "granted" | "denied" | "prompt");
    }).catch(() => setMicPermission("unknown"));
  }, []);

  // Action context
  const openCamera = useCallback(() => cameraInputRef.current?.click(), []);
  const toggleTorch = useCallback(async () => {
    try {
      if (torchOnRef.current && torchStreamRef.current) {
        torchStreamRef.current.getTracks().forEach((t) => t.stop());
        torchStreamRef.current = null;
        torchOnRef.current = false;
        toast("Torch off");
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
      toast.success("Torch on");
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
  const ctx = { openCamera, toggleTorch, playMusic, pauseMusic };

  const executeCommand = useCallback(
    async (id: CommandId, label: string) => {
      try {
        const msg = await runCommand(id, ctx);
        toast.success(label, { description: msg });
        setLastCommand(label);
      } catch (e) {
        toast.error("Action failed", { description: String(e) });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleFinal = useCallback(
    (text: string) => {
      setLastFinal(text);
      setInterim("");
      if (poweredOffRef.current) return;
      if (!activatedRef.current) {
        if (hasWake(text)) {
          activatedRef.current = true;
          setActivated(true);
          setOrbState("activated");
          toast.success("Activated", { description: "Yes, I'm here 👁️" });
          // brief burst, then back to listening for commands
          setTimeout(() => setOrbState("listening"), 1200);
        }
        return;
      }
      if (hasOff(text)) {
        poweredOffRef.current = true;
        activatedRef.current = false;
        setPoweredOff(true);
        setActivated(false);
        setOrbState("offline");
        try { speech.stop(); } catch { /* noop */ }
        toast("Assistant is OFF");
        return;
      }
      // After activation: route to a command
      const result = matchCommand(text);
      if (result.command) {
        executeCommand(result.command.id, result.command.label);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [executeCommand],
  );

  const handleError = useCallback((err: string) => {
    if (err === "not-allowed") {
      setMicPermission("denied");
      setOrbState("offline");
      toast.error("Microphone blocked", { description: "Allow mic permission in your browser." });
    }
    // ignore no-speech, aborted etc; loop will restart
  }, []);

  const speech = useSpeech({
    onFinal: handleFinal,
    onInterim: setInterim,
    onError: handleError,
  });

  // Always-on listening loop: auto-start and auto-restart whenever the
  // recognizer ends (timeout, silence). This gives a hands-free feel.
  useEffect(() => {
    if (!speech.supported) {
      setOrbState("offline");
      return;
    }
    if (poweredOff) return;
    if (!speech.listening) {
      restartTimerRef.current = setTimeout(() => speech.start(), 350);
    } else {
      setOrbState((s) => (s === "offline" ? "listening" : activatedRef.current && s === "activated" ? s : "listening"));
    }
    return () => {
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    };
  }, [speech.listening, speech.supported, speech.start, poweredOff]);

  const powerOn = useCallback(() => {
    poweredOffRef.current = false;
    setPoweredOff(false);
    setOrbState("listening");
    setTimeout(() => speech.start(), 200);
  }, [speech]);

  const headline =
    poweredOff
      ? "Assistant is OFF"
      : orbState === "offline"
      ? "Offline AI Ready 🔒"
      : orbState === "activated"
        ? "Yes, I'm here 👁️"
        : activated
          ? "Listening for a command…"
          : speech.listening
            ? "Listening…"
            : "Say \"khul ja sim sim\" to begin";

  const hint = poweredOff
    ? "Tap the orb or say \"khul ja sim sim\" to restart"
    : activated
      ? "Try: open camera • torch • play music • say \"off app\" to stop"
      : "Say \"khul ja sim sim\" to activate";

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

      {/* Top bar */}
      <header className="relative z-10 grid grid-cols-3 items-center px-6 pt-5 text-xs">
        <span className="text-cyan-300/70 tracking-[0.3em] uppercase">Lovable AI</span>
        <span className="text-center text-base font-medium tabular-nums">{now}</span>
        <span className="flex items-center justify-end gap-2 text-right">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${poweredOff ? "bg-rose-500" : "bg-emerald-400 animate-pulse"}`}
            style={{ boxShadow: poweredOff ? "0 0 10px rgba(244,63,94,0.8)" : "0 0 10px rgba(52,211,153,0.8)" }}
          />
          <span className={poweredOff ? "text-rose-300/80" : "text-emerald-300/80"}>
            {poweredOff ? "OFF" : "ON"}
          </span>
        </span>
      </header>

      {/* Center */}
      <section className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 px-6">
        <button
          type="button"
          onClick={poweredOff ? powerOn : undefined}
          className={`rounded-full outline-none ${poweredOff ? "cursor-pointer opacity-60 scale-75" : "cursor-default"} transition-transform duration-700`}
          aria-label={poweredOff ? "Restart assistant" : "Assistant orb"}
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

        <Waveform active={!poweredOff && (orbState === "listening" || orbState === "activated")} />

        <div className="min-h-[2.5rem] w-full max-w-md text-center">
          {interim && <p className="text-sm italic text-cyan-200/70">&ldquo;{interim}&rdquo;</p>}
          {!interim && lastFinal && <p className="text-sm text-white/80">&ldquo;{lastFinal}&rdquo;</p>}
        </div>

        {lastCommand && (
          <p className="text-[11px] uppercase tracking-[0.25em] text-cyan-300/50">
            Last command: <span className="text-cyan-200/80">{lastCommand}</span>
          </p>
        )}
      </section>

      {/* Bottom controls */}
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
              <span className="text-cyan-200/80">
                {speech.supported ? "Mic ready" : "Unsupported"}
              </span>
              <ShieldAlert className="h-4 w-4 text-cyan-300/60" />
            </>
          )}
        </div>
      </footer>

      {/* Settings sheet */}
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
              <p className="text-base font-medium text-cyan-200">Voice commands</p>
              <button
                className="text-xs text-cyan-300/70 hover:text-cyan-200"
                onClick={() => setShowSettings(false)}
              >
                Close
              </button>
            </div>
            <p className="mb-3 text-xs text-cyan-200/60">
              Wake phrase: <span className="text-cyan-300">"khul ja sim sim"</span>
            </p>
            <ul className="max-h-[50vh] space-y-1.5 overflow-y-auto text-xs text-white/70">
              {COMMANDS.map((c) => (
                <li key={c.id} className="flex justify-between gap-3">
                  <span className="text-white">{c.label}</span>
                  <span className="text-cyan-200/60">"{c.phrases?.[0] ?? c.keywords[0]}"</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}
