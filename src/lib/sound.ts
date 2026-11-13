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

/**
 * Una nota morbida: sinusoide con un filo di armonica, filtrata in basso,
 * attacco lento e coda lunga che sfuma. Niente spigoli acuti.
 */
function note(
  ac: AudioContext,
  freq: number,
  start: number,
  length: number,
  volume: number,
  attack = 0.02,
) {
  const out = ac.createGain();
  out.gain.setValueAtTime(0, start);
  out.gain.linearRampToValueAtTime(volume, start + attack);
  out.gain.exponentialRampToValueAtTime(0.0001, start + length);

  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(Math.min(freq * 2.5, 1800), start);
  filter.Q.value = 0.5;
  filter.connect(out).connect(ac.destination);

  // Fondamentale più un’ottava sopra molto leggera: suono caldo, da campanella di legno.
  for (const [mult, level] of [
    [1, 1],
    [2, 0.12],
  ] as const) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq * mult, start);
    g.gain.value = level;
    osc.connect(g).connect(filter);
    osc.start(start);
    osc.stop(start + length + 0.05);
  }
}

/*
 * Su iPhone Safari tratta Web Audio come suono "di ambiente": con il
 * telefono in silenzioso non si sente. Per la durata dell’effetto chiediamo una
 * sessione audio "transient" (suoni brevi, abbassa un attimo la musica invece
 * di fermarla), poi torniamo ad "auto" così il microfono dell’esame non cambia.
 */
type AudioSession = { type: string };
let restore: ReturnType<typeof setTimeout> | null = null;

function iosAudible(ms: number) {
  const session = (navigator as Navigator & { audioSession?: AudioSession })
    .audioSession;
  if (!session || session.type === "play-and-record") return;
  try {
    session.type = "transient";
  } catch {
    return;
  }
  if (restore) clearTimeout(restore);
  restore = setTimeout(() => {
    try {
      if (session.type === "transient") session.type = "auto";
    } catch {
      // Niente da ripristinare.
    }
  }, ms);
}

export function playSound(kind: SoundKind) {
  if (!soundsOn()) return;
  if (typeof navigator !== "undefined") iosAudible(kind === "tap" ? 400 : 2000);
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.005;
  if (kind === "tap") {
    // Tocco ovattato e basso, quasi una goccia su legno.
    note(ac, 440, t, 0.16, 0.06, 0.012);
  } else if (kind === "start") {
    // Due note calme che salgono (sol, do): si comincia.
    note(ac, 392, t, 0.7, 0.07, 0.03);
    note(ac, 523.25, t + 0.16, 0.9, 0.07, 0.03);
  } else {
    // Accordo di fa maggiore arpeggiato piano, con coda lunga: il voto è pronto.
    note(ac, 349.23, t, 1.4, 0.055, 0.04);
    note(ac, 440, t + 0.12, 1.3, 0.055, 0.04);
    note(ac, 523.25, t + 0.24, 1.3, 0.055, 0.04);
    note(ac, 698.46, t + 0.36, 1.5, 0.045, 0.04);
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
  // iPhone sblocca l’audio solo a fine tocco (touchend/click), non a pointerdown.
  const unlock = () => {
    if (!soundsOn()) return;
    const ac = audio();
    if (!ac) return;
    const src = ac.createBufferSource();
    src.buffer = ac.createBuffer(1, 1, 22050);
    src.connect(ac.destination);
    src.start(0);
  };
  document.addEventListener("pointerdown", onDown, { capture: true });
  document.addEventListener("touchend", unlock, { capture: true });
  document.addEventListener("click", unlock, { capture: true });
  return () => {
    document.removeEventListener("pointerdown", onDown, { capture: true });
    document.removeEventListener("touchend", unlock, { capture: true });
    document.removeEventListener("click", unlock, { capture: true });
  };
}
