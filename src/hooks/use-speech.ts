import { useCallback, useEffect, useRef, useState } from "react";

// Minimal types for the Web Speech API (not in lib.dom).
type SRResult = { isFinal: boolean; 0: { transcript: string } };
type SREvent = { results: ArrayLike<SRResult> & { length: number } };
interface SRInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SREvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SRCtor = new () => SRInstance;

function getSRCtor(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SRCtor;
    webkitSpeechRecognition?: SRCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export interface UseSpeechOptions {
  lang?: string;
  onFinal: (transcript: string) => void;
  onInterim?: (transcript: string) => void;
  onError?: (err: string) => void;
}

export function useSpeech({ lang = "en-US", onFinal, onInterim, onError }: UseSpeechOptions) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SRInstance | null>(null);
  const stoppingRef = useRef(false);

  // Keep latest callbacks without re-creating the recognizer.
  const cbs = useRef({ onFinal, onInterim, onError });
  cbs.current = { onFinal, onInterim, onError };

  useEffect(() => {
    const Ctor = getSRCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    setSupported(true);
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (interim && cbs.current.onInterim) cbs.current.onInterim(interim);
      if (final) cbs.current.onFinal(final.trim());
    };
    rec.onend = () => {
      setListening(false);
      stoppingRef.current = false;
    };
    rec.onerror = (e) => {
      setListening(false);
      cbs.current.onError?.(e.error || "speech_error");
    };
    recRef.current = rec;
    return () => {
      try { rec.abort(); } catch { /* noop */ }
      recRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    const rec = recRef.current;
    if (!rec || listening) return;
    try {
      rec.start();
      setListening(true);
    } catch (e) {
      cbs.current.onError?.(String(e));
    }
  }, [listening]);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (!rec || !listening || stoppingRef.current) return;
    stoppingRef.current = true;
    try { rec.stop(); } catch { /* noop */ }
  }, [listening]);

  return { supported, listening, start, stop };
}