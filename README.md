# Transcript App

Um webapp minimalista que baixa o áudio de vídeos (YouTube e Reels públicos do Instagram), divide em pedaços seguros (<25 MB), manda cada pedaço para a API de transcrição (Whisper) da OpenAI e devolve o texto puro retornado pelo modelo. Ideal para gerar legendas ou arquivos .txt direto do áudio, mesmo em vídeos longos.

## Requisitos

- `node` (>=18)
- `yt-dlp` (instalado via Homebrew ou similar, usado para baixar áudio de YouTube e Instagram)
- `ffmpeg` (necessário para dividir o áudio)
- Uma chave `OPENAI_API_KEY` válida com acesso ao endpoint de áudio (Whisper ou similar).

## Instalação

```bash
npm install
```

## Variáveis de ambiente

- `OPENAI_API_KEY` — necessária para chamar `/api/transcribe`. Exemplo:

```bash
export OPENAI_API_KEY=sk-...
```

## Como usar

```bash
npm run dev
```

Abra o navegador em `http://localhost:3000`, cole o link do YouTube (não precisa ter legendas públicas) e toque em **Transcrever**. O backend baixa o áudio com `yt-dlp`, usa `ffmpeg` para cortar em pedaços (~55 segundos) que cabem no limite de 25 MB e envia cada um para o Whisper (`whisper-1`). O texto final aparece logo abaixo, sem nenhuma interpretação ou resumo.

## Observações

- Reels públicos do Instagram e vídeos do YouTube são suportados a partir do mesmo campo de URL; o backend detecta a origem automaticamente e usa `yt-dlp` para baixar o áudio.
- Vídeos longos geram vários segmentos, mas você recebe tudo concatenado com quebras de linha entre cada pedaço.
- Pode demorar um pouco mais que o normal porque o download e as várias chamadas à API são feitas em sequência.
- Se quiser, posso adicionar uma barra de progresso ou histórico para mostrar quantos segmentos já foram processados.
