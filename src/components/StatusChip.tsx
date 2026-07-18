import type { NovelStatus } from "../api/types";

const CHIPS: Record<NovelStatus, { label: string; cls: string }> = {
  publish: { label: "Published", cls: "is-success" },
  draft: { label: "Draft", cls: "is-pending" },
  trash: { label: "Trashed", cls: "is-missed" },
};

export default function StatusChip({ status }: { status: NovelStatus }) {
  const { label, cls } = CHIPS[status];
  return <span className={`status-chip ${cls}`}>{label}</span>;
}
