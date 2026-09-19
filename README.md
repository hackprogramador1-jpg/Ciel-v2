# CIEL V2 — INTELIGENTE

Esta versão conecta a CIEL a um motor de IA no servidor.

## Estrutura

- `index.html` — interface
- `style.css` — visual
- `app.js` — voz, memória local, agenda e comunicação com a IA
- `api/chat.js` — backend seguro da CIEL
- `vercel.json` — configuração da função serverless
- `.env.example` — exemplo das variáveis
- `ciel-background.jpg` — visual de fundo

## Configuração no Vercel

1. Suba todos os arquivos para o repositório.
2. No Vercel, abra o projeto.
3. Vá em Settings → Environment Variables.
4. Crie:
   - `OPENAI_API_KEY` = sua chave da API
   - `CIEL_MODEL` = `gpt-5.6-luna` (opcional)
5. Faça um novo Deploy.

A chave NÃO deve ser colocada em `app.js` ou `index.html`.

A CIEL usa a Responses API no backend. Os modelos atuais da OpenAI são disponibilizados pela Responses API; `gpt-5.6-luna` é uma opção de menor custo na documentação atual. 

## O que a V2 já faz

- Conversa inteligente por texto.
- Conversa inteligente por voz, usando o reconhecimento de voz do navegador.
- Resposta falada.
- Histórico local das últimas conversas enviado como contexto.
- Data/hora real enviada para o cérebro.
- Agenda futura enviada para o cérebro.
- Agenda e hora continuam funcionando localmente mesmo sem IA.
- Interface visual reage aos estados da CIEL.

## Próxima evolução

V3 pode transformar a CIEL em uma agente com ferramentas reais:
- criar/editar/cancelar compromissos por intenção;
- memória estruturada;
- pesquisa na web;
- lembretes;
- tarefas;
- contas de usuário e banco de dados;
- execução de ações com confirmação.
