import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Mic,
  Camera,
  MapPin,
  Contact as ContactIcon,
  Bell,
  Lock,
  Wifi,
  Globe,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
} from "lucide-react";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "Security Dashboard — JARVIS OS" },
      {
        name: "description",
        content:
          "Permission transparency, microphone and camera usage history, VPN encryption status, and live threat detection summary.",
      },
      { property: "og:title", content: "Security Dashboard — JARVIS OS" },
      {
        property: "og:description",
        content:
          "Audit permissions, sensor access history, encryption, and threats in one futuristic HUD.",
      },
    ],
  }),
  component: SecurityDashboard,
});

type PermStatus = "granted" | "denied" | "ask";

interface PermRow {
  id: string;
  label: string;
  icon: typeof Mic;
  status: PermStatus;
  detail: string;
}

interface UsageEvent {
  id: string;
  sensor: "Microphone" | "Camera";
  app: string;
  when: string;
  duration: string;
  ok: boolean;
}

interface Threat {
  id: string;
  level: "low" | "medium" | "high";
  title: string;
  detail: string;
  when: string;
}

function useNow() {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function StatusPill({ status }: { status: PermStatus }) {
  const map = {
    granted: { label: "Granted", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30" },
    denied: { label: "Denied", cls: "bg-rose-500/15 text-rose-300 border-rose-400/30" },
    ask: { label: "Ask each time", cls: "bg-amber-500/15 text-amber-300 border-amber-400/30" },
  } as const;
  const v = map[status];
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${v.cls}`}>
      {v.label}
    </span>
  );
}

function SecurityDashboard() {
  const now = useNow();

  const [perms, setPerms] = useState<PermRow[]>([
    { id: "mic", label: "Microphone", icon: Mic, status: "granted", detail: "Used by voice assistant for wake word." },
    { id: "cam", label: "Camera", icon: Camera, status: "ask", detail: "Required for face HUD scan." },
    { id: "loc", label: "Location", icon: MapPin, status: "denied", detail: "Not used. Disabled for privacy." },
    { id: "con", label: "Contacts", icon: ContactIcon, status: "granted", detail: "Used to dial saved contacts." },
    { id: "ntf", label: "Notifications", icon: Bell, status: "granted", detail: "Alerts and assistant replies." },
  ]);

  const usage: UsageEvent[] = useMemo(
    () => [
      { id: "u1", sensor: "Microphone", app: "JARVIS OS", when: "2 min ago", duration: "00:08", ok: true },
      { id: "u2", sensor: "Microphone", app: "JARVIS OS", when: "14 min ago", duration: "00:03", ok: true },
      { id: "u3", sensor: "Camera", app: "JARVIS OS", when: "1 hr ago", duration: "00:12", ok: true },
      { id: "u4", sensor: "Microphone", app: "Background", when: "3 hr ago", duration: "00:01", ok: false },
      { id: "u5", sensor: "Camera", app: "JARVIS OS", when: "Yesterday", duration: "00:22", ok: true },
    ],
    [],
  );

  const threats: Threat[] = [
    { id: "t1", level: "low", title: "Open Wi-Fi nearby", detail: "Unsecured network 'CafeFree' detected.", when: "5 min ago" },
    { id: "t2", level: "medium", title: "Background mic access", detail: "An app accessed mic while in background.", when: "3 hr ago" },
  ];

  const grantedCount = perms.filter((p) => p.status === "granted").length;
  const score = Math.max(
    0,
    Math.min(
      100,
      100 -
        threats.reduce((acc, t) => acc + (t.level === "high" ? 30 : t.level === "medium" ? 15 : 5), 0) -
        (perms.find((p) => p.id === "loc")?.status === "granted" ? 5 : 0),
    ),
  );
  const scoreLabel = score >= 85 ? "Secure" : score >= 65 ? "Caution" : "At risk";
  const scoreColor = score >= 85 ? "0,230,118" : score >= 65 ? "255,213,79" : "239,83,80";

  function cyclePerm(id: string) {
    setPerms((arr) =>
      arr.map((p) => {
        if (p.id !== id) return p;
        const next: PermStatus = p.status === "granted" ? "ask" : p.status === "ask" ? "denied" : "granted";
        return { ...p, status: next };
      }),
    );
  }

  return (
    <main
      className="relative min-h-dvh w-full overflow-hidden text-white"
      style={{
        background:
          "radial-gradient(circle at 20% 0%, rgba(0,229,255,0.18), transparent 55%), radial-gradient(circle at 80% 100%, rgba(124,77,255,0.18), transparent 55%), #05070d",
      }}
    >
      {/* Grid lines */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,229,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.6) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative z-10 mx-auto flex max-w-md flex-col gap-4 p-4 pb-24">
        {/* Top bar */}
        <header className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur-md">
          <Link
            to="/"
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-cyan-200 transition hover:bg-white/10"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Home
          </Link>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-cyan-200/70">
            <Activity className="h-3 w-3 animate-pulse text-emerald-300" />
            Live
            <span className="ml-2 text-white/50">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
          </div>
        </header>

        {/* Title */}
        <div className="text-center">
          <h1
            className="text-2xl font-semibold tracking-[0.2em]"
            style={{ textShadow: "0 0 18px rgba(0,229,255,0.5)" }}
          >
            SECURITY HUD
          </h1>
          <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-200/60">
            Threat • Permissions • Encryption
          </p>
        </div>

        {/* Score ring */}
        <section
          className="relative flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md"
          style={{ boxShadow: `inset 0 0 36px rgba(${scoreColor},0.08)` }}
        >
          <div
            className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(rgb(${scoreColor}) ${score * 3.6}deg, rgba(255,255,255,0.08) 0)`,
            }}
          >
            <div className="flex h-[78%] w-[78%] flex-col items-center justify-center rounded-full bg-[#05070d]">
              <div className="text-2xl font-semibold" style={{ color: `rgb(${scoreColor})` }}>
                {score}
              </div>
              <div className="text-[9px] uppercase tracking-[0.2em] text-white/60">Score</div>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              {score >= 85 ? (
                <ShieldCheck className="h-5 w-5 text-emerald-300" />
              ) : (
                <ShieldAlert className="h-5 w-5" style={{ color: `rgb(${scoreColor})` }} />
              )}
              <span className="text-base font-medium">{scoreLabel}</span>
            </div>
            <p className="text-xs text-white/60">
              {threats.length} threat{threats.length === 1 ? "" : "s"} detected • {grantedCount} permissions active
            </p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/60">
              Last scan • just now
            </p>
          </div>
        </section>

        {/* Encryption / VPN */}
        <section className="grid grid-cols-2 gap-2">
          {[
            { icon: Lock, label: "Encryption", value: "AES-256", ok: true, color: "0,230,118" },
            { icon: Globe, label: "VPN", value: "Connected", ok: true, color: "0,229,255" },
            { icon: Wifi, label: "Network", value: "Trusted Wi-Fi", ok: true, color: "0,229,255" },
            { icon: KeyRound, label: "Biometric", value: "Active", ok: true, color: "124,77,255" },
          ].map((c) => (
            <div
              key={c.label}
              className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-md"
              style={{ boxShadow: `inset 0 0 24px rgba(${c.color},0.06)` }}
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{
                  background: `radial-gradient(circle, rgba(${c.color},0.28), transparent 70%)`,
                  boxShadow: `0 0 14px rgba(${c.color},0.35)`,
                }}
              >
                <c.icon className="h-4 w-4" style={{ color: `rgb(${c.color})` }} />
              </span>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-[0.18em] text-white/60">{c.label}</span>
                <span className="text-sm font-medium">{c.value}</span>
              </div>
            </div>
          ))}
        </section>

        {/* Permissions */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-[0.25em] text-cyan-200/80">Permission Transparency</h2>
            <span className="text-[10px] text-white/50">Tap to cycle</span>
          </div>
          <ul className="flex flex-col divide-y divide-white/5">
            {perms.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => cyclePerm(p.id)}
                  className="flex w-full items-center gap-3 py-2.5 text-left transition hover:bg-white/5"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5">
                    <p.icon className="h-4 w-4 text-cyan-200" />
                  </span>
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm">{p.label}</span>
                    <span className="text-[11px] text-white/50">{p.detail}</span>
                  </div>
                  <StatusPill status={p.status} />
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Sensor usage history */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-[0.25em] text-cyan-200/80">Mic & Camera Usage</h2>
            <span className="flex items-center gap-1 text-[10px] text-white/50">
              <Clock className="h-3 w-3" />
              Last 24h
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {usage.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2"
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    u.sensor === "Microphone" ? "bg-cyan-500/10" : "bg-fuchsia-500/10"
                  }`}
                >
                  {u.sensor === "Microphone" ? (
                    <Mic className="h-4 w-4 text-cyan-300" />
                  ) : (
                    <Camera className="h-4 w-4 text-fuchsia-300" />
                  )}
                </span>
                <div className="flex flex-1 flex-col">
                  <span className="text-sm">
                    {u.sensor} • <span className="text-white/60">{u.app}</span>
                  </span>
                  <span className="text-[11px] text-white/50">
                    {u.when} • {u.duration}
                  </span>
                </div>
                {u.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-300" />
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Threats */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-[0.25em] text-cyan-200/80">Threat Detection</h2>
            <span className="text-[10px] text-white/50">{threats.length} active</span>
          </div>
          {threats.length === 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/5 px-3 py-3 text-emerald-200">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-sm">No threats detected.</span>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {threats.map((t) => {
                const color =
                  t.level === "high" ? "239,83,80" : t.level === "medium" ? "255,213,79" : "0,229,255";
                return (
                  <li
                    key={t.id}
                    className="flex items-start gap-3 rounded-xl border px-3 py-2.5"
                    style={{
                      borderColor: `rgba(${color},0.3)`,
                      background: `rgba(${color},0.05)`,
                    }}
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4" style={{ color: `rgb(${color})` }} />
                    <div className="flex flex-1 flex-col">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{t.title}</span>
                        <span
                          className="rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.2em]"
                          style={{ borderColor: `rgba(${color},0.4)`, color: `rgb(${color})` }}
                        >
                          {t.level}
                        </span>
                      </div>
                      <span className="text-[11px] text-white/60">{t.detail}</span>
                      <span className="text-[10px] text-white/40">{t.when}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}