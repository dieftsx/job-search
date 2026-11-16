import { Analysis, Job, Profile } from "./types";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}

function buildPrompt(profile: Profile, job: Job): string {
  return `Você é um recrutador experiente ajudando um candidato brasileiro.

Compare o CURRÍCULO com a VAGA e responda APENAS com um JSON neste formato:
{
  "score": número inteiro de 0 a 100 (compatibilidade real, seja rigoroso),
  "summary": "2 frases explicando a nota",
  "strengths": ["pontos do currículo que atendem a vaga"],
  "gaps": ["requisitos da vaga que o currículo não comprova"],
  "coverLetter": "carta de apresentação em português, 3 parágrafos curtos, em primeira pessoa, específica para esta vaga e empresa",
  "pitch": "resposta de até 500 caracteres para 'por que você quer esta vaga?'"
}

Regras:
- Use somente fatos presentes no currículo. Nunca invente experiência, formação ou habilidade.
- Se o currículo não atende a um requisito, liste em "gaps" em vez de disfarçar.

CANDIDATO: ${profile.name || "(sem nome)"}

CURRÍCULO:
${profile.resume}

VAGA: ${job.name}
EMPRESA: ${job.company}
LOCAL: ${[job.city, job.state].filter(Boolean).join(" - ")} (${job.workplaceType})

DESCRIÇÃO:
${job.description.slice(0, 12000)}`;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}

export async function analyzeJob(
  profile: Profile,
  job: Job,
): Promise<Analysis> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("Defina GEMINI_API_KEY no arquivo .env.local");
  }
  if (!profile.resume.trim()) {
    throw new Error("Preencha o currículo no perfil antes de analisar");
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(profile, job) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.4,
        },
      }),
    },
  );

  const body = (await res.json()) as GeminiResponse;
  if (!res.ok) {
    throw new Error(
      `Gemini (${res.status}): ${body.error?.message ?? "erro desconhecido"}`,
    );
  }

  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini não retornou conteúdo");

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("Gemini retornou um JSON inválido");
  }

  const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score))));
  return {
    score: Number.isFinite(score) ? score : 0,
    summary: String(parsed.summary ?? ""),
    strengths: asStringArray(parsed.strengths),
    gaps: asStringArray(parsed.gaps),
    coverLetter: String(parsed.coverLetter ?? ""),
    pitch: String(parsed.pitch ?? ""),
    analyzedAt: new Date().toISOString(),
  };
}
