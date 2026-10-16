/**
 * TTS și înregistrare strict pe dispozitiv.
 * Nu folosim speech recognition / TTS online. Evităm vocile localService=false/undefined.
 */
let activeRecorder = null;
let activeStream = null;
let playbackUrl = null;

export function frenchVoices() {
  if (!("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices().filter(v =>
    v.localService === true && v.lang?.replace("_", "-").toLowerCase() === "fr-fr"
  );
}
export function speakFrench(text) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    return { ok: false, message: "Sinteza vocală nu este disponibilă în acest browser." };
  }
  const voice = frenchVoices()[0];
  if (!voice) return { ok: false, message: "Instalează o voce franceză (Franța) locală în sistem. Nu folosim voci de pe server." };
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(String(text));
  utterance.lang = "fr-FR";
  utterance.voice = voice;
  utterance.rate = 0.88;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
  return { ok: true, message: voice.name };
}
export function recordingAvailable() {
  return !!(window.MediaRecorder && navigator.mediaDevices?.getUserMedia);
}
export async function startRecording(onStop) {
  if (!recordingAvailable()) throw new Error("Microfonul local nu este disponibil. Verifică permisiunile și HTTPS.");
  if (activeRecorder) throw new Error("Există deja o înregistrare în curs.");
  activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  try {
    activeRecorder = new MediaRecorder(activeStream);
    const recorded = [];
    activeRecorder.addEventListener("dataavailable", e => { if (e.data.size) recorded.push(e.data); });
    activeRecorder.addEventListener("stop", () => {
      if (playbackUrl) URL.revokeObjectURL(playbackUrl);
      playbackUrl = URL.createObjectURL(new Blob(recorded, { type: activeRecorder?.mimeType || "audio/webm" }));
      const result = playbackUrl;
      activeStream?.getTracks().forEach(track => track.stop());
      activeRecorder = null;
      activeStream = null;
      onStop(result);
    }, { once: true });
    activeRecorder.start();
    return true;
  } catch (error) {
    activeStream?.getTracks().forEach(track => track.stop());
    activeStream = null;
    activeRecorder = null;
    throw error;
  }
}
export function stopRecording() {
  if (activeRecorder?.state === "recording") {
    activeRecorder.stop();
    return true;
  }
  return false;
}
export function cleanupRecording() {
  stopRecording();
  // URL-ul rămâne valid până la noua înregistrare/închiderea paginii.
}
