const labels = {
  en: { listen: "Listen", mute: "Mute", retry: "Retry audio", voice: "AI voice", replay: "Replay this screen’s narration", error: "Audio could not play." },
  es: { listen: "Escuchar", mute: "Silenciar", retry: "Reintentar", voice: "Voz de IA", replay: "Volver a escuchar esta pantalla", error: "No se pudo reproducir el audio." }
};

export function createNarration(toggle, replay, status) {
  const audio = new Audio();
  audio.preload = "none";
  let language, screen, enabled = false, failed = false, attempt = 0;

  function paint() {
    const text = labels[language];
    toggle.querySelector(".voice-action").textContent = failed ? text.retry : enabled ? text.mute : text.listen;
    toggle.querySelector(".voice-label").textContent = text.voice;
    replay.title = text.replay;
    replay.setAttribute("aria-label", text.replay);
    replay.hidden = !enabled;
    status.textContent = failed ? text.error : "";
  }

  function playbackFailed() {
    enabled = false;
    failed = true;
    paint();
  }

  async function play() {
    const currentAttempt = ++attempt;
    const id = String(screen).padStart(2, "0");
    const url = new URL(`../assets/narration/${language}/${id}.mp3`, import.meta.url).href;
    if (audio.src !== url) audio.src = url;
    else if (audio.error) audio.load();
    else audio.currentTime = 0;
    try {
      await audio.play();
    } catch {
      if (currentAttempt === attempt && enabled) playbackFailed();
    }
  }

  audio.addEventListener("error", () => {
    if (enabled && audio.error) playbackFailed();
  });
  toggle.addEventListener("click", () => {
    if (!screen) return;
    enabled = !enabled;
    failed = false;
    if (enabled) play();
    else {
      ++attempt;
      audio.pause();
    }
    paint();
  });
  replay.addEventListener("click", play);

  return {
    setScreen(nextLanguage, nextScreen) {
      if (language === nextLanguage && screen === nextScreen) return;
      language = nextLanguage;
      screen = nextScreen;
      failed = false;
      paint();
      if (enabled) play();
    }
  };
}
