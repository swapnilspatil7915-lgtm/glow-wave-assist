import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Mic, MicOff, Wifi, Signal, BatteryFull,
  Phone, Camera, Flashlight, Music, MessageCircle,
  Map, Youtube, Mail, Globe, Clock, X, Home, History, Settings,
} from "lucide-react";
import { COMMANDS, matchCommand, type CommandId } from "@/lib/commands";
import { runCommand } from "@/lib/actions";
import { useSpeech } from "@/hooks/use-speech";

export const Route = createFileRoute("/")({ component: Index });

type AssistantState = "idle" | "listening" | "processing" | "offline";

const stateConfig: Record<AssistantState, { label: string; dot: string; bg: string; text: string }> = {
  idle: { label: "Idle", dot: "bg-muted-foreground", bg: "bg-muted", text: "text-muted-foreground" },
  listening: { label: "Listening…", dot: "bg-emerald-500", bg: "bg-emerald-500/15", text: "text-emerald-500" },
  processing: { label: "Processing…", dot: "bg-blue-500", bg: "bg-blue-500/15", text: "text-blue-500" },
  offline: { label: "Offline Ready", dot: "bg-zinc-400", bg: "bg-zinc-500/15", text: "text-zinc-400" },
};

const ICONS: Record<CommandId, typeof Phone> = {
  call: Phone, sms: MessageCircle, camera: Camera, torch: Flashlight,
  music_play: Music, music_pause: Music, whatsapp: MessageCircle,
  maps: Map, youtube: Youtube, gmail: Mail, browser: Globe, time: Clock, stop: X,
};

const DEMO_TRACK =
  "https://cdn.pixabay.com/download/audio/2022/03/15/audio_1718e0f3a8.mp3?filename=lofi-study-112191.mp3";

function StatusBar({ state }: { state: AssistantState }) {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  const cfg = stateConfig[state];
  return (
    <header className="flex items-center justify-between px-6 pt-4 text-sm">
      <span className="font-medium tabular-nums">{time}</span>
      <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
        <span className={`h-2 w-2 rounded-full ${cfg.dot} ${state === "listening" ? "animate-pulse" : ""}`} />
        {cfg.label}
      </div>
      <div className="flex items-center gap-1.5 text-foreground/80">
        <Signal className="h-4 w-4" /><Wifi className="h-4 w-4" /><BatteryFull className="h-4 w-4" />
      </div>
    </header>
  );
}

function MicVisualizer({ state, onClick, supported }: { state: AssistantState; onClick: () => void; supported: boolean }) {
  return (
    <button
      onClick={onClick}
      className="relative flex h-64 w-64 items-center justify-center focus:outline-none disabled:opacity-50"
      aria-label="Activate assistant"
      disabled={!supported}
    >
      {state === "listening" && (
        <>
          <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-mic-pulse" />
          <span className="absolute inset-6 rounded-full bg-emerald-500/30 animate-mic-pulse [animation-delay:0.3s]" />
        </>
      )}
      {state === "processing" && (
        <span className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 border-r-blue-500/40 animate-ring-spin" />
      )}
      <span
        className={`absolute inset-10 rounded-full bg-gradient-to-br from-primary to-primary/70 ${
          state === "idle" ? "animate-mic-glow" : ""
        } ${!supported ? "grayscale opacity-50" : ""}`}
      />
      {supported ? (
        <Mic className="relative z-10 h-16 w-16 text-primary-foreground" />
      ) : (
        <MicOff className="relative z-10 h-16 w-16 text-primary-foreground" />
      )}
    </button>
  );
}

function Index() {
  const [state, setState] = useState<AssistantState>("idle");
  const [activeNav, setActiveNav] = useState<"home" | "history" | "settings">("home");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [history, setHistory] = useState<{ said: string; matched: string; at: string }[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const torchStreamRef = useRef<MediaStream | null>(null);
  const torchOnRef = useRef(false);

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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      const track = stream.getVideoTracks()[0];
      const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
      if (!caps.torch) {
        stream.getTracks().forEach((t) => t.stop());
        toast.error("Torch not supported on this device/browser", {
          description: "Works on Chrome Android only.",
        });
        return;
      }
      await track.applyConstraints({ advanced: [{ torch: true } as MediaTrackConstraintSet] });
      torchStreamRef.current = stream;
      torchOnRef.current = true;
      toast.success("Torch on");
    } catch (e) {
      toast.error("Could not access camera for torch", { description: String(e) });
    }
  }, []);

  const playMusic = useCallback(async () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(DEMO_TRACK);
      audioRef.current.loop = true;
    }
    await audioRef.current.play();
  }, []);
  const pauseMusic = useCallback(() => audioRef.current?.pause(), []);

  const ctx = { openCamera, toggleTorch, playMusic, pauseMusic };

  const executeCommand = useCallback(
    async (id: CommandId, said: string, matchedLabel: string) => {
      setState("processing");
      try {
        const msg = await runCommand(id, ctx);
        toast.success(matchedLabel, { description: msg });
      } catch (e) {
        toast.error("Action failed", { description: String(e) });
      } finally {
        setHistory((h) =>
          [{ said, matched: matchedLabel, at: new Date().toLocaleTimeString() }, ...h].slice(0, 20),
        );
        setTimeout(() => setState("idle"), 600);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleFinal = useCallback(
    (text: string) => {
      setTranscript(text);
      setInterim("");
      const result = matchCommand(text);
      if (result.command) {
        executeCommand(result.command.id, text, result.command.label);
      } else {
        toast.error("Didn't catch a command", { description: `"${text}"` });
        setState("idle");
      }
    },
    [executeCommand],
  );

  const handleError = useCallback((err: string) => {
    setState("idle");
    if (err === "no-speech") return;
    if (err === "not-allowed") {
      toast.error("Microphone blocked", { description: "Allow mic permission in your browser." });
      return;
    }
    toast.error("Speech error", { description: err });
  }, []);

  const speech = useSpeech({
    onFinal: handleFinal,
    onInterim: setInterim,
    onError: handleError,
  });

  // Reflect speech state in UI state.
  useEffect(() => {
    if (!speech.supported) {
      setState("offline");
    } else if (speech.listening) {
      setState("listening");
    } else if (state === "listening") {
      setState("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.listening, speech.supported]);

  const handleMic = () => {
    if (!speech.supported) {
      toast.error("Speech recognition not supported", {
        description: "Use Chrome on Android or desktop Chrome.",
      });
      return;
    }
    if (speech.listening) speech.stop();
    else {
      setTranscript("");
      setInterim("");
      speech.start();
    }
  };

  const handleSuggestion = (id: CommandId, label: string) => executeCommand(id, label, label);

  const handleCameraFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      toast.success("Photo captured", { description: file.name });
    }
    e.target.value = "";
  };

  // Subset shown as quick-tap suggestions.
  const suggestionIds: CommandId[] = ["call", "camera", "torch", "music_play", "whatsapp", "maps"];
  const suggestions = suggestionIds
    .map((id) => COMMANDS.find((c) => c.id === id)!)
    .filter(Boolean);

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-background via-background to-muted">
      <StatusBar state={state} />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraFile}
      />

      <section className="flex flex-1 flex-col items-center justify-start gap-8 px-6 pt-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Hi, I'm Swapnil</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap the mic and say things like &ldquo;open camera&rdquo;, &ldquo;turn on torch&rdquo;, &ldquo;play music&rdquo;
          </p>
        </div>

        <MicVisualizer state={state} onClick={handleMic} supported={speech.supported} />

        <div className="min-h-[3rem] w-full max-w-md text-center">
          {interim && <p className="text-sm italic text-muted-foreground">&ldquo;{interim}&rdquo;</p>}
          {!interim && transcript && (
            <p className="text-sm font-medium">&ldquo;{transcript}&rdquo;</p>
          )}
        </div>

        <div className="w-full max-w-md">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Smart Suggestions
          </p>
          <div className="grid grid-cols-2 gap-3">
            {suggestions.map((cmd) => {
              const Icon = ICONS[cmd.id];
              return (
                <button
                  key={cmd.id}
                  onClick={() => handleSuggestion(cmd.id, cmd.label)}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left text-sm font-medium shadow-sm transition hover:scale-[1.02] hover:border-primary/40 hover:bg-accent"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  {cmd.label}
                </button>
              );
            })}
          </div>

          {photoUrl && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
              <button
                onClick={() => setPhotoOpen(true)}
                className="shrink-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Open full-screen preview"
              >
                <img src={photoUrl} alt="Captured preview" className="h-16 w-16 rounded-xl object-cover" />
              </button>
              <div className="flex-1">
                <p className="text-sm font-medium">Last capture</p>
                <p className="text-xs text-muted-foreground">Tap to preview</p>
              </div>
              <button
                onClick={() => {
                  URL.revokeObjectURL(photoUrl);
                  setPhotoUrl(null);
                  setPhotoOpen(false);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Remove photo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {activeNav === "history" && history.length > 0 && (
            <div className="mt-4 rounded-2xl border border-border bg-card p-3 shadow-sm">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Recent commands
              </p>
              <ul className="space-y-2">
                {history.map((h, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="truncate"><span className="font-medium">{h.matched}</span> <span className="text-muted-foreground">— "{h.said}"</span></span>
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">{h.at}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeNav === "settings" && (
            <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm text-sm space-y-2">
              <p className="font-medium">Available voice commands</p>
              <ul className="text-muted-foreground text-xs space-y-1">
                {COMMANDS.map((c) => (
                  <li key={c.id}>
                    <span className="font-medium text-foreground">{c.label}</span> — try: "{c.phrases?.[0] ?? c.keywords[0]}"
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {photoUrl && photoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setPhotoOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            onClick={(e) => { e.stopPropagation(); setPhotoOpen(false); }}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20"
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={photoUrl}
            alt="Captured full preview"
            className="max-h-[90vh] max-w-[95vw] rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <nav className="sticky bottom-0 mx-4 mb-4 mt-6 flex items-center justify-around rounded-3xl border border-border bg-card/80 p-2 shadow-lg backdrop-blur">
        {([
          { id: "home", label: "Home", icon: Home },
          { id: "history", label: "History", icon: History },
          { id: "settings", label: "Settings", icon: Settings },
        ] as const).map(({ id, label, icon: Icon }) => {
          const active = activeNav === id;
          return (
            <button
              key={id}
              onClick={() => setActiveNav(id)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 text-xs font-medium transition ${
                active ? "bg-primary text-primary-foreground animate-nav-pop" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          );
        })}
      </nav>
    </main>
  );
}