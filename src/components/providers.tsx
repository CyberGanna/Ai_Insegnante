"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { SWRConfig } from "swr";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { createLocalStore } from "@/lib/store/local";
import { createSupabaseStore } from "@/lib/store/supabase";
import type { DataStore } from "@/lib/store/types";

type AuthState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "ready"; store: DataStore; email: string | null };

const AppContext = createContext<AuthState>({ status: "loading" });

export function Providers({ children }: { children: React.ReactNode }) {
  // Senza Supabase si entra subito in modalità prova.
  const [state, setState] = useState<AuthState>(() =>
    isSupabaseConfigured ? { status: "loading" } : { status: "ready", store: createLocalStore(), email: null },
  );

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();
    const apply = (userId: string | undefined, email: string | undefined) =>
      setState(
        userId
          ? { status: "ready", store: createSupabaseStore(supabase, userId), email: email ?? null }
          : { status: "signed-out" },
      );
    supabase.auth.getSession().then(({ data }) => apply(data.session?.user.id, data.session?.user.email));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      apply(session?.user.id, session?.user.email);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const swr = useMemo(() => ({ revalidateOnFocus: false, shouldRetryOnError: false }), []);

  return (
    <AppContext.Provider value={state}>
      <SWRConfig value={swr}>{children}</SWRConfig>
    </AppContext.Provider>
  );
}

export const useAuth = () => useContext(AppContext);

/** Il DataStore, disponibile solo dentro le pagine protette. */
export function useStore(): DataStore {
  const state = useContext(AppContext);
  if (state.status !== "ready") throw new Error("useStore fuori da una pagina protetta");
  return state.store;
}
