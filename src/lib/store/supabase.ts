import type { SupabaseClient } from "@supabase/supabase-js";
import type { Material, Profile, Report, Session, Turn } from "@/lib/types";
import { scoreMaxFor } from "@/lib/types";
import { kindForFile } from "./local";
import type { DataStore } from "./types";

/* Le colonne del database sono in snake_case: qui le traduciamo. */

type Row = Record<string, unknown>;

const toMaterial = (r: Row): Material => ({
  id: r.id as string,
  name: r.name as string,
  kind: r.kind as Material["kind"],
  status: r.status as Material["status"],
  source: (r.source as string) ?? null,
  sizeBytes: (r.size_bytes as number) ?? null,
  text: (r.extracted_text as string) ?? null,
  error: (r.error as string) ?? null,
  createdAt: r.created_at as string,
});

const toSession = (r: Row): Session => ({
  id: r.id as string,
  title: r.title as string,
  mode: r.mode as Session["mode"],
  format: (r.format as Session["format"]) ?? "orale",
  durationMin: r.duration_min as Session["durationMin"],
  difficulty: r.difficulty as Session["difficulty"],
  voice: r.voice as Session["voice"],
  jobPosting: (r.job_posting as string) ?? null,
  materialIds: ((r.session_materials as { material_id: string }[]) ?? []).map((m) => m.material_id),
  focusTopics: (r.focus_topics as string[]) ?? [],
  status: r.status as Session["status"],
  score: (r.score as number) ?? null,
  scoreMax: (r.score_max as 10 | 100) ?? 10,
  startedAt: r.started_at as string,
  endedAt: (r.ended_at as string) ?? null,
});

const toTurn = (r: Row): Turn => ({
  id: r.id as string,
  sessionId: r.session_id as string,
  index: r.idx as number,
  question: r.question as string,
  topic: (r.topic as string) ?? "",
  isFollowUp: Boolean(r.is_follow_up),
  kind: (r.kind as Turn["kind"]) ?? "aperta",
  options: (r.options as string[]) ?? null,
  answer: (r.answer as string) ?? null,
  modelAnswer: (r.model_answer as string) ?? null,
  feedback: (r.feedback as string) ?? null,
  askedAt: r.asked_at as string,
});

const toReport = (r: Row): Report => ({
  sessionId: r.session_id as string,
  score: r.score as number,
  scoreMax: r.score_max as 10 | 100,
  summary: (r.summary as string) ?? "",
  strengths: (r.strengths as string[]) ?? [],
  improvements: (r.improvements as string[]) ?? [],
  weakTopics: (r.weak_topics as string[]) ?? [],
  createdAt: r.created_at as string,
});

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const SESSION_SELECT = "*, session_materials(material_id)";

export function createSupabaseStore(supabase: SupabaseClient, userId: string): DataStore {
  return {
    kind: "supabase",

    async getProfile() {
      const row = check(await supabase.from("profiles").select("*").eq("id", userId).maybeSingle()) as Row | null;
      return {
        id: userId,
        name: (row?.name as string) ?? "",
        defaultVoice: (row?.default_voice as Profile["defaultVoice"]) ?? "calma",
        defaultDifficulty: (row?.default_difficulty as Profile["defaultDifficulty"]) ?? "medio",
        defaultDuration: (row?.default_duration as Profile["defaultDuration"]) ?? 20,
      };
    },
    async updateProfile(patch) {
      const row: Row = { id: userId };
      if (patch.name !== undefined) row.name = patch.name;
      if (patch.defaultVoice) row.default_voice = patch.defaultVoice;
      if (patch.defaultDifficulty) row.default_difficulty = patch.defaultDifficulty;
      if (patch.defaultDuration) row.default_duration = patch.defaultDuration;
      check(await supabase.from("profiles").upsert(row));
      return this.getProfile();
    },

    async listMaterials() {
      const rows = check(
        await supabase.from("materials").select("*").order("created_at", { ascending: false }),
      ) as Row[];
      return rows.map(toMaterial);
    },
    async addMaterial(input) {
      if (input.kind === "url") {
        const row = check(
          await supabase
            .from("materials")
            .insert({
              user_id: userId,
              name: input.url.replace(/^https?:\/\//, "").replace(/\/$/, ""),
              kind: "url",
              status: "reading",
              source: input.url,
            })
            .select()
            .single(),
        ) as Row;
        return toMaterial(row);
      }
      const file = input.file;
      const id = crypto.randomUUID();
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${userId}/${id}-${safeName}`;
      const up = await supabase.storage.from("materials").upload(path, file, {
        contentType: file.type || undefined,
      });
      if (up.error) throw new Error(up.error.message);
      const row = check(
        await supabase
          .from("materials")
          .insert({
            id,
            user_id: userId,
            name: file.name,
            kind: kindForFile(file) ?? "text",
            status: "reading",
            source: path,
            size_bytes: file.size,
          })
          .select()
          .single(),
      ) as Row;
      return toMaterial(row);
    },
    async updateMaterial(id, patch) {
      const row: Row = {};
      if (patch.status) row.status = patch.status;
      if (patch.text !== undefined) row.extracted_text = patch.text;
      if (patch.error !== undefined) row.error = patch.error;
      check(await supabase.from("materials").update(row).eq("id", id));
    },
    async deleteMaterial(id) {
      const row = check(
        await supabase.from("materials").select("kind, source").eq("id", id).maybeSingle(),
      ) as Row | null;
      if (row && row.kind !== "url" && row.source) {
        await supabase.storage.from("materials").remove([row.source as string]);
      }
      check(await supabase.from("materials").delete().eq("id", id));
    },
    async getMaterialFile(material) {
      if (material.kind === "url" || !material.source) return null;
      const res = await supabase.storage.from("materials").download(material.source);
      return res.data ?? null;
    },

    async listSessions(limit) {
      let q = supabase.from("sessions").select(SESSION_SELECT).order("started_at", { ascending: false });
      if (limit) q = q.limit(limit);
      return (check(await q) as Row[]).map(toSession);
    },
    async getSession(id) {
      const row = check(
        await supabase.from("sessions").select(SESSION_SELECT).eq("id", id).maybeSingle(),
      ) as Row | null;
      return row ? toSession(row) : null;
    },
    async createSession(config, title) {
      const row = check(
        await supabase
          .from("sessions")
          .insert({
            user_id: userId,
            title,
            mode: config.mode,
            format: config.format,
            duration_min: config.durationMin,
            difficulty: config.difficulty,
            voice: config.voice,
            job_posting: config.jobPosting,
            focus_topics: config.focusTopics,
            score_max: scoreMaxFor(config.mode),
          })
          .select()
          .single(),
      ) as Row;
      if (config.materialIds.length) {
        check(
          await supabase
            .from("session_materials")
            .insert(config.materialIds.map((material_id) => ({ session_id: row.id, material_id, user_id: userId }))),
        );
      }
      return toSession({ ...row, session_materials: config.materialIds.map((material_id) => ({ material_id })) });
    },
    async updateSession(id, patch) {
      const row: Row = {};
      if (patch.status) row.status = patch.status;
      if (patch.score !== undefined) row.score = patch.score;
      if (patch.endedAt !== undefined) row.ended_at = patch.endedAt;
      check(await supabase.from("sessions").update(row).eq("id", id));
    },

    async listTurns(sessionId) {
      const rows = check(await supabase.from("turns").select("*").eq("session_id", sessionId).order("idx")) as Row[];
      return rows.map(toTurn);
    },
    async addTurn(turn) {
      const row = check(
        await supabase
          .from("turns")
          .insert({
            user_id: userId,
            session_id: turn.sessionId,
            idx: turn.index,
            question: turn.question,
            topic: turn.topic,
            is_follow_up: turn.isFollowUp,
            kind: turn.kind,
            options: turn.options,
            answer: turn.answer,
            asked_at: turn.askedAt,
          })
          .select()
          .single(),
      ) as Row;
      return toTurn(row);
    },
    async updateTurn(id, patch) {
      const row: Row = {};
      if (patch.answer !== undefined) row.answer = patch.answer;
      if (patch.modelAnswer !== undefined) row.model_answer = patch.modelAnswer;
      if (patch.feedback !== undefined) row.feedback = patch.feedback;
      check(await supabase.from("turns").update(row).eq("id", id));
    },

    async getReport(sessionId) {
      const row = check(
        await supabase.from("reports").select("*").eq("session_id", sessionId).maybeSingle(),
      ) as Row | null;
      return row ? toReport(row) : null;
    },
    async saveReport(report) {
      check(
        await supabase.from("reports").upsert({
          session_id: report.sessionId,
          user_id: userId,
          score: report.score,
          score_max: report.scoreMax,
          summary: report.summary,
          strengths: report.strengths,
          improvements: report.improvements,
          weak_topics: report.weakTopics,
        }),
      );
    },
  };
}
