import path from "node:path";
import type { BrowserContext } from "playwright";
import { Job } from "./types";

// Perfil persistente: você faz login na Gupy uma vez e a sessão fica salva.
const PROFILE_DIR = path.join(process.cwd(), "data", "browser-profile");

const g = globalThis as unknown as { __vagasCtx?: BrowserContext };

async function getContext(): Promise<BrowserContext> {
  if (g.__vagasCtx) {
    try {
      g.__vagasCtx.pages(); // lança erro se o navegador foi fechado
      return g.__vagasCtx;
    } catch {
      g.__vagasCtx = undefined;
    }
  }
  const { chromium } = await import("playwright");
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: null,
  });
  ctx.on("close", () => {
    g.__vagasCtx = undefined;
  });
  g.__vagasCtx = ctx;
  return ctx;
}

export interface ApplyResult {
  clickedApply: boolean;
}

/**
 * Abre a vaga em um navegador visível e tenta clicar em "Candidatar-se".
 * O envio final fica com você: a janela permanece aberta para revisar,
 * responder às perguntas da empresa e confirmar.
 */
export async function openApplication(job: Job): Promise<ApplyResult> {
  const ctx = await getContext();
  const page = await ctx.newPage();
  await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.bringToFront();

  let clickedApply = false;
  try {
    const apply = page
      .getByRole("link", { name: /candidatar/i })
      .or(page.getByRole("button", { name: /candidatar/i }))
      .first();
    await apply.waitFor({ state: "visible", timeout: 10000 });
    await apply.click();
    clickedApply = true;
  } catch {
    // Botão não encontrado (layout diferente ou vaga encerrada): segue manual.
  }
  return { clickedApply };
}
