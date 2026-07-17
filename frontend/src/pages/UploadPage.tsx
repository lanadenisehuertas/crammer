import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileUp, Loader2, PenLine, UploadCloud } from "lucide-react";
import { api } from "../lib/api";
import { Button, Card } from "../components/ui";

/** Local-time ISO string (matches the backend's created_at format). */
function localIso(msAgo = 0): string {
  const d = new Date(Date.now() - msAgo);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const POLL_MS = 4000;
const POLL_LIMIT_MS = 15 * 60 * 1000;

export function UploadPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slowNote, setSlowNote] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (pollRef.current !== null) window.clearInterval(pollRef.current);
  }, []);

  /** Run a generation request, but don't trust its HTTP response alone:
   *  poll the server too, so completion is detected even if the original
   *  request is dropped by the browser (long generations). */
  async function runGeneration(action: () => Promise<{ document_id: number }>) {
    setError(null);
    setSlowNote(false);
    setGenerating(true);
    const startedAt = localIso(5000); // small slack for clock skew
    const pollStart = Date.now();
    let settled = false;

    const finish = (docId: number) => {
      if (settled) return;
      settled = true;
      if (pollRef.current !== null) window.clearInterval(pollRef.current);
      navigate(`/document/${docId}`);
    };

    pollRef.current = window.setInterval(async () => {
      if (Date.now() - pollStart > POLL_LIMIT_MS) {
        if (pollRef.current !== null) window.clearInterval(pollRef.current);
        setGenerating(false);
        setError("This is taking unusually long. Check the Home page in a bit — " +
          "the document may still finish in the background.");
        return;
      }
      if (Date.now() - pollStart > 90 * 1000) setSlowNote(true);
      try {
        const overview = await api.overview();
        const done = overview.documents.find(
          (d) => d.created_at >= startedAt && d.modules_total > 0);
        if (done) finish(done.id);
      } catch {
        /* transient poll failure: keep trying */
      }
    }, POLL_MS);

    try {
      const { document_id } = await action();
      finish(document_id);
    } catch (err) {
      // A network drop mid-request doesn't mean generation failed — the
      // server keeps working and the poller will catch the result. Only a
      // real API error (which carries a message from the server) is final.
      const isNetworkDrop = err instanceof TypeError;
      if (!settled && !isNetworkDrop) {
        settled = true;
        if (pollRef.current !== null) window.clearInterval(pollRef.current);
        setGenerating(false);
        setError((err as Error).message ?? "Could not process that.");
      }
    }
  }

  async function submitUpload(e: FormEvent) {
    e.preventDefault();
    if (!pickedFile) return;
    await runGeneration(() => api.upload(pickedFile));
  }

  async function submitPaste(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    await runGeneration(() => api.paste(title, text));
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-extrabold text-ink">Add Study Material</h1>

      {error && (
        <div className="mb-4 rounded-card bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>
      )}

      {generating && (
        <div className="mb-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white">
            <Loader2 size={16} className="animate-spin" />
            Generating your reviewer&hellip;
          </div>
          {slowNote && (
            <p className="mt-2 text-xs text-muted">
              Still working — big files and free-tier pacing can take a few
              minutes. You can leave this page; the document will appear on
              Home when it's ready.
            </p>
          )}
        </div>
      )}

      <form onSubmit={submitUpload}>
        <Card className="mb-6 p-6">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-mint text-emerald-700">
            <FileUp size={18} />
          </div>
          <h2 className="mb-1 text-base font-bold text-ink">Upload a file</h2>
          <p className="mb-4 text-sm text-muted">
            PDF, DOCX, PPTX, images, spreadsheets, HTML, EPUB, or text files.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.pptx,.png,.jpg,.jpeg,.gif,.webp,.csv,.xlsx,.xls,.html,.htm,.epub,.txt,.md,.markdown,.rtf"
            className="hidden"
            onChange={(e) => setPickedFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-card border-2 border-dashed border-ink/10 bg-wash py-6 text-sm font-semibold text-muted"
          >
            <UploadCloud size={18} />
            {pickedFile ? pickedFile.name : "Choose a file"}
          </button>

          <Button type="submit" variant="pill-dark" className="w-full" disabled={!pickedFile || generating}>
            Generate reviewer
          </Button>
        </Card>
      </form>

      <form onSubmit={submitPaste}>
        <Card className="p-6">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-lav text-primary">
            <PenLine size={18} />
          </div>
          <h2 className="mb-1 text-base font-bold text-ink">Paste text</h2>
          <p className="mb-4 text-sm text-muted">Paste notes straight from anywhere.</p>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="mb-3 w-full rounded-full bg-wash px-4 py-3 text-sm text-ink outline-none placeholder:text-muted"
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your notes here..."
            rows={6}
            className="mb-4 w-full rounded-card bg-wash px-4 py-3 text-sm text-ink outline-none placeholder:text-muted"
          />

          <Button type="submit" variant="pill-primary" className="w-full" disabled={!text.trim() || generating}>
            Generate reviewer
          </Button>
        </Card>
      </form>
    </div>
  );
}
