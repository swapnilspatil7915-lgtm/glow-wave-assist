import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Mic,
  Wifi,
  Signal,
  BatteryFull,
  Phone,
  Camera,
  Bluetooth,
  Music,
  Home,
  History,
  Settings,
  X,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

type AssistantState = "idle" | "listening" | "processing" | "offline";

const stateConfig: Record<
  AssistantState,
  { label: string; dot: string; bg: string; text: string }
> = {
  idle: {
    label: "Idle",
    dot: "bg-muted-foreground",
    bg: "bg-muted",
    text: "text-muted-foreground",
  },
  listening: {
    label: "Listening…",
    dot: "bg-emerald-500",
    bg: "bg-emerald-500/15",
    text: "text-emerald-500",
  },
  processing: {
    label: "Processing…",
    dot: "bg-blue-500",
    bg: "bg-blue-500/15",
    text: "text-blue-500",
  },
  offline: {
    label: "Offline Ready",
    dot: "bg-zinc-400",
    bg: "bg-zinc-500/15",
    text: "text-zinc-400",
  },
};

type SuggestionId = "call" | "camera" | "bluetooth" | "music";

const suggestions: { id: SuggestionId; label: string; icon: typeof Phone }[] = [
  { id: "call", label: "Call Mom", icon: Phone },
  { id: "camera", label: "Open Camera", icon: Camera },
  { id: "bluetooth", label: "Turn on Bluetooth", icon: Bluetooth },
  { id: "music", label: "Play Music", icon: Music },
];

// Demo audio (royalty-free chime) — swap for any track URL.
const DEMO_TRACK =
  "https://cdn.pixabay.com/download/audio/2022/03/15/audio_1718e0f3a8.mp3?filename=lofi-study-112191.mp3";

function StatusBar({ state }: { state: AssistantState }) {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  const cfg = stateConfig[state];
  return (
    <header className="flex items-center justify-between px-6 pt-4 text-sm">
      <span className="font-medium tabular-nums">{time}</span>
      <div
        className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${cfg.bg} ${cfg.text}`}
      >
        <span
          className={`h-2 w-2 rounded-full ${cfg.dot} ${
            state === "listening" ? "animate-pulse" : ""
          }`}
        />
        {cfg.label}
      </div>
      <div className="flex items-center gap-1.5 text-foreground/80">
        <Signal className="h-4 w-4" />
        <Wifi className="h-4 w-4" />
        <BatteryFull className="h-4 w-4" />
      </div>
    </header>
  );
}

function MicVisualizer({
  state,
  onClick,
}: {
  state: AssistantState;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex h-64 w-64 items-center justify-center focus:outline-none"
      aria-label="Activate assistant"
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
        } ${state === "offline" ? "opacity-50 grayscale" : ""}`}
      />
      <Mic className="relative z-10 h-16 w-16 text-primary-foreground" />
      {state === "listening" && (
        <div className="absolute -bottom-10 flex h-10 items-end gap-1">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <span
              key={i}
              className="w-1.5 rounded-full bg-emerald-500 animate-wave"
              style={{
                animationDelay: `${i * 0.1}s`,
                height: "30%",
              }}
            />
          ))}
        </div>
      )}
    </button>
  );
}

function Index() {
  const [state, setState] = useState<AssistantState>("idle");
  const [activeNav, setActiveNav] = useState<"home" | "history" | "settings">(
    "home",
  );
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const handleMic = () => {
    if (state === "listening") {
      setState("processing");
      setTimeout(() => setState("idle"), 1800);
    } else {
      setState("listening");
    }
  };

  const handleSuggestion = async (id: SuggestionId) => {
    switch (id) {
      case "call": {
        // Replace with real number when available.
        window.location.href = "tel:+10000000000";
        toast("Calling Mom…", { description: "Opening your phone dialer." });
        break;
      }
      case "camera": {
        cameraInputRef.current?.click();
        break;
      }
      case "bluetooth": {
        const nav = navigator as Navigator & {
          bluetooth?: { requestDevice: (o: object) => Promise<{ name?: string }> };
        };
        if (!nav.bluetooth) {
          toast.error("Bluetooth not supported", {
            description: "This browser doesn't expose Web Bluetooth.",
          });
          return;
        }
        try {
          const device = await nav.bluetooth.requestDevice({
            acceptAllDevices: true,
          });
          toast.success("Bluetooth ready", {
            description: device.name
              ? `Selected ${device.name}`
              : "Device selected.",
          });
        } catch {
          toast("Bluetooth cancelled");
        }
        break;
      }
      case "music": {
        if (!audioRef.current) {
          audioRef.current = new Audio(DEMO_TRACK);
          audioRef.current.loop = true;
        }
        if (musicPlaying) {
          audioRef.current.pause();
          setMusicPlaying(false);
          toast("Music paused");
        } else {
          try {
            await audioRef.current.play();
            setMusicPlaying(true);
            toast.success("Now playing", { description: "Lo-fi study mix" });
          } catch {
            toast.error("Couldn't start playback");
          }
        }
        break;
      }
    }
  };

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

      <section className="flex flex-1 flex-col items-center justify-center gap-12 px-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Hi, I'm Swapnil</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap the mic or say "Hey Swapnil"
          </p>
        </div>

        <MicVisualizer state={state} onClick={handleMic} />

        <div className="w-full max-w-md">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Smart Suggestions
          </p>
          <div className="grid grid-cols-2 gap-3">
            {suggestions.map(({ id, label, icon: Icon }) => (
              <button
                key={label}
                onClick={() => handleSuggestion(id)}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left text-sm font-medium shadow-sm transition hover:scale-[1.02] hover:border-primary/40 hover:bg-accent"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                {id === "music" && musicPlaying ? "Pause Music" : label}
              </button>
            ))}
          </div>

          {photoUrl && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
              <img
                src={photoUrl}
                alt="Captured preview"
                className="h-16 w-16 rounded-xl object-cover"
              />
              <div className="flex-1">
                <p className="text-sm font-medium">Last capture</p>
                <p className="text-xs text-muted-foreground">Tap to retake</p>
              </div>
              <button
                onClick={() => {
                  URL.revokeObjectURL(photoUrl);
                  setPhotoUrl(null);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Remove photo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </section>

      <nav className="sticky bottom-0 mx-4 mb-4 flex items-center justify-around rounded-3xl border border-border bg-card/80 p-2 shadow-lg backdrop-blur">
        {(
          [
            { id: "home", label: "Home", icon: Home },
            { id: "history", label: "History", icon: History },
            { id: "settings", label: "Settings", icon: Settings },
          ] as const
        ).map(({ id, label, icon: Icon }) => {
          const active = activeNav === id;
          return (
            <button
              key={id}
              onClick={() => setActiveNav(id)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 text-xs font-medium transition ${
                active
                  ? "bg-primary text-primary-foreground animate-nav-pop"
                  : "text-muted-foreground hover:text-foreground"
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
