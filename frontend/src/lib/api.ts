// Typed fetch client for the Crammer JSON API (see reviewer/web/api.py).

export type SourceType = string;

export interface DocSummary {
  id: number;
  title: string;
  source_type: SourceType;
  created_at: string;
  exam_date: string | null;
  cards_total: number;
  cards_due: number;
  modules_finished: number;
  modules_total: number;
  mastery_pct: number;
  text_chars: number;
}

export interface SectionOut {
  heading: string;
  content: string;
  origin: string;
}

export interface ModuleOut {
  id: number;
  title: string;
  position: number;
  finished: boolean;
  cards_count: number;
  sections: SectionOut[];
  cards: CardOut[];
}

export interface DocDetail extends DocSummary {
  cheat_sheet: string | null;
  reviews_today: number;
  streak: number;
  modules: ModuleOut[];
}

export interface CardOut {
  id: number;
  document_id: number;
  module_id: number;
  card_type: string;
  question: string;
  answer: string;
}

export interface Overview {
  streak: number;
  longest_streak: number;
  reviews_today: number;
  cards_due_total: number;
  mastery_pct: number;
  documents: DocSummary[];
}

export interface WeeklyStats {
  days: { date: string; reviews: number }[];
}

export interface ScheduleOut {
  study_days: string[];
  exams: { document_id: number; title: string; exam_date: string }[];
}

export type QueueMode = "due" | "cram" | "weak";
export type Rating = "again" | "hard" | "good" | "easy";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers:
      init && init.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json", ...(init.headers ?? {}) }
        : init?.headers,
    ...init,
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      if (data && typeof data.detail === "string") message = data.detail;
    } catch {
      // ignore parse failures, keep statusText
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  overview: () => request<Overview>("/overview"),

  document: (id: number) => request<DocDetail>(`/documents/${id}`),

  paste: (title: string, text: string) =>
    request<{ document_id: number }>("/paste", {
      method: "POST",
      body: JSON.stringify({ title, text }),
    }),

  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ document_id: number }>("/upload", {
      method: "POST",
      body: form,
    });
  },

  generateDocument: (id: number) =>
    request<{ ok: true }>(`/documents/${id}/generate`, { method: "POST" }),

  deleteDocument: (id: number) =>
    request<{ ok: true }>(`/documents/${id}`, { method: "DELETE" }),

  queue: (id: number, mode: QueueMode) =>
    request<{ cards: CardOut[] }>(`/documents/${id}/queue?mode=${mode}`),

  globalQueue: (mode: QueueMode) => request<{ cards: CardOut[] }>(`/queue?mode=${mode}`),

  review: (cardId: number, rating: Rating) =>
    request<{ ok: true }>("/review", {
      method: "POST",
      body: JSON.stringify({ card_id: cardId, rating }),
    }),

  createCard: (
    docId: number,
    body: { module_id: number; question: string; answer: string; card_type: string },
  ) =>
    request<CardOut>(`/documents/${docId}/cards`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateCard: (
    cardId: number,
    patch: { question?: string; answer?: string; card_type?: string },
  ) =>
    request<CardOut>(`/cards/${cardId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  deleteCard: (cardId: number) =>
    request<{ ok: true }>(`/cards/${cardId}`, { method: "DELETE" }),

  moreCards: (docId: number, moduleId: number) =>
    request<{ added: number }>(`/documents/${docId}/modules/${moduleId}/more-cards`, {
      method: "POST",
    }),

  practice: (id: number) => request<{ cards: CardOut[] }>(`/documents/${id}/practice`),

  setExamDate: (id: number, examDate: string | null) =>
    request<{ ok: true }>(`/documents/${id}/exam-date`, {
      method: "POST",
      body: JSON.stringify({ exam_date: examDate }),
    }),

  weeklyStats: () => request<WeeklyStats>("/stats/weekly"),

  schedule: () => request<ScheduleOut>("/schedule"),
};
