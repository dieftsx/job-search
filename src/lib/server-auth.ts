import { NextResponse } from "next/server";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface LookupResponse {
  users?: { localId?: string }[];
}

/**
 * Confere o token de login do Firebase enviado pelo navegador e devolve o
 * uid. Sem isso, qualquer pessoa poderia usar as rotas (e a sua cota do
 * Gemini) sem ter conta.
 */
export async function requireUser(req: Request): Promise<string> {
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!key) throw new HttpError(500, "Firebase não configurado no servidor");

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Faça login para continuar");

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${key}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken: token }),
      cache: "no-store",
    },
  );
  if (!res.ok) throw new HttpError(401, "Sessão inválida. Entre de novo.");

  const data = (await res.json()) as LookupResponse;
  const uid = data.users?.[0]?.localId;
  if (!uid) throw new HttpError(401, "Sessão inválida. Entre de novo.");
  return uid;
}

export function errorResponse(e: unknown) {
  const status = e instanceof HttpError ? e.status : 500;
  const message = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ error: message }, { status });
}
