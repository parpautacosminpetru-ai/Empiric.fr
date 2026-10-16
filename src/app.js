import {
  SAMPLE, tokens, targets, contextFor, maskedContext, wordInfo,
  grammarChallenge, newContextCheck, spellingCorrect, syntaxWords,
  shuffledIndices, syntaxCorrect, wordStages, firstOpenStage, progressFor, normalize
} from "./engine.js";
import { loadLibrary, saveLibrary, insertText } from "./storage.js";
import { frenchVoices, speakFrench, recordingAvailable, startRecording, stopRecording, cleanupRecording } from "./audio.js";

const $ = id => document.getElementById(id);
const library = loadLibrary();
let selectedKey = null;
let selectedTab = "reader";
let sentenceIndices = [];
let syntaxMessage = "";
let pictureUrl = null;
let deferredInstall = null;
let alertTimeout = null;

function activeDoc() { return library.documents.find(d => d.id === library.activeId) ?? null; }
function safely(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
}
function notify(message, error = false) {
  const n = $("notification");
  n.textContent = message;
  n.className = "toast" + (error ? " error" : "");
  n.hidden = false;
  clearTimeout(alertTimeout);
  alertTimeout = setTimeout(() => { n.hidden = true; }, 5800);
}
function notice(message, error = false) {
  const node = $("importNotice");
  node.textContent = message;
  node.classList.toggle("error", error);
}
function save() {
  if (!saveLibrary(library)) notify("Spațiul local este plin sau browserul blochează salvarea. Progresul nu este garantat.", true);
}
function firstPending(doc) {
  return targets(doc.text).find(w => firstOpenStage(doc, w.form) !== null)?.key ?? null;
}
function ensureSelection(doc) {
  const all = targets(doc.text);
  if (!all.some(w => w.key === selectedKey)) selectedKey = firstPending(doc) ?? all[0]?.key ?? null;
}
function activeWord(doc) { return targets(doc.text).find(w => w.key === selectedKey) ?? null; }
function setTab(tab) {
  if (!["reader", "practice", "syntax", "progress"].includes(tab)) return;
  selectedTab = tab;
  document.querySelectorAll(".tab").forEach(button => {
    const active = button.dataset.tab === tab;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  ["reader", "practice", "syntax", "progress"].forEach(name => { $("tab-" + name).hidden = name !== tab; });
}
function beginText(text) {
  const active = activeDoc();
  if (active && !progressFor(active).complete) {
    notice("Textul curent nu este încheiat. Aplică toate cuvintele și reconstruiește sintaxa, sau șterge-l din «Acoperire».", true);
    setTab("progress");
    notify("Mai întâi finalizează textul curent. Progresul tău rămâne salvat.", true);
    return;
  }
  try {
    const doc = insertText(library, text);
    selectedKey = firstPending(doc);
    sentenceIndices = [];
    syntaxMessage = "";
    save();
    setTab("reader");
    render();
    notice("Text transformat în elemente interactive. Fără apeluri către server.");
    $("sourceInput").value = "";
  } catch (error) {
    notice(error.message, true);
  }
}
function markStage(phase) {
  const doc = activeDoc();
  if (!doc || !selectedKey) return;
  if (!doc.completion) doc.completion = {};
  if (!doc.completion[selectedKey]) doc.completion[selectedKey] = {};
  doc.completion[selectedKey][phase] = true;
  save();
  render();
  if (progressFor(doc).complete) notify("Text complet parcurs! Ai bifat toate exercițiile definite în această versiune.");
}
function updateHeading(doc) {
  const pct = doc ? progressFor(doc).percentage : 0;
  if (doc) {
    $("documentTitle").textContent = doc.text.replace(/\s+/g, " ").slice(0, 62) + (doc.text.length > 62 ? "…" : "");
    $("documentSubtitle").textContent = targets(doc.text).length + " forme lexicale distincte · " + tokens(doc.text).length + " apariții în text";
    const current = progressFor(doc);
    $("completionMessage").textContent = current.complete
      ? "Parcursul de exerciții este complet. Poți importa un text nou."
      : current.mastered + " din " + current.words + " forme au parcurs toate provocările. Un text nou rămâne blocat până la completare.";
  } else {
    $("documentTitle").textContent = "Începe de la un text.";
    $("documentSubtitle").textContent = "Vocabularul, sintaxa, scrisul și vocea se lucrează împreună.";
    $("completionMessage").textContent = "Alege un text pentru a începe.";
  }
  $("progressPercent").textContent = pct + "%";
  $("progressRing").style.background = "conic-gradient(#a8cf4e 0 " + pct + "%, #dde6d6 " + pct + "% 100%)";
  $("progressRing").setAttribute("aria-label", "Progres: " + pct + " la sută");
  $("progressFill").style.width = pct + "%";
}
function renderLibrary() {
  const list = $("documentList");
  list.replaceChildren();
  $("documentCount").textContent = String(library.documents.length);
  if (!library.documents.length) {
    list.innerHTML = '<p class="muted">Niciun text încă.</p>';
    return;
  }
  for (const doc of library.documents) {
    const pct = progressFor(doc).percentage;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "document-item" + (library.activeId === doc.id ? " selected" : "");
    button.innerHTML = '<span><span class="excerpt">' + safely(doc.text.replace(/\s+/g, " ").slice(0, 77)) + '…</span><span class="doc-meta">' + new Date(doc.createdAt).toLocaleDateString("ro-RO") + '</span></span><span class="doc-pct">' + pct + '%</span>';
    button.addEventListener("click", () => {
      if (doc.id === library.activeId) return;
      const active = activeDoc();
      if (active && !progressFor(active).complete) {
        notify("Finalizează textul curent înainte să deschizi alt text, sau șterge-l.", true);
        setTab("progress");
        return;
      }
      cleanupRecording();
      library.activeId = doc.id;
      selectedKey = null;
      sentenceIndices = [];
      syntaxMessage = "";
      save();
      render();
      setTab("reader");
    });
    list.append(button);
  }
}
function renderReader(doc) {
  const passage = $("passage");
  passage.replaceChildren();
  if (!doc) {
    passage.textContent = "Lipește un text în stânga sau încearcă exemplul.";
    $("readingStats").textContent = "Selectează fiecare cuvânt pentru a-l folosi activ.";
    return;
  }
  let cursor = 0;
  for (const token of tokens(doc.text)) {
    passage.append(document.createTextNode(doc.text.slice(cursor, token.start)));
    const button = document.createElement("button");
    button.type = "button";
    button.className = "word-token";
    button.textContent = token.form;
    button.setAttribute("lang", "fr");
    button.setAttribute("aria-label", "Explorează «" + token.form + "»");
    button.setAttribute("aria-pressed", String(token.key === selectedKey));
    if (token.key === selectedKey) button.classList.add("focused");
    if (firstOpenStage(doc, token.form) === null) button.classList.add("mastered");
    button.addEventListener("click", () => selectWord(token.key));
    passage.append(button);
    cursor = token.end;
  }
  passage.append(document.createTextNode(doc.text.slice(cursor)));
  $("readingStats").textContent = "Toate cuvintele sunt accesibile, inclusiv cele gramaticale. Verde = toate provocările definite au fost bifate.";
}
function selectWord(key, jump = false) {
  selectedKey = normalize(key);
  const doc = activeDoc();
  if (!doc) return;
  renderReader(doc);
  renderInspector(doc);
  renderChallenge(doc);
  updateNext(doc);
  if (jump) setTab("practice");
}
function renderInspector(doc) {
  const box = $("wordInspector");
  if (!doc) {
    box.innerHTML = '<h2>Un cuvânt, posibilități nelimitate.</h2><p class="muted">Atinge un cuvânt din text. Exercițiile îl vor transfera în alte contexte.</p>';
    return;
  }
  const word = activeWord(doc);
  if (!word) return;
  const info = wordInfo(word.form);
  const gloss = doc.glosses?.[word.key] ?? "";
  const mastered = firstOpenStage(doc, word.form) === null;
  box.innerHTML =
    '<div class="word-feature"><strong lang="fr">' + safely(word.form) + '</strong><span class="feature-pill">' + word.count + ' apariție/apariții</span><span class="feature-pill">' + (mastered ? 'Provocări bifate' : 'În lucru') + '</span></div>' +
    '<div class="discover-row"><button id="listenWord" class="button button-ghost">♫ Pronunță fr-FR</button><button id="openWordPractice" class="button button-primary">Folosește acum →</button><button id="revealInfo" class="button button-ghost" aria-expanded="false">Indiciu facultativ</button></div>' +
    '<div id="wordHint" hidden><dl class="info-list"><dt>Categorie în minilexicon</dt><dd>' + safely(info.category) + '</dd><dt>Formă și relații</dt><dd>' + safely(info.details) + '</dd><dt>Sens orientativ, numai dacă există în minilexicon</dt><dd>' + safely(info.meaning) + '</dd><dt>Acoperire</dt><dd>' + safely(info.source) + '</dd></dl></div>' +
    '<div class="label-line">Sens descoperit de mine (opțional)</div>' +
    '<div class="mini-form"><input type="text" id="myGloss" maxlength="220" value="' + safely(gloss) + '" placeholder="Notează un sens, fără să memorezi o listă."><button id="saveGloss" class="button button-ghost">Păstrează</button></div>' +
    '<p class="muted small">Aplicația nu inventează definiții pentru cuvintele pe care încă nu le poate analiza sigur.</p>';
  $("listenWord").addEventListener("click", () => speakOrWarn(word.form));
  $("openWordPractice").addEventListener("click", () => setTab("practice"));
  $("revealInfo").addEventListener("click", () => {
    $("wordHint").hidden = !$("wordHint").hidden;
    $("revealInfo").setAttribute("aria-expanded", String(!$("wordHint").hidden));
  });
  $("saveGloss").addEventListener("click", () => {
    if (!doc.glosses) doc.glosses = {};
    doc.glosses[word.key] = $("myGloss").value.trim();
    save();
    notify("Sensul tău a fost păstrat local.");
  });
}
function feedback(message, error = false, warning = false) {
  const field = $("taskFeedback");
  if (!field) return;
  field.textContent = message;
  field.hidden = false;
  field.className = "feedback" + (error ? " error" : warning ? " warning" : "");
}
function renderChallenge(doc) {
  const panel = $("challenge");
  if (!doc) {
    panel.innerHTML = "<h2>Importă un text pentru a începe provocările.</h2>";
    return;
  }
  const word = activeWord(doc);
  if (!word) { panel.textContent = "Textul nu conține cuvinte de exersat."; return; }
  const stages = wordStages(word.form);
  const completed = doc.completion?.[word.key] ?? {};
  const phase = firstOpenStage(doc, word.form);
  const labels = { spell: "Scriere", grammar: "Transformare", transfer: "Context nou", oral: "Vorbire" };
  let html = '<div class="task-step">' + stages.map(stage =>
    '<span class="step-mark ' + (completed[stage] ? 'done' : stage === phase ? 'current' : '') + '">' +
    (completed[stage] ? '✓ ' : '') + labels[stage] + '</span>'
  ).join("") + '</div>';
  html += '<div class="challenge-word" lang="fr">' + safely(word.form) + '</div>';
  if (phase === null) {
    panel.innerHTML = html + '<h2>Ai parcurs toate provocările pentru această formă.</h2><p class="muted">Poți reveni la text sau continua cu o altă formă lexicală.</p><div class="button-row"><button id="practiceNext" class="button button-primary">Următorul cuvânt →</button></div>';
    $("practiceNext").addEventListener("click", nextWord);
    return;
  }
  if (phase === "spell") {
    html += '<h2>Recunoaște forma în context și scrie-o.</h2>' +
      '<div class="challenge-prompt" lang="fr">' + safely(maskedContext(doc.text, word.key)) + '</div>' +
      '<div class="challenge-form"><input id="spellInput" type="text" lang="fr" spellcheck="false" autocomplete="off" aria-label="Cuvântul lipsă" placeholder="Cuvântul lipsă…"><button id="checkSpelling" class="button button-primary">Verifică forma</button></div>' +
      '<div class="task-actions"><button id="spellingHint" class="button button-ghost">Un indiciu</button><button id="spellAudio" class="button button-ghost">♫ Ascultă cuvântul</button></div><p id="taskFeedback" class="feedback" hidden></p>' +
      '<p class="prompt-footnote">Diacriticele și accentele franceze contează. Nu memorăm o listă izolată: reconstruim forma văzută într-un context.</p>';
    panel.innerHTML = html;
    const check = () => {
      if (spellingCorrect($("spellInput").value, word.form)) markStage("spell");
      else feedback("Nu este exact forma originală. Verifică accentele și ortografia.", true);
    };
    $("checkSpelling").addEventListener("click", check);
    $("spellInput").addEventListener("keydown", e => { if (e.key === "Enter") check(); });
    $("spellingHint").addEventListener("click", () => feedback("Începe cu «" + word.form.slice(0,1) + "» și are " + Array.from(word.form).length + " caractere.", false, true));
    $("spellAudio").addEventListener("click", () => speakOrWarn(word.form));
    return;
  }
  if (phase === "grammar") {
    const test = grammarChallenge(word.form);
    html += '<h2>Transformă, nu repeta forma inițială.</h2>' +
      '<div class="challenge-prompt">Infinitiv: <b lang="fr">' + safely(test.lemma) + '</b><br>Folosește <b>' + safely(test.person) + '</b> la <b>' + safely(test.tense) + '</b>. Scrie numai forma verbală, fără pronume.</div>' +
      '<div class="challenge-form"><input id="grammarInput" type="text" lang="fr" spellcheck="false" autocomplete="off" placeholder="Forma conjugată…"><button id="checkGrammar" class="button button-primary">Verifică transformarea</button></div>' +
      '<p id="taskFeedback" class="feedback" hidden></p><p class="prompt-footnote">Transformările automate sunt disponibile doar pentru verbele regulate implementate explicit. Aplicația nu ghicește paradigme.</p>';
    panel.innerHTML = html;
    const check = () => {
      if (spellingCorrect($("grammarInput").value, test.expected)) markStage("grammar");
      else feedback("Forma nu corespunde paradigmei implementate pentru această persoană și acest timp.", true);
    };
    $("checkGrammar").addEventListener("click", check);
    $("grammarInput").addEventListener("keydown", e => { if (e.key === "Enter") check(); });
    return;
  }
  if (phase === "transfer") {
    const original = contextFor(doc.text, word.key);
    html += '<h2>Folosește cuvântul într-un context diferit.</h2>' +
      '<div class="challenge-prompt" lang="fr">' + safely(original) + '</div>' +
      '<p>Scrie <b>o propoziție nouă în franceză</b> folosind <b lang="fr">' + safely(word.form) + '</b>. La verbele recunoscute poți schimba timpul sau persoana. Încearcă și o situație complet diferită.</p>' +
      '<div class="challenge-form"><textarea id="transferInput" lang="fr" rows="4" spellcheck="false" placeholder="Une nouvelle phrase…"></textarea></div>' +
      '<div class="button-row"><button id="checkTransfer" class="button button-primary">Verifică utilizarea</button><button id="acceptTransfer" class="button button-secondary" hidden>Am verificat eu sensul și gramatica ✓</button></div>' +
      '<p id="taskFeedback" class="feedback" hidden></p><p class="prompt-footnote">Aplicația verifică automat prezența formei (sau a unei forme verbale cunoscute) și diferența față de original. Nu poate încă valida o propoziție liberă gramatical ori semantic; confirmarea este autoevaluare.</p>';
    panel.innerHTML = html;
    let checkedText = null;
    $("checkTransfer").addEventListener("click", () => {
      const answer = $("transferInput").value;
      const outcome = newContextCheck(answer, word.form, doc.text);
      feedback(outcome.message, !outcome.ok, outcome.ok);
      $("acceptTransfer").hidden = !outcome.ok;
      checkedText = outcome.ok ? answer : null;
    });
    $("transferInput").addEventListener("input", () => { $("acceptTransfer").hidden = true; checkedText = null; });
    $("acceptTransfer").addEventListener("click", () => {
      if (checkedText === null || checkedText !== $("transferInput").value) return;
      if (!doc.productions) doc.productions = {};
      doc.productions[word.key] = checkedText.trim();
      markStage("transfer");
    });
    return;
  }
  if (phase === "oral") {
    html += '<h2>Produce limba, nu doar o recunoaște.</h2>' +
      '<p>Spune cu voce tare o propoziție <b>nouă</b> în franceză folosind <b lang="fr">' + safely(word.form) + '</b>. Poți asculta modelul și să-ți înregistrezi vocea pentru comparație.</p>' +
      '<div class="challenge-prompt" lang="fr">' + safely(contextFor(doc.text, word.key)) + '</div>' +
      '<div class="button-row"><button id="hearFrench" class="button button-ghost">♫ Ascultă originalul fr-FR</button><button id="startMicrophone" class="button button-ghost">● Înregistrează local</button><button id="stopMicrophone" class="button button-ghost" hidden>■ Oprește înregistrarea</button></div>' +
      '<audio id="audioPlayback" controls hidden aria-label="Reascultă înregistrarea ta"></audio>' +
      '<p class="prompt-footnote">Nicio înregistrare nu este trimisă sau salvată pe server. Nu există încă scor de pronunție automat; acesta va necesita un model local.</p>' +
      '<div class="button-row"><button id="confirmOral" class="button button-secondary">Am formulat și rostit o propoziție nouă ✓</button></div><p id="taskFeedback" class="feedback" hidden></p>';
    panel.innerHTML = html;
    $("hearFrench").addEventListener("click", () => speakOrWarn(contextFor(doc.text, word.key)));
    $("startMicrophone").disabled = !recordingAvailable();
    $("startMicrophone").addEventListener("click", async () => {
      try {
        await startRecording(url => {
          const audio = $("audioPlayback");
          if (audio) { audio.src = url; audio.hidden = false; }
          if ($("startMicrophone")) $("startMicrophone").hidden = false;
          if ($("stopMicrophone")) $("stopMicrophone").hidden = true;
        });
        $("startMicrophone").hidden = true;
        $("stopMicrophone").hidden = false;
      } catch (error) { feedback("Microfon indisponibil: " + error.message, true); }
    });
    $("stopMicrophone").addEventListener("click", () => stopRecording());
    $("confirmOral").addEventListener("click", () => {
      if (confirm("Ai formulat și rostit efectiv o propoziție nouă? Confirmarea este autoevaluare, nu verificare automată a pronunției.")) {
        cleanupRecording();
        markStage("oral");
      }
    });
  }
}
function speakOrWarn(text) {
  const result = speakFrench(text);
  if (!result.ok) notify(result.message, true);
}
function updateNext(doc) {
  const next = firstPending(doc);
  $("nextBtn").disabled = !next;
  $("nextBtn").textContent = next ? "Următorul cuvânt →" : "Toate formele bifate ✓";
}
function nextWord() {
  const doc = activeDoc();
  if (!doc) return;
  const words = targets(doc.text);
  const currentIndex = words.findIndex(w => w.key === selectedKey);
  const next = words.slice(currentIndex + 1).concat(words.slice(0, currentIndex + 1))
    .find(w => firstOpenStage(doc, w.form) !== null);
  if (!next) { notify("Toate formele sunt bifate. Verifică și exercițiul de sintaxă."); setTab("syntax"); return; }
  selectWord(next.key, true);
}
function renderSyntax(doc) {
  const answer = $("syntaxAnswer"), bank = $("syntaxBank");
  answer.replaceChildren(); bank.replaceChildren();
  if (!doc) {
    answer.innerHTML = '<span class="muted">Importă mai întâi un text.</span>';
    $("syntaxNotice").textContent = "";
    $("syntaxCheck").disabled = true;
    $("syntaxUndo").disabled = true;
    $("syntaxReset").disabled = true;
    return;
  }
  const wordList = syntaxWords(doc.text);
  if (doc.syntaxDone) {
    answer.textContent = "✓ Ordinea propoziției a fost reconstruită corect.";
    bank.textContent = wordList.join(" ");
    $("syntaxNotice").textContent = "Structura a fost bifată. Progresul este păstrat local.";
    $("syntaxCheck").disabled = true;
    $("syntaxUndo").disabled = true;
    $("syntaxReset").disabled = true;
    return;
  }
  $("syntaxCheck").disabled = wordList.length < 2;
  $("syntaxUndo").disabled = sentenceIndices.length === 0;
  $("syntaxReset").disabled = sentenceIndices.length === 0;
  if (!sentenceIndices.length) answer.innerHTML = '<span class="muted">Alege cuvintele de mai jos…</span>';
  for (const [position, index] of sentenceIndices.entries()) {
    const chip = document.createElement("button");
    chip.type = "button"; chip.className = "word-chip chosen"; chip.textContent = wordList[index];
    chip.title = "Elimină acest cuvânt";
    chip.addEventListener("click", () => { sentenceIndices.splice(position, 1); syntaxMessage = ""; renderSyntax(doc); });
    answer.append(chip);
  }
  for (const i of shuffledIndices(wordList.length)) {
    if (sentenceIndices.includes(i)) continue;
    const chip = document.createElement("button");
    chip.type = "button"; chip.className = "word-chip"; chip.textContent = wordList[i];
    chip.addEventListener("click", () => { sentenceIndices.push(i); syntaxMessage = ""; renderSyntax(doc); });
    bank.append(chip);
  }
  $("syntaxNotice").textContent = syntaxMessage || ("Reconstruiești " + wordList.length + " cuvinte dintr-o propoziție/fragment, fără punctuație.");
}
function renderProgress(doc) {
  const summary = $("coverageSummary"), list = $("coverageList");
  summary.replaceChildren(); list.replaceChildren();
  if (!doc) {
    summary.innerHTML = '<p class="muted">Importă un text ca să urmărești fiecare cuvânt.</p>';
    return;
  }
  const p = progressFor(doc);
  summary.innerHTML = '<div class="summary-stat"><strong>' + p.mastered + '/' + p.words + '</strong><span>Forme exersate integral</span></div><div class="summary-stat"><strong>' + p.done + '/' + p.total + '</strong><span>Verificări și autoevaluări</span></div><div class="summary-stat"><strong>' + (doc.syntaxDone ? '✓' : '—') + '</strong><span>Ordine sintactică</span></div>';
  for (const word of targets(doc.text)) {
    const stages = wordStages(word.form);
    const completed = doc.completion?.[word.key] ?? {};
    const done = stages.filter(stage => completed[stage]).length;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "coverage-item" + (done === stages.length ? " is-done" : "");
    button.innerHTML = '<span class="word-line"><span lang="fr">' + safely(word.form) + '</span><span>' + done + '/' + stages.length + '</span></span><span class="stages-line">' +
      stages.map(s => (completed[s] ? "✓ " : "○ ") + ({ spell:"scriere", grammar:"transformare", transfer:"context", oral:"oral" }[s])).join(" · ") + '</span>';
    button.addEventListener("click", () => selectWord(word.key, true));
    list.append(button);
  }
  const deleteButton = document.createElement("button");
  deleteButton.className = "button button-ghost";
  deleteButton.style.marginTop = "18px";
  deleteButton.textContent = "Șterge definitiv textul curent și progresul său";
  deleteButton.addEventListener("click", () => {
    if (!confirm("Ștergi definitiv acest text și toate exercițiile sale din acest browser? Această operație nu se poate anula.")) return;
    cleanupRecording();
    library.documents = library.documents.filter(d => d.id !== doc.id);
    library.activeId = library.documents[0]?.id ?? null;
    selectedKey = null;
    sentenceIndices = [];
    syntaxMessage = "";
    save();
    render();
    setTab("reader");
    notify("Textul și progresul său au fost șterse de pe dispozitiv.");
  });
  summary.append(deleteButton);
}
function render() {
  const doc = activeDoc();
  if (doc) ensureSelection(doc);
  updateHeading(doc);
  renderLibrary();
  renderReader(doc);
  renderInspector(doc);
  renderChallenge(doc);
  renderSyntax(doc);
  renderProgress(doc);
  if (doc) updateNext(doc);
  else { $("nextBtn").disabled = true; $("nextBtn").textContent = "Următorul cuvânt →"; }
}
function updateVoices() {
  const voices = frenchVoices();
  $("voiceStatus").textContent = voices.length
    ? "Voce fr-FR locală: " + voices[0].name
    : "Voce fr-FR locală indisponibilă (se poate instala în sistem)";
}
function wireEvents() {
  $("importBtn").addEventListener("click", () => beginText($("sourceInput").value));
  $("sampleBtn").addEventListener("click", () => beginText(SAMPLE));
  $("speakAllBtn").addEventListener("click", () => {
    const doc = activeDoc();
    if (doc) speakOrWarn(doc.text);
    else notify("Adaugă mai întâi un text.");
  });
  document.querySelectorAll(".tab").forEach(button => button.addEventListener("click", () => setTab(button.dataset.tab)));
  $("nextBtn").addEventListener("click", nextWord);
  $("syntaxUndo").addEventListener("click", () => {
    sentenceIndices.pop(); syntaxMessage = ""; renderSyntax(activeDoc());
  });
  $("syntaxReset").addEventListener("click", () => {
    sentenceIndices = []; syntaxMessage = ""; renderSyntax(activeDoc());
  });
  $("syntaxCheck").addEventListener("click", () => {
    const doc = activeDoc();
    if (!doc) return;
    if (syntaxCorrect(sentenceIndices, doc.text)) {
      doc.syntaxDone = true; save(); render(); setTab("syntax");
      notify("Ai reconstruit ordinea cuvintelor!");
    } else {
      syntaxMessage = sentenceIndices.length !== syntaxWords(doc.text).length
        ? "Propoziția este incompletă. Folosește toate cuvintele."
        : "Ordinea nu este aceea din text. Reîncearcă fără să privești originalul.";
      renderSyntax(doc);
    }
  });
  $("photoInput").addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { notice("Selectează o imagine.", true); return; }
    if (pictureUrl) URL.revokeObjectURL(pictureUrl);
    pictureUrl = URL.createObjectURL(file);
    const wrapper = $("photoPreview");
    wrapper.replaceChildren();
    const image = document.createElement("img");
    image.alt = "Imagine franceză încărcată local";
    image.src = pictureUrl;
    wrapper.append(image);
    wrapper.hidden = false;
    notice("Imaginea a fost selectată numai local. OCR-ul offline complet nu este încă instalat în această versiune; introdu manual textul pentru a-l lucra.", true);
  });
  if ("speechSynthesis" in window) {
    if (window.speechSynthesis.addEventListener) window.speechSynthesis.addEventListener("voiceschanged", updateVoices);
    updateVoices();
  } else $("voiceStatus").textContent = "Acest browser nu are sintetizator vocal";
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault(); deferredInstall = event; $("installBtn").hidden = false;
  });
  $("installBtn").addEventListener("click", async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null; $("installBtn").hidden = true;
  });
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    navigator.serviceWorker.register("./sw.js").catch(() => notify("Nu s-a putut instala cache-ul offline. Verifică HTTPS și reîncarcă pagina.", true));
  }
}
wireEvents();
render();
setTab(selectedTab);
