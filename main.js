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
    // Normalize incoming payload: accept raw JSON string, object, or wrapped {__ai_bridge:...}
    const raw = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
    const data = raw && raw.__ai_bridge ? raw : raw;
    if (!data || data.action !== "generate" || !data.type || !data.prompt) {
      return;
    }

    const id = data.id || nanoid();
    log({ incoming: data }, `recv ${id} from ${ev.origin}`);

    // determine best reply target: prefer ev.source (the window that sent the message), fallback to parent/opener
    const replyTarget = (ev.source && typeof ev.source.postMessage === "function")
      ? ev.source
      : (window.parent && window.parent !== window ? window.parent : (window.opener || null));
    const replyOrigin = ev.origin || "*";

    // acknowledge
    postResponse({ id, status: "received", note: "Processing started" }, replyTarget, replyOrigin);

    // let AI handler process and return result
    postResponse({ id, status: "progress", stage: "ai_call" }, replyTarget, replyOrigin);
    const result = await handleInstruction({ id, ...data, sourceOrigin: ev.origin });

    // final response
    postResponse({ id, status: "done", result }, replyTarget, replyOrigin);
    log({ outgoing: result }, `sent ${id} to ${replyOrigin}`);

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
  // determine fallback target if none supplied
  const finalTarget = target && typeof target.postMessage === "function"
    ? target
    : (window.parent && window.parent !== window ? window.parent : (window.opener || null));
  if (finalTarget && typeof finalTarget.postMessage === "function") {
    finalTarget.postMessage(message, targetOrigin ?? "*");
  } else {
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