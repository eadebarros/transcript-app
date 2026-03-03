const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { OpenAI } = require('openai');

const openaiKey = process.env.OPENAI_API_KEY;
if (!openaiKey) {
  console.warn('VÍDEO: defina OPENAI_API_KEY para habilitar a transcrição via áudio.');
}
const openai = new OpenAI({ apiKey: openaiKey });

const app = express();
const PORT = process.env.PORT || 3000;
const tmpDir = path.join(os.tmpdir(), 'transcript-app');
const downloadsDir = path.join(tmpDir, 'downloads');
fs.mkdirSync(tmpDir, { recursive: true });
fs.mkdirSync(downloadsDir, { recursive: true });

const SOURCE_LABELS = {
  youtube: 'YouTube',
  instagram: 'Instagram Reels',
  generic: 'vídeo',
};

const detectSourceFromUrl = (videoUrl) => {
  const normalizedUrl = new URL(videoUrl);
  const hostname = normalizedUrl.hostname.replace(/^www\./i, '').toLowerCase();

  if (hostname.includes('instagram.com')) {
    return 'instagram';
  }

  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
    return 'youtube';
  }

  return 'generic';
};

const downloadAudio = (videoUrl, source = 'generic') => {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const basePath = path.join(tmpDir, `audio-${timestamp}`);
    const outputTemplate = `${basePath}.%(ext)s`;
    const finalPath = `${basePath}.mp3`;

    console.log(
      `[download] ${SOURCE_LABELS[source] || SOURCE_LABELS.generic} detectado. Baixando o áudio...`
    );

    const ytdlp = spawn('yt-dlp', [
      '-x',
      '--audio-format',
      'mp3',
      '--audio-quality',
      '0',
      '-o',
      outputTemplate,
      videoUrl,
    ]);

    ytdlp.stderr.on('data', (chunk) => console.debug('[yt-dlp]', chunk.toString()));
    ytdlp.stdout.on('data', (chunk) => console.debug('[yt-dlp]', chunk.toString()));

    ytdlp.on('error', reject);
    ytdlp.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error('Falha ao baixar o áudio do vídeo.'));
      }
      resolve(finalPath);
    });
  });
};

const downloadVideoFile = (videoUrl, source = 'generic') => {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const basePath = path.join(downloadsDir, `video-${timestamp}`);
    const outputTemplate = `${basePath}.%(ext)s`;
    const finalPath = `${basePath}.mp4`;

    console.log(`[download] ${SOURCE_LABELS[source] || SOURCE_LABELS.generic} detectado. Baixando o vídeo...`);

    const ytdlp = spawn('yt-dlp', [
      '-f',
      'bestvideo+bestaudio/best',
      '--merge-output-format',
      'mp4',
      '-o',
      outputTemplate,
      videoUrl,
    ]);

    ytdlp.stderr.on('data', (chunk) => console.debug('[yt-dlp]', chunk.toString()));
    ytdlp.stdout.on('data', (chunk) => console.debug('[yt-dlp]', chunk.toString()));

    ytdlp.on('error', reject);
    ytdlp.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error('Falha ao baixar o vídeo.'));
      }
      resolve(finalPath);
    });
  });
};

const splitAudio = (filePath, segmentSeconds = 55) => {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(filePath);
    const baseName = path.basename(filePath, path.extname(filePath));
    const segmentTemplate = path.join(dir, `${baseName}-segment-%03d.mp3`);

    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-i',
      filePath,
      '-f',
      'segment',
      '-segment_time',
      segmentSeconds.toString(),
      '-c',
      'copy',
      segmentTemplate,
    ]);

    ffmpeg.stderr.on('data', (chunk) => console.debug('[ffmpeg]', chunk.toString()));
    ffmpeg.stdout.on('data', (chunk) => console.debug('[ffmpeg]', chunk.toString()));

    ffmpeg.on('error', reject);
    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error('Falha ao dividir o áudio em segmentos.'));
      }
      const segments = fs
        .readdirSync(dir)
        .filter((file) => file.startsWith(`${baseName}-segment-`))
        .map((file) => path.join(dir, file))
        .sort();

      if (!segments.length) {
        return reject(new Error('Nenhum segmento gerado.'));
      }

      resolve(segments);
    });
  });
};

const transcribeSegments = async (chunks, lang) => {
  const texts = [];
  for (let i = 0; i < chunks.length; i += 1) {
    const chunkPath = chunks[i];
    console.log(`Transcrevendo segmento ${i + 1}/${chunks.length}`);
    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(chunkPath),
      model: 'whisper-1',
      ...(lang ? { language: lang } : {}),
    });
    texts.push(response.text);
  }
  return texts;
};

const cleanupFiles = (files) => {
  files.forEach((file) => {
    fs.unlink(file, () => {});
  });
};

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/transcribe', async (req, res) => {
  let audioPath;
  let segments = [];
  let source = 'generic';
  try {
    const { url, lang } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Informe a URL do vídeo' });
    }

    try {
      source = detectSourceFromUrl(url);
    } catch (innerError) {
      console.error(innerError);
      return res.status(400).json({ error: 'Informe uma URL válida (YouTube ou Instagram).' });
    }

    audioPath = await downloadAudio(url, source);
    segments = await splitAudio(audioPath);
    const textSegments = await transcribeSegments(segments, lang);
    res.json({
      text: textSegments.join('\n\n'),
      segments: textSegments.length,
      source: {
        id: source,
        label: SOURCE_LABELS[source] || SOURCE_LABELS.generic,
      },
    });
  } catch (error) {
    console.error(error);
    const message =
      error?.message?.includes('OPENAI_API_KEY')
        ? 'A chave OPENAI_API_KEY não está definida. Configure a variável de ambiente e tente novamente.'
        : error?.message?.includes('Falha ao baixar o áudio')
          ? 'Não foi possível baixar o áudio do vídeo. Confira a URL e tente novamente.'
          : error?.message?.includes('Falha ao dividir o áudio')
            ? 'Não foi possível dividir o áudio em segmentos. Verifique se o ffmpeg está instalado.'
            : 'Não foi possível transcrever o áudio. Tente novamente em alguns instantes.';
    res.status(500).json({ error: message });
  } finally {
    if (audioPath) {
      cleanupFiles([audioPath]);
    }
    if (segments.length) {
      cleanupFiles(segments);
    }
  }
});

app.post('/api/download', async (req, res) => {
  let source = 'generic';
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Informe a URL do vídeo para download.' });
    }

    try {
      source = detectSourceFromUrl(url);
    } catch (innerError) {
      console.error(innerError);
      return res.status(400).json({ error: 'Informe uma URL válida do YouTube.' });
    }

    const videoPath = await downloadVideoFile(url, source);
    const fileName = path.basename(videoPath);
    const downloadUrl = `/api/download-file/${fileName}`;
    res.json({
      message: 'Download pronto. Clique no link abaixo para salvar o vídeo.',
      file: downloadUrl,
      fileName,
    });
  } catch (error) {
    console.error(error);
    const message = error?.message?.includes('Falha ao baixar o vídeo')
      ? 'Não foi possível baixar o vídeo. Verifique a URL e tente novamente.'
      : 'Não foi possível processar o download. Tente novamente mais tarde.';
    res.status(500).json({ error: message });
  }
});

app.get('/api/download-file/:fileName', (req, res) => {
  const safeName = path.basename(req.params.fileName || '');
  const filePath = path.join(downloadsDir, safeName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Arquivo não encontrado. Execute o download novamente.');
  }

  res.download(filePath, safeName, (err) => {
    cleanupFiles([filePath]);
    if (err && !res.headersSent) {
      console.error('Erro no download do vídeo:', err);
      res.status(500).send('Erro ao enviar o vídeo. Tente novamente.');
    }
  });
});

app.listen(PORT, () => {
  console.log(`Transcript app rodando em http://localhost:${PORT}`);
});
