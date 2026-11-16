import { promises as fs } from "node:fs";
import path from "node:path";
import { Db, Job, Profile, emptyProfile } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

// Fila simples para evitar gravações concorrentes no arquivo.
let queue: Promise<unknown> = Promise.resolve();

async function read(): Promise<Db> {
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    const db = JSON.parse(raw) as Partial<Db>;
    return {
      profile: { ...emptyProfile, ...(db.profile ?? {}) },
      jobs: db.jobs ?? [],
    };
  } catch {
    return { profile: { ...emptyProfile }, jobs: [] };
  }
}

async function write(db: Db): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tmp, DB_FILE);
}

/** Lê o banco, aplica a alteração e grava, uma operação por vez. */
function mutate<T>(fn: (db: Db) => T): Promise<T> {
  const run = queue.then(async () => {
    const db = await read();
    const result = fn(db);
    await write(db);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function getProfile(): Promise<Profile> {
  return (await read()).profile;
}

export function saveProfile(profile: Profile): Promise<Profile> {
  return mutate((db) => {
    db.profile = profile;
    return profile;
  });
}

export async function listJobs(): Promise<Job[]> {
  return (await read()).jobs;
}

export async function getJob(id: string): Promise<Job | undefined> {
  return (await read()).jobs.find((j) => j.id === id);
}

/** Adiciona só as vagas ainda não vistas. Retorna quantas eram novas. */
export function addJobs(jobs: Job[]): Promise<number> {
  return mutate((db) => {
    const known = new Set(db.jobs.map((j) => j.id));
    const fresh = jobs.filter((j) => !known.has(j.id));
    db.jobs.push(...fresh);
    return fresh.length;
  });
}

export function updateJob(
  id: string,
  patch: Partial<Job>,
): Promise<Job | undefined> {
  return mutate((db) => {
    const job = db.jobs.find((j) => j.id === id);
    if (!job) return undefined;
    Object.assign(job, patch);
    return job;
  });
}
