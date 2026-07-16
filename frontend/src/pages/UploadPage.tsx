import { FormEvent, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileUp, Loader2, PenLine, UploadCloud } from "lucide-react";
import { api } from "../lib/api";
import { Button, Card } from "../components/ui";

export function UploadPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitUpload(e: FormEvent) {
    e.preventDefault();
    if (!pickedFile) return;
    setError(null);
    setGenerating(true);
    try {
      const { document_id } = await api.upload(pickedFile);
      navigate(`/document/${document_id}`);
    } catch (err) {
      setError((err as Error).message ?? "Could not process that file.");
    } finally {
      setGenerating(false);
    }
  }

  async function submitPaste(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setError(null);
    setGenerating(true);
    try {
      const { document_id } = await api.paste(title, text);
      navigate(`/document/${document_id}`);
    } catch (err) {
      setError((err as Error).message ?? "Could not process that text.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-extrabold text-ink">Add Study Material</h1>

      {error && (
        <div className="mb-4 rounded-card bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>
      )}

      {generating && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white">
          <Loader2 size={16} className="animate-spin" />
          Generating your reviewer&hellip;
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
