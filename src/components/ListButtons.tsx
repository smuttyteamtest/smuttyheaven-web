import { useEffect, useState } from "react";
import { addToList, checkList, removeFromList } from "../api/endpoints";
import type { ListType } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "./Toasts";

const LISTS: { type: ListType; label: string; icon: string }[] = [
  { type: "saved", label: "Save", icon: "🔖" },
  { type: "favourite", label: "Favourite", icon: "💜" },
  { type: "archived", label: "Archive", icon: "📦" },
];

/** Saved / Favourite / Archived toggles on the novel detail page. */
export default function ListButtons({ novelId }: { novelId: number }) {
  const { user } = useAuth();
  const toast = useToast();
  const [membership, setMembership] = useState<Record<ListType, boolean>>({
    saved: false,
    favourite: false,
    archived: false,
  });
  const [pending, setPending] = useState<ListType | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    Promise.all(LISTS.map(({ type }) => checkList(type, novelId)))
      .then(([saved, favourite, archived]) => {
        if (alive)
          setMembership({
            saved: saved.inList,
            favourite: favourite.inList,
            archived: archived.inList,
          });
      })
      .catch(() => {
        // toggles just start in the "off" state; toggling still works
      });
    return () => {
      alive = false;
    };
  }, [user, novelId]);

  if (!user) return null;

  async function toggle(type: ListType) {
    const inList = membership[type];
    setPending(type);
    // optimistic — add/remove are idempotent, so a retry is always safe
    setMembership((m) => ({ ...m, [type]: !inList }));
    try {
      if (inList) await removeFromList(type, novelId);
      else await addToList(type, novelId);
    } catch (err) {
      setMembership((m) => ({ ...m, [type]: inList }));
      const detail =
        err instanceof Error ? err.message : "something went wrong";
      toast(`Couldn't update your ${type} list — ${detail}`);
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      {LISTS.map(({ type, label, icon }) => (
        <button
          key={type}
          className={`btn btn-secondary btn-md${membership[type] ? " is-active" : ""}`}
          onClick={() => toggle(type)}
          disabled={pending === type}
          aria-pressed={membership[type]}
        >
          <span aria-hidden>{icon}</span>
          {membership[type] ? `${label}d` : label}
        </button>
      ))}
    </>
  );
}
