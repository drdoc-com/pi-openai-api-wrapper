# pi-openai-api-wrapper

Web endpoint package for the Pi Agent (`pi.dev`), providing full compatibility with the Ollama API and the OpenAI Chat Completions API.

**Description**

The `pi-openai-api-wrapper` package acts as a bridge between standard AI interfaces and the PI Agent (`pi.dev`). By exposing endpoints compatible with the OpenAI Chat Completions API (`/v1/chat/completions`) and the Ollama API (`/api/chat`, `/api/generate`), it enables any modern software supporting these standard protocols (e.g. Dr.DOC DMS/ECM) to seamlessly utilize PI Agent as its AI provider. This setup extends standard language model capabilities by allowing external applications to leverage PI Agents tool execution, custom skills, and package ecosystem for autonomous, multi-step tasks.

**Use Cases**

* **Enhanced Document Indexing in DMS:** Integration into Document Management Systems (e.g. Dr.DOC DMS/ECM) as a custom AI model provider. Incoming documents such as supplier invoices are enriched by retrieving reference data directly from an ERP system via PI Agent packages, enabling automatic validation of prices, quantities, and delivery dates before populating metadata and triggering downstream workflows.
* **Drop-in AI Provider Replacement:** Connecting existing tools, CLI utilities, or IDE extensions designed for OpenAI or Ollama to PI Agent without modifying the host application's codebase.
* **Automated Data Reconciliation & Validation:** Executing complex, multi-system checks where incoming unstructured request data must be verified against internal databases or APIs before returning structured responses to the caller.
* **Agentic Task Delegation via Standard APIs:** Delegating interactive tasks (such as live web browsing, file system manipulations, or custom script executions) from standard chat applications or API clients directly into isolated PI Agent sessions.

## Features

* **OpenAI Compatible:** 
Exposes `/v1/chat/completions` to integrate Pi seamlessly with existing OpenAI tooling.
* **Ollama Compatible:** 
Exposes native Ollama endpoints `/api/chat` and `/api/generate` (including basic streaming support via NDJSON).
* **Autonomous Sessions:** 
Each incoming API request spins up an independent Pi agent session using the specified model.

## Installation

via npm:
```bash
pi install npm:@drdoc-com/pi-openai-api-wrapper
```

or via git:
```bash
pi install git:https://github.com/drdoc-com/pi-openai-api-wrapper
```

## Configuration

Set the listening port via environment variable:
```bash
export PI_API_WRAPPER_PORT=8090
```

Enable Debugging:
```bash
export PI_API_WRAPPER_DEBUG=1
```
