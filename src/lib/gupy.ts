import { Job } from "./types";

// Endpoint público usado pelo portal de vagas da Gupy (portal.gupy.io).
const BASE = "https://portal.api.gupy.io/api/v1/jobs";
const PAGE_SIZE = 20;

interface GupyJob {
  id: number;
  name: string;
  description?: string;
  careerPageName?: string;
  type?: string;
  publishedDate?: string;
  applicationDeadline?: string | null;
  isRemoteWork?: boolean;
  city?: string;
  state?: string;
  jobUrl: string;
  workplaceType?: string;
}

interface GupyResponse {
  data?: GupyJob[];
}

export interface SearchOptions {
  remoteOnly?: boolean;
  state?: string;
  /** Quantas páginas de 20 vagas buscar por termo. */
  pages?: number;
}

function stripHtml(html: string): string {
  return html
    .replace(/<(br|\/p|\/li|\/h\d)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

function toJob(g: GupyJob): Job {
  return {
    id: String(g.id),
    name: g.name,
    company: g.careerPageName ?? "",
    description: stripHtml(g.description ?? ""),
    url: g.jobUrl,
    city: g.city ?? "",
    state: g.state ?? "",
    workplaceType: g.workplaceType ?? (g.isRemoteWork ? "remote" : ""),
    type: g.type ?? "",
    publishedDate: g.publishedDate ?? "",
    deadline: g.applicationDeadline ?? null,
    status: "new",
    foundAt: new Date().toISOString(),
  };
}

export async function searchGupy(
  term: string,
  opts: SearchOptions = {},
): Promise<Job[]> {
  const pages = opts.pages ?? 2;
  const out: Job[] = [];

  for (let page = 0; page < pages; page++) {
    const params = new URLSearchParams({
      jobName: term,
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    if (opts.remoteOnly) params.set("workplaceType", "remote");
    if (opts.state) params.set("state", opts.state);

    const res = await fetch(`${BASE}?${params}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Gupy respondeu ${res.status} ao buscar "${term}"`);
    }
    const body = (await res.json()) as GupyResponse;
    const items = body.data ?? [];
    out.push(...items.map(toJob));
    if (items.length < PAGE_SIZE) break;
  }

  // Filtro extra no cliente, caso a API ignore algum parâmetro.
  return out.filter((j) => {
    if (opts.remoteOnly && j.workplaceType !== "remote") return false;
    return true;
  });
}
