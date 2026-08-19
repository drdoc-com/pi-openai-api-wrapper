# pi-openai-api-wrapper

Web endpoint package for the Pi Agent (`pi.dev`), providing full compatibility with the Ollama API (`/api/chat`, `/api/generate`) and the OpenAI Chat Completions API (`/v1/chat/completions`).

## Features

**OpenAI Compatible:**
Exposes `/v1/chat/completions` to integrate Pi seamlessly with existing OpenAI tooling.

**Ollama Compatible:**
Exposes native Ollama endpoints `/api/chat` and `/api/generate` (including basic streaming support via NDJSON).

**Autonomous Sessions:**
Each incoming API request spins up an independent Pi agent session using the specified model.

## Configuration

Set the listening port via environment variable:
```bash
export PI_API_WRAPPER_PORT=8090
```
