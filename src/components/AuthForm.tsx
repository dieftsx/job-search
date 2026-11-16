"use client";

import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { saveProfile } from "@/lib/db";
import { fb, firebaseConfigured } from "@/lib/firebase";
import { emptyProfile } from "@/lib/types";
import SetupNotice from "./SetupNotice";

const ERRORS: Record<string, string> = {
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/user-not-found": "E-mail ou senha incorretos.",
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/email-already-in-use": "Já existe uma conta com esse e-mail.",
  "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
  "auth/invalid-email": "E-mail inválido.",
  "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco.",
  "auth/operation-not-allowed":
    "Login por e-mail e senha não está ativado no Firebase.",
};

function friendly(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  return ERRORS[code] ?? (e instanceof Error ? e.message : String(e));
}

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const signup = mode === "signup";

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const { auth } = fb();
      if (signup) {
        const cred = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        );
        const cleanName = name.trim();
        if (cleanName) await updateProfile(cred.user, { displayName: cleanName });
        await saveProfile(cred.user.uid, { ...emptyProfile, name: cleanName });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      router.replace("/");
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setError("");
    setInfo("");
    if (!email.trim()) {
      setError("Digite seu e-mail acima para receber o link.");
      return;
    }
    try {
      await sendPasswordResetEmail(fb().auth, email.trim());
      setInfo("Se o e-mail tiver conta, o link de redefinição foi enviado.");
    } catch (err) {
      setError(friendly(err));
    }
  }

  if (!firebaseConfigured) return <SetupNotice />;

  return (
    <main className="auth">
      <h1 className="center">VAGAS AUTO</h1>
      <p className="center muted">
        {signup ? "NOVO JOGADOR" : "INSIRA SUAS CREDENCIAIS"}
        <span className="blink"> _</span>
      </p>

      <form className="panel" onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{signup ? "Criar conta" : "Entrar"}</h2>

        {signup && (
          <div>
            <label htmlFor="name">Nome</label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}
        <div>
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button className="primary" type="submit" disabled={busy}>
          {busy ? "Carregando..." : signup ? "Criar conta" : "Start"}
        </button>

        {error && <div className="notice error">{error}</div>}
        {info && <div className="notice">{info}</div>}

        <div className="center small">
          {signup ? (
            <>
              Já tem conta? <Link href="/login">Entrar</Link>
            </>
          ) : (
            <>
              Ainda não tem conta? <Link href="/cadastro">Cadastre-se</Link>
              <br />
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  void reset();
                }}
              >
                Esqueci a senha
              </a>
            </>
          )}
        </div>
      </form>
    </main>
  );
}
