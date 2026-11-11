/**
 * Effetti sonori leggeri, generati con Web Audio: niente file da scaricare.
 * Si spengono da Impostazioni; la scelta resta su questo dispositivo.
 */

export type SoundKind = "tap" | "start" | "done";

const KEY = "ai-insegnante:suoni";
let ctx: AudioContext | null = null;

export function soundsOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundsOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Archiviazione bloccata: la scelta vale solo per questa visita.
  }
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Una nota morbida: sinusoide con attacco breve e coda che sfuma. */
function note(
  ac: AudioContext,
  freq: number,
  start: number,
  length: number,
  volume: number,
) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

export function playSound(kind: SoundKind) {
  if (!soundsOn()) return;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.005;
  if (kind === "tap") {
    // "Tic" corto, come una goccia.
    note(ac, 1320, t, 0.06, 0.05);
  } else if (kind === "start") {
    // Due note che salgono: si comincia.
    note(ac, 660, t, 0.25, 0.08);
    note(ac, 990, t + 0.11, 0.35, 0.08);
  } else {
    // Accordo arpeggiato: il voto è pronto.
    note(ac, 784, t, 0.4, 0.07);
    note(ac, 988, t + 0.09, 0.45, 0.07);
    note(ac, 1319, t + 0.18, 0.6, 0.07);
  }
}

/** Fa "tic" su ogni pulsante, link o scelta premuti nell’app. */
export function installTapSounds(): () => void {
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const el = (e.target as Element | null)?.closest(
      "button, a[href], label, select, [role='button']",
    );
    if (!el || el.matches(":disabled, [aria-disabled='true']")) return;
    playSound("tap");
  };
  document.addEventListener("pointerdown", onDown, { capture: true });
  return () =>
    document.removeEventListener("pointerdown", onDown, { capture: true });
}
