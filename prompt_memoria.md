# Prompt Memória — Transcript App

## Visão geral
- Webapp minimalista que permite colar a URL de um vídeo e obter uma transcrição automática do áudio. Atualmente aceita YouTube (vídeos comuns) e Reels públicos do Instagram, e também consegue baixar o vídeo completo em MP4.
- Backend em Node/Express usa `yt-dlp` + `ffmpeg` para baixar e fatiar o áudio em pedaços ≤25 MB, depois envia cada pedaço para `whisper-1` via OpenAI. Há um handler separado (`/api/download`) que usa `yt-dlp` para baixar o MP4 e expõe o arquivo via `/downloads/`.
- Frontend leve (HTML/CSS/JS vanilla) com um único formulário, feedback de origem detectada, botão “Baixar Markdown”, barra de progresso e um card adicional para baixar o vídeo.

## Stack e dependências
1. **Node.js (>=18)** — runtime do servidor.
2. **Express 5** — serve API e arquivos estáticos.
3. **OpenAI SDK (`openai` 6.x)** — chama o endpoint de transcrição por áudio (`openai.audio.transcriptions.create`).
4. **`yt-dlp` no PATH** — baixa o áudio dos vídeos, tanto do YouTube quanto do Instagram, graças à detecção automática de domínio.
5. **`ffmpeg` no PATH** — divide o MP3 em segmentos com `-f segment -segment_time 55` (copiando sem re-encodar) para manter cada pedaço <25 MB.
6. **Cliente**: HTML estático, CSS e um script que envia `POST /api/transcribe` com JSON `{ url, lang? }`, exibe o texto retornado e mostra qual fonte foi detectada.
7. **Rotina**: a resposta inclui `text` (texto concatenado), `segments` (número de pedaços) e `source` (origem detectada, ex: YouTube ou Instagram Reels) para melhorar a experiência.
8. **Downloads**: há uma rota `POST /api/download` que baixa o MP4 com `yt-dlp` e serve o arquivo em `/downloads/` (dentro de `tmp/transcript-app/downloads`).

## Fluxo atual
1. O frontend abre `http://localhost:3000`, o usuário cola o link (YouTube ou Instagram) e escolhe idioma opcional.
2. O backend valida `req.body.url`, detecta a origem (YouTube, Instagram ou genérico), chama `downloadAudio(url)` (`yt-dlp`), `splitAudio(file)` (`ffmpeg`), `transcribeSegments(chunks, lang)` (loop com OpenAI) e retorna o texto + número de segmentos + fonte.
3. O texto final volta com `text` concatenado, `segments` e `source`; a rota limpa arquivos temporários no bloco `finally`.
3.a. Há também o endpoint `/api/download`: ele aceita a mesma URL, chama o handler de vídeo, retorna uma mensagem e o caminho `/downloads/...`, e expõe o arquivo MP4 via middleware `express.static`.
4. Tratamento de erros cobre falta de `OPENAI_API_KEY`, falha no download, divisão ou transcrição e devolve mensagens amistosas.

## Pontos importantes
- O app exige variável de ambiente `OPENAI_API_KEY`; sem ela a transcrição não roda (console warns e erro amigável é retornado).
- Frontend também permite copiar tudo para a área de transferência, baixar a transcrição em Markdown e mostra uma barra de progresso + aviso sobre a fonte detectada durante a requisição.
- `public` serve apenas HTML/CSS/JS, sem bundlers.
- Não há nenhum banco, armazenamento ou login — o estado é efêmero.

## Lacunas / próximos passos
1. **UI mais rica**: adiantar barra de progresso, histórico de transcrições e indicadores dos segmentos processados.
2. **Observabilidade e retry**: logs mais detalhados e um fluxo automático de retry quando a transcrição falha ou o download é instável.
3. **Outras fontes**: estudar handlers para TikTok/Vimeo ou permitir upload manual de vídeo.
4. **Gerenciamento de downloads**: criar limpeza/TTL para os arquivos MP4 baixados (`/downloads/`) e talvez registrar seus metadados para auditoria.

## Próxima missão
- Criar um feedback visual mais claro durante o processamento (barra/contador) e registrar estatísticas básicas de uso.
- Explorar um sistema de retry/observabilidade para capturar falhas da transcrição ou downloads instáveis.
- Documentar no README como o app detecta e trata as diferentes fontes e manter essa memória atualizada conforme o fluxo evolui.
- Planejar uma estratégia de retenção e limpeza para os arquivos MP4 gerados em `/downloads` e logar quem os solicitou.
