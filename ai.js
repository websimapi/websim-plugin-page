/* AI helper module
   Uses global `websim` APIs described in the runtime:
   - websim.chat.completions.create({ messages, ... })
   - websim.imageGen({...})
   - websim.textToSpeech({...})
*/
export async function handleInstruction(request){
  const { id, type, prompt, options = {}, sourceOrigin } = request;

  // Normalize prompt into messages for chat if needed
  const messages = [
    { role: "system", content: "You are an assistant that receives structured JSON instructions and must return a JSON payload with the generated content and metadata." },
    { role: "user", content: `Instruction: type=${type}\nPrompt: ${prompt}\nOptions: ${JSON.stringify(options)}` }
  ];

  try {
    if (type === "text") {
      // Use chat completion to generate text
      const completion = await websim.chat.completions.create({
        messages,
        // pass any simple options through (temperature, max_tokens)
        temperature: options.temperature ?? 0.2,
        max_tokens: options.max_tokens ?? 400
      });
      const text = completion.content;
      return { id, type, text, meta: { modelResponse: true } };

    } else if (type === "image") {
      // Image generation
      const imgResult = await websim.imageGen({
        prompt,
        width: options.width,
        height: options.height,
        aspect_ratio: options.aspect_ratio
      });
      return { id, type, image: { url: imgResult.url }, meta: { provider: "websim.imageGen" } };

    } else if (type === "tts" || type === "speech") {
      // TTS
      // first get text via chat (so we can convert dynamic prompts)
      const comp = await websim.chat.completions.create({ messages, temperature: 0.2, max_tokens: options.max_tokens ?? 200 });
      const text = comp.content;
      const tts = await websim.textToSpeech({ text, voice: options.voice ?? "en-male" });
      return { id, type: "tts", text, audio: { url: tts.url }, meta: { voice: options.voice ?? "en-male" } };

    } else {
      return { id, error: "unsupported_type", message: `Type '${type}' is not supported.` };
    }
  } catch (err) {
    return { id, error: true, message: err?.message ?? String(err) };
  }
}

/* ...existing code... */

