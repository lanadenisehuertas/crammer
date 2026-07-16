import { useState } from "react";
import { Loader2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { api, CardOut } from "../lib/api";
import { Badge } from "./ui";
import { cn } from "../lib/cn";

const TYPE_LABEL: Record<string, string> = {
  flashcard: "Flashcard",
  "fill-in-blank": "Fill in blank",
  "short-answer": "Short answer",
};

const CARD_TYPES = ["flashcard", "fill-in-blank", "short-answer"] as const;

interface CardFormState {
  question: string;
  answer: string;
  card_type: string;
}

const EMPTY_FORM: CardFormState = { question: "", answer: "", card_type: "flashcard" };

function CardForm({
  initial,
  saving,
  error,
  onSave,
  onCancel,
}: {
  initial: CardFormState;
  saving: boolean;
  error: string | null;
  onSave: (form: CardFormState) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<CardFormState>(initial);
  return (
    <div className="rounded-2xl bg-white p-3 shadow-soft">
      <textarea
        value={form.question}
        onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
        placeholder="Question"
        rows={2}
        className="mb-2 w-full resize-none rounded-xl border border-ink/10 bg-wash p-2.5 text-sm text-ink outline-none focus:border-primary"
      />
      <textarea
        value={form.answer}
        onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
        placeholder="Answer"
        rows={2}
        className="mb-2 w-full resize-none rounded-xl border border-ink/10 bg-wash p-2.5 text-sm text-ink outline-none focus:border-primary"
      />
      <select
        value={form.card_type}
        onChange={(e) => setForm((f) => ({ ...f, card_type: e.target.value }))}
        className="mb-3 w-full rounded-xl border border-ink/10 bg-wash p-2.5 text-sm font-semibold text-ink outline-none focus:border-primary"
      >
        {CARD_TYPES.map((t) => (
          <option key={t} value={t}>
            {TYPE_LABEL[t]}
          </option>
        ))}
      </select>
      {error && <p className="mb-2 text-xs font-medium text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 rounded-full bg-washAlt py-2 text-xs font-bold text-ink disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={saving}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-ink py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {saving && <Loader2 size={12} className="animate-spin" />}
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

export function ModuleCardsList({
  docId,
  moduleId,
  cards,
  onChanged,
}: {
  docId: number;
  moduleId: number;
  cards: CardOut[];
  onChanged: () => void;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [rowDeleting, setRowDeleting] = useState(false);

  const [moreLoading, setMoreLoading] = useState(false);
  const [moreAdded, setMoreAdded] = useState<number | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);

  function startEdit(id: number) {
    setDeletingId(null);
    setAdding(false);
    setFormError(null);
    setEditingId(id);
  }

  function startAdd() {
    setEditingId(null);
    setDeletingId(null);
    setFormError(null);
    setAdding(true);
  }

  function cancelForm() {
    setEditingId(null);
    setAdding(false);
    setFormError(null);
  }

  async function saveEdit(cardId: number, form: CardFormState) {
    setSaving(true);
    setFormError(null);
    try {
      await api.updateCard(cardId, form);
      setEditingId(null);
      onChanged();
    } catch (e) {
      setFormError((e as Error).message ?? "Could not save this card.");
    } finally {
      setSaving(false);
    }
  }

  async function saveNew(form: CardFormState) {
    if (!form.question.trim() || !form.answer.trim()) {
      setFormError("Question and answer are required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await api.createCard(docId, { module_id: moduleId, ...form });
      setAdding(false);
      onChanged();
    } catch (e) {
      setFormError((e as Error).message ?? "Could not add this card.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(cardId: number) {
    setRowDeleting(true);
    try {
      await api.deleteCard(cardId);
      setDeletingId(null);
      onChanged();
    } catch {
      // leave the confirm row up; the card list will simply not have shrunk
    } finally {
      setRowDeleting(false);
    }
  }

  async function runMoreCards() {
    setMoreLoading(true);
    setMoreError(null);
    setMoreAdded(null);
    try {
      const res = await api.moreCards(docId, moduleId);
      setMoreAdded(res.added);
      onChanged();
    } catch (e) {
      setMoreError((e as Error).message ?? "Could not generate more cards.");
    } finally {
      setMoreLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="pt-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          Cards ({cards.length})
        </p>
        <div className="flex flex-col items-end">
          <button
            type="button"
            onClick={runMoreCards}
            disabled={moreLoading}
            className="inline-flex items-center gap-1.5 rounded-full bg-lav px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-60"
          >
            {moreLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            More cards
          </button>
          <span className="mt-1 text-[10px] text-muted">uses AI credits</span>
        </div>
      </div>

      {moreAdded !== null && (
        <p className="mb-2 text-xs font-semibold text-emerald-700">+{moreAdded} added</p>
      )}
      {moreError && (
        <div className="mb-2 rounded-card bg-red-50 p-3 text-xs font-medium text-red-700">
          {moreError}
        </div>
      )}

      <div className="space-y-2">
        {cards.map((card) =>
          editingId === card.id ? (
            <CardForm
              key={card.id}
              initial={{ question: card.question, answer: card.answer, card_type: card.card_type }}
              saving={saving}
              error={formError}
              onSave={(form) => saveEdit(card.id, form)}
              onCancel={cancelForm}
            />
          ) : deletingId === card.id ? (
            <div key={card.id} className="flex items-center justify-between gap-3 rounded-2xl bg-red-50 p-3">
              <p className="text-xs font-medium text-red-700">Delete this card?</p>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingId(null)}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => confirmDelete(card.id)}
                  disabled={rowDeleting}
                  className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {rowDeleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          ) : (
            <div key={card.id} className="flex items-start gap-2 rounded-2xl bg-washAlt/70 p-3">
              <Badge tone="white" className="mt-0.5 shrink-0">
                {TYPE_LABEL[card.card_type] ?? card.card_type}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{card.question}</p>
                <p className="truncate text-xs text-muted">{card.answer}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  aria-label="Edit card"
                  onClick={() => startEdit(card.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-ink"
                >
                  <Pencil size={12} />
                </button>
                <button
                  type="button"
                  aria-label="Delete card"
                  onClick={() => setDeletingId(card.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-ink"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ),
        )}

        {cards.length === 0 && !adding && (
          <p className="text-sm text-muted">No cards in this module yet.</p>
        )}

        {adding ? (
          <CardForm initial={EMPTY_FORM} saving={saving} error={formError} onSave={saveNew} onCancel={cancelForm} />
        ) : (
          <button
            type="button"
            onClick={startAdd}
            className={cn(
              "flex w-full items-center justify-center gap-1.5 rounded-full border border-dashed border-ink/15 py-2.5 text-xs font-semibold text-muted hover:text-ink",
            )}
          >
            <Plus size={13} />
            Add a card
          </button>
        )}
      </div>
    </div>
  );
}
