# QVAC Translator — 100% On-Device English ⇄ Hindi AI Studio

> **Private, high-performance, on-device bilingual translation studio powered by Tether's `@qvac/sdk` (v0.19.1) and accelerated via local Vulkan 1.4 GPU offload.**

[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](LICENSE)
[![@qvac/sdk](https://img.shields.io/badge/@qvac/sdk-0.19.1-indigo.svg)](https://www.npmjs.com/package/@qvac/sdk)
[![On-Device](https://img.shields.io/badge/Architecture-100%25%20On--Device%20Local-emerald.svg)](#zero-cloud-architecture)
[![Vulkan](https://img.shields.io/badge/GPU-Vulkan%201.4%20Offload-blue.svg)](#hardware--benchmarks)

---

## 🌟 Overview

**QVAC Translator** is a local, privacy-first translation application specifically engineered for seamless **English to Hindi (and Hindi to English)** language translation. Operating entirely on local hardware, it guarantees that no user text, documents, or queries are ever transmitted to third-party cloud servers.

Built for the **Tether QVAC Hackathon**, this project meets every strict requirement:
- ✅ **Declared Dependency**: `@qvac/sdk >= 0.19.0` explicitly declared in `package.json`.
- ✅ **Native SDK APIs**: Direct invocation of `loadModel`, `translate`, and `completion` from `@qvac/sdk`.
- ✅ **Zero Cloud Verification**: 100% local execution running on `localhost:3001` with local Vulkan GPU acceleration.
- ✅ **Open Source**: Licensed under the MIT License with community attribution (no personal names).
- ✅ **Git History**: Structured with clean, atomic commits demonstrating step-by-step development.

---

## 🎨 Visual Identity & UX Design

Crafted with a dedicated **Royal Indigo & Saffron Amber** design language tailored for Indian linguistic software:
- **Base Surfaces**: Deep Obsidian Slate (`#070a13` / `#0d1322`) with glassmorphism and subtle indigo borders.
- **Accents**: Radiant Saffron Gold (`#f59e0b` / `#fbbf24`) and Electric Indigo (`#6366f1`).
- **Typography**: High-clarity Devanagari script rendering using `Mukta` and `Noto Sans Devanagari`.
- **Dual-Pane Layout**: Side-by-side English input and Hindi output with real-time token streaming, word counts, and latency tracking.

---

## 🚀 Translation Modes

| Mode | Engine | Description |
| :--- | :--- | :--- |
| **Standard NMT** | `@qvac/sdk.translate` | Native on-device neural translation producing natural, fluent Hindi. |
| **Formal / Shuddh** | `@qvac/sdk.completion` | Respectful, literary Shuddh Hindi (शुद्ध और शिष्ट हिन्दी) using proper honorifics. |
| **Conversational Hinglish** | `@qvac/sdk.completion` | Modern colloquial Hindi written in the English / Roman alphabet. |
| **Hindi ➔ English** | `@qvac/sdk.completion` | Bi-directional reverse translation from Hindi back to English. |

---

## 📊 Hardware & Performance Benchmarks

Tested on an **NVIDIA GeForce RTX 4070 (Vulkan 1.4, 24 CPU threads, 32 GB RAM)**:

| Metric | Measured Value |
| :--- | :--- |
| **Model** | `Llama 3.2 1B Instruct (Q4_0)` via QVAC registry |
| **Time to First Token (TTFT)** | **69 ms** |
| **Generation Throughput** | **~99.7 – 115.0 tokens / sec** |
| **Cloud Network Calls** | **0 (Completely Offline)** |
| **Local Memory Footprint** | ~1.2 GB VRAM / System RAM |

---

## 🛠️ Prerequisites

- **Node.js**: Version 18.0.0 or later (`v20+` or `v24+` recommended).
- **OS**: Windows 10/11, macOS, or Linux.
- **Hardware**: GPU with Vulkan 1.4 support (NVIDIA, AMD, Apple Silicon) or modern multi-core CPU.

---

## 📦 SDK Version
This project strictly runs on **@qvac/sdk version 0.19.1** (exceeding the `@qvac/sdk >= 0.19.0` requirement).

---

## ⚡ Install Steps & Run Steps

### Install Steps
```bash
git clone https://github.com/akshatsharmawestup/qvac-translator.git
cd qvac-translator
npm install
```

### Run Steps
```bash
npm start
```
Then open your browser to **`http://localhost:3001`**.

### 4. Open in Browser
Visit **`http://localhost:3001`** in your browser.

1. Click **"Load Model"** in the top-right corner to initialize weights in local memory.
2. Type or paste English text into the source pane (or click one of the preset chips: *Welcome*, *On-Device AI*, *Business*, *Travel*).
3. Click **"Translate Locally"** or press **`Ctrl + Enter`**.
4. Watch Hindi Devanagari text stream smoothly in real time with live hardware metrics.
5. Click **"Listen"** to hear spoken pronunciation via Web Speech TTS or **"Copy"** to save to clipboard.

---

## 📡 API Endpoints

### `GET /api/status`
Returns system diagnostics, loaded model ID, memory consumption, and verification flags:
```json
{
  "status": "online",
  "modelStatus": "ready",
  "currentModelId": "bd4db59fb4120b52",
  "systemInfo": {
    "gpuAcceleration": "Vulkan 1.4 (NVIDIA RTX / Compatible GPU)",
    "runtime": "Node.js v24.18.0",
    "qvacSdkVersion": "0.19.1",
    "zeroCloudVerified": true
  }
}
```

### `POST /api/model/load`
Triggers background loading of the on-device model via `@qvac/sdk.loadModel`.

### `POST /api/model/unload`
Releases VRAM and system memory by calling `@qvac/sdk.unloadModel`.

### `POST /api/translate`
Executes streaming bilingual translation using Server-Sent Events (SSE):
```json
{
  "text": "Welcome to our country! We are delighted to host you today.",
  "from": "en",
  "to": "hi",
  "mode": "standard"
}
```

---

## 🔒 Zero Cloud Architecture

```
┌────────────────────────────────────────────────────────┐
│               LOCAL DEVICE (100% OFFLINE)              │
│                                                        │
│  [Browser: localhost:3001]                             │
│       │ SSE Stream                                     │
│       ▼                                                │
│  [Node.js Express Server: server.js]                   │
│       │                                                │
│       ▼                                                │
│  [@qvac/sdk v0.19.1]                                  │
│       │                                                │
│       ▼                                                │
│  [Bare Runtime / Vulkan 1.4 Offload]                   │
│       │                                                │
│       ▼                                                │
│  [Local GGUF Weights in ~/.qvac/models]                │
│                                                        │
│  🔒 ZERO Cloud Network Calls • ZERO Third-Party APIs   │
└────────────────────────────────────────────────────────┘
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) — see the LICENSE file for details.

Developed with pride by **The QVAC Translator Contributors** for the open-source community.
