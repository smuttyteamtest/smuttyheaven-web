import { Navigate, useParams } from "react-router-dom";
import NovelBrowser from "../components/NovelBrowser";
import { ORIGIN_LABELS, type NovelOrigin } from "../api/types";

function isOrigin(value: string | undefined): value is NonNullable<NovelOrigin> {
  return value === "korean" || value === "japanese" || value === "chinese";
}

// Novels by source language (GET /api/novels?origin=…), reached from the
// Origin dropdown. An unknown :origin slug bounces to the full catalog rather
// than rendering an empty, unfiltered grid.
export default function OriginPage() {
  const { origin } = useParams();
  if (!isOrigin(origin)) return <Navigate to="/browse" replace />;
  return (
    <NovelBrowser origin={origin} heading={`${ORIGIN_LABELS[origin]} novels`} />
  );
}
