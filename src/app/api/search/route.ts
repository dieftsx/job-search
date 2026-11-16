import { NextResponse } from "next/server";
import { searchGupy } from "@/lib/gupy";
import { addJobs, getProfile } from "@/lib/store";
import { Job } from "@/lib/types";

/** Busca na Gupy todos os termos do perfil e salva as vagas inéditas. */
export async function POST() {
  const profile = await getProfile();
  if (profile.keywords.length === 0) {
    return NextResponse.json(
      { error: "Adicione ao menos um termo de busca no perfil" },
      { status: 400 },
    );
  }

  const found = new Map<string, Job>();
  const errors: string[] = [];
  for (const term of profile.keywords) {
    try {
      const jobs = await searchGupy(term, {
        remoteOnly: profile.remoteOnly,
        state: profile.state || undefined,
      });
      for (const job of jobs) found.set(job.id, job);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  const added = await addJobs([...found.values()]);
  return NextResponse.json({ found: found.size, added, errors });
}
