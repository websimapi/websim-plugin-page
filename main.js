import { nanoid } from "nanoid";

import { handleInstruction } from "./ai.js";

/* ...existing code... */
// minimal boot
const logEl = document.getElementById("log");
function log(message, meta){
  const el = document.createElement("div");
  el.className = "entry";
  el.innerHTML = `<div class="meta">${meta ?? new Date().toLocaleTimeString()}</div><div class="msg">${escapeHtml(JSON.stringify(message,null,2))}</div>`;
  logEl.prepend(el);
  console.log("AI Bridge:", message, meta);
}

function escapeHtml(s){
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

/*
Inbound postMessage handler
Expected incoming message structure (JSON):
{
  id?: string,                    // optional client id for correlation
  action: "generate",             // currently supported action
  type: "text"|"image"|"tts",     // requested generation type
  prompt: string,                 // main instruction
  options?: object                // optional extra options passed to AI
}
*/
window.addEventListener("message", async (ev) => {
  try {
    // Optionally restrict origin: if (ev.origin !== "https://trusted.origin") return;
    const data = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
    if (!data || data.action !== "generate" || !data.type || !data.prompt) {
      // ignore unrelated messages
      return;
    }

    const id = data.id || nanoid();
    log({ incoming: data }, `recv ${id} from ${ev.origin}`);

    // acknowledge
    postResponse({ id, status: "received", note: "Processing started" }, ev.source, ev.origin);

    // let AI handler process and return result
    postResponse({ id, status: "progress", stage: "ai_call" }, ev.source, ev.origin);
    const result = await handleInstruction({ id, ...data, sourceOrigin: ev.origin });

    // final response
    postResponse({ id, status: "done", result }, ev.source, ev.origin);
    log({ outgoing: result }, `sent ${id} to ${ev.origin}`);

  } catch (err) {
    console.error(err);
  }
});

/*
Helper to send outbound messages.
If embedded in iframe, parent is the host. If not, try window.opener else console.
*/
function postResponse(payload, target = null, targetOrigin = "*"){
  const message = { __ai_bridge: true, ...payload };
  if (target && typeof target.postMessage === "function") {
    target.postMessage(message, targetOrigin);
  } else if (window.parent && window.parent !== window) {
    window.parent.postMessage(message, targetOrigin);
  } else if (window.opener) {
    window.opener.postMessage(message, targetOrigin);
  } else {
    // top-level page with no partner; still log
    console.info("postResponse (no target):", message);
  }
}

/* Test UI for manual sending when embedded */
document.getElementById("sendTest").addEventListener("click", async () => {
  const type = document.getElementById("testType").value;
  const prompt = document.getElementById("testPrompt").value;
  const id = nanoid();
  const payload = { id, action: "generate", type, prompt, options: {} };
  log({ test_sent: payload }, "test");
  // send to parent/opener
  postResponse({ id, status: "test-sent", payload }, null, "*");
  // Also simulate inbound message locally to show flow (use window to trigger our listener)
  window.postMessage(payload, "*");
});

/* ...existing code... */

