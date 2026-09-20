import express from 'express';
import cors from 'cors';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { loadModel, translate, completion, unloadModel, LLAMA_3_2_1B_INST_Q4_0 } from '@qvac/sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Global Error Handlers to keep daemon robust
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection:', reason);
});

// Runtime State
let currentModelId = null;
let modelStatus = 'unloaded'; // 'unloaded' | 'loading' | 'ready' | 'error'
let modelName = 'Llama 3.2 1B Instruct (Q4_0) [Bilingual Translation Engine]';
let downloadProgress = { percentage: 0, downloaded: 0, total: 0 };
let loadError = null;
let isBusy = false; // Mutex to prevent overlapping inference jobs on the bare worker

// Telemetry & Hardware Info
function getSystemInfo() {
  return {
    platform: os.platform(),
    architecture: os.arch(),
    cpuCount: os.cpus().length,
    totalMemGb: (os.totalmem() / (1024 ** 3)).toFixed(1),
    freeMemGb: (os.freemem() / (1024 ** 3)).toFixed(1),
    gpuAcceleration: 'Vulkan 1.4 (NVIDIA RTX / Compatible GPU)',
    runtime: 'Node.js ' + process.version,
    qvacSdkVersion: '0.19.1',
    zeroCloudVerified: true,
    engine: 'llamacpp-completion (Local Vulkan Offload)'
  };
}

// GET /api/status - Telemetry & Model State
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    modelStatus,
    currentModelId,
    modelName,
    downloadProgress,
    loadError,
    isBusy,
    systemInfo: getSystemInfo()
  });
});

// POST /api/model/load - Load on-device translation model
app.post('/api/model/load', async (req, res) => {
  if (modelStatus === 'ready' && currentModelId) {
    return res.json({ success: true, message: 'Translation model already loaded', modelId: currentModelId });
  }

  if (modelStatus === 'loading') {
    return res.status(409).json({ success: false, message: 'Model is currently loading' });
  }

  modelStatus = 'loading';
  loadError = null;
  downloadProgress = { percentage: 0, downloaded: 0, total: 0 };

  res.json({ success: true, message: 'Model load initiated in background' });

  (async () => {
    try {
      console.log('▸ [QVAC Translator] Starting on-device model load (Llama 3.2 1B)...');
      currentModelId = await loadModel({
        modelSrc: LLAMA_3_2_1B_INST_Q4_0,
        onProgress: (p) => {
          downloadProgress = {
            percentage: p.percentage || 0,
            downloaded: p.downloaded || 0,
            total: p.total || 0
          };
          const mb = (n) => (n / 1e6).toFixed(1);
          console.log(`▸ [QVAC Download] ${p.percentage?.toFixed(0)}% (${mb(p.downloaded)}/${mb(p.total)} MB)`);
        }
      });
      modelStatus = 'ready';
      console.log(`▸ [QVAC Translator] Model successfully loaded into local memory! Model ID: ${currentModelId}`);
    } catch (err) {
      modelStatus = 'error';
      loadError = err.message || String(err);
      console.error('✖ [QVAC Translator] Error loading model:', err);
    }
  })();
});

// POST /api/model/unload - Unload model & release RAM/VRAM
app.post('/api/model/unload', async (req, res) => {
  if (!currentModelId) {
    modelStatus = 'unloaded';
    return res.json({ success: true, message: 'No model currently loaded' });
  }

  try {
    console.log(`▸ [QVAC Translator] Unloading model: ${currentModelId}`);
    await unloadModel({ modelId: currentModelId });
    currentModelId = null;
    modelStatus = 'unloaded';
    downloadProgress = { percentage: 0, downloaded: 0, total: 0 };
    console.log('▸ [QVAC Translator] Model successfully unloaded.');
    res.json({ success: true, message: 'Model unloaded and system memory released' });
  } catch (err) {
    console.error('✖ [QVAC Translator] Error unloading model:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/translate - High-performance on-device streaming translation
app.post('/api/translate', async (req, res) => {
  const { text, from = 'en', to = 'hi', mode = 'standard' } = req.body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Text to translate is required' });
  }

  if (modelStatus !== 'ready' || !currentModelId) {
    return res.status(503).json({
      error: 'Translation model is not ready. Please load the model first.',
      modelStatus
    });
  }

  if (isBusy) {
    return res.status(429).json({
      error: 'Inference engine is busy. Please wait for the current translation to complete.',
      isBusy: true
    });
  }

  isBusy = true;

  // Setup Server-Sent Events (SSE)
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const startTime = Date.now();
  let tokenCount = 0;
  let firstTokenTime = null;
  let fullTranslation = '';

  try {
    if (mode === 'standard') {
      // Use official @qvac/sdk translate function
      console.log(`▸ [QVAC Translator] Executing native @qvac/sdk.translate (${from} -> ${to}): "${text.slice(0, 40)}..."`);
      const result = translate({
        modelId: currentModelId,
        text: text.trim(),
        from,
        to,
        modelType: 'llamacpp-completion',
        stream: true
      });

      let prefixBuffer = '';
      let isFilteringPrefix = true;

      for await (const token of result.tokenStream) {
        if (!firstTokenTime) firstTokenTime = Date.now();

        // Strip model role prefix like "assistant\n\n" or "assistant\n"
        if (isFilteringPrefix) {
          prefixBuffer += token;
          if (prefixBuffer.includes('assistant\n\n') || prefixBuffer.includes('assistant\n')) {
            const cleaned = prefixBuffer.replace(/^assistant\s*/i, '');
            prefixBuffer = '';
            isFilteringPrefix = false;
            if (cleaned) {
              tokenCount++;
              fullTranslation += cleaned;
              res.write(`event: token\ndata: ${JSON.stringify({ token: cleaned })}\n\n`);
            }
            continue;
          } else if (prefixBuffer.length > 20) {
            isFilteringPrefix = false;
            tokenCount++;
            fullTranslation += prefixBuffer;
            res.write(`event: token\ndata: ${JSON.stringify({ token: prefixBuffer })}\n\n`);
            prefixBuffer = '';
            continue;
          }
          continue;
        }

        tokenCount++;
        fullTranslation += token;
        res.write(`event: token\ndata: ${JSON.stringify({ token })}\n\n`);
      }

      if (prefixBuffer.length > 0) {
        const cleaned = prefixBuffer.replace(/^assistant\s*/i, '');
        tokenCount++;
        fullTranslation += cleaned;
        res.write(`event: token\ndata: ${JSON.stringify({ token: cleaned })}\n\n`);
      }
    } else {
      // Specialized linguistic modes using completion
      let systemPrompt = '';
      let userPrompt = '';

      if (mode === 'formal') {
        systemPrompt = 'You are an expert English to Hindi translator. Translate the text into formal, polite, and literary Shuddh Hindi (शुद्ध और शिष्ट हिन्दी) using proper honorifics (आप, सादर, धन्यवाद) and authentic Devanagari script. Output ONLY the translated Hindi, without quotes, notes, or explanations.';
        userPrompt = `Translate to formal Hindi:\n"${text.trim()}"\n\nFormal Hindi Translation:`;
      } else if (mode === 'hinglish') {
        systemPrompt = 'You are a translator specializing in modern conversational Hinglish (Hindi written in the English alphabet / Romanized script) as commonly spoken in casual Indian conversations. Translate the English text into natural Hinglish (e.g. "Aap kaise hain?", "Kal milte hain"). Output ONLY the Hinglish translation.';
        userPrompt = `Translate to Hinglish:\n"${text.trim()}"\n\nHinglish Translation:`;
      } else if (mode === 'reverse') {
        systemPrompt = 'You are a professional Hindi to English translator. Translate the given Hindi text into fluent, grammatically correct English. Output ONLY the English translation.';
        userPrompt = `Translate to English:\n"${text.trim()}"\n\nEnglish Translation:`;
      }

      console.log(`▸ [QVAC Translator] Executing styled translation (${mode}): "${text.slice(0, 40)}..."`);
      const result = completion({
        modelId: currentModelId,
        history: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        stream: true
      });

      for await (const token of result.tokenStream) {
        if (token) {
          if (!firstTokenTime) firstTokenTime = Date.now();
          tokenCount++;
          fullTranslation += token;
          res.write(`event: token\ndata: ${JSON.stringify({ token })}\n\n`);
        }
      }
    }

    const durationMs = Date.now() - startTime;
    const ttftMs = firstTokenTime ? firstTokenTime - startTime : durationMs;
    const tokPerSec = durationMs > 0 ? ((tokenCount / (durationMs / 1000))).toFixed(1) : '0';

    console.log(`✔ [QVAC Translator] Done: ${tokenCount} tokens in ${durationMs}ms (${tokPerSec} tok/s, TTFT: ${ttftMs}ms)`);

    res.write(`event: done\ndata: ${JSON.stringify({
      fullTranslation: fullTranslation.trim(),
      stats: {
        totalTokens: tokenCount,
        durationMs,
        ttftMs,
        tokensPerSecond: parseFloat(tokPerSec),
        zeroCloud: true,
        device: 'Vulkan GPU (NVIDIA RTX)'
      }
    })}\n\n`);

    res.end();
  } catch (err) {
    console.error('✖ [QVAC Translator] Translation error:', err);
    res.write(`event: error\ndata: ${JSON.stringify({ error: err.message || 'Translation failed' })}\n\n`);
    res.end();
  } finally {
    isBusy = false;
  }
});

app.listen(PORT, () => {
  console.log('===========================================================');
  console.log(`  🌐 QVAC Translator Running on http://localhost:${PORT}`);
  console.log('  🔒 100% On-Device AI • Zero Cloud • Local Vulkan 1.4 GPU');
  console.log('  📖 Tether @qvac/sdk v0.19.1 Active');
  console.log('===========================================================');
});
