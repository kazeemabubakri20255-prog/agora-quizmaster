import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Public (unauthenticated) student-facing exam API.
 *
 * Every handler runs server-side with a privileged client so that answer keys
 * never leave the server during an exam. Access to a session is proven with an
 * opaque per-attempt session token, never with a database id alone.
 */

const AnswerLetter = z.enum(["A", "B", "C", "D"]);

const sessionCredentials = z.object({
  sessionId: z.string().uuid(),
  token: z.string().uuid(),
});

const answerPatch = z.object({
  questionId: z.string().uuid(),
  selected: AnswerLetter.nullable(),
});

export type AnswerLetterT = z.infer<typeof AnswerLetter>;

export type PublicQuestion = {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  topic: string | null;
  difficulty: string;
};

export type ExamState = {
  sessionId: string;
  token: string;
  quiz: { title: string; slug: string; durationSeconds: number };
  questions: PublicQuestion[];
  answers: Record<string, AnswerLetterT>;
  marked: string[];
  currentIndex: number;
  expiresAt: string;
  serverNow: string;
  status: "active";
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Friendly, non-leaky error. */
class ExamError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/* ------------------------------------------------------------------ */
/* Grading (server authoritative)                                      */
/* ------------------------------------------------------------------ */

type AnyClient = Awaited<ReturnType<typeof admin>>;

async function gradeAndFinalize(
  db: AnyClient,
  session: {
    id: string;
    quiz_id: string;
    student_id: string | null;
    student_name: string;
    question_ids: string[];
    started_at: string;
    expires_at: string;
  },
  autoSubmitted: boolean,
) {
  // Idempotency: one submission per session (enforced by a unique constraint).
  const existing = await db
    .from("submissions")
    .select("id")
    .eq("session_id", session.id)
    .maybeSingle();
  if (existing.data) return existing.data.id as string;

  const [{ data: questions }, { data: saved }] = await Promise.all([
    db
      .from("questions")
      .select("id, correct_answer")
      .in("id", session.question_ids.length ? session.question_ids : [session.id]),
    db.from("session_answers").select("question_id, selected_answer").eq("session_id", session.id),
  ]);

  const key = new Map((questions ?? []).map((q) => [q.id, q.correct_answer]));
  const chosen = new Map((saved ?? []).map((a) => [a.question_id, a.selected_answer]));

  let correct = 0;
  let incorrect = 0;
  let unanswered = 0;
  const rows: {
    question_id: string;
    selected_answer: string | null;
    is_correct: boolean;
  }[] = [];

  for (const qid of session.question_ids) {
    const picked = chosen.get(qid) ?? null;
    if (!picked) {
      unanswered++;
      rows.push({ question_id: qid, selected_answer: null, is_correct: false });
      continue;
    }
    const ok = key.get(qid) === picked;
    if (ok) correct++;
    else incorrect++;
    rows.push({ question_id: qid, selected_answer: picked, is_correct: ok });
  }

  const total = session.question_ids.length;
  const percentage = total ? Math.round((correct / total) * 10000) / 100 : 0;
  const submittedAt = new Date();
  const duration = Math.max(
    0,
    Math.round((submittedAt.getTime() - new Date(session.started_at).getTime()) / 1000),
  );

  const inserted = await db
    .from("submissions")
    .insert({
      session_id: session.id,
      quiz_id: session.quiz_id,
      student_id: session.student_id,
      student_name: session.student_name,
      score: correct,
      percentage,
      total_questions: total,
      correct_count: correct,
      incorrect_count: incorrect,
      unanswered_count: unanswered,
      duration_seconds: duration,
      auto_submitted: autoSubmitted,
      submitted_at: submittedAt.toISOString(),
    })
    .select("id")
    .single();

  if (inserted.error) {
    // Lost a race with a concurrent submit — reuse the winner.
    const again = await db
      .from("submissions")
      .select("id")
      .eq("session_id", session.id)
      .maybeSingle();
    if (again.data) return again.data.id as string;
    throw inserted.error;
  }

  const submissionId = inserted.data.id as string;
  if (rows.length) {
    await db
      .from("submission_answers")
      .insert(rows.map((r) => ({ ...r, submission_id: submissionId })));
  }

  await db
    .from("exam_sessions")
    .update({
      status: autoSubmitted ? "expired" : "submitted",
      submitted_at: submittedAt.toISOString(),
      score: correct,
    })
    .eq("id", session.id);

  return submissionId;
}

async function loadSession(db: AnyClient, sessionId: string, token: string) {
  const { data, error } = await db
    .from("exam_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new ExamError("db", "Session lookup failed");
  if (!data || data.session_token !== token) {
    throw new ExamError("not_found", "This exam session could not be found.");
  }
  return data;
}

/* ------------------------------------------------------------------ */
/* Public endpoints                                                    */
/* ------------------------------------------------------------------ */

export const getQuizPublic = createServerFn({ method: "GET" })
  .inputValidator((raw) => z.object({ slug: z.string().min(1).max(120) }).parse(raw))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: quiz } = await db
      .from("quizzes")
      .select(
        "title, slug, description, duration_seconds, question_limit, is_active, status, show_leaderboard, whatsapp_url",
      )
      .eq("slug", data.slug)
      .maybeSingle();

    if (!quiz) return { found: false as const };

    const available = quiz.is_active && quiz.status === "active";
    return {
      found: true as const,
      available,
      quiz: {
        title: quiz.title,
        slug: quiz.slug,
        description: quiz.description,
        durationSeconds: quiz.duration_seconds,
        questionLimit: quiz.question_limit,
        showLeaderboard: quiz.show_leaderboard,
        whatsappUrl: quiz.whatsapp_url,
      },
    };
  });

export const listActiveQuizzes = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data } = await db
    .from("quizzes")
    .select("title, slug, description, duration_seconds, question_limit, is_demo")
    .eq("is_active", true)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(12);
  return (data ?? []).map((q) => ({
    title: q.title,
    slug: q.slug,
    description: q.description,
    durationSeconds: q.duration_seconds,
    questionLimit: q.question_limit,
    isDemo: q.is_demo,
  }));
});

export const startExam = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        slug: z.string().min(1).max(120),
        studentName: z.string().trim().min(2).max(80),
        studentIdentifier: z.string().trim().max(120).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }): Promise<ExamState> => {
    const db = await admin();
    const { data: quiz } = await db
      .from("quizzes")
      .select("id, title, slug, duration_seconds, question_limit, is_active, status, shuffle_questions")
      .eq("slug", data.slug)
      .maybeSingle();

    if (!quiz) throw new ExamError("missing", "This examination could not be found.");
    if (!quiz.is_active || quiz.status !== "active") {
      throw new ExamError("inactive", "This examination is currently unavailable.");
    }

    const { data: pool } = await db
      .from("questions")
      .select("id, question_text, option_a, option_b, option_c, option_d, topic, difficulty, position")
      .eq("quiz_id", quiz.id)
      .eq("is_active", true)
      .order("position", { ascending: true })
      .limit(180);

    if (!pool || pool.length === 0) {
      throw new ExamError("empty", "This examination has no questions yet.");
    }

    const ordered = quiz.shuffle_questions ? shuffle(pool) : pool;
    const selected = ordered.slice(0, Math.min(quiz.question_limit, 180, ordered.length));

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + quiz.duration_seconds * 1000);

    const { data: session, error } = await db
      .from("exam_sessions")
      .insert({
        quiz_id: quiz.id,
        student_name: data.studentName,
        student_identifier: data.studentIdentifier ?? null,
        started_at: startedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        status: "active",
        question_ids: selected.map((q) => q.id),
      })
      .select("id, session_token, expires_at")
      .single();

    if (error || !session) throw new ExamError("db", "Could not start this examination.");

    return {
      sessionId: session.id,
      token: session.session_token,
      quiz: { title: quiz.title, slug: quiz.slug, durationSeconds: quiz.duration_seconds },
      questions: selected.map(({ position: _p, ...q }) => q) as PublicQuestion[],
      answers: {},
      marked: [],
      currentIndex: 0,
      expiresAt: session.expires_at,
      serverNow: new Date().toISOString(),
      status: "active",
    };
  });

export type ResumeResult =
  | { state: "active"; exam: ExamState }
  | { state: "finished"; submissionId: string }
  | { state: "gone" };

export const resumeExam = createServerFn({ method: "POST" })
  .inputValidator((raw) => sessionCredentials.parse(raw))
  .handler(async ({ data }): Promise<ResumeResult> => {
    const db = await admin();
    let session;
    try {
      session = await loadSession(db, data.sessionId, data.token);
    } catch {
      return { state: "gone" };
    }

    if (session.status === "submitted" || session.status === "expired") {
      const sub = await db
        .from("submissions")
        .select("id")
        .eq("session_id", session.id)
        .maybeSingle();
      if (sub.data) return { state: "finished", submissionId: sub.data.id };
    }

    if (new Date(session.expires_at).getTime() <= Date.now()) {
      const submissionId = await gradeAndFinalize(db, session, true);
      return { state: "finished", submissionId };
    }

    const [{ data: quiz }, { data: questions }, { data: saved }] = await Promise.all([
      db.from("quizzes").select("title, slug, duration_seconds").eq("id", session.quiz_id).single(),
      db
        .from("questions")
        .select("id, question_text, option_a, option_b, option_c, option_d, topic, difficulty")
        .in("id", session.question_ids),
      db.from("session_answers").select("question_id, selected_answer").eq("session_id", session.id),
    ]);

    const byId = new Map((questions ?? []).map((q) => [q.id, q]));
    const answers: Record<string, AnswerLetterT> = {};
    for (const row of saved ?? []) {
      if (row.selected_answer) answers[row.question_id] = row.selected_answer as AnswerLetterT;
    }

    return {
      state: "active",
      exam: {
        sessionId: session.id,
        token: session.session_token,
        quiz: {
          title: quiz?.title ?? "Examination",
          slug: quiz?.slug ?? "",
          durationSeconds: quiz?.duration_seconds ?? 0,
        },
        questions: session.question_ids
          .map((id: string) => byId.get(id))
          .filter(Boolean) as PublicQuestion[],
        answers,
        marked: session.marked_ids ?? [],
        currentIndex: session.current_index ?? 0,
        expiresAt: session.expires_at,
        serverNow: new Date().toISOString(),
        status: "active",
      },
    };
  });

export const syncExam = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    sessionCredentials
      .extend({
        answers: z.array(answerPatch).max(180),
        marked: z.array(z.string().uuid()).max(180).optional(),
        currentIndex: z.number().int().min(0).max(179).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const session = await loadSession(db, data.sessionId, data.token);

    if (session.status !== "active") {
      return { ok: false as const, reason: "closed" as const, serverNow: new Date().toISOString() };
    }
    if (new Date(session.expires_at).getTime() <= Date.now()) {
      await gradeAndFinalize(db, session, true);
      return { ok: false as const, reason: "expired" as const, serverNow: new Date().toISOString() };
    }

    const allowed = new Set(session.question_ids as string[]);
    const rows = data.answers
      .filter((a) => allowed.has(a.questionId) && a.selected !== null)
      .map((a) => ({
        session_id: session.id,
        question_id: a.questionId,
        selected_answer: a.selected,
        updated_at: new Date().toISOString(),
      }));

    if (rows.length) {
      await db.from("session_answers").upsert(rows, { onConflict: "session_id,question_id" });
    }
    const cleared = data.answers.filter((a) => allowed.has(a.questionId) && a.selected === null);
    for (const c of cleared) {
      await db
        .from("session_answers")
        .delete()
        .eq("session_id", session.id)
        .eq("question_id", c.questionId);
    }

    await db
      .from("exam_sessions")
      .update({
        marked_ids: data.marked ?? session.marked_ids,
        current_index: data.currentIndex ?? session.current_index,
      })
      .eq("id", session.id);

    return {
      ok: true as const,
      serverNow: new Date().toISOString(),
      expiresAt: session.expires_at,
    };
  });

export const submitExam = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    sessionCredentials
      .extend({
        answers: z.array(answerPatch).max(180).optional(),
        auto: z.boolean().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const session = await loadSession(db, data.sessionId, data.token);

    const expired = new Date(session.expires_at).getTime() <= Date.now();

    if (session.status === "active" && !expired && data.answers?.length) {
      const allowed = new Set(session.question_ids as string[]);
      const rows = data.answers
        .filter((a) => allowed.has(a.questionId) && a.selected !== null)
        .map((a) => ({
          session_id: session.id,
          question_id: a.questionId,
          selected_answer: a.selected,
          updated_at: new Date().toISOString(),
        }));
      if (rows.length) {
        await db.from("session_answers").upsert(rows, { onConflict: "session_id,question_id" });
      }
    }

    const submissionId = await gradeAndFinalize(db, session, expired || Boolean(data.auto));
    return { submissionId };
  });

export type ReviewItem = {
  questionId: string;
  question: string;
  options: { A: string; B: string; C: string; D: string };
  selected: AnswerLetterT | null;
  correct: AnswerLetterT;
  isCorrect: boolean;
  explanation: string | null;
  topic: string | null;
};

export const getResult = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({ submissionId: z.string().uuid(), token: z.string().uuid() })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: submission } = await db
      .from("submissions")
      .select("*")
      .eq("id", data.submissionId)
      .maybeSingle();
    if (!submission) throw new ExamError("missing", "This result could not be found.");

    const { data: session } = await db
      .from("exam_sessions")
      .select("session_token, started_at, submitted_at, expires_at")
      .eq("id", submission.session_id)
      .maybeSingle();

    if (!session || session.session_token !== data.token) {
      throw new ExamError("forbidden", "This result could not be found.");
    }

    const [{ data: answers }, { data: quiz }] = await Promise.all([
      db
        .from("submission_answers")
        .select("question_id, selected_answer, is_correct")
        .eq("submission_id", submission.id),
      db.from("quizzes").select("title, slug, show_leaderboard").eq("id", submission.quiz_id).single(),
    ]);

    const questionIds = (answers ?? []).map((a) => a.question_id);
    const { data: questions } = await db
      .from("questions")
      .select(
        "id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, topic",
      )
      .in("id", questionIds.length ? questionIds : [submission.id]);

    const qById = new Map((questions ?? []).map((q) => [q.id, q]));
    const review: ReviewItem[] = (answers ?? []).map((a) => {
      const q = qById.get(a.question_id);
      return {
        questionId: a.question_id,
        question: q?.question_text ?? "",
        options: {
          A: q?.option_a ?? "",
          B: q?.option_b ?? "",
          C: q?.option_c ?? "",
          D: q?.option_d ?? "",
        },
        selected: (a.selected_answer as AnswerLetterT | null) ?? null,
        correct: (q?.correct_answer ?? "A") as AnswerLetterT,
        isCorrect: a.is_correct,
        explanation: q?.explanation ?? null,
        topic: q?.topic ?? null,
      };
    });

    return {
      quiz: { title: quiz?.title ?? "Examination", slug: quiz?.slug ?? "", showLeaderboard: quiz?.show_leaderboard ?? false },
      summary: {
        studentName: submission.student_name,
        score: submission.score,
        percentage: Number(submission.percentage),
        totalQuestions: submission.total_questions,
        correct: submission.correct_count,
        incorrect: submission.incorrect_count,
        unanswered: submission.unanswered_count,
        answered: submission.total_questions - submission.unanswered_count,
        durationSeconds: submission.duration_seconds,
        autoSubmitted: submission.auto_submitted,
        submittedAt: submission.submitted_at,
      },
      review,
    };
  });

export const getLeaderboard = createServerFn({ method: "POST" })
  .inputValidator((raw) => z.object({ slug: z.string().min(1).max(120) }).parse(raw))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: quiz } = await db
      .from("quizzes")
      .select("id, title, show_leaderboard")
      .eq("slug", data.slug)
      .maybeSingle();

    if (!quiz || !quiz.show_leaderboard) return { enabled: false as const, rows: [] };

    const { data: rows } = await db
      .from("submissions")
      .select("student_name, score, percentage, duration_seconds, submitted_at")
      .eq("quiz_id", quiz.id)
      .order("score", { ascending: false })
      .order("duration_seconds", { ascending: true })
      .limit(25);

    return {
      enabled: true as const,
      rows: (rows ?? []).map((r, i) => ({
        rank: i + 1,
        name: r.student_name,
        score: r.score,
        percentage: Number(r.percentage),
        durationSeconds: r.duration_seconds,
      })),
    };
  });
