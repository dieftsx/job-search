"use client";

import { signOut, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import SetupNotice from "@/components/SetupNotice";
import { useAuth } from "@/lib/auth-context";
import * as db from "@/lib/db";
import { fb, firebaseConfigured } from "@/lib/firebase";
import type { Analysis, Job, JobStatus, Profile } from "@/lib/types";
import { emptyProfile } from "@/lib/types";

type Tab = JobStatus | "all";

const TABS: { id: Tab; label: string }[] = [
  { id: "ready", label: "Prontas" },
  { id: "new", label: "Novas" },
  { id: "low", label: "Nota baixa" },
  { id: "applied", label: "Inscritas" },
  { id: "dismissed", label: "Descartadas" },
  { id: "all", label: "Todas" },
];

/** Chama uma rota da API enviando o token de login do Firebase. */
async function api<T>(user: User, url: string, body: unknown): Promise<T> {
  const token = await user.getIdToken();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
  return data;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [keywordsText, setKeywordsText] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [tab, setTab] = useState<Tab>("ready");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [isError, setIsError] = useState(false);

  const say = useCallback((text: string, error = false) => {
    setNotice(text);
    setIsError(error);
  }, []);

  useEffect(() => {
    if (!loading && !user && firebaseConfigured) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const p = await db.getProfile(user.uid);
        if (!p.name && user.displayName) p.name = user.displayName;
        setProfile(p);
        setKeywordsText(p.keywords.join(", "));
        setJobs(await db.listJobs(user.uid));
      } catch (e) {
        say(e instanceof Error ? e.message : String(e), true);
      }
    })();
  }, [user, say]);

  if (!firebaseConfigured) return <SetupNotice />;
  if (loading || !user) {
    return (
      <main className="auth">
        <p className="center pixel">
          LOADING<span className="blink">...</span>
        </p>
      </main>
    );
  }
  const me = user;

  function replaceJob(id: string, patch: Partial<Job>) {
    setJobs((list) => list.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }

  function currentProfile(): Profile {
    return {
      ...profile,
      keywords: keywordsText
        .split(/[,\n]/)
        .map((k) => k.trim())
        .filter(Boolean),
      minScore: Math.max(0, Math.min(100, Number(profile.minScore) || 0)),
    };
  }

  async function saveProfile(): Promise<Profile> {
    const p = currentProfile();
    await db.saveProfile(me.uid, p);
    setProfile(p);
    return p;
  }

  /** Executa uma ação mostrando erros no aviso e bloqueando os botões. */
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      say(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  async function analyze(job: Job, p: Profile) {
    const analysis = await api<Analysis>(me, "/api/analyze", {
      profile: { name: p.name, resume: p.resume },
      job,
    });
    const status: JobStatus = analysis.score >= p.minScore ? "ready" : "low";
    await db.updateJob(me.uid, job.id, { analysis, status });
    replaceJob(job.id, { analysis, status });
  }

  /** Fluxo automático: salva o perfil, busca e analisa todas as vagas novas. */
  const runAll = () =>
    run(async () => {
      const p = await saveProfile();
      say("Buscando vagas na Gupy...");
      const r = await api<{ jobs: Job[]; errors: string[] }>(
        me,
        "/api/search",
        { keywords: p.keywords, remoteOnly: p.remoteOnly, state: p.state },
      );
      const known = new Set(jobs.map((j) => j.id));
      const added = await db.addJobs(me.uid, r.jobs, known);
      const list = await db.listJobs(me.uid);
      setJobs(list);

      const pending = list.filter((j) => j.status === "new");
      let done = 0;
      let failed = 0;
      for (const job of pending) {
        say(`Analisando ${done + failed + 1} de ${pending.length}...`);
        try {
          await analyze(job, p);
          done++;
        } catch (e) {
          failed++;
          // Sem chave, sem currículo ou sem login: não adianta continuar.
          if (/GEMINI_API_KEY|currículo|login|Sessão/.test(String(e))) throw e;
        }
        await sleep(4000); // respeita o limite do plano gratuito do Gemini
      }
      setJobs(await db.listJobs(me.uid));
      setTab("ready");
      say(
        `${r.jobs.length} vagas encontradas, ${added} inéditas, ${done} analisadas` +
          (failed ? `, ${failed} com falha na análise` : "") +
          (r.errors.length ? `. Erros na busca: ${r.errors.join("; ")}` : "."),
        r.errors.length > 0,
      );
    });

  const setStatus = (id: string, status: JobStatus) =>
    run(async () => {
      const patch: Partial<Job> = { status };
      if (status === "applied") patch.appliedAt = new Date().toISOString();
      await db.updateJob(me.uid, id, patch);
      replaceJob(id, patch);
    });

  const saveTexts = (job: Job) =>
    run(async () => {
      if (!job.analysis) return;
      await db.updateJob(me.uid, job.id, { analysis: job.analysis });
      say("Textos salvos.");
    });

  const apply = (job: Job) =>
    run(async () => {
      say("Abrindo a vaga no navegador...");
      const r = await api<{ clickedApply: boolean }>(me, "/api/apply", {
        url: job.url,
      });
      say(
        r.clickedApply
          ? "Candidatura aberta. Revise, cole os textos e envie na janela do navegador; depois marque como inscrita."
          : "Vaga aberta, mas não achei o botão de candidatura. Continue manualmente na janela do navegador.",
      );
    });

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    say("Copiado.");
  }

  function editText(job: Job, field: "coverLetter" | "pitch", value: string) {
    if (!job.analysis) return;
    replaceJob(job.id, { analysis: { ...job.analysis, [field]: value } });
  }

  const visible = jobs.filter((j) => tab === "all" || j.status === tab);
  const count = (t: Tab) =>
    t === "all" ? jobs.length : jobs.filter((j) => j.status === t).length;

  return (
    <main>
      <header className="topbar">
        <div>
          <h1>VAGAS AUTO</h1>
          <div className="muted">
            Caça vagas na Gupy e calcula seu nível de compatibilidade
            <span className="blink"> _</span>
          </div>
        </div>
        <div className="row">
          <span className="small muted">{me.email}</span>
          <button className="danger" onClick={() => void signOut(fb().auth)}>
            Sair
          </button>
        </div>
      </header>

      <section className="panel">
        <h2>Player 1: perfil</h2>
        <div className="grid">
          <div>
            <label htmlFor="name">Nome</label>
            <input
              id="name"
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="keywords">Termos de busca (com vírgula)</label>
            <input
              id="keywords"
              type="text"
              placeholder="front-end, react, designer"
              value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="state">Estado (vazio = todos)</label>
            <input
              id="state"
              type="text"
              placeholder="Rondônia"
              value={profile.state}
              onChange={(e) =>
                setProfile({ ...profile, state: e.target.value })
              }
            />
          </div>
          <div>
            <label htmlFor="minScore">Nota mínima (0 a 100)</label>
            <input
              id="minScore"
              type="number"
              min={0}
              max={100}
              value={profile.minScore}
              onChange={(e) =>
                setProfile({ ...profile, minScore: Number(e.target.value) })
              }
            />
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <label className="check">
            <input
              type="checkbox"
              checked={profile.remoteOnly}
              onChange={(e) =>
                setProfile({ ...profile, remoteOnly: e.target.checked })
              }
            />
            Somente vagas remotas
          </label>
        </div>
        <div style={{ marginTop: 16 }}>
          <label htmlFor="resume">Currículo (cole o texto completo)</label>
          <textarea
            id="resume"
            rows={8}
            value={profile.resume}
            onChange={(e) => setProfile({ ...profile, resume: e.target.value })}
          />
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="primary" disabled={busy} onClick={runAll}>
            ▶ Buscar e analisar
          </button>
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                await saveProfile();
                say("Perfil salvo.");
              })
            }
          >
            Salvar perfil
          </button>
        </div>
        {notice && (
          <div className={`notice ${isError ? "error" : ""}`}>{notice}</div>
        )}
      </section>

      <section className="panel">
        <h2>Missões: vagas</h2>
        <div className="row">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label} {count(t.id)}
            </button>
          ))}
        </div>

        {visible.length === 0 && (
          <div className="muted" style={{ paddingTop: 18 }}>
            Nenhuma vaga nesta fase ainda.
          </div>
        )}

        {visible.map((job) => {
          const a = job.analysis;
          const cls = !a
            ? ""
            : a.score >= profile.minScore
              ? "good"
              : a.score >= 50
                ? "mid"
                : "bad";
          const isOpen = open === job.id;
          return (
            <div className="job" key={job.id}>
              <div className="job-head">
                <div>
                  <div className="job-title">{job.name}</div>
                  <div className="muted small">
                    {[
                      job.company,
                      [job.city, job.state].filter(Boolean).join(" - "),
                      job.workplaceType,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  {a && <div className="small">{a.summary}</div>}
                </div>
                <div className={`score ${cls}`}>
                  <strong>{a ? a.score : "??"}</strong>
                  <div className="bar">
                    <span style={{ width: `${a ? a.score : 0}%` }} />
                  </div>
                </div>
              </div>

              <div className="row" style={{ marginTop: 12 }}>
                <button onClick={() => setOpen(isOpen ? null : job.id)}>
                  {isOpen ? "Fechar" : "Revisar"}
                </button>
                {!a && (
                  <button
                    disabled={busy}
                    onClick={() => run(() => analyze(job, currentProfile()))}
                  >
                    Analisar
                  </button>
                )}
                {job.status !== "applied" && (
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => apply(job)}
                  >
                    Abrir inscrição
                  </button>
                )}
                {job.status !== "applied" && (
                  <button
                    disabled={busy}
                    onClick={() => setStatus(job.id, "applied")}
                  >
                    Marcar inscrita
                  </button>
                )}
                {job.status !== "dismissed" && job.status !== "applied" && (
                  <button
                    className="ghost"
                    disabled={busy}
                    onClick={() => setStatus(job.id, "dismissed")}
                  >
                    Descartar
                  </button>
                )}
                <a href={job.url} target="_blank" rel="noreferrer">
                  Ver na Gupy
                </a>
              </div>

              {isOpen && (
                <div className="details">
                  {a && (
                    <>
                      <div className="grid">
                        <div>
                          <strong>Pontos fortes</strong>
                          <ul>
                            {a.strengths.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <strong>Lacunas</strong>
                          <ul>
                            {a.gaps.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div>
                        <label htmlFor={`cl-${job.id}`}>
                          Carta de apresentação
                        </label>
                        <textarea
                          id={`cl-${job.id}`}
                          rows={9}
                          value={a.coverLetter}
                          onChange={(e) =>
                            editText(job, "coverLetter", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label htmlFor={`pt-${job.id}`}>
                          Por que quero esta vaga
                        </label>
                        <textarea
                          id={`pt-${job.id}`}
                          rows={4}
                          value={a.pitch}
                          onChange={(e) =>
                            editText(job, "pitch", e.target.value)
                          }
                        />
                      </div>
                      <div className="row">
                        <button onClick={() => copy(a.coverLetter)}>
                          Copiar carta
                        </button>
                        <button onClick={() => copy(a.pitch)}>
                          Copiar resposta
                        </button>
                        <button disabled={busy} onClick={() => saveTexts(job)}>
                          Salvar edições
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            run(() => analyze(job, currentProfile()))
                          }
                        >
                          Gerar de novo
                        </button>
                      </div>
                    </>
                  )}
                  <div>
                    <label>Descrição da vaga</label>
                    <div className="desc">
                      {job.description || "Sem descrição."}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>
    </main>
  );
}
