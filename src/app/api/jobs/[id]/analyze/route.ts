import { NextResponse } from "next/server";
import { analyzeJob } from "@/lib/gemini";
import { getJob, getProfile, updateJob } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

/** Pontua a vaga contra o currículo e gera os textos de candidatura. */
export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const [job, profile] = await Promise.all([getJob(id), getProfile()]);
  if (!job) {
    return NextResponse.json({ error: "Vaga não encontrada" }, { status: 404 });
  }

  try {
    const analysis = await analyzeJob(profile, job);
    const status = analysis.score >= profile.minScore ? "ready" : "low";
    return NextResponse.json(await updateJob(id, { analysis, status }));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
