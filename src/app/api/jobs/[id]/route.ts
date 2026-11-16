import { NextResponse } from "next/server";
import { getJob, updateJob } from "@/lib/store";
import { Job, JobStatus } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

const STATUSES: JobStatus[] = ["new", "ready", "low", "applied", "dismissed"];

/** Atualiza o status da vaga e/ou os textos editados na revisão. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json()) as {
    status?: JobStatus;
    coverLetter?: string;
    pitch?: string;
  };

  const job = await getJob(id);
  if (!job) {
    return NextResponse.json({ error: "Vaga não encontrada" }, { status: 404 });
  }

  const patch: Partial<Job> = {};
  if (body.status && STATUSES.includes(body.status)) {
    patch.status = body.status;
    if (body.status === "applied") patch.appliedAt = new Date().toISOString();
  }
  if (job.analysis && (body.coverLetter != null || body.pitch != null)) {
    patch.analysis = {
      ...job.analysis,
      coverLetter: body.coverLetter ?? job.analysis.coverLetter,
      pitch: body.pitch ?? job.analysis.pitch,
    };
  }

  return NextResponse.json(await updateJob(id, patch));
}
