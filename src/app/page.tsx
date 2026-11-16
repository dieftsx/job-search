"use client";

import { useCallback, useEffect, useState } from "react";
import type { Job, JobStatus, Profile } from "@/lib/types";
import { emptyProfile } from "@/lib/types";

type Tab = JobStatus | "all";

const TABS: { id: Tab; label: string }[] = [
  { id: "ready", label: "Prontas para inscrição" },
  { id: "new", label: "Novas" },
  { id: "low", label: "Baixa compatibilidade" },
  { id: "applied", label: "Inscritas" },
  { id: "dismissed", label: "Descartadas" },
  { id: "all", label: "Todas" },
];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Erro ${res.status}`);
  return body;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Home() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [keywordsText, setKeywordsText] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [tab, setTab] = useState<Tab>("ready");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const loadJobs = useCallback(async () => {
    setJobs(await api<Job[]>("/api/jobs"));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const p = await api<Profile>("/api/profile");
        setProfile(p);
        setKeywordsText(p.keywords.join(", "));
        await loadJobs();
      } catch (e) {
        setNotice(String(e));
      }
    })();
  }, [loadJobs]);

  function replaceJob(job: Job) {
    setJobs((list) => list.map((j) => (j.id === job.id ? job : j)));
  }

  async function saveProfile(): Promise<Profile> {
    const saved = await api<Profile>("/api/profile", {
      method: "PUT",
      body: JSON.stringify({
        ...profile,
        keywords: keywordsText.split(/[,\n]/),
      }),
    });
    setProfile(saved);
    return saved;
  }

  /** Executa uma ação mostrando erros no aviso e bloqueando os botões. */
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function analyze(id: string) {
    replaceJob(await api<Job>(`/api/jobs/${id}/analyze`, { method: "POST" }));
  }

  /** Fluxo automático: salva o perfil, busca e analisa todas as vagas novas. */
  const runAll = () =>
    run(async () => {
      await saveProfile();
      setNotice("Buscando vagas na Gupy...");
      const r = await api<{ found: number; added: number; errors: string[] }>(
        "/api/search",
        { method: "POST" },
      );
      const list = await api<Job[]>("/api/jobs");
      setJobs(list);

      const pending = list.filter((j) => j.status === "new");
      let done = 0;
      let failed = 0;
      for (const job of pending) {
        setNotice(`Analisando ${done + failed + 1} de ${pending.length}...`);
        try {
          await analyze(job.id);
          done++;
        } catch (e) {
          failed++;
          // Sem chave ou sem currículo: não adianta continuar.
          if (/GEMINI_API_KEY|currículo/.test(String(e))) throw e;
        }
        await sleep(4000); // respeita o limite do plano gratuito do Gemini
      }
      await loadJobs();
      setTab("ready");
      setNotice(
        `${r.found} vagas encontradas, ${r.added} inéditas, ${done} analisadas` +
          (failed ? `, ${failed} com falha na análise` : "") +
          (r.errors.length ? `. Erros na busca: ${r.errors.join("; ")}` : "."),
      );
    });

  const setStatus = (id: string, status: JobStatus) =>
    run(async () => {
      replaceJob(
        await api<Job>(`/api/jobs/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }),
      );
    });

  const saveTexts = (job: Job) =>
    run(async () => {
      replaceJob(
        await api<Job>(`/api/jobs/${job.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            coverLetter: job.analysis?.coverLetter,
            pitch: job.analysis?.pitch,
          }),
        }),
      );
      setNotice("Textos salvos.");
    });

  const apply = (job: Job) =>
    run(async () => {
      setNotice("Abrindo a vaga no navegador...");
      const r = await api<{ clickedApply: boolean }>(
        `/api/jobs/${job.id}/apply`,
        { method: "POST" },
      );
      setNotice(
        r.clickedApply
          ? "Candidatura aberta. Revise, cole os textos e envie na janela do navegador; depois marque como inscrita."
          : "Vaga aberta, mas não achei o botão de candidatura. Continue manualmente na janela do navegador.",
      );
    });

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setNotice("Copiado.");
  }

  function editText(job: Job, field: "coverLetter" | "pitch", value: string) {
    if (!job.analysis) return;
    replaceJob({ ...job, analysis: { ...job.analysis, [field]: value } });
  }

  const visible = jobs.filter((j) => tab === "all" || j.status === tab);
  const count = (t: Tab) =>
    t === "all" ? jobs.length : jobs.filter((j) => j.status === t).length;

  return (
    <main>
      <h1>Vagas Auto</h1>
      <div className="muted">
        Busca vagas na Gupy, pontua contra o seu currículo e prepara a
        inscrição para você revisar e enviar.
      </div>

      <section className="panel">
        <h2>Perfil</h2>
        <div className="grid">
          <div>
            <label>Nome</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
          </div>
          <div>
            <label>Termos de busca (separados por vírgula)</label>
            <input
              type="text"
              placeholder="fotógrafo, social media, editor de vídeo"
              value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
            />
          </div>
          <div>
            <label>Estado (nome completo, vazio = todos)</label>
            <input
              type="text"
              placeholder="Rondônia"
              value={profile.state}
              onChange={(e) =>
                setProfile({ ...profile, state: e.target.value })
              }
            />
          </div>
          <div>
            <label>Nota mínima para inscrição (0 a 100)</label>
            <input
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
        <div style={{ marginTop: 12 }}>
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
        <div style={{ marginTop: 12 }}>
          <label>Currículo (cole o texto completo)</label>
          <textarea
            rows={8}
            value={profile.resume}
            onChange={(e) => setProfile({ ...profile, resume: e.target.value })}
          />
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="primary" disabled={busy} onClick={runAll}>
            Buscar e analisar vagas
          </button>
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                await saveProfile();
                setNotice("Perfil salvo.");
              })
            }
          >
            Salvar perfil
          </button>
        </div>
        {notice && <div className="notice">{notice}</div>}
      </section>

      <section className="panel">
        <div className="row" style={{ marginBottom: 8 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label} ({count(t.id)})
            </button>
          ))}
        </div>

        {visible.length === 0 && (
          <div className="muted" style={{ padding: "12px 0" }}>
            Nenhuma vaga aqui ainda.
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
                <div className={`score ${cls}`}>{a ? a.score : "–"}</div>
              </div>

              <div className="row" style={{ marginTop: 10 }}>
                <button onClick={() => setOpen(isOpen ? null : job.id)}>
                  {isOpen ? "Fechar" : "Revisar"}
                </button>
                {!a && (
                  <button
                    disabled={busy}
                    onClick={() => run(() => analyze(job.id))}
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
                    Marcar como inscrita
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
                        <label>Carta de apresentação</label>
                        <textarea
                          rows={9}
                          value={a.coverLetter}
                          onChange={(e) =>
                            editText(job, "coverLetter", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label>Por que quero esta vaga</label>
                        <textarea
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
                          onClick={() => run(() => analyze(job.id))}
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
