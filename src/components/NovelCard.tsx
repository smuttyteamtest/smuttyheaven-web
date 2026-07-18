import { Link } from "react-router-dom";
import Cover from "./Cover";

export interface NovelCardData {
  id: number;
  title: string;
  cover?: string | null;
  /** small grey line under the title (reason, chapter, added date…) */
  subtitle?: string;
  /** where the card links; defaults to the novel detail page */
  href: string;
}

export default function NovelCard({ item }: { item: NovelCardData }) {
  return (
    <Link to={item.href} className="novel-card">
      <Cover src={item.cover} title={item.title} seed={item.id} />
      <div className="novel-card-title">{item.title}</div>
      {item.subtitle && <div className="novel-card-subtitle">{item.subtitle}</div>}
    </Link>
  );
}
