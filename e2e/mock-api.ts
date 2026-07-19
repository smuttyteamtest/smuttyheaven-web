import type { Page, Route } from "@playwright/test";

/**
 * In-memory stand-in for novvels-api, served through Playwright route
 * interception. Response shapes mirror frontend_handoff.md §4. Never run the
 * E2E suite against the real backend — it writes real rows to the shared
 * Azure database.
 */

interface MockChapter {
  id: number;
  name: string;
  slug: string;
  index: number;
  content: string | null;
}

interface MockNovel {
  id: number;
  title: string;
  slug: string;
  cover: string | null;
  date: string;
  description: string;
  genres: string[];
  featured: boolean;
  status: "ongoing" | "completed" | "hiatus";
  chapters: MockChapter[];
}

export const NOVELS: MockNovel[] = [
  {
    id: 8757,
    title: "Reincarnation Of The Strongest Sword God",
    slug: "reincarnation-of-the-strongest-sword-god",
    cover: null,
    date: "2020-07-15T05:28:04.000Z",
    description: "<p>Starting over once more, he has entered this game world.</p>",
    genres: ["fantasy", "action"],
    featured: true,
    status: "ongoing",
    chapters: [
      {
        id: 334646,
        name: "Chapter 1 - Starting Over",
        slug: "chapter-1-starting-over",
        index: 0,
        // First paragraph is asserted on by the smoke flow; the padding makes
        // the chapter tall enough to scroll for the scroll-memory test.
        content:
          "<p>Shi Feng opened his eyes to a world he had left ten years ago.</p>" +
          "<p>The starting village of White River City spread out around him.</p>".repeat(
            40,
          ),
      },
      {
        id: 334647,
        name: "Chapter 2 - Shadow Blade",
        slug: "chapter-2-shadow-blade",
        index: 1,
        content: "<p>The Shadow Blade hummed with a familiar, forgotten power.</p>",
      },
      {
        id: 334648,
        name: "Chapter 3 - Silvaros",
        slug: "chapter-3-silvaros",
        index: 2,
        content: "<p>The gates of Silvaros rose before him at dawn.</p>",
      },
    ],
  },
  {
    id: 236921,
    title: "Godly Empress Doctor",
    slug: "godly-empress-doctor",
    cover: null,
    date: "2021-03-02T09:00:00.000Z",
    description: "<p>A genius doctor wakes in another world.</p>",
    genres: ["action", "romance"],
    featured: false,
    status: "completed",
    chapters: [
      {
        id: 400001,
        name: "Chapter 1 - The Awakening",
        slug: "ged-chapter-1",
        index: 0,
        content: "<p>Feng Wu awoke to the smell of medicinal herbs.</p>",
      },
      {
        id: 400002,
        name: "Chapter 2 - The Phoenix",
        slug: "ged-chapter-2",
        index: 1,
        content: "<p>The phoenix mark on her wrist began to glow.</p>",
      },
    ],
  },
  {
    id: 1859,
    title: "Solo Leveling",
    slug: "solo-leveling",
    cover: null,
    date: "2020-11-20T18:30:00.000Z",
    description: "<p>The weakest hunter of all mankind.</p>",
    genres: ["action", "fantasy"],
    featured: false,
    status: "completed",
    chapters: [
      {
        id: 500001,
        name: "Chapter 1 - The World's Weakest",
        slug: "sl-chapter-1",
        index: 0,
        content: "<p>Jinwoo checked his dagger one last time.</p>",
      },
      {
        id: 500002,
        name: "Chapter 2 - The Double Dungeon",
        slug: "sl-chapter-2",
        index: 1,
        content: "<p>The stone doors slid shut behind the raid party.</p>",
      },
    ],
  },
  {
    id: 5001,
    title: "Lord of the Mysteries",
    slug: "lord-of-the-mysteries",
    cover: null,
    date: "2022-01-05T12:00:00.000Z",
    description: "<p>Fog, steam and machinery.</p>",
    genres: ["fantasy"],
    featured: false,
    status: "hiatus",
    chapters: [
      {
        id: 600001,
        name: "Chapter 1 - Crimson",
        slug: "lotm-chapter-1",
        index: 0,
        content: "<p>Klein rubbed his aching temples in the dim lamplight.</p>",
      },
    ],
  },
];

const GENRES = [
  { id: 12, name: "Fantasy", slug: "fantasy" },
  { id: 13, name: "Action", slug: "action" },
  { id: 15, name: "Romance", slug: "romance" },
];

const LIST_TYPES = ["saved", "favourite", "archived"] as const;
type MockListType = (typeof LIST_TYPES)[number];

interface MockUser {
  id: number;
  username: string;
  email: string;
  displayName: string;
  role: "reader";
  registered: string;
}

interface UserState {
  user: MockUser;
  password: string;
  lists: Record<MockListType, Map<number, string>>;
  progress: Map<number, { chapterId: number; seq: number; updatedAt: string }>;
}

/** Where the frontend expects novvels-api (VITE_API_URL default). */
export const API_ORIGIN = "http://localhost:3000";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const listItem = (n: MockNovel) => ({
  id: n.id,
  title: n.title,
  slug: n.slug,
  cover: n.cover,
  date: n.date,
  status: n.status,
});

export class MockApi {
  private users = new Map<string, UserState>();
  private sessions = new Map<string, string>(); // token → username
  private nextUserId = 225197;
  private seq = 0;

  async install(page: Page): Promise<void> {
    // Scoped to the backend origin — a bare "**/api/**" would also swallow
    // the Vite dev server's own /src/api/*.ts module requests.
    await page.route(`${API_ORIGIN}/api/**`, (route) => this.handle(route));
  }

  /** Server-side state assertions for specs. */
  state(username: string): UserState | undefined {
    return this.users.get(username);
  }

  private handle(route: Route): Promise<void> {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;

    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        body: JSON.stringify(body),
      });

    // The client sends Content-Type on every request, so even GETs preflight.
    if (method === "OPTIONS") {
      return route.fulfill({ status: 204, headers: CORS_HEADERS });
    }

    const authed = (): UserState | undefined => {
      const header = request.headers()["authorization"];
      if (!header?.startsWith("Bearer ")) return undefined;
      const username = this.sessions.get(header.slice("Bearer ".length));
      return username ? this.users.get(username) : undefined;
    };

    let m: RegExpMatchArray | null;

    if (path === "/api/health") {
      return json({ status: "ok", db: "connected" });
    }

    if (path === "/api/genres") {
      return json({
        genres: GENRES.map((g) => ({
          ...g,
          count: NOVELS.filter((n) => n.genres.includes(g.slug)).length,
        })),
      });
    }

    if (path === "/api/novels" && method === "GET") {
      let novels = [...NOVELS];
      const search = url.searchParams.get("search")?.toLowerCase();
      if (search)
        novels = novels.filter((n) => n.title.toLowerCase().includes(search));
      if (url.searchParams.get("featured") === "true")
        novels = novels.filter((n) => n.featured);
      const genre = url.searchParams.get("genre");
      if (genre) novels = novels.filter((n) => n.genres.includes(genre));
      // Lenient, like the real API: unknown status values are ignored.
      const status = url.searchParams.get("status");
      if (status && ["ongoing", "completed", "hiatus"].includes(status))
        novels = novels.filter((n) => n.status === status);

      const sort = url.searchParams.get("sort") ?? "latest";
      if (sort === "popular")
        novels.sort((a, b) => b.chapters.length - a.chapters.length);
      else if (sort === "title")
        novels.sort((a, b) => a.title.localeCompare(b.title));
      else novels.sort((a, b) => b.date.localeCompare(a.date));

      const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
      const limit = Math.min(100, Number(url.searchParams.get("limit")) || 20);
      return json({
        page,
        limit,
        total: novels.length,
        novels: novels.slice((page - 1) * limit, page * limit).map(listItem),
      });
    }

    if ((m = path.match(/^\/api\/novels\/(\d+)$/)) && method === "GET") {
      const novel = NOVELS.find((n) => n.id === Number(m![1]));
      if (!novel) return json({ error: "Novel not found" }, 404);
      return json({
        ...listItem(novel),
        description: novel.description,
        chapters: [...novel.chapters]
          .sort((a, b) => a.index - b.index)
          .map(({ id, name, slug, index }) => ({
            id,
            name,
            slug,
            index,
            date: novel.date,
          })),
      });
    }

    if ((m = path.match(/^\/api\/novels\/(\d+)\/related$/))) {
      const novel = NOVELS.find((n) => n.id === Number(m![1]));
      if (!novel) return json({ error: "Novel not found" }, 404);
      const related = NOVELS.filter(
        (n) =>
          n.id !== novel.id && n.genres.some((g) => novel.genres.includes(g)),
      );
      return json({ novels: related.slice(0, 10).map(listItem) });
    }

    if ((m = path.match(/^\/api\/chapters\/(\d+)$/))) {
      const id = Number(m[1]);
      for (const novel of NOVELS) {
        const chapter = novel.chapters.find((c) => c.id === id);
        if (chapter)
          return json({ id: chapter.id, name: chapter.name, content: chapter.content });
      }
      return json({ error: "Chapter not found" }, 404);
    }

    if (path === "/api/auth/register" && method === "POST") {
      const body = request.postDataJSON() as {
        username: string;
        email: string;
        password: string;
        displayName?: string;
      };
      const taken = [...this.users.values()].some(
        (u) =>
          u.user.username === body.username || u.user.email === body.email,
      );
      if (taken) return json({ error: "Username or email already taken" }, 409);
      const user: MockUser = {
        id: this.nextUserId++,
        username: body.username,
        email: body.email.toLowerCase(),
        displayName: body.displayName ?? body.username,
        role: "reader",
        registered: new Date().toISOString(),
      };
      this.users.set(body.username, {
        user,
        password: body.password,
        lists: { saved: new Map(), favourite: new Map(), archived: new Map() },
        progress: new Map(),
      });
      const token = `mock-jwt-${this.users.size}`;
      this.sessions.set(token, body.username);
      return json({ token, user }, 201);
    }

    if (path === "/api/auth/login" && method === "POST") {
      const body = request.postDataJSON() as { login: string; password: string };
      const state = [...this.users.values()].find(
        (u) =>
          (u.user.username === body.login || u.user.email === body.login) &&
          u.password === body.password,
      );
      if (!state) return json({ error: "Invalid credentials" }, 401);
      const token = `mock-jwt-${this.sessions.size + 1}`;
      this.sessions.set(token, state.user.username);
      return json({ token, user: state.user });
    }

    if (path === "/api/auth/me") {
      const me = authed();
      if (!me) return json({ error: "Invalid or expired token" }, 401);
      return json({ user: me.user });
    }

    if (path.startsWith("/api/me/")) {
      const me = authed();
      if (!me)
        return json({ error: "Missing or malformed Authorization header" }, 401);

      if (
        (m = path.match(/^\/api\/me\/lists\/(saved|favourite|archived)\/(\d+)$/))
      ) {
        const list = me.lists[m[1] as MockListType];
        const novelId = Number(m[2]);
        if (method === "GET") return json({ inList: list.has(novelId) });
        if (method === "POST") {
          if (!NOVELS.some((n) => n.id === novelId))
            return json({ error: "Novel not found" }, 404);
          const existed = list.has(novelId);
          if (!existed) list.set(novelId, new Date().toISOString());
          return json({ inList: true }, existed ? 200 : 201);
        }
        if (method === "DELETE") {
          list.delete(novelId);
          return json({ inList: false });
        }
      }

      if ((m = path.match(/^\/api\/me\/lists\/(saved|favourite|archived)$/))) {
        const list = me.lists[m[1] as MockListType];
        const novels = [...list.entries()]
          .sort((a, b) => b[1].localeCompare(a[1]))
          .map(([novelId, addedAt]) => {
            const novel = NOVELS.find((n) => n.id === novelId)!;
            return {
              id: novel.id,
              title: novel.title,
              slug: novel.slug,
              cover: novel.cover,
              addedAt,
            };
          });
        return json({ page: 1, limit: 20, total: novels.length, novels });
      }

      if ((m = path.match(/^\/api\/me\/progress\/(\d+)$/))) {
        const novelId = Number(m[1]);
        const novel = NOVELS.find((n) => n.id === novelId);
        if (method === "PUT") {
          const body = request.postDataJSON() as { chapterId: number };
          if (!novel || !novel.chapters.some((c) => c.id === body.chapterId))
            return json({ error: "Chapter does not belong to that novel" }, 400);
          me.progress.set(novelId, {
            chapterId: body.chapterId,
            seq: ++this.seq,
            updatedAt: new Date().toISOString(),
          });
          return json({ saved: true, novelId, chapterId: body.chapterId });
        }
        const progress = me.progress.get(novelId);
        if (!progress || !novel) return json(null); // literal null body
        const chapter = novel.chapters.find((c) => c.id === progress.chapterId);
        return json({
          novelId,
          chapterId: progress.chapterId,
          chapterName: chapter?.name ?? null,
          chapterIndex: chapter?.index ?? null,
          updatedAt: progress.updatedAt,
        });
      }

      if (path === "/api/me/history") {
        const history = [...me.progress.entries()]
          .sort((a, b) => b[1].seq - a[1].seq)
          .map(([novelId, progress]) => {
            const novel = NOVELS.find((n) => n.id === novelId)!;
            const chapter = novel.chapters.find(
              (c) => c.id === progress.chapterId,
            );
            return {
              novelId,
              title: novel.title,
              slug: novel.slug,
              cover: novel.cover,
              chapterId: progress.chapterId,
              chapterName: chapter?.name ?? null,
              chapterIndex: chapter?.index ?? null,
              updatedAt: progress.updatedAt,
            };
          });
        return json({ page: 1, limit: 20, total: history.length, history });
      }

      if (path === "/api/me/recommendations") {
        const excluded = new Set<number>([
          ...LIST_TYPES.flatMap((t) => [...me.lists[t].keys()]),
          ...me.progress.keys(),
        ]);
        const lastRead = [...me.progress.entries()].sort(
          (a, b) => b[1].seq - a[1].seq,
        )[0];
        const genreSlug = lastRead
          ? NOVELS.find((n) => n.id === lastRead[0])?.genres[0]
          : undefined;
        const genreName = GENRES.find((g) => g.slug === genreSlug)?.name;
        const reason = genreName
          ? `Because you read ${genreName}`
          : "Popular right now";
        return json({
          recommendations: NOVELS.filter((n) => !excluded.has(n.id)).map(
            (n) => ({
              id: n.id,
              title: n.title,
              slug: n.slug,
              cover: n.cover,
              reason,
            }),
          ),
        });
      }
    }

    return json({ error: "Not found" }, 404);
  }
}
