import { narrationLines } from "./narration-lines.mjs";

const labels = {
  en: { credit: "AI-narrated tour", start: "Press Start for the narrated tour", blocked: "Tap to hear the narration", error: "Narration couldn’t load. Tap to retry." },
  es: { credit: "Guía con voz de IA", start: "Pulsa Empezar para oír la guía", blocked: "Toca para escuchar la guía", error: "No se pudo cargar la voz. Toca para reintentar." }
};

export function createNarration(status) {
  // Reusing the element retains the playback permission granted by Start on iOS.
  const audio = new Audio();
  audio.preload = "auto";
  let language, screen, phase = "idle", attempt = 0, afterIntro;

  function setPhase(next) {
    phase = next;
    const copy = labels[language];
    if (!copy) return;
    const message = phase === "error" ? copy.error
      : phase === "blocked" ? (screen === 1 ? copy.start : copy.blocked)
      : screen === 1 ? copy.credit : "";
    if (status.textContent !== message) status.textContent = message;
  }

  async function play() {
    const request = ++attempt;
    setPhase("starting");
    try {
      await audio.play();
      if (request === attempt) setPhase("playing");
    } catch (err) {
      if (request !== attempt) return;
      setPhase(err.name === "NotAllowedError" ? "blocked" : "error");
    }
  }

  function retry() {
    if (phase !== "error" && phase !== "blocked") return;
    if (audio.error) audio.load();
    play();
  }
  document.addEventListener("click", retry);
  document.addEventListener("keyup", retry);
  audio.addEventListener("error", () => { if (audio.error) setPhase("error"); });
  audio.addEventListener("ended", () => {
    if (!audio.ended) return;
    setPhase("ended");
    const advance = afterIntro;
    afterIntro = undefined;
    advance?.();
  });

  return {
    total: narrationLines.length,
    get waitingForEnd() { return phase !== "ended" && phase !== "error"; },
    setScreen(nextLanguage, nextScreen) {
      if (language === nextLanguage && screen === nextScreen) return;
      const recording = narrationLines[nextScreen - 1];
      language = nextLanguage;
      screen = nextScreen;
      afterIntro = undefined;
      audio.src = new URL(`../assets/narration/${language}/${recording.id}.mp3`, import.meta.url).href;
      play();
    },
    startIntro(advance) {
      // Browsers that require a gesture get their first audible play in this
      // click. Finish the introduction and take that same Start press forward.
      if (afterIntro) return;
      if (phase === "blocked" || phase === "error" || (phase === "starting" && audio.paused)) {
        afterIntro = advance;
        if (audio.error) audio.load();
        play();
      } else {
        advance();
      }
    }
  };
}
