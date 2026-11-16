import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { fb } from "./firebase";
import { emptyProfile, type Job, type Profile } from "./types";

// Estrutura no Firestore (cada usuário só enxerga o que é dele):
//   users/{uid}             -> perfil
//   users/{uid}/jobs/{id}   -> vagas encontradas e suas análises

const userRef = (uid: string) => doc(fb().db, "users", uid);
const jobsRef = (uid: string) => collection(fb().db, "users", uid, "jobs");

export async function getProfile(uid: string): Promise<Profile> {
  const snap = await getDoc(userRef(uid));
  const d = (snap.data() ?? {}) as Partial<Profile>;
  return {
    name: d.name ?? emptyProfile.name,
    resume: d.resume ?? emptyProfile.resume,
    keywords: Array.isArray(d.keywords) ? d.keywords : [],
    remoteOnly: Boolean(d.remoteOnly),
    state: d.state ?? emptyProfile.state,
    minScore: typeof d.minScore === "number" ? d.minScore : emptyProfile.minScore,
  };
}

export async function saveProfile(uid: string, profile: Profile): Promise<void> {
  await setDoc(
    userRef(uid),
    { ...profile, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function listJobs(uid: string): Promise<Job[]> {
  const snap = await getDocs(jobsRef(uid));
  const jobs = snap.docs.map((d) => d.data() as Job);
  jobs.sort(
    (a, b) =>
      (b.analysis?.score ?? -1) - (a.analysis?.score ?? -1) ||
      b.foundAt.localeCompare(a.foundAt),
  );
  return jobs;
}

/** Grava só as vagas ainda não conhecidas. Retorna quantas eram novas. */
export async function addJobs(
  uid: string,
  jobs: Job[],
  knownIds: Set<string>,
): Promise<number> {
  const fresh = jobs.filter((j) => !knownIds.has(j.id));
  // O Firestore aceita até 500 gravações por lote.
  for (let i = 0; i < fresh.length; i += 400) {
    const batch = writeBatch(fb().db);
    for (const job of fresh.slice(i, i + 400)) {
      batch.set(doc(jobsRef(uid), job.id), { ...job });
    }
    await batch.commit();
  }
  return fresh.length;
}

export async function updateJob(
  uid: string,
  id: string,
  patch: Partial<Job>,
): Promise<void> {
  await updateDoc(doc(jobsRef(uid), id), { ...patch });
}
