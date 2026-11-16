import { NextResponse } from "next/server";
import { openApplication } from "@/lib/apply";
import { errorResponse, HttpError, requireUser } from "@/lib/server-auth";
import type { Job } from "@/lib/types";

/** Abre a candidatura no navegador controlado. Só funciona rodando local. */
export async function POST(req: Request) {
  try {
    await requireUser(req);
    if (process.env.VERCEL) {
      throw new HttpError(
        400,
        "A inscrição assistida só funciona com o app rodando no seu computador. Use o link 'Ver na Gupy'.",
      );
    }

    const { url } = (await req.json()) as { url?: string };
    let host = "";
    try {
      host = new URL(String(url)).hostname;
    } catch {
      /* URL inválida */
    }
    if (host !== "gupy.io" && !host.endsWith(".gupy.io")) {
      throw new HttpError(400, "Link de vaga inválido");
    }

    try {
      return NextResponse.json(await openApplication({ url } as Job));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new HttpError(
        500,
        /Executable doesn't exist|playwright install/i.test(msg)
          ? "Navegador não instalado. Rode: npm run browser:install"
          : msg,
      );
    }
  } catch (e) {
    return errorResponse(e);
  }
}
