export type JobStatus = "new" | "ready" | "low" | "applied" | "dismissed";

export interface Analysis {
  /** Compatibilidade de 0 a 100 entre o currículo e a vaga. */
  score: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  /** Carta de apresentação adaptada à vaga. */
  coverLetter: string;
  /** Resposta curta para "por que você quer esta vaga?". */
  pitch: string;
  analyzedAt: string;
}

export interface Job {
  id: string;
  name: string;
  company: string;
  description: string;
  url: string;
  city: string;
  state: string;
  workplaceType: string;
  type: string;
  publishedDate: string;
  deadline: string | null;
  status: JobStatus;
  foundAt: string;
  appliedAt?: string;
  analysis?: Analysis;
}

export interface Profile {
  name: string;
  /** Currículo em texto puro. */
  resume: string;
  /** Termos de busca, um por cargo/área. */
  keywords: string[];
  remoteOnly: boolean;
  /** Nome do estado como aparece na Gupy (ex.: "Rondônia"). Vazio = todos. */
  state: string;
  /** Nota mínima para a vaga entrar em "Prontas para inscrição". */
  minScore: number;
}

export const emptyProfile: Profile = {
  name: "",
  resume: "",
  keywords: [],
  remoteOnly: false,
  state: "",
  minScore: 70,
};
