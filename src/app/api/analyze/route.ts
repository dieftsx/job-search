import { NextResponse } from "next/server";
import { analyzeJob } from "@/lib/gemini";
import { errorResponse, HttpError, requireUser } from "@/lib/server-auth";
import { emptyProfile, type Job, type Profile } from "@/lib/types";

interface Body {
  profile?: Partial<Profile>;
  job?: Partial<Job>;
}

/** Pontua a vaga contra o currículo e gera os textos de candidatura. */
export async function POST(req: Request) {
  try {
    await requireUser(req);
    const { profile, job } = (await req.json()) as Body;
    if (!job?.name) throw new HttpError(400, "Vaga inválida");

    // Limita o tamanho do que vai para a IA.
    const safeProfile: Profile = {
      ...emptyProfile,
      name: String(profile?.name ?? "").slice(0, 200),
      resume: String(profile?.resume ?? "").slice(0, 20000),
    };
    const safeJob = {
      name: String(job.name).slice(0, 300),
      company: String(job.company ?? "").slice(0, 300),
      description: String(job.description ?? ""),
      city: String(job.city ?? ""),
      state: String(job.state ?? ""),
      workplaceType: String(job.workplaceType ?? ""),
    } as Job;

    return NextResponse.json(await analyzeJob(safeProfile, safeJob));
  } catch (e) {
    return errorResponse(e);
  }
}
