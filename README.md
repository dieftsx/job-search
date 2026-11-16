# Vagas Auto

Aplicação local (Next.js + TypeScript) que:

1. **Busca** vagas no portal da Gupy pelos seus termos.
2. **Analisa** cada vaga com o Gemini: nota de compatibilidade (0 a 100), pontos fortes, lacunas, carta de apresentação e resposta para "por que quero esta vaga".
3. **Abre a inscrição** em um navegador controlado (Playwright), já logado na sua conta Gupy, para você revisar e enviar.

## Como rodar

Requer Node.js 20.9 ou mais novo.

```bash
npm install
npm run browser:install     # baixa o Chromium do Playwright (uma vez)
cp .env.example .env.local  # no Windows: copy .env.example .env.local
```

Edite `.env.local` e cole sua chave do Gemini (gratuita em https://aistudio.google.com/apikey). Depois:

```bash
npm run dev
```

Abra http://localhost:3000.

## Uso

1. Preencha o **Perfil**: nome, termos de busca, currículo em texto e nota mínima.
2. Clique em **Buscar e analisar vagas**. As vagas com nota igual ou acima da mínima vão para "Prontas para inscrição".
3. Em cada vaga, **Revisar** mostra a análise e os textos (editáveis).
4. **Abrir inscrição** abre a vaga no navegador controlado e clica em "Candidatar-se". Na primeira vez, faça login na Gupy nessa janela; a sessão fica salva em `data/browser-profile`.
5. Complete e envie o formulário, depois clique em **Marcar como inscrita**.

## Estrutura

```
src/lib/gupy.ts     busca no portal da Gupy
src/lib/gemini.ts   análise e geração de textos
src/lib/apply.ts    navegador controlado (Playwright)
src/lib/store.ts    banco local em data/db.json
src/app/api/*       rotas da API
src/app/page.tsx    painel
```

## Limites conhecidos

- O envio final é manual por escolha de projeto: cada empresa na Gupy tem perguntas próprias e o envio sem revisão gera candidaturas erradas.
- A busca usa o endpoint público do portal da Gupy, que não é documentado e pode mudar.
- A pausa de 4 segundos entre análises respeita o limite do plano gratuito do Gemini.
- Os dados (currículo, vagas, sessão do navegador) ficam só na pasta `data/` do seu computador.
