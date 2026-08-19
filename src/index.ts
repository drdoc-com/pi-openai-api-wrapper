import express, { Request, Response } from 'express';
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
//import type { Model } from "@earendil-works/pi-ai";

// Konstanten für den Server
const DEFAULT_PORT = 8090;
const LOG_PREFIX = '[Pi API Extension] ';
//const DEFAULT_MODEL = 'gemma4:e4b';

/**
 * Wandelt Eingaben (z. B. verschachtelte OpenAI-Content-Objekte, Arrays oder Nicht-String-Werte) 
 * sicher in einen String um, um Laufzeitfehler bei String-Methoden zu vermeiden.
 */
function ensureString(input: any): string {
  if (typeof input === 'string') {
    return input;
  }
  if (Array.isArray(input)) {
    return input
      .map((item) => (typeof item === 'string' ? item : item?.text || ''))
      .filter(Boolean)
      .join('\n');
  }
  if (input && typeof input === 'object') {
    return input.text || input.content || JSON.stringify(input);
  }
  return String(input ?? '');
}

/**
 * Extrahiert die letzte Benutzer-Nachricht und garantiert die Rückgabe eines Strings.
 */
function extractLastUserMessage(messages: any[]): string | undefined {
  if (!Array.isArray(messages)) return undefined;
  const lastUserMsg = messages.filter((m) => m.role === 'user').pop();
  if (!lastUserMsg || lastUserMsg.content === undefined) return undefined;

  return ensureString(lastUserMsg.content);
}

async function getTempSession(model) {
  // 2. Pass model object into session creation
  const { session } = await createAgentSession({
    //model: localModel,
    //model: model || DEFAULT_MODEL,
    sessionManager: SessionManager.inMemory()
  });

  // Fallback API-Key für lokale Ollama-Modelle setzen
  //if (session.agent) {
  //    session.agent.getApiKey = () => "ollama";
  //}

  return session;
}

/**
 * Führt den Prompt aus und extrahiert die Antwort sicher. 
 * Wenn prompt() undefined zurückgibt, wird die Antwort aus dem Nachrichtenverlauf gelesen.
 */
async function executeSessionPrompt(session: any, promptText: string): Promise<string> {
  const result = await session.prompt(promptText);

  let resultText = "";
  if (result && typeof result === 'object' && result.text) {
    resultText = result.text;
  } else if (typeof result === 'string') {
    resultText = result;
  } else {
    // Fallback: Letzte Assistant-Nachricht aus der Historie lesen
    const history = typeof session.getMessages === 'function'
      ? session.getMessages()
      : (session.messages || (session.state ? session.state.messages : []));

    if (Array.isArray(history)) {
      const assistantMsgs = history.filter((m: any) => m.role === 'assistant');
      const lastMsg = assistantMsgs.pop();
      if (lastMsg) {
        resultText = lastMsg.content || lastMsg.text || "";
      }
    }
  }

  return ensureString(resultText);
}

/**
 * Pi Extension Entry Point.
 * Der Express-Server mit OpenAI- und Ollama-Kompatibilität wird initialisiert.
 */
export default function (pi: any) {
  const port = process.env.PI_API_WRAPPER_PORT ? parseInt(process.env.PI_API_WRAPPER_PORT, 10) : DEFAULT_PORT;
  const app = express();

  app.use(express.json());



  app.get('/test', async (req: Request, res: Response) => {
    try {
      const { prompt, model, stream } = req.body;

      //if (!prompt || typeof prompt !== 'string') {
      //  return res.status(400).json({ error: 'Es wurde kein gültiger "prompt"-String im Body übergeben.' });
      //}

      return res.json({ hello: "Hello World!" });

    } catch (error) {
      console.error("Ollama Generate Error:", error);
      return res.status(500).json({ error: (error as Error).message || `${LOG_PREFIX}Ein unbekannter Fehler ist aufgetreten.` });
    }
  });

  // ==========================================
  // 1. OpenAI Chat Completions Endpunkt (v1/chat/completions)
  // ==========================================
  app.post('/v1/chat/completions', async (req: Request, res: Response) => {
    try {
      const { messages, model } = req.body;

      // Es muss sichergestellt werden, dass ein String übergeben wird.
      const lastUserMessage = extractLastUserMessage(messages);

      if (!lastUserMessage) {
        return res.status(400).json({
          error: { message: `${LOG_PREFIX}Es wurde keine User-Nachricht im OpenAI-Format übergeben (OpenAI Completion).` }
        });
      }

      const session = await getTempSession(model);

      // Das gesamte Nachrichten-Array wird übergeben, um den Kontext aufrechtzuerhalten.
      // Es wird davon ausgegangen, dass session.prompt dieses Format unterstützt.
      //const result = await session.prompt(lastUserMessage);
      const content = await executeSessionPrompt(session, lastUserMessage);

      // Fallback-Prüfung, falls das Ergebnis ein Objekt mit 'text' oder ein reiner String ist.
      //const content = result?.text !== undefined ? result.text : result;

      return res.json({
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model || 'pi-agent',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: content,
            },
            finish_reason: 'stop',
          },
        ],
      });
    } catch (error) {
      console.error("ChatGPT Completion Error:", error);
      return res.status(500).json({
        error: { message: (error as Error).message || `${LOG_PREFIX}Ein unbekannter Fehler ist aufgetreten (OpenAI Completion).` }
      });
    }
  });

  // ==========================================
  // 2. Ollama /api/chat Endpunkt
  // ==========================================
  app.post('/api/chat', async (req: Request, res: Response) => {
    try {
      const { messages, model, stream } = req.body;

      const lastUserMessage = extractLastUserMessage(messages);

      if (!lastUserMessage) {
        return res.status(400).json({ error: `${LOG_PREFIX}Es wurde keine User-Nachricht im Ollama-Chat-Format übergeben (Ollama Chat).` });
      }

      const session = await getTempSession(model);

      //const result = await session.prompt(lastUserMessage);
      //const resultText = result?.text !== undefined ? result.text : result;
      const resultText = await executeSessionPrompt(session, lastUserMessage);
      const createdAt = new Date().toISOString();

      console.error("Ollama Chat Response:", resultText);

      if (stream) {
        // Da 'await' auf session.prompt() blockiert, steht das finale Ergebnis 
        // bereits fest. Echtes Streaming erfordert einen Async-Generator vom Agenten.
        // Das Ergebnis wird hier als ein einzelner NDJSON-Block zurückgegeben.
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.write(JSON.stringify({
          model: model || 'pi-agent',
          created_at: createdAt,
          message: { role: 'assistant', content: resultText },
          done: true
        }) + '\n');
        return res.end();
      }

      // Standard non-streaming Antwort im Ollama-Stil
      return res.json({
        model: model || 'pi-agent',
        created_at: createdAt,
        message: {
          role: 'assistant',
          content: resultText,
        },
        done: true,
        total_duration: 0,
        load_duration: 0,
        prompt_eval_count: 0,
        eval_count: 0,
      });
    } catch (error) {
      console.error("Ollama Chat Error:", error, req?.body);
      return res.status(500).json({ error: (error as Error).message || `${LOG_PREFIX}Ein unbekannter Fehler ist aufgetreten (Ollama Chat).` });
    }
  });

  // ==========================================
  // 3. Ollama /api/generate Endpunkt
  // ==========================================
  app.post('/api/generate', async (req: Request, res: Response) => {
    try {
      const { prompt, model, stream } = req.body;

      //if (!prompt || typeof prompt !== 'string') {
      //  return res.status(400).json({ error: 'Es wurde kein gültiger "prompt"-String im Body übergeben.' });
      //}
      if (!prompt) {
        return res.status(400).json({ error: `${LOG_PREFIX}Es wurde kein gültiger "prompt" im Body übergeben (Ollama Generate).` });
      }
      const safePrompt = ensureString(prompt);

      const session = await getTempSession(model);

      //const result = await session.prompt(safePrompt); 
      //const resultText = result?.text !== undefined ? result.text : result;
      const resultText = await executeSessionPrompt(session, lastUserMessage);
      const createdAt = new Date().toISOString();

      if (stream) {
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.write(JSON.stringify({
          model: model || 'pi-agent',
          created_at: createdAt,
          response: resultText,
          done: true
        }) + '\n');
        return res.end();
      }

      return res.json({
        model: model || 'pi-agent',
        created_at: createdAt,
        response: resultText,
        done: true,
        total_duration: 0,
        load_duration: 0,
        prompt_eval_count: 0,
        eval_count: 0,
      });
    } catch (error) {
      console.error("Ollama Generate Error:", error, req?.body);
      return res.status(500).json({ error: (error as Error).message || `${LOG_PREFIX}Ein unbekannter Fehler ist aufgetreten (Ollama Generate).` });
    }
  });

  // ==========================================
  // Server-Initialisierung mit Fehlerbehandlung
  // ==========================================
  const server = app.listen(port, () => {
    const startMsg = `Pi API Wrapper (OpenAI & Ollama) läuft erfolgreich auf Port ${port}`;
    if (typeof pi !== 'undefined' && pi.ui && typeof pi.ui.notify === 'function') {
      pi.ui.notify(startMsg);
    } else {
      console.log(`${LOG_PREFIX}${startMsg}`);
    }
  });

  // Abfangen von Verbindungsfehlern (z. B. bereits belegter Port)
  server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      const errorMsg = `Port ${port} ist bereits belegt. Der Server konnte nicht gestartet werden.`;
      if (typeof pi !== 'undefined' && pi.ui && typeof pi.ui.notify === 'function') {
        pi.ui.notify(errorMsg);
      } else {
        console.error(`${LOG_PREFIX}${errorMsg}`);
      }
    } else {
      console.error(`${LOG_PREFIX}Unerwarteter Serverfehler:`, error);
    }
  });
}
