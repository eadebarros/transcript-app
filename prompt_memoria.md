# Prompt Memória — Transcript App

## Visão geral
- Webapp minimalista que permite colar a URL de um vídeo e obter uma transcrição automática do áudio. O foco atual é YouTube.
- Backend em Node/Express usa `yt-dlp` + `ffmpeg` para baixar e fatiar o áudio em pedaços ≤25 MB, depois envia cada pedaço para `whisper-1` via OpenAI.
- Frontend leve (HTML/CSS/JS vanilla) com um único formulário e um card de resultados.

## Stack e dependências
1. **Node.js (>=18)** — runtime do servidor.
2. **Express 5** — serve API e arquivos estáticos.
3. **OpenAI SDK (`openai` 6.x)** — chama o endpoint de transcrição por áudio (`openai.audio.transcriptions.create`).
4. **`yt-dlp` no PATH** — baixa o áudio do YouTube em MP3 com qualidade máxima (`-x --audio-quality 0`).
5. **`ffmpeg` no PATH** — divide o MP3 em segmentos com `-f segment -segment_time 55` (copiando sem re-encodar) para manter cada pedaço <25 MB.
6. **Cliente**: HTML estático, CSS e um script que envia `POST /api/transcribe` com JSON `{ url, lang? }` e exibe o texto retornado.
7. **Rotina**: a resposta inclui `text` (texto concatenado) e `segments` (número de pedaços) para UI/UX simples (mensagem “transcrito em X segmentos”).

## Fluxo atual
1. O frontend abre `http://localhost:3000`, o usuário cola o link, escolhe idioma opcional e clica em “Transcrever”.
2. O backend valida `req.body.url`, chama `downloadAudio(url)` (`yt-dlp`), `splitAudio(file)` (`ffmpeg`), `transcribeSegments(chunks, lang)` (loop com OpenAI). 
3. O texto final volta com `text` concatenado e o número de segmentos. Limpeza acontece no `finally` (audio + segmentos deletados).
4. Tratamento de erros cobre falta de `OPENAI_API_KEY`, falha no download, divisão ou transcrição e devolve mensagens amistosas.

## Pontos importantes
- O app exige variável de ambiente `OPENAI_API_KEY`; sem ela a transcrição não roda (console warns e erro amigável é retornado).
- Frontend também permite copiar tudo para a área de transferência e mostra status “Transcrevendo…” durante a requisição.
- `public` serve apenas HTML/CSS/JS, sem bundlers.
- Não há nenhum banco, armazenamento ou login — o estado é efêmero.

## Lacunas / próximos passos
1. **Novas fontes**: hoje só funciona com YouTube. Queremos aceitar Instagram Reels (contas públicas) usando o mesmo campo de input.
2. **Detecção automática**: normalizar a URL e escolher a ferramenta certa (YouTube vs Instagram) dentro de um handler comum (`downloadVideo(url)` que roteia para `yt-dlp`, `instaloader`, headless browser etc.).
3. **UI feedback**: informar “baixando do Instagram…” quando o link for de outro domínio e exibir mensagens de sucesso/erro específicas.
4. **Testes e observabilidade**: hoje não há cobertura — talvez adicionar logs para cada etapa e, futuramente, persistência.
5. **Progresso granular**: ideia futura de barra de progresso ou histórico com número de segmentos processados.

## Próxima missão
- Implementar um handler unificado que detecte `instagram.com/reel/` (e equivalentes) e use uma ferramenta compatível para baixar o MP4/áudio, mantendo o pipeline de transcrição.
- Garantir que o mesmo campo de URL aceite tanto YouTube quanto Instagram e apenas roteie internamente para o downloader certo.
- Atualizar o README/UI para explicar a nova fonte e os requisitos (ex: `yt-dlp` + `instaloader` ou `yt-dlp` com suporte a Instagram).
