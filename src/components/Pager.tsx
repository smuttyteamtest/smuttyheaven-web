interface PagerProps {
  page: number;
  total: number;
  limit: number;
  onPage: (page: number) => void;
}

export default function Pager({ page, total, limit, onPage }: PagerProps) {
  const pageCount = Math.max(1, Math.ceil(total / limit));
  if (pageCount <= 1) return null;

  return (
    <nav className="pager" aria-label="Pagination">
      <button
        className="btn btn-secondary btn-sm"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        ← Prev
      </button>
      <span className="pager-info">
        {page} / {pageCount}
      </span>
      <button
        className="btn btn-secondary btn-sm"
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
      >
        Next →
      </button>
    </nav>
  );
}
