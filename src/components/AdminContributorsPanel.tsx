import { useState, type FormEvent } from "react";
import { addContributor, fetchAdminUsers, fetchNovels } from "../api/endpoints";
import type { AdminUser, ContributorRole, Novel } from "../api/types";
import { useAsync } from "../hooks/useAsync";
import { useDebounce } from "../hooks/useDebounce";

export default function AdminContributorsPanel() {
  const [pickedUser, setPickedUser] = useState<AdminUser | null>(null);
  const [pickedNovel, setPickedNovel] = useState<Novel | null>(null);
  const [role, setRole] = useState<ContributorRole>("writer");

  const [userQuery, setUserQuery] = useState("");
  const [novelQuery, setNovelQuery] = useState("");
  const debouncedUser = useDebounce(userQuery.trim());
  const debouncedNovel = useDebounce(novelQuery.trim());

  const userResults = useAsync(
    () => fetchAdminUsers({ search: debouncedUser, limit: 8 }),
    [debouncedUser],
    pickedUser === null && debouncedUser.length > 0,
  );
  const novelResults = useAsync(
    () => fetchNovels({ search: debouncedNovel, limit: 8 }),
    [debouncedNovel],
    pickedNovel === null && debouncedNovel.length > 0,
  );

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pickedUser || !pickedNovel) {
      setError("Pick both a user and a novel first.");
      return;
    }
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await addContributor({
        userId: pickedUser.id,
        novelId: pickedNovel.id,
        role,
      });
      // Contributor grants are per-novel DB rows, not part of the JWT — but
      // the grant is useless until the account's app role matches it.
      const needsRole =
        pickedUser.role === "reader" ||
        (role === "writer" && pickedUser.role === "translator");
      setNotice(
        `${pickedUser.username} is now a ${role} on “${pickedNovel.title}”.` +
          (needsRole
            ? ` Heads up: their account role is “${pickedUser.role}”, which can't use this grant — change it in the Users tab (they'll need to re-login).`
            : ""),
      );
      setPickedNovel(null);
      setNovelQuery("");
    } catch (err) {
      // 409 → "User already holds that role on this novel" — show verbatim.
      setError(err instanceof Error ? err.message : "Grant failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-grant">
      <p className="text-secondary" style={{ margin: "var(--sp-3) 0" }}>
        Give a user the writer or translator role on one specific novel.
        Writers can edit the novel and its chapters; translators can only edit
        chapter text.
      </p>

      {notice && <div className="form-success">{notice}</div>}
      {error && <div className="form-error">{error}</div>}

      <form className="card" onSubmit={onSubmit}>
        <div className="grant-pickers">
          <div className="field">
            <label className="field-label" htmlFor="grant-user">
              User
            </label>
            {pickedUser ? (
              <div className="picked-row">
                <span className="picked-label">
                  {pickedUser.displayName}{" "}
                  <span className="text-tertiary">
                    @{pickedUser.username} · #{pickedUser.id} ·{" "}
                    {pickedUser.role}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPickedUser(null)}
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  id="grant-user"
                  className="input"
                  type="search"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Search username or email…"
                />
                <PickerResults
                  loading={userResults.loading}
                  error={userResults.error}
                  empty="No accounts match."
                  items={userResults.data?.users.map((user) => ({
                    key: user.id,
                    label: `${user.username} · ${user.email}`,
                    onPick: () => setPickedUser(user),
                  }))}
                />
              </>
            )}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="grant-novel">
              Novel
            </label>
            {pickedNovel ? (
              <div className="picked-row">
                <span className="picked-label">
                  {pickedNovel.title}{" "}
                  <span className="text-tertiary">#{pickedNovel.id}</span>
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPickedNovel(null)}
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  id="grant-novel"
                  className="input"
                  type="search"
                  value={novelQuery}
                  onChange={(e) => setNovelQuery(e.target.value)}
                  placeholder="Search titles…"
                />
                <PickerResults
                  loading={novelResults.loading}
                  error={novelResults.error}
                  empty="No titles match."
                  items={novelResults.data?.novels.map((novel) => ({
                    key: novel.id,
                    label: novel.title,
                    onPick: () => setPickedNovel(novel),
                  }))}
                />
              </>
            )}
          </div>
        </div>

        <div className="grant-submit">
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label" htmlFor="grant-role">
              Contributor role
            </label>
            <select
              id="grant-role"
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value as ContributorRole)}
            >
              <option value="writer">Writer — full editing on this novel</option>
              <option value="translator">
                Translator — chapter text only
              </option>
            </select>
          </div>
          <button className="btn btn-primary btn-md" disabled={busy}>
            {busy ? "Granting…" : "Grant role ✦"}
          </button>
        </div>
      </form>

      <div className="note-banner">
        Grants are write-only in the API — there's no way to list or revoke a
        novel's contributors yet, so double-check before granting.
      </div>
    </section>
  );
}

function PickerResults({
  loading,
  error,
  empty,
  items,
}: {
  loading: boolean;
  error: string | undefined;
  empty: string;
  items?: { key: number; label: string; onPick: () => void }[];
}) {
  if (loading) {
    return (
      <p className="text-small text-tertiary" style={{ marginTop: "var(--sp-2)" }}>
        Searching…
      </p>
    );
  }
  if (error) {
    return (
      <p
        className="text-small"
        style={{ marginTop: "var(--sp-2)", color: "var(--error)" }}
      >
        {error}
      </p>
    );
  }
  if (!items) return null;
  return (
    <ul className="track-results">
      {items.length === 0 && (
        <li className="text-small text-tertiary">{empty}</li>
      )}
      {items.map(({ key, label, onPick }) => (
        <li key={key}>
          <span className="track-result-title">{label}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onPick}
          >
            Pick
          </button>
        </li>
      ))}
    </ul>
  );
}
