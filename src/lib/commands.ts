// Voice command engine: maps any spoken phrase to a known command via
// keyword scoring + fuzzy matching. No external deps.

export type CommandId =
  | "call"
  | "sms"
  | "camera"
  | "torch"
  | "music_play"
  | "music_pause"
  | "whatsapp"
  | "maps"
  | "youtube"
  | "gmail"
  | "browser"
  | "time"
  | "stop";

export interface CommandDef {
  id: CommandId;
  label: string;
  // Keywords: any of these words/phrases in the transcript scores the command.
  keywords: string[];
  // Optional exact phrases that strongly match.
  phrases?: string[];
}

export const COMMANDS: CommandDef[] = [
  {
    id: "call",
    label: "Call Mom",
    keywords: ["call", "dial", "phone", "ring", "mom", "mummy", "mother"],
    phrases: ["call mom", "call mummy", "phone mom"],
  },
  {
    id: "sms",
    label: "Send SMS",
    keywords: ["sms", "message", "text", "send"],
    phrases: ["send sms", "send message", "send a text"],
  },
  {
    id: "camera",
    label: "Open Camera",
    keywords: ["camera", "photo", "picture", "selfie", "capture", "click"],
    phrases: ["open camera", "take a photo", "take picture", "click photo"],
  },
  {
    id: "torch",
    label: "Turn on Torch",
    keywords: ["torch", "flashlight", "flash", "light", "lamp"],
    phrases: ["turn on torch", "turn on flashlight", "open torch", "switch on light"],
  },
  {
    id: "music_play",
    label: "Play Music",
    keywords: ["play", "music", "song", "track", "audio"],
    phrases: ["play music", "play song", "start music"],
  },
  {
    id: "music_pause",
    label: "Pause Music",
    keywords: ["pause", "stop", "mute"],
    phrases: ["pause music", "stop music", "stop song"],
  },
  {
    id: "whatsapp",
    label: "Open WhatsApp",
    keywords: ["whatsapp", "whats", "wa"],
    phrases: ["open whatsapp", "launch whatsapp"],
  },
  {
    id: "maps",
    label: "Open Maps",
    keywords: ["maps", "map", "navigation", "directions", "navigate"],
    phrases: ["open maps", "open google maps", "show map"],
  },
  {
    id: "youtube",
    label: "Open YouTube",
    keywords: ["youtube", "yt", "video"],
    phrases: ["open youtube", "play youtube"],
  },
  {
    id: "gmail",
    label: "Open Gmail",
    keywords: ["gmail", "mail", "email", "inbox"],
    phrases: ["open gmail", "open mail", "check email"],
  },
  {
    id: "browser",
    label: "Open Browser",
    keywords: ["browser", "google", "search", "internet", "web"],
    phrases: ["open browser", "open google", "search the web"],
  },
  {
    id: "time",
    label: "What's the time",
    keywords: ["time", "clock", "hour"],
    phrases: ["what time is it", "tell me the time", "current time"],
  },
  {
    id: "stop",
    label: "Stop Listening",
    keywords: ["stop", "cancel", "exit", "quit", "nevermind"],
    phrases: ["stop listening", "cancel that", "never mind"],
  },
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

// Levenshtein distance for tolerance to misheard words.
function lev(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp: number[] = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) dp[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : Math.min(prev, dp[j], dp[j - 1]) + 1;
      prev = tmp;
    }
  }
  return dp[b.length];
}

function fuzzyIncludes(haystackWords: string[], needle: string): boolean {
  if (haystackWords.includes(needle)) return true;
  // tolerate 1-2 char typos for words length >= 4
  if (needle.length < 4) return false;
  const tol = needle.length >= 7 ? 2 : 1;
  return haystackWords.some(
    (w) => Math.abs(w.length - needle.length) <= tol && lev(w, needle) <= tol
  );
}

export interface MatchResult {
  command: CommandDef | null;
  score: number;
  transcript: string;
}

export function matchCommand(transcript: string): MatchResult {
  const norm = normalize(transcript);
  const words = norm.split(" ").filter(Boolean);
  let best: CommandDef | null = null;
  let bestScore = 0;

  for (const cmd of COMMANDS) {
    let score = 0;
    if (cmd.phrases) {
      for (const p of cmd.phrases) {
        if (norm.includes(normalize(p))) score += 5;
      }
    }
    for (const kw of cmd.keywords) {
      if (fuzzyIncludes(words, kw.toLowerCase())) score += 2;
    }
    if (score > bestScore) {
      bestScore = score;
      best = cmd;
    }
  }

  return { command: bestScore >= 2 ? best : null, score: bestScore, transcript: norm };
}