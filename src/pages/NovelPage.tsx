import { Link, useParams } from "react-router-dom";
import {
  fetchNovelCached,
  fetchProgress,
  fetchRelated,
} from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { usePageMeta } from "../hooks/usePageMeta";
import ChapterList from "../components/ChapterList";
import Cover from "../components/Cover";
import ListButtons from "../components/ListButtons";
import Rail from "../components/Rail";
import SafeHtml from "../components/SafeHtml";
import { SkeletonLines } from "../components/Skeletons";
import { formatDate, htmlToText, novelPath, readerPath } from "../lib/format";

export default function NovelPage() {
  const { id } = useParams();
  const novelId = Number(id);
  const { user } = useAuth();

  const novel = useAsync(
    () => fetchNovelCached(novelId),
    [novelId],
    Number.isFinite(novelId),
  );
  const related = useAsync(
    () => fetchRelated(novelId),
    [novelId],
    Number.isFinite(novelId),
  );
  // Literal `null` body when the user has never read this novel.
  const progress = useAsync(
    () => fetchProgress(novelId),
    [novelId, user?.id],
    Number.isFinite(novelId) && !!user,
  );

  usePageMeta({
    title: novel.data?.title,
    description: novel.data?.description
      ? htmlToText(novel.data.description).slice(0, 180) || undefined
      : undefined,
  });

  if (!Number.isFinite(novelId)) {
    return (
      <div className="container error-state">
        <p>That novel link doesn't look right.</p>
        <Link to="/browse" className="btn btn-secondary btn-md">
          Browse novels
        </Link>
      </div>
    );
  }

  if (novel.error) {
    return (
      <div className="container error-state">
        <p>{novel.error}</p>
        <Link to="/browse" className="btn btn-secondary btn-md">
          Browse novels
        </Link>
      </div>
    );
  }

  const data = novel.data;
  const chapters = data?.chapters ?? [];
  const firstChapter = chapters.length
    ? chapters.reduce((min, c) => (c.index < min.index ? c : min))
    : undefined;
  const resume = progress.data ?? null;

  const relatedCards = related.data?.novels.map((n) => ({
    id: n.id,
    title: n.title,
    cover: n.cover,
    href: novelPath(n.id, n.slug),
  }));

  return (
    <div className="container">
      <div className="novel-detail-head">
        <div>
          {data ? (
            <Cover src={data.cover} title={data.title} seed={data.id} />
          ) : (
            <div className="skeleton skeleton-cover" />
          )}
        </div>
        <div>
          {data ? (
            <>
              <h1>{data.title}</h1>
              <p className="detail-meta">
                {chapters.length} chapters · added {formatDate(data.date)}
              </p>
              <div className="novel-detail-actions">
                {resume ? (
                  <Link
                    to={readerPath(novelId, resume.chapterId)}
                    className="btn btn-primary btn-lg"
                  >
                    ▶ Continue{resume.chapterName ? `: ${resume.chapterName}` : " reading"}
                  </Link>
                ) : firstChapter ? (
                  <Link
                    to={readerPath(novelId, firstChapter.id)}
                    className="btn btn-primary btn-lg"
                  >
                    ▶ Start reading
                  </Link>
                ) : null}
                <ListButtons novelId={novelId} />
              </div>
              {data.description && (
                <SafeHtml html={data.description} className="novel-description" />
              )}
            </>
          ) : (
            <SkeletonLines count={6} />
          )}
        </div>
      </div>

      {data && (
        <ChapterList
          novelId={novelId}
          chapters={chapters}
          currentChapterId={resume?.chapterId}
        />
      )}

      <Rail
        title="You may also like"
        items={relatedCards}
        loading={related.loading}
        error={related.error}
      />
    </div>
  );
}
