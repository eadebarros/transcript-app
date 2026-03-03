const form = document.getElementById('transcript-form');
const resultsSection = document.getElementById('results');
const transcriptText = document.getElementById('transcript-text');
const errorText = document.getElementById('error');
const copyButton = document.getElementById('copy-text');
const submitButton = form.querySelector('button[type="submit"]');
const segmentInfo = document.getElementById('segment-info');

const setLoading = (loading) => {
  if (loading) {
    submitButton.disabled = true;
    submitButton.textContent = 'Transcrevendo...';
    submitButton.classList.add('loading');
  } else {
    submitButton.disabled = false;
    submitButton.textContent = 'Transcrever';
    submitButton.classList.remove('loading');
  }
};

const showTranscript = (text) => {
  transcriptText.textContent = text;
  resultsSection.hidden = false;
};

const showSegmentInfo = (count) => {
  if (count && Number(count) > 1) {
    segmentInfo.textContent = `Transcrito em ${count} segmentos.`;
    segmentInfo.hidden = false;
  } else {
    segmentInfo.hidden = true;
  }
};

const resetState = () => {
  errorText.hidden = true;
  resultsSection.hidden = true;
  transcriptText.textContent = '';
  segmentInfo.hidden = true;
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

    const { text, segments } = await response.json();
    showTranscript(text);
    showSegmentInfo(segments);
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
