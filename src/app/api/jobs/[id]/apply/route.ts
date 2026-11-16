import { NextResponse } from "next/server";
import { openApplication } from "@/lib/apply";
import { getJob } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

/** Abre a candidatura no navegador controlado (login da Gupy salvo). */
export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) {
    return NextResponse.json({ error: "Vaga não encontrada" }, { status: 404 });
  }

  try {
    return NextResponse.json(await openApplication(job));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint = /Executable doesn't exist|playwright install/i.test(msg)
      ? "Navegador não instalado. Rode: npm run browser:install"
      : msg;
    return NextResponse.json({ error: hint }, { status: 500 });
  }
}
