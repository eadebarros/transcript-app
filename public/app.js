const form = document.getElementById('transcript-form');
const resultsSection = document.getElementById('results');
const transcriptText = document.getElementById('transcript-text');
const errorText = document.getElementById('error');
const copyButton = document.getElementById('copy-text');
const submitButton = form.querySelector('button[type="submit"]');
const segmentInfo = document.getElementById('segment-info');
const sourceMessage = document.getElementById('source-message');
const progressBar = document.getElementById('progress-bar');
const progressFilled = document.getElementById('progress-filled');
const downloadButton = document.getElementById('download-markdown');
const downloadVideoButton = document.getElementById('download-video-button');
const downloadStatus = document.getElementById('download-status');
const downloadLink = document.getElementById('download-link');

const setLoading = (loading) => {
  if (loading) {
    submitButton.disabled = true;
    submitButton.textContent = 'Transcrevendo...';
    submitButton.classList.add('loading');
    startProgress();
  } else {
    submitButton.disabled = false;
    submitButton.textContent = 'Transcrever';
    submitButton.classList.remove('loading');
    completeProgress();
  }
};

let progressIntervalId;
let currentProgress = 0;

const showTranscript = (text) => {
  transcriptText.textContent = text;
  resultsSection.hidden = false;
  downloadButton.disabled = false;
};

const showSegmentInfo = (count) => {
  if (count && Number(count) > 1) {
    segmentInfo.textContent = `Transcrito em ${count} segmentos.`;
    segmentInfo.hidden = false;
  } else {
    segmentInfo.hidden = true;
  }
};

const startProgress = () => {
  clearInterval(progressIntervalId);
  progressBar.hidden = false;
  currentProgress = 5;
  progressFilled.style.width = `${currentProgress}%`;
  progressIntervalId = setInterval(() => {
    if (currentProgress < 90) {
      currentProgress += Math.random() * 5;
      progressFilled.style.width = `${Math.min(currentProgress, 90)}%`;
    }
  }, 300);
};

const completeProgress = () => {
  clearInterval(progressIntervalId);
  currentProgress = 100;
  progressFilled.style.width = '100%';
  setTimeout(() => {
    progressBar.hidden = true;
    progressFilled.style.width = '0%';
    currentProgress = 0;
  }, 600);
};

const showSourceMessage = (source) => {
  if (!source?.label || source.label === 'vídeo') {
    sourceMessage.hidden = true;
    sourceMessage.textContent = '';
    return;
  }
  sourceMessage.textContent = `Fonte detectada: ${source.label}`;
  sourceMessage.hidden = false;
};

const showDownloadStatus = (message, isError = false) => {
  if (!message) {
    downloadStatus.hidden = true;
    downloadStatus.textContent = '';
    downloadStatus.classList.remove('error');
    return;
  }

  downloadStatus.textContent = message;
  downloadStatus.hidden = false;
  downloadStatus.classList.toggle('error', isError);
};

const resetDownloadStatus = () => {
  downloadLink.hidden = true;
  downloadLink.href = '';
  downloadLink.removeAttribute('download');
  downloadLink.textContent = 'Salvar vídeo';
  showDownloadStatus('');
};

const resetState = () => {
  errorText.hidden = true;
  resultsSection.hidden = true;
  transcriptText.textContent = '';
  segmentInfo.hidden = true;
  sourceMessage.hidden = true;
  sourceMessage.textContent = '';
  downloadButton.disabled = true;
  progressBar.hidden = true;
  progressFilled.style.width = '0%';
  clearInterval(progressIntervalId);
  resetDownloadStatus();
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  resetState();

  const formData = new FormData(form);
  const url = formData.get('url');
  const lang = formData.get('lang')?.trim();

  try {
    setLoading(true);
    const response = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, lang: lang || undefined }),
    });

    if (!response.ok) {
      const payload = await response.json();
      throw new Error(payload.error || 'Erro desconhecido');
    }

    const { text, segments, source } = await response.json();
    showTranscript(text);
    showSegmentInfo(segments);
    showSourceMessage(source);
  } catch (error) {
    errorText.textContent = error.message;
    errorText.hidden = false;
  } finally {
    setLoading(false);
  }
});

copyButton.addEventListener('click', async () => {
  const text = transcriptText.textContent;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copyButton.textContent = 'Copiado!';
    setTimeout(() => (copyButton.textContent = 'Copiar tudo'), 1500);
  } catch (error) {
    copyButton.textContent = 'Falha ao copiar';
    setTimeout(() => (copyButton.textContent = 'Copiar tudo'), 1500);
  }
});

const slugifyTitle = (input) => {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 45) || 'transcricao';
};

const downloadMarkdown = () => {
  const text = transcriptText.textContent;
  if (!text) return;
  const markdown = `# Transcrição\n\n${text}`;
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${slugifyTitle(text.substring(0, 40))}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const handleVideoDownload = async () => {
  const urlInput = document.getElementById('video-url');
  const url = urlInput?.value?.trim();
  if (!url) {
    showDownloadStatus('Informe uma URL válida.', true);
    return;
  }

  downloadVideoButton.disabled = true;
  showDownloadStatus('Preparando o download...');
  downloadLink.hidden = true;

  try {
    const response = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const payload = await response.json();
      throw new Error(payload.error || 'Erro desconhecido');
    }

    const { message, file, fileName } = await response.json();
    showDownloadStatus(message);
    downloadLink.href = file;
    if (fileName) {
      downloadLink.setAttribute('download', fileName);
    }
    downloadLink.hidden = false;
  } catch (error) {
    showDownloadStatus(error.message, true);
  } finally {
    downloadVideoButton.disabled = false;
  }
};

downloadButton.addEventListener('click', downloadMarkdown);
downloadVideoButton.addEventListener('click', handleVideoDownload);

downloadButton.disabled = true;
resetState();
