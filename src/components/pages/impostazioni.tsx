"use client";

import { useId, useState } from "react";
import { mutate } from "swr";
import { ExamSettings } from "@/components/dashboard/setup";
import { useAuth, useStore } from "@/components/providers";
import { Button, Card } from "@/components/ui";
import { keys, useProfile } from "@/lib/hooks";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Difficulty, Duration, Profile, Voice } from "@/lib/types";
import { PageFrame, PageHeader } from "./page-header";

export function SettingsPage() {
  const auth = useAuth();
  const { data: profile } = useProfile();

  return (
    <PageFrame>
      <PageHeader title="Impostazioni" />
      {profile ? (
        <ProfileForm profile={profile} />
      ) : (
        <p className="mt-8 text-ink-soft">Caricamento…</p>
      )}

      <Card className="mt-10 p-5 sm:p-6">
        <h2 className="text-xl font-medium">Account</h2>
        {isSupabaseConfigured && auth.status === "ready" ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <p className="text-ink-soft">Accesso con {auth.email}</p>
            <Button
              variant="secondary"
              onClick={() => void getSupabase().auth.signOut()}
            >
              Esci dall’account
            </Button>
          </div>
        ) : (
          <p className="mt-3 leading-relaxed text-ink-soft">
            Stai usando la modalità prova: materiali e sessioni restano in
            questo browser. Quando il progetto sarà collegato a Supabase potrai
            accedere con la tua email e ritrovarli su ogni dispositivo.
          </p>
        )}
      </Card>
    </PageFrame>
  );
}

function ProfileForm({ profile }: { profile: Profile }) {
  const store = useStore();
  const [name, setName] = useState(profile.name);
  const [duration, setDuration] = useState<Duration>(profile.defaultDuration);
  const [difficulty, setDifficulty] = useState<Difficulty>(
    profile.defaultDifficulty,
  );
  const [voice, setVoice] = useState<Voice>(profile.defaultVoice);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nameId = useId();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await store.updateProfile({
        name: name.trim(),
        defaultDuration: duration,
        defaultDifficulty: difficulty,
        defaultVoice: voice,
      });
      await mutate(keys.profile);
      setSaved("Impostazioni salvate.");
    } catch (err) {
      setSaved(
        err instanceof Error ? err.message : "Salvataggio non riuscito.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-8 space-y-4">
      <Card className="p-5 sm:p-6">
        <label htmlFor={nameId} className="text-[15px] font-medium">
          Come ti chiami?
        </label>
        <p className="mt-0.5 text-sm text-ink-soft">
          Lo usiamo per salutarti e l’esaminatore per chiamarti.
        </p>
        <input
          id={nameId}
          name="given-name"
          autoComplete="given-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(null);
          }}
          className="mt-3 block h-11 w-full max-w-sm rounded-[10px] bg-card px-3.5 text-[15px] ring-1 ring-line focus:ring-2 focus:ring-teal focus:outline-none"
        />
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="text-xl font-medium">
          Valori predefiniti della simulazione
        </h2>
        <p className="mt-1 mb-5 text-sm text-ink-soft">
          Li ritrovi già scelti ogni volta che prepari una prova.
        </p>
        <ExamSettings
          duration={duration}
          difficulty={difficulty}
          voice={voice}
          onDuration={(v) => (setDuration(v), setSaved(null))}
          onDifficulty={(v) => (setDifficulty(v), setSaved(null))}
          onVoice={(v) => (setVoice(v), setSaved(null))}
        />
      </Card>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={saving}>
          {saving ? "Salvo…" : "Salva impostazioni"}
        </Button>
        <p aria-live="polite" className="text-sm text-ink-soft">
          {saved}
        </p>
      </div>
    </form>
  );
}
