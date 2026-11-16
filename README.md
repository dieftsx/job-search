# Vagas Auto

Aplicação Next.js + TypeScript com visual 8-bits que:

1. **Busca** vagas no portal da Gupy pelos seus termos.
2. **Analisa** cada vaga com o Gemini: nota de compatibilidade (0 a 100), pontos fortes, lacunas, carta de apresentação e resposta para "por que quero esta vaga".
3. **Abre a inscrição** em um navegador controlado (Playwright) para você revisar e enviar. Esse passo só funciona rodando no seu computador.

Cada usuário tem login próprio (Firebase Auth) e só enxerga o próprio perfil e as próprias vagas (Firestore).

## 1. Configurar o Firebase

No [Console do Firebase](https://console.firebase.google.com):

1. Crie um projeto (ou use um existente).
2. **Authentication > Sign-in method**: ative **E-mail/senha**.
3. **Firestore Database**: crie o banco em modo de produção.
4. **Firestore > Regras**: cole o conteúdo de `firestore.rules` e publique. Sem isso, ninguém consegue ler nem gravar.
5. **Configurações do projeto > Seus apps**: adicione um app da Web e copie os valores do `firebaseConfig`.
6. **Authentication > Settings > Domínios autorizados**: adicione o domínio da Vercel (ex.: `job-search-xxx.vercel.app`).

## 2. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

| Variável | Onde achar |
| --- | --- |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey |
| `NEXT_PUBLIC_FIREBASE_*` | `firebaseConfig` do app da Web |

Na Vercel, cadastre as mesmas variáveis em **Settings > Environment Variables** e publique de novo.

## 3. Rodar

Requer Node.js 20.9 ou mais novo.

```bash
npm install
npm run browser:install   # Chromium do Playwright, só para a inscrição assistida
npm run dev
```

Abra http://localhost:3000, crie sua conta em **Cadastre-se** e preencha o perfil.

## Estrutura

```
firestore.rules            regras de segurança (cada usuário só vê o que é dele)
src/lib/firebase.ts        inicialização do Firebase no navegador
src/lib/auth-context.tsx   estado de login
src/lib/db.ts              leitura e gravação no Firestore
src/lib/server-auth.ts     confere o token de login nas rotas da API
src/lib/gupy.ts            busca no portal da Gupy
src/lib/gemini.ts          análise e geração de textos
src/lib/apply.ts           navegador controlado (Playwright)
src/app/api/*              rotas: search, analyze, apply
src/app/page.tsx           painel
src/app/login, /cadastro   telas de acesso
```

Dados no Firestore:

```
users/{uid}              perfil (nome, currículo, termos, nota mínima)
users/{uid}/jobs/{id}    vagas encontradas, status e análise
```

## Limites conhecidos

- O envio final da candidatura é manual: cada empresa na Gupy tem perguntas próprias.
- A busca usa o endpoint público do portal da Gupy, que não é documentado e pode mudar.
- A pausa de 4 segundos entre análises respeita o limite do plano gratuito do Gemini.
- Todos os usuários consomem a mesma chave do Gemini. Antes de abrir para o público, será preciso limitar o uso por usuário (cotas ou planos).
