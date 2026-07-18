import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "../api/client";
import {
  createChapter,
  fetchChapter,
  updateChapterContent,
  updateChapterMeta,
} from "../api/endpoints";
import type { ChapterSummary, Role } from "../api/types";
import { useAsync } from "../hooks/useAsync";
import {
  BODY_BYTE_LIMIT,
  BODY_BYTE_SAFE,
  formatKb,
  jsonBytes,
} from "../lib/payload";
import { canEditText, canWrite, explain403 } from "../lib/roles";
import SafeHtml from "./SafeHtml";

export interface SavedChapter {
  id: number;
  name: string;
  slug: string;
  index: number;
}

interface ChapterEditorPanelProps {
  novelId: number;
  /** null → creating a new chapter */
  chapter: ChapterSummary | null;
  role: Role;
  onSaved: (chapter: SavedChapter) => void;
  onClose: () => void;
}

/**
 * Create a chapter or edit an existing one. Writers/admins get name + index +
 * text; translators get text only (the one authoring endpoint they can use).
 * Mount with a `key` per chapter so state resets on selection change.
 */
export default function ChapterEditorPanel({
  novelId,
  chapter,
  role,
  onSaved,
  onClose,
}: ChapterEditorPanelProps) {
  const isNew = chapter === null;
  const manage = canWrite(role);
  const text = canEditText(role);

  const [name, setName] = useState(chapter?.name ?? "");
  const [indexStr, setIndexStr] = useState(
    chapter ? String(chapter.index) : "",
  );
  const [content, setContent] = useState("");
  // What the server currently holds, to diff against; null until loaded.
  const [loaded, setLoaded] = useState<string | null>(isNew ? "" : null);
  const [hadNoText, setHadNoText] = useState(false);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Existing chapters: pull the current text into the editor.
  const existing = useAsync(
    () => fetchChapter(chapter!.id),
    [chapter?.id],
    !isNew,
  );
  useEffect(() => {
    if (!existing.data) return;
    const current = existing.data.content ?? "";
    setContent(current);
    setLoaded(current);
    setHadNoText(existing.data.content === null);
  }, [existing.data]);

  const body = isNew
    ? { name, content, index: indexStr.trim() ? Number(indexStr) : undefined }
    : { content };
  const bytes = jsonBytes(body);
  const tooBig = bytes > BODY_BYTE_SAFE;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const idx = indexStr.trim();
    const index = idx ? Number(idx) : undefined;
    if (manage && idx && (!Number.isInteger(index) || index! < 0)) {
      setError("Index must be a whole number (0 or higher).");
      return;
    }
    if (tooBig) return;

    setBusy(true);
    try {
      if (isNew) {
        const trimmed = name.trim();
        if (!trimmed || !content.trim()) {
          setError("A new chapter needs a name and some text.");
          return;
        }
        const res = await createChapter(novelId, {
          name: trimmed,
          content,
          index,
        });
        onSaved(res);
        setName("");
        setContent("");
        setIndexStr("");
        setNotice(`Added “${res.name}” ✦ — keep going or close the panel.`);
      } else {
        let savedName = chapter.name;
        let savedIndex = chapter.index;
        const metaPatch: Partial<{ name: string; index: number }> = {};
        if (manage && name.trim() && name.trim() !== chapter.name)
          metaPatch.name = name.trim();
        if (manage && index !== undefined && index !== chapter.index)
          metaPatch.index = index;
        const textChanged = text && loaded !== null && content !== loaded;

        if (Object.keys(metaPatch).length === 0 && !textChanged) {
          setNotice("Nothing changed.");
          return;
        }
        if (Object.keys(metaPatch).length > 0) {
          const res = await updateChapterMeta(chapter.id, metaPatch);
          savedName = res.name;
          savedIndex = res.index;
        }
        if (textChanged) {
          await updateChapterContent(chapter.id, content);
          setLoaded(content);
          setHadNoText(false);
        }
        onSaved({
          id: chapter.id,
          name: savedName,
          slug: chapter.slug,
          index: savedIndex,
        });
        setNotice("Saved ✦");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      setError(
        err instanceof ApiError && err.status === 403
          ? explain403(message)
          : message,
      );
    } finally {
      setBusy(false);
    }
  }

  const textLoading = !isNew && existing.loading;

  return (
    <form className="card chapter-editor" onSubmit={onSubmit}>
      <div className="chapter-editor-head">
        <h4>{isNew ? "New chapter" : `Editing: ${chapter.name}`}</h4>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onClose}
        >
          Close ✕
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}
      {notice && <div className="form-success">{notice}</div>}
      {!isNew && existing.error && (
        <div className="form-error">
          Couldn't load the current text: {existing.error}{" "}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={existing.reload}
          >
            Retry
          </button>
        </div>
      )}
      {hadNoText && (
        <div className="warn-banner">
          This chapter has no text row (broken legacy data) — the API may
          reject saving text for it.
        </div>
      )}

      {manage && (
        <div className="chapter-editor-meta">
          <div className="field">
            <label className="field-label" htmlFor="ch-name">
              Chapter name
            </label>
            <input
              id="ch-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={255}
              placeholder="Chapter 1 — The Beginning"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="ch-index">
              Reading order (index)
            </label>
            <input
              id="ch-index"
              className="input"
              inputMode="numeric"
              value={indexStr}
              onChange={(e) => setIndexStr(e.target.value)}
              placeholder={isNew ? "auto (append at end)" : undefined}
            />
            <div className="field-help">
              0-based position in the novel. Readers navigate by this, never by
              the name.
            </div>
          </div>
        </div>
      )}

      {text && (
        <div className="field">
          <div className="chapter-editor-texthead">
            <label className="field-label" htmlFor="ch-content">
              Chapter text (HTML)
            </label>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setPreview((p) => !p)}
              disabled={textLoading}
            >
              {preview ? "Edit" : "Preview"}
            </button>
          </div>
          {preview ? (
            <SafeHtml html={content} className="chapter-preview" />
          ) : (
            <textarea
              id="ch-content"
              className="input textarea-lg"
              value={textLoading ? "" : content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                textLoading ? "Loading current text…" : "<p>Once upon a star…</p>"
              }
              disabled={textLoading}
            />
          )}
          <div className={`byte-meter${tooBig ? " is-over" : ""}`}>
            {formatKb(bytes)} of ~{formatKb(BODY_BYTE_LIMIT)}
            {tooBig &&
              " — too large for the API; split this into multiple chapters"}
          </div>
        </div>
      )}

      <div className="chapter-editor-actions">
        <button
          className="btn btn-primary btn-md"
          disabled={busy || tooBig || textLoading}
        >
          {busy ? "Saving…" : isNew ? "Add chapter" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
