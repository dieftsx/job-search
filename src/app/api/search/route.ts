import { NextResponse } from "next/server";
import { searchGupy } from "@/lib/gupy";
import { errorResponse, HttpError, requireUser } from "@/lib/server-auth";
import type { Job } from "@/lib/types";

interface Body {
  keywords?: unknown;
  remoteOnly?: unknown;
  state?: unknown;
}

/** Busca na Gupy os termos enviados e devolve as vagas (sem gravar nada). */
export async function POST(req: Request) {
  try {
    await requireUser(req);
    const body = (await req.json()) as Body;
    const keywords = (Array.isArray(body.keywords) ? body.keywords : [])
      .map((k) => String(k).trim())
      .filter(Boolean)
      .slice(0, 8);
    if (keywords.length === 0) {
      throw new HttpError(400, "Adicione ao menos um termo de busca no perfil");
    }

    const found = new Map<string, Job>();
    const errors: string[] = [];
    for (const term of keywords) {
      try {
        const jobs = await searchGupy(term, {
          remoteOnly: Boolean(body.remoteOnly),
          state: String(body.state ?? "").trim() || undefined,
        });
        for (const job of jobs) found.set(job.id, job);
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }

    return NextResponse.json({ jobs: [...found.values()], errors });
  } catch (e) {
    return errorResponse(e);
  }
}
