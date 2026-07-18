export function SkeletonCard() {
  return (
    <div>
      <div className="skeleton skeleton-cover" />
      <div className="skeleton skeleton-line" style={{ width: "85%" }} />
      <div className="skeleton skeleton-line" style={{ width: "55%" }} />
    </div>
  );
}

export function SkeletonGrid({ count = 12 }: { count?: number }) {
  return (
    <div className="novel-grid">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonLines({ count = 5 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="skeleton skeleton-line"
          style={{ width: `${90 - (i % 3) * 15}%`, height: 16 }}
        />
      ))}
    </div>
  );
}
