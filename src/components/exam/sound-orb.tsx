"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/components/ui";

export type OrbState = "idle" | "thinking" | "speaking" | "listening";

/**
 * Il cerchio d’esame. Il bordo è un’onda sonora:
 * - parla l’esaminatore: verde acqua, l’onda respira
 * - ascolta te: ambra, l’onda segue il volume reale del microfono
 * - pensa: l’onda si calma e ruota piano
 * Disegnato in SVG e aggiornato con requestAnimationFrame, senza re-render React.
 */
export function SoundOrb({
  state,
  stream,
}: {
  state: OrbState;
  stream: MediaStream | null;
}) {
  const outer = useRef<SVGPathElement>(null);
  const inner = useRef<SVGPathElement>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const levelRef = useRef(0);

  // Volume del microfono, solo mentre ascolta.
  useEffect(() => {
    if (!stream) {
      levelRef.current = 0;
      return;
    }
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    let raf = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      levelRef.current = levelRef.current * 0.7 + Math.min(1, rms * 4) * 0.3;
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      void ctx.close();
    };
  }, [stream]);

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const N = 120;
    const R = 100;
    let raf = 0;
    let amp = 2;
    const start = performance.now();

    const pathFor = (t: number, a: number, phase: number) => {
      let d = "";
      for (let i = 0; i <= N; i++) {
        const th = (i / N) * Math.PI * 2;
        const wave =
          Math.sin(th * 6 + t * 2.1 + phase) * 0.55 +
          Math.sin(th * 11 - t * 3.3 + phase * 2) * 0.3 +
          Math.sin(th * 3 + t * 1.2) * 0.15;
        const r = R + wave * a;
        const x = 120 + Math.cos(th) * r;
        const y = 120 + Math.sin(th) * r;
        d += `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
      }
      return d + "Z";
    };

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const s = stateRef.current;
      let target = 1.5;
      if (s === "speaking")
        target =
          7 + (Math.sin(t * 5.3) * 0.5 + 0.5) * 6 + Math.sin(t * 13.7) * 2;
      else if (s === "listening") target = 2 + levelRef.current * 22;
      else if (s === "thinking") target = 3;
      amp += (target - amp) * 0.12;
      const rot = s === "thinking" ? t * 0.8 : 0;
      outer.current?.setAttribute("d", pathFor(t + rot, amp, 0));
      inner.current?.setAttribute("d", pathFor(t * 0.8 + rot, amp * 0.6, 1.7));
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const listening = state === "listening";
  const color = listening ? "var(--color-amber)" : "var(--color-teal)";

  return (
    <div
      className="relative mx-auto aspect-square w-[min(68vw,19rem)] sm:w-[22rem]"
      aria-hidden="true"
    >
      {/* Anelli che si allargano mentre l’esaminatore parla */}
      {state === "speaking"
        ? [0, 1].map((i) => (
            <span
              key={i}
              className="absolute inset-[8%] rounded-full border-2 border-teal/40"
              style={{
                animation: `orb-breathe 2.4s ease-in-out ${i * 1.2}s infinite`,
              }}
            />
          ))
        : null}
      <svg
        viewBox="0 0 240 240"
        className="absolute inset-0 h-full w-full overflow-visible"
      >
        <defs>
          <radialGradient id="orb-core" cx="50%" cy="42%" r="60%">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
            <stop
              offset="1"
              stopColor={listening ? "#e9e9e9" : "#f1f1f1"}
              stopOpacity="1"
            />
          </radialGradient>
        </defs>
        <path
          ref={inner}
          fill="none"
          stroke={color}
          strokeOpacity={0.3}
          strokeWidth={1.5}
          className="transition-[stroke] duration-500"
        />
        <path
          ref={outer}
          fill="url(#orb-core)"
          stroke={color}
          strokeWidth={2.5}
          className="transition-[stroke] duration-500"
        />
      </svg>
      <div
        className={cn(
          "absolute inset-[36%] rounded-full transition-colors duration-500",
          listening
            ? "bg-amber/90"
            : state === "thinking"
              ? "bg-teal/50"
              : "bg-teal",
        )}
        style={
          state === "thinking"
            ? { animation: "status-pulse 1.6s ease-in-out infinite" }
            : undefined
        }
      />
    </div>
  );
}
