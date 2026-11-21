// Run from any directory with Node 22+ and OPENAI_API_KEY in the environment.
import { mkdir, rename, stat, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { narrationLines } from "../js/narration-lines.mjs";
const delivery = {
  en: "Speak in clear, conversational English.",
  es: "Habla en español latinoamericano, con pronunciación clara y natural."
};

async function generate(language, script, file) {
  if (!process.env.OPENAI_API_KEY) throw new Error("Set OPENAI_API_KEY to generate missing recordings.");
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    redirect: "error",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice: "marin",
      input: script,
      instructions: delivery[language] + " Be a friendly museum guide sharing a discovery with one listener. Warm, curious, unhurried. Read only the supplied text.",
      response_format: "mp3"
    }),
    signal: AbortSignal.timeout(90000)
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`OpenAI speech returned ${response.status} (${error.error?.code || response.statusText}).`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!response.headers.get("content-type")?.startsWith("audio/") || !bytes.length) {
    throw new Error("OpenAI returned an empty or unexpected audio response.");
  }
  const part = file + "." + process.pid + ".tmp";
  try {
    await writeFile(part, bytes, { flag: "wx" });
    await rename(part, file);
  } finally {
    await rm(part, { force: true });
  }
}

for (const language of Object.keys(delivery)) {
  const dir = new URL(`../assets/narration/${language}/`, import.meta.url);
  await mkdir(dir, { recursive: true });
  for (const entry of narrationLines) {
    const id = entry.id;
    const file = fileURLToPath(new URL(id + ".mp3", dir));
    const existing = await stat(file).catch(error => {
      if (error.code !== "ENOENT") throw error;
    });
    if (existing?.size > 0) continue;
    try {
      await generate(language, entry[language], file);
      console.log(`Saved ${language}/${id}.mp3`);
    } catch (error) {
      console.error(`${language}/${id}: ${error.message}`);
      process.exit(1);
    }
  }
}
