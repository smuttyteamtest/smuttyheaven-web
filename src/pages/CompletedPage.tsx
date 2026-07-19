import NovelBrowser from "../components/NovelBrowser";

// Finished stories only — the full novels grid with the completion filter
// pinned (GET /api/novels?status=completed).
export default function CompletedPage() {
  return <NovelBrowser heading="Completed novels" status="completed" />;
}
