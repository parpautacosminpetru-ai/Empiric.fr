import { emptyDoc } from "./engine.js";
const KEY = "empiric.fr:library:v1";
export function loadLibrary() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "null");
    if (value?.version === 1 && Array.isArray(value.documents)) {
      const documents = value.documents.filter(d => d && typeof d.id === "string" && typeof d.text === "string").slice(0, 80);
      return { documents, activeId: documents.some(d => d.id === value.activeId) ? value.activeId : (documents[0]?.id ?? null) };
    }
  } catch { /* format vechi sau date inaccesibile */ }
  return { documents: [], activeId: null };
}
export function saveLibrary(library) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, documents: library.documents, activeId: library.activeId }));
    return true;
  } catch { return false; }
}
export function insertText(library, text) {
  const clean = String(text ?? "").trim();
  if (!clean) throw new Error("Introdu un text în limba franceză.");
  if (clean.length > 16000) throw new Error("Pentru moment, limitează textul la 16.000 de caractere.");
  const id = "text-" + Date.now() + "-" + Math.floor(Math.random() * 100000);
  const doc = emptyDoc(clean, id);
  library.documents.unshift(doc);
  library.activeId = id;
  if (library.documents.length > 80) library.documents.length = 80;
  return doc;
}
