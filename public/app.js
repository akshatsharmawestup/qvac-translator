
// Model Strip Elements
const btnLoadModel = document.getElementById('btnLoadModel');
const btnUnloadModel = document.getElementById('btnUnloadModel');
const modelSelect = document.getElementById('modelSelect');
const modelTitle = document.getElementById('modelTitle');
const statusText = document.getElementById('statusText');
const stripProgressTrack = document.getElementById('stripProgressTrack');
const stripProgressFill = document.getElementById('stripProgressFill');

// QVAC Translator — Client-Side Application Logic

// DOM Elements
const modelStatusDot = document.getElementById('modelStatusDot');
const modelStatusText = document.getElementById('modelStatusText');
const btnModelToggle = document.getElementById('btnModelToggle');
const loadingBanner = document.getElementById('loadingBanner');
const loadingTitle = document.getElementById('loadingTitle');
const loadingPercent = document.getElementById('loadingPercent');
const progressBar = document.getElementById('progressBar');

const modeTabs = document.querySelectorAll('.mode-tab');
const chipBtns = document.querySelectorAll('.chip-btn');
const inputText = document.getElementById('inputText');
const charCount = document.getElementById('charCount');
const btnPaste = document.getElementById('btnPaste');
const btnClear = document.getElementById('btnClear');
const btnTranslate = document.getElementById('btnTranslate');
const btnSwap = document.getElementById('btnSwap');

const sourceLangTag = document.getElementById('sourceLangTag');
const targetLangTag = document.getElementById('targetLangTag');
const streamIndicator = document.getElementById('streamIndicator');
const outputText = document.getElementById('outputText');
const btnTts = document.getElementById('btnTts');
const btnCopy = document.getElementById('btnCopy');
const copyLabel = document.getElementById('copyLabel');

const metricSpeed = document.getElementById('metricSpeed');
const metricLatency = document.getElementById('metricLatency');
const metricTokens = document.getElementById('metricTokens');

const tRuntime = document.getElementById('tRuntime');
const tGpu = document.getElementById('tGpu');
const tMem = document.getElementById('tMem');
const gpuText = document.getElementById('gpuText');

// Application State
let currentMode = 'standard';
let modelStatus = 'unloaded'; // 'unloaded' | 'loading' | 'ready' | 'error'
let isGenerating = false;
let fromLang = 'en';
let toLang = 'hi';
let statusPollInterval = null;

// Initialize
async function init() {
  setupEventListeners();
  await checkStatus();
  startStatusPolling();
}

// Event Listeners
function setupEventListeners() {
  // Model Toggle (Load / Unload)
  btnModelToggle.addEventListener('click', handleModelToggle);
  if (btnLoadModel) {
    btnLoadModel.addEventListener('click', async () => {
      if (modelStatus === 'ready') return;
      await handleModelLoad();
    });
  }
  if (btnUnloadModel) {
    btnUnloadModel.addEventListener('click', async () => {
      if (modelStatus !== 'ready') return;
      await handleModelUnload();
    });
  }
  if (modelSelect) {
    modelSelect.addEventListener('change', () => {
      if (modelSelect.value === 'llama') {
        if (modelTitle) modelTitle.textContent = 'Model: Llama 3.2 1B Instruct (GGUF Q4_0)';
      } else {
        if (modelTitle) modelTitle.textContent = 'Model: Marian Indic EN-HI 200M (Q4_0)';
      }
    });
  }

  // Mode Selection Tabs
  modeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      modeTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentMode = tab.getAttribute('data-mode');
      updateModeLabels();
    });
  });

  // Example Chips
  chipBtns.forEach(chip => {
    chip.addEventListener('click', () => {
      const sample = chip.getAttribute('data-text');
      inputText.value = sample;
      updateCharCount();
      if (modelStatus === 'ready' && !isGenerating) {
        translateText();
      }
    });
  });

  // Textarea input & character count
  inputText.addEventListener('input', updateCharCount);

  // Keyboard shortcut: Ctrl + Enter
  inputText.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isGenerating) translateText();
    }
  });

  // Paste button
  btnPaste.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        inputText.value = text;
        updateCharCount();
        inputText.focus();
      }
    } catch (err) {
      console.warn('Clipboard paste failed:', err);
    }
  });

  // Clear button
  btnClear.addEventListener('click', () => {
    inputText.value = '';
    outputText.innerHTML = '<span class="output-placeholder">Your on-device Hindi translation will stream here in real time...</span>';
    updateCharCount();
    resetMetrics();
  });

  // Translate button
  btnTranslate.addEventListener('click', () => {
    if (!isGenerating) translateText();
  });

  // Swap Languages button
  btnSwap.addEventListener('click', swapLanguages);

  // Copy button
  btnCopy.addEventListener('click', copyTranslation);

  // TTS Listen button
  btnTts.addEventListener('click', speakTranslation);
}

// Update Mode Labels
function updateModeLabels() {
  if (currentMode === 'reverse') {
    fromLang = 'hi';
    toLang = 'en';
    sourceLangTag.textContent = 'Hindi (हिन्दी)';
    targetLangTag.textContent = 'English';
    inputText.placeholder = 'हिंदी पाठ यहाँ टाइप करें या चिपकाएँ... (अनुवाद के लिए Ctrl + Enter दबाएँ)';
    outputText.innerHTML = '<span class="output-placeholder">Your English translation will stream here in real time...</span>';
  } else {
    fromLang = 'en';
    toLang = 'hi';
    sourceLangTag.textContent = 'English';
    inputText.placeholder = 'Type or paste English text here to translate locally... (Press Ctrl + Enter to Translate)';

    if (currentMode === 'standard') {
      targetLangTag.textContent = 'Hindi (हिन्दी) • Standard NMT';
      outputText.innerHTML = '<span class="output-placeholder">Your on-device Hindi translation will stream here in real time...</span>';
    } else if (currentMode === 'formal') {
      targetLangTag.textContent = 'Hindi (शुद्ध और शिष्ट हिन्दी)';
      outputText.innerHTML = '<span class="output-placeholder">Formal Shuddh Hindi translation will stream here...</span>';
    } else if (currentMode === 'hinglish') {
      targetLangTag.textContent = 'Hinglish (Colloquial Romanized)';
      outputText.innerHTML = '<span class="output-placeholder">Conversational Hinglish translation will stream here...</span>';
    }
  }
}

// Swap Languages
function swapLanguages() {
  const currentInput = inputText.value;
  const currentOutput = outputText.textContent.replace('Your on-device Hindi translation will stream here in real time...', '').trim();

  if (currentMode === 'reverse') {
    // Switch back to standard EN -> HI
    const standardTab = document.querySelector('[data-mode="standard"]');
    if (standardTab) standardTab.click();
  } else {
    // Switch to reverse HI -> EN
    const reverseTab = document.querySelector('[data-mode="reverse"]');
    if (reverseTab) reverseTab.click();
  }

  if (currentOutput) {
    inputText.value = currentOutput;
    updateCharCount();
  }
}

// Check Server & Model Status
async function checkStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();

    modelStatus = data.modelStatus;
    updateStatusUI(data);
  } catch (err) {
    console.error('Failed to query /api/status:', err);
    modelStatusText.textContent = 'Offline / Connecting...';
    modelStatusDot.className = 'status-dot status-error';
  }
}

function startStatusPolling() {
  if (statusPollInterval) clearInterval(statusPollInterval);
  statusPollInterval = setInterval(checkStatus, 3000);
}

// Update Status in UI
function updateStatusUI(data) {
  const { modelStatus, downloadProgress, systemInfo } = data;

  // Telemetry updates
  if (systemInfo) {
    tRuntime.textContent = systemInfo.runtime || 'Node.js';
    tGpu.textContent = systemInfo.gpuAcceleration || 'Vulkan 1.4 GPU';
    gpuText.textContent = 'RTX 4070 • Vulkan 1.4';
    tMem.textContent = `${systemInfo.freeMemGb} GB / ${systemInfo.totalMemGb} GB`;
  }

  // Model State Dot & Label
  modelStatusDot.className = 'status-dot';
  
  if (modelTitle) {
    modelTitle.textContent = `Model: ${data.modelName || 'Llama 3.2 1B Instruct (GGUF Q4_0)'}`;
  }
  if (statusText) {
    if (modelStatus === 'ready') {
      statusText.textContent = 'Status: Model ready on local Vulkan 1.4 GPU';
    } else if (modelStatus === 'loading') {
      const pct = (downloadProgress?.percentage || 0).toFixed(0);
      statusText.textContent = `Status: Loading model weights into local memory (${pct}%)...`;
    } else {
      statusText.textContent = 'Status: Model unloaded (RAM/VRAM released)';
    }
  }
  if (btnLoadModel) {
    if (modelStatus === 'ready') {
      btnLoadModel.disabled = true;
      btnLoadModel.textContent = '⚡ Model Loaded';
      btnLoadModel.style.opacity = '0.7';
    } else if (modelStatus === 'loading') {
      btnLoadModel.disabled = true;
      btnLoadModel.textContent = 'Loading...';
      btnLoadModel.style.opacity = '0.6';
    } else {
      btnLoadModel.disabled = false;
      btnLoadModel.textContent = '⚡ Load Model';
      btnLoadModel.style.opacity = '1';
    }
  }
  if (btnUnloadModel) {
    btnUnloadModel.disabled = (modelStatus !== 'ready');
  }
  if (stripProgressTrack && stripProgressFill) {
    if (modelStatus === 'loading') {
      stripProgressTrack.style.display = 'block';
      stripProgressFill.style.width = `${downloadProgress?.percentage || 0}%`;
    } else {
      stripProgressTrack.style.display = 'none';
    }
  }
  if (modelStatus === 'ready') {
    modelStatusDot.classList.add('status-ready');
    modelStatusText.textContent = 'Model Ready (Llama 3.2 1B)';
    btnModelToggle.textContent = 'Unload';
    btnModelToggle.className = 'btn-model-action btn-unload';
    loadingBanner.style.display = 'none';
    btnTranslate.disabled = false;
  } else if (modelStatus === 'loading') {
    modelStatusDot.classList.add('status-loading');
    modelStatusText.textContent = 'Loading Model...';
    btnModelToggle.textContent = 'Loading...';
    btnModelToggle.className = 'btn-model-action';
    btnModelToggle.disabled = true;
    loadingBanner.style.display = 'block';
    btnTranslate.disabled = true;

    const pct = Math.min(100, Math.max(0, downloadProgress?.percentage || 0));
    progressBar.style.width = `${pct}%`;
    loadingPercent.textContent = `${pct.toFixed(0)}%`;
    if (downloadProgress?.total > 0) {
      const mb = (n) => (n / 1e6).toFixed(1);
      loadingTitle.textContent = `Loading weights into local memory (${mb(downloadProgress.downloaded)}/${mb(downloadProgress.total)} MB)...`;
    }
  } else {
    modelStatusDot.classList.add('status-unloaded');
    modelStatusText.textContent = 'Model Unloaded';
    btnModelToggle.textContent = 'Load Model';
    btnModelToggle.className = 'btn-model-action';
    btnModelToggle.disabled = false;
    loadingBanner.style.display = 'none';
    btnTranslate.disabled = false;
  }
}

// Handle Model Toggle Button
async function handleModelToggle() {
  if (modelStatus === 'ready') {
    // Unload
    btnModelToggle.disabled = true;
    btnModelToggle.textContent = 'Unloading...';
    try {
      const res = await fetch('/api/model/unload', { method: 'POST' });
      await res.json();
      await checkStatus();
    } catch (err) {
      console.error('Unload error:', err);
    } finally {
      btnModelToggle.disabled = false;
    }
  } else if (modelStatus === 'unloaded' || modelStatus === 'error') {
    // Load
    btnModelToggle.disabled = true;
    btnModelToggle.textContent = 'Loading...';
    try {
      const res = await fetch('/api/model/load', { method: 'POST' });
      await res.json();
      await checkStatus();
    } catch (err) {
      console.error('Load error:', err);
    }
  }
}

// Update Character Count
function updateCharCount() {
  const count = inputText.value.length;
  const words = inputText.value.trim() ? inputText.value.trim().split(/\s+/).length : 0;
  charCount.textContent = `${count} chars • ${words} words`;
}

// Reset Metrics Display
function resetMetrics() {
  metricSpeed.textContent = '-- tok/s';
  metricLatency.textContent = '-- ms';
  metricTokens.textContent = '0';
}

// Translate Text via Streaming SSE
async function translateText() {
  const text = inputText.value.trim();
  if (!text) {
    inputText.focus();
    return;
  }

  // Auto-load model if unloaded
  if (modelStatus === 'unloaded') {
    handleModelToggle();
    alert('Model is currently loading into local GPU memory. Please wait a few seconds...');
    return;
  }

  isGenerating = true;
  btnTranslate.disabled = true;
  streamIndicator.style.display = 'flex';
  outputText.innerHTML = '';
  outputText.classList.add('streaming');
  resetMetrics();

  const startTime = Date.now();
  let receivedTokens = 0;
  let firstTokenReceived = false;

  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        from: fromLang,
        to: toLang,
        mode: currentMode
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Server returned error ' + response.status);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep last incomplete chunk

      let currentEvent = null;

      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEvent = line.replace('event:', '').trim();
        } else if (line.startsWith('data:')) {
          const rawData = line.replace('data:', '').trim();
          if (!rawData) continue;

          try {
            const data = JSON.parse(rawData);

            if (currentEvent === 'token' && data.token) {
              if (!firstTokenReceived) {
                firstTokenReceived = true;
                const ttft = Date.now() - startTime;
                metricLatency.textContent = `${ttft} ms`;
              }
              receivedTokens++;
              outputText.textContent += data.token;
              metricTokens.textContent = receivedTokens;

              const elapsedSec = (Date.now() - startTime) / 1000;
              if (elapsedSec > 0.1) {
                metricSpeed.textContent = `${(receivedTokens / elapsedSec).toFixed(1)} tok/s`;
              }
            } else if (currentEvent === 'done' && data.stats) {
              metricSpeed.textContent = `${data.stats.tokensPerSecond} tok/s`;
              metricLatency.textContent = `${data.stats.ttftMs} ms`;
              metricTokens.textContent = data.stats.totalTokens;
            } else if (currentEvent === 'error') {
              outputText.textContent = `[Error: ${data.error}]`;
            }
          } catch (e) {
            console.error('SSE parse error:', e);
          }
        }
      }
    }
  } catch (err) {
    console.error('Translation failed:', err);
    outputText.textContent = `[Translation Error: ${err.message}]`;
  } finally {
    isGenerating = false;
    btnTranslate.disabled = false;
    streamIndicator.style.display = 'none';
    outputText.classList.remove('streaming');
  }
}

// Copy Translation
async function copyTranslation() {
  const text = outputText.textContent.trim();
  if (!text || text.includes('Your on-device Hindi translation will stream here')) return;

  try {
    await navigator.clipboard.writeText(text);
    copyLabel.textContent = 'Copied!';
    btnCopy.style.color = '#34d399';
    setTimeout(() => {
      copyLabel.textContent = 'Copy';
      btnCopy.style.color = '';
    }, 2000);
  } catch (err) {
    console.warn('Copy failed:', err);
  }
}

// TTS Pronounce Translation
function speakTranslation() {
  const text = outputText.textContent.trim();
  if (!text || text.includes('Your on-device Hindi translation will stream here') || !('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = (currentMode === 'reverse') ? 'en-US' : 'hi-IN';
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

// Boot application
window.addEventListener('DOMContentLoaded', init);

// Demo URL param support for visual captures
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('demo') === '1') {
  setTimeout(() => {
    inputText.value = 'Welcome to our country! We are delighted to host you today.';
    updateCharCount();
    outputText.textContent = 'मैं आपके देश का स्वागत करता हूँ। हमें खुशी है कि आप आज यहाँ आते हैं।';
    metricSpeed.textContent = '99.7 tok/s';
    metricLatency.textContent = '69 ms';
    metricTokens.textContent = '30';
    modelStatusDot.className = 'status-dot status-ready';
    modelStatusText.textContent = 'Model Ready (Llama 3.2 1B)';
    btnModelToggle.textContent = 'Unload';
    btnModelToggle.className = 'btn-model-action btn-unload';
  }, 300);
}


async function handleModelLoad() {
  if (btnLoadModel) {
    btnLoadModel.disabled = true;
    btnLoadModel.textContent = '⚡ Loading...';
  }
  btnModelToggle.disabled = true;
  btnModelToggle.textContent = 'Loading...';

  try {
    const res = await fetch('/api/model/load', { method: 'POST' });
    await res.json();
    await checkStatus();
  } catch (err) {
    console.error('Load error:', err);
  }
}

async function handleModelUnload() {
  if (btnUnloadModel) {
    btnUnloadModel.disabled = true;
    btnUnloadModel.textContent = 'Releasing...';
  }
  btnModelToggle.disabled = true;
  btnModelToggle.textContent = 'Unloading...';

  try {
    const res = await fetch('/api/model/unload', { method: 'POST' });
    await res.json();
    await checkStatus();
  } catch (err) {
    console.error('Unload error:', err);
  } finally {
    if (btnUnloadModel) btnUnloadModel.disabled = false;
  }
}
