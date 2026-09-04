import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Administrative API. Every handler re-verifies the caller's admin role. */

const Letter = z.enum(["A", "B", "C", "D"]);
const Difficulty = z.enum(["easy", "medium", "hard"]);

export const questionInput = z.object({
  id: z.string().uuid().optional(),
  quiz_id: z.string().uuid(),
  question_text: z.string().trim().min(5).max(2000),
  option_a: z.string().trim().min(1).max(500),
  option_b: z.string().trim().min(1).max(500),
  option_c: z.string().trim().min(1).max(500),
  option_d: z.string().trim().min(1).max(500),
  correct_answer: Letter,
  explanation: z.string().trim().max(2000).optional().nullable(),
  topic: z.string().trim().max(120).optional().nullable(),
  subtopic: z.string().trim().max(120).optional().nullable(),
  difficulty: Difficulty.default("medium"),
  position: z.number().int().min(0).max(500).optional(),
  is_active: z.boolean().optional(),
});

export const quizInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(140),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes"),
  description: z.string().trim().max(600).optional().nullable(),
  duration_seconds: z.number().int().min(60).max(43200),
  question_limit: z.number().int().min(1).max(180),
  status: z.enum(["draft", "active", "inactive", "archived"]),
  is_active: z.boolean(),
  show_leaderboard: z.boolean(),
  shuffle_questions: z.boolean(),
  whatsapp_url: z.string().trim().url().max(400).optional().or(z.literal("")).nullable(),
});

async function requireAdmin(context: { supabase: { rpc: Function }; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------- session -------------------------------- */

export const getAdminIdentity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: Boolean(data), userId: context.userId };
  });

/** Bootstrap: the first account to claim admin becomes admin. */
export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) return { granted: false as const };
    await supabaseAdmin.from("user_roles").insert({ user_id: context.userId, role: "admin" });
    return { granted: true as const };
  });

/* -------------------------------- overview ------------------------------ */

export const getOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await requireAdmin(context);
    const [quizzes, submissions] = await Promise.all([
      db.from("quizzes").select("id, title, slug, is_active, status, created_at"),
      db.from("submissions").select("score, percentage, duration_seconds, submitted_at, quiz_id"),
    ]);
    const subs = submissions.data ?? [];
    const percentages = subs.map((s) => Number(s.percentage));
    const avg = percentages.length
      ? Math.round((percentages.reduce((a, b) => a + b, 0) / percentages.length) * 10) / 10
      : 0;
    return {
      totalQuizzes: quizzes.data?.length ?? 0,
      activeQuizzes: (quizzes.data ?? []).filter((q) => q.is_active && q.status === "active").length,
      totalAttempts: subs.length,
      averageScore: avg,
      highestScore: percentages.length ? Math.max(...percentages) : 0,
      lowestScore: percentages.length ? Math.min(...percentages) : 0,
      averageDuration: subs.length
        ? Math.round(subs.reduce((a, b) => a + b.duration_seconds, 0) / subs.length)
        : 0,
      recent: subs
        .slice()
        .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))
        .slice(0, 8)
        .map((s) => ({ percentage: Number(s.percentage), submittedAt: s.submitted_at })),
    };
  });

/* --------------------------------- quizzes ------------------------------- */

export const listQuizzes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await requireAdmin(context);
    const { data: quizzes } = await db
      .from("quizzes")
      .select("*")
      .order("created_at", { ascending: false });
    const { data: counts } = await db.from("questions").select("quiz_id");
    const perQuiz = new Map<string, number>();
    for (const row of counts ?? []) perQuiz.set(row.quiz_id, (perQuiz.get(row.quiz_id) ?? 0) + 1);
    return (quizzes ?? []).map((q) => ({ ...q, questionCount: perQuiz.get(q.id) ?? 0 }));
  });

export const saveQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => quizInput.parse(raw))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    const { id: _quizId, ...fields } = data;
    const payload = {
      ...fields,
      description: data.description ?? null,
      whatsapp_url: data.whatsapp_url || null,
    };
    if (data.id) {
      const { error } = await db.from("quizzes").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message.includes("slug") ? "That slug is already in use." : "Could not save the quiz.");
      return { id: data.id };
    }
    const { data: created, error } = await db.from("quizzes").insert(payload).select("id").single();
    if (error) throw new Error(error.message.includes("slug") ? "That slug is already in use." : "Could not create the quiz.");
    return { id: created.id };
  });

export const setQuizActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid(), isActive: z.boolean() }).parse(raw))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    await db
      .from("quizzes")
      .update({ is_active: data.isActive, status: data.isActive ? "active" : "inactive" })
      .eq("id", data.id);
    return { ok: true };
  });

export const deleteQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    await db.from("quizzes").delete().eq("id", data.id);
    return { ok: true };
  });

export const duplicateQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    const { data: quiz } = await db.from("quizzes").select("*").eq("id", data.id).single();
    if (!quiz) throw new Error("Quiz not found");
    const suffix = Math.random().toString(36).slice(2, 6);
    const { id: _id, created_at: _c, updated_at: _u, ...rest } = quiz;
    const { data: copy, error } = await db
      .from("quizzes")
      .insert({
        ...rest,
        title: `${quiz.title} (copy)`,
        slug: `${quiz.slug}-${suffix}`.slice(0, 118),
        is_active: false,
        status: "draft",
      })
      .select("id")
      .single();
    if (error) throw new Error("Could not duplicate the quiz.");
    const { data: questions } = await db.from("questions").select("*").eq("quiz_id", data.id);
    if (questions?.length) {
      await db.from("questions").insert(
        questions.map(({ id: _qid, created_at: _qc, updated_at: _qu, ...q }) => ({
          ...q,
          quiz_id: copy.id,
        })),
      );
    }
    return { id: copy.id };
  });

/* -------------------------------- questions ------------------------------ */

export const listQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ quizId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    const { data: rows } = await db
      .from("questions")
      .select("*")
      .eq("quiz_id", data.quizId)
      .order("position", { ascending: true });
    return rows ?? [];
  });

export const saveQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => questionInput.parse(raw))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    const { id: _questionId, ...qfields } = data;
    const payload = {
      ...qfields,
      explanation: data.explanation ?? null,
      topic: data.topic ?? null,
      subtopic: data.subtopic ?? null,
      is_active: data.is_active ?? true,
      position: data.position ?? 0,
      normalized_text: normalize(data.question_text),
    };
    if (data.id) {
      await db.from("questions").update(payload).eq("id", data.id);
      return { id: data.id };
    }
    const { count } = await db
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("quiz_id", data.quiz_id);
    const { data: created, error } = await db
      .from("questions")
      .insert({ ...payload, position: (count ?? 0) + 1 })
      .select("id")
      .single();
    if (error) throw new Error("Could not save the question.");
    return { id: created.id };
  });

export const deleteQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    await db.from("questions").delete().eq("id", data.id);
    return { ok: true };
  });

export const reorderQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ id: z.string().uuid(), position: z.number().int().min(0).max(500) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    await db.from("questions").update({ position: data.position }).eq("id", data.id);
    return { ok: true };
  });

/* ------------------------------- CSV import ------------------------------ */

const importRow = z.object({
  question: z.string().trim().min(5),
  option_a: z.string().trim().min(1),
  option_b: z.string().trim().min(1),
  option_c: z.string().trim().min(1),
  option_d: z.string().trim().min(1),
  correct_answer: z.string().trim(),
  explanation: z.string().trim().optional().default(""),
  topic: z.string().trim().optional().default(""),
  subtopic: z.string().trim().optional().default(""),
  difficulty: z.string().trim().optional().default("medium"),
});

export type ImportIssue = { row: number; message: string; level: "error" | "warning" };

export const importQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        quizId: z.string().uuid(),
        rows: z.array(z.record(z.string(), z.string())).max(180),
        confirm: z.boolean().default(false),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    const issues: ImportIssue[] = [];
    const valid: {
      question_text: string;
      option_a: string;
      option_b: string;
      option_c: string;
      option_d: string;
      correct_answer: string;
      explanation: string | null;
      topic: string | null;
      subtopic: string | null;
      difficulty: string;
      normalized_text: string;
    }[] = [];

    if (data.rows.length === 0) issues.push({ row: 0, message: "The file contains no rows.", level: "error" });
    if (data.rows.length > 180)
      issues.push({ row: 0, message: "A single import may contain at most 180 questions.", level: "error" });

    const { data: existing } = await db
      .from("questions")
      .select("normalized_text")
      .eq("quiz_id", data.quizId);
    const known = new Set((existing ?? []).map((q) => q.normalized_text ?? ""));
    const seen = new Set<string>();

    data.rows.forEach((raw, i) => {
      const rowNo = i + 2; // header is row 1
      const parsed = importRow.safeParse(raw);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          issues.push({ row: rowNo, message: `${issue.path.join(".") || "row"}: ${issue.message}`, level: "error" });
        }
        return;
      }
      const r = parsed.data;
      const letter = r.correct_answer.toUpperCase();
      if (!["A", "B", "C", "D"].includes(letter)) {
        issues.push({ row: rowNo, message: "correct_answer must be A, B, C or D", level: "error" });
        return;
      }
      const difficulty = r.difficulty.toLowerCase() || "medium";
      if (!["easy", "medium", "hard"].includes(difficulty)) {
        issues.push({ row: rowNo, message: `unsupported difficulty "${r.difficulty}"`, level: "error" });
        return;
      }
      const options = [r.option_a, r.option_b, r.option_c, r.option_d].map((o) => o.toLowerCase());
      if (new Set(options).size !== 4) {
        issues.push({ row: rowNo, message: "duplicate options in this row", level: "error" });
        return;
      }
      const norm = normalize(r.question);
      if (seen.has(norm)) {
        issues.push({ row: rowNo, message: "duplicate question inside this file", level: "error" });
        return;
      }
      if (known.has(norm)) {
        issues.push({ row: rowNo, message: "this question already exists in the bank", level: "error" });
        return;
      }
      const nearMatch = [...known, ...seen].find((k) => {
        if (Math.abs(k.length - norm.length) > 40) return false;
        const a = new Set(k.split(" "));
        const b = norm.split(" ");
        const overlap = b.filter((w) => a.has(w)).length / Math.max(b.length, 1);
        return overlap > 0.75;
      });
      if (nearMatch) {
        issues.push({ row: rowNo, message: "highly similar to an existing question — please review", level: "warning" });
      }
      if (!r.explanation) {
        issues.push({ row: rowNo, message: "explanation is empty", level: "warning" });
      }
      seen.add(norm);
      valid.push({
        question_text: r.question,
        option_a: r.option_a,
        option_b: r.option_b,
        option_c: r.option_c,
        option_d: r.option_d,
        correct_answer: letter,
        explanation: r.explanation || null,
        topic: r.topic || null,
        subtopic: r.subtopic || null,
        difficulty,
        normalized_text: norm,
      });
    });

    const hasErrors = issues.some((i) => i.level === "error");
    if (!data.confirm || hasErrors) {
      return { imported: 0, validCount: valid.length, issues, committed: false as const };
    }

    const { count } = await db
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("quiz_id", data.quizId);
    const base = count ?? 0;

    const { error } = await db
      .from("questions")
      .insert(valid.map((v, i) => ({ ...v, quiz_id: data.quizId, position: base + i + 1 })));
    if (error) throw new Error("The import could not be completed. No questions were added.");

    return { imported: valid.length, validCount: valid.length, issues, committed: true as const };
  });

/* ------------------------------- submissions ----------------------------- */

export const listSubmissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ quizId: z.string().uuid().optional() }).parse(raw))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    let query = db
      .from("submissions")
      .select("id, quiz_id, student_name, score, percentage, total_questions, correct_count, incorrect_count, unanswered_count, duration_seconds, auto_submitted, submitted_at")
      .order("submitted_at", { ascending: false })
      .limit(300);
    if (data.quizId) query = query.eq("quiz_id", data.quizId);
    const { data: rows } = await query;
    const { data: quizzes } = await db.from("quizzes").select("id, title");
    const titles = new Map((quizzes ?? []).map((q) => [q.id, q.title]));
    return (rows ?? []).map((r) => ({ ...r, quizTitle: titles.get(r.quiz_id) ?? "—" }));
  });

export const getSubmissionDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    const { data: submission } = await db.from("submissions").select("*").eq("id", data.id).maybeSingle();
    if (!submission) throw new Error("That submission could not be found.");
    const { data: session } = await db
      .from("exam_sessions")
      .select("started_at, submitted_at, status")
      .eq("id", submission.session_id)
      .maybeSingle();
    const { data: answers } = await db
      .from("submission_answers")
      .select("question_id, selected_answer, is_correct")
      .eq("submission_id", data.id);
    const ids = (answers ?? []).map((a) => a.question_id);
    const { data: questions } = await db
      .from("questions")
      .select("id, question_text, option_a, option_b, option_c, option_d, correct_answer, topic")
      .in("id", ids.length ? ids : [data.id]);
    const map = new Map((questions ?? []).map((q) => [q.id, q]));
    return {
      submission,
      session,
      answers: (answers ?? []).map((a) => ({
        ...a,
        question: map.get(a.question_id)?.question_text ?? "",
        correct: map.get(a.question_id)?.correct_answer ?? "",
        topic: map.get(a.question_id)?.topic ?? null,
      })),
    };
  });

/* -------------------------------- analytics ------------------------------ */

export const getAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ quizId: z.string().uuid().optional() }).parse(raw))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);

    let subQuery = db.from("submissions").select("id, quiz_id, percentage, duration_seconds, unanswered_count, total_questions");
    if (data.quizId) subQuery = subQuery.eq("quiz_id", data.quizId);
    const { data: subs } = await subQuery;
    const submissionIds = (subs ?? []).map((s) => s.id);

    const { data: answers } = submissionIds.length
      ? await db
          .from("submission_answers")
          .select("question_id, is_correct")
          .in("submission_id", submissionIds.slice(0, 500))
      : { data: [] as { question_id: string; is_correct: boolean }[] };

    const stats = new Map<string, { total: number; correct: number }>();
    for (const a of answers ?? []) {
      const s = stats.get(a.question_id) ?? { total: 0, correct: 0 };
      s.total++;
      if (a.is_correct) s.correct++;
      stats.set(a.question_id, s);
    }
    const qIds = [...stats.keys()];
    const { data: questions } = qIds.length
      ? await db.from("questions").select("id, question_text, topic").in("id", qIds)
      : { data: [] as { id: string; question_text: string; topic: string | null }[] };
    const qMap = new Map((questions ?? []).map((q) => [q.id, q]));

    const perQuestion = qIds
      .map((id) => {
        const s = stats.get(id)!;
        return {
          id,
          question: qMap.get(id)?.question_text ?? "",
          topic: qMap.get(id)?.topic ?? null,
          attempts: s.total,
          accuracy: s.total ? Math.round((s.correct / s.total) * 100) : 0,
        };
      })
      .sort((a, b) => a.accuracy - b.accuracy);

    const topicAgg = new Map<string, { total: number; correct: number }>();
    for (const [id, s] of stats) {
      const topic = qMap.get(id)?.topic ?? "Uncategorised";
      const t = topicAgg.get(topic) ?? { total: 0, correct: 0 };
      t.total += s.total;
      t.correct += s.correct;
      topicAgg.set(topic, t);
    }

    const percentages = (subs ?? []).map((s) => Number(s.percentage));
    const buckets = [0, 0, 0, 0, 0];
    for (const p of percentages) buckets[Math.min(4, Math.floor(p / 20))]!++;

    return {
      attempts: percentages.length,
      average: percentages.length
        ? Math.round((percentages.reduce((a, b) => a + b, 0) / percentages.length) * 10) / 10
        : 0,
      highest: percentages.length ? Math.max(...percentages) : 0,
      lowest: percentages.length ? Math.min(...percentages) : 0,
      averageDuration: (subs ?? []).length
        ? Math.round((subs ?? []).reduce((a, b) => a + b.duration_seconds, 0) / (subs ?? []).length)
        : 0,
      completionRate: (subs ?? []).length
        ? Math.round(
            ((subs ?? []).reduce(
              (a, b) => a + (b.total_questions ? 1 - b.unanswered_count / b.total_questions : 0),
              0,
            ) /
              (subs ?? []).length) *
              100,
          )
        : 0,
      hardest: perQuestion.slice(0, 5),
      easiest: perQuestion.slice(-5).reverse(),
      topics: [...topicAgg.entries()].map(([topic, t]) => ({
        topic,
        accuracy: t.total ? Math.round((t.correct / t.total) * 100) : 0,
        attempts: t.total,
      })),
      distribution: buckets.map((count, i) => ({ band: `${i * 20}-${i * 20 + 19}%`, count })),
    };
  });
