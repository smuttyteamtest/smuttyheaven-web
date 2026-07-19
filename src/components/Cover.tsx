import { useState } from "react";

// Nebula-family gradient pairs for novels whose cover is null or fails to
// load (cover URLs are hot-linked to the old WordPress domain and break).
const GRADIENTS = [
  ["#4c3a9e", "#7c5ce0"],
  ["#3b3286", "#a78bfa"],
  ["#2e2a6e", "#60a5fa"],
  ["#5b3a9e", "#f0abfc"],
  ["#312e81", "#818cf8"],
  ["#433c8f", "#67e8f9"],
];

interface CoverProps {
  src: string | null | undefined;
  title: string;
  /** any stable number (novel id) — picks the fallback gradient */
  seed: number;
}

export default function Cover({ src, title, seed }: CoverProps) {
  const [broken, setBroken] = useState(false);
  const showImage = !!src && !broken;
  const [from, to] = GRADIENTS[Math.abs(seed) % GRADIENTS.length];

  return (
    <div className="cover">
      {showImage ? (
        <img
          src={src}
          alt={`Cover of ${title}`}
          loading="lazy"
          onError={() => setBroken(true)}
        />
      ) : (
        <div
          className="cover-fallback"
          style={{ background: `linear-gradient(160deg, ${from}, ${to})` }}
          aria-label={`Cover of ${title}`}
        >
          <span className="cover-initial">{title.charAt(0).toUpperCase()}</span>
          <span className="cover-title">{title}</span>
        </div>
      )}
    </div>
  );
}
