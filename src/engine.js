/**
 * Empiric.fr — motor lingvistic DETERMINIST (fără servicii externe).
 * Nu pretinde analiză lingvistică exhaustivă sau validare semantică automată.
 */
const WORD_RE = /[\p{L}\p{M}]+(?:[’'-][\p{L}\p{M}]+)*/gu;
export const SAMPLE = "Le problème de la Renaissance était complexe, mais les chercheurs ont trouvé une nouvelle approche. Ils ont transformé leur manière de penser.";

export const PEOPLE = ["je", "tu", "il / elle", "nous", "vous", "ils / elles"];
const PRESENT_ENDINGS = ["e", "es", "e", "ons", "ez", "ent"];
const IMPARFAIT_ENDINGS = ["ais", "ais", "ait", "ions", "iez", "aient"];
const FUTUR_ENDINGS = ["ai", "as", "a", "ons", "ez", "ont"];
const REGULAR_ER = new Set([
  "parler", "aimer", "chercher", "trouver", "transformer", "regarder",
  "penser", "marcher", "travailler", "demander", "donner", "écouter",
  "étudier", "jouer", "changer", "habiter", "expliquer", "présenter"
]);
// Excludem verbele cu alternanțe ortografice din generatorul simplu.
REGULAR_ER.delete("changer");

export function normalize(word) {
  return String(word ?? "").normalize("NFC").toLocaleLowerCase("fr-FR").replaceAll("’", "'").trim();
}
export function tokens(text) {
  return Array.from(String(text ?? "").matchAll(WORD_RE), match => ({
    form: match[0], key: normalize(match[0]), start: match.index, end: match.index + match[0].length
  }));
}
export function sentences(text) {
  return (String(text ?? "").match(/[^.!?…]+[.!?…]*/gu) ?? [])
    .map(s => s.trim()).filter(Boolean);
}
export function targets(text) {
  const seen = new Map();
  for (const token of tokens(text)) {
    if (!seen.has(token.key)) seen.set(token.key, { key: token.key, form: token.form, count: 0 });
    seen.get(token.key).count += 1;
  }
  return [...seen.values()];
}
export function contextFor(text, key) {
  const norm = normalize(key);
  return sentences(text).find(s => tokens(s).some(t => t.key === norm)) ?? String(text).trim();
}
export function maskedContext(text, key) {
  const context = contextFor(text, key);
  const found = tokens(context).find(t => t.key === normalize(key));
  return found ? context.slice(0, found.start) + "_____" + context.slice(found.end) : context;
}
export function spellingCorrect(given, expected) {
  return normalize(given) === normalize(expected);
}

const WORDS = {
  le: ["articol hotărât / pronume", "masculin singular ca articol; funcția exactă depinde de context", "—"],
  la: ["articol hotărât / pronume", "feminin singular ca articol; funcția exactă depinde de context", "—"],
  les: ["articol hotărât / pronume", "plural ca articol; funcția exactă depinde de context", "—"],
  l: ["articol elidat", "singular", "—"],
  un: ["articol nehotărât", "masculin singular", "un"],
  une: ["articol nehotărât", "feminin singular", "o"],
  des: ["articol nehotărât / contractat", "plural; dependent de context", "—"],
  de: ["prepoziție", "relație dependentă de context", "de"],
  du: ["prepoziție + articol", "de + le", "—"],
  au: ["prepoziție + articol", "à + le", "—"],
  aux: ["prepoziție + articol", "à + les", "—"],
  à: ["prepoziție", "relație dependentă de context", "la / în"],
  et: ["conjuncție", "coordonare", "și"],
  mais: ["conjuncție", "opoziție", "dar"],
  ou: ["conjuncție", "alternativă", "sau"],
  avec: ["prepoziție", "asociere", "cu"],
  sans: ["prepoziție", "absență", "fără"],
  pour: ["prepoziție", "scop / destinație", "pentru"],
  dans: ["prepoziție", "interioritate", "în"],
  en: ["prepoziție / pronume", "dependent de context", "—"],
  sur: ["prepoziție", "relație spațială ori abstractă", "pe"],
  il: ["pronume personal", "persoana III singular", "el"],
  ils: ["pronume personal", "persoana III plural masculin sau mixt", "ei"],
  elle: ["pronume personal", "persoana III singular", "ea"],
  elles: ["pronume personal", "persoana III plural feminin", "ele"],
  je: ["pronume personal", "persoana I singular", "eu"],
  tu: ["pronume personal", "persoana II singular", "tu"],
  nous: ["pronume personal", "persoana I plural", "noi"],
  vous: ["pronume personal", "persoana II plural / politețe", "voi / dumneavoastră"],
  ne: ["element al negației", "de regulă înainte de verb", "—"],
  pas: ["element al negației", "de regulă după verbul conjugat", "nu"],
  que: ["conjuncție / pronume", "dependent de context", "—"],
  qui: ["pronume interogativ / relativ", "dependent de context", "cine / care"],
  ce: ["determinant / pronume", "dependent de context", "acest / aceasta"],
  cette: ["determinant demonstrativ", "feminin singular", "această"],
  ces: ["determinant demonstrativ", "plural", "acești / aceste"],
  problème: ["substantiv", "masculin singular", "problemă"],
  renaissance: ["substantiv", "feminin singular", "renaștere"],
  chercheurs: ["substantiv", "masculin plural", "cercetători"],
  chercheur: ["substantiv", "masculin singular", "cercetător"],
  manière: ["substantiv", "feminin singular", "manieră / mod"],
  approche: ["substantiv", "feminin singular", "abordare"],
  nouvelle: ["adjectiv", "feminin singular", "nouă"],
  nouvelles: ["adjectiv", "feminin plural", "noi"],
  nouveau: ["adjectiv", "masculin singular", "nou"],
  nouveaux: ["adjectiv", "masculin plural", "noi"],
  complexe: ["adjectiv", "singular; genul se stabilește din context", "complex(ă)"],
  complexes: ["adjectiv", "plural; genul se stabilește din context", "complecși / complexe"],
  était: ["verb", "être — indicativ imparfait, III singular", "era"],
  est: ["verb", "être — prezent, III singular", "este"],
  sont: ["verb", "être — prezent, III plural", "sunt"],
  être: ["verb", "infinitiv", "a fi"],
  a: ["verb / prepoziție fără accent", "avoir — prezent, III singular", "are"],
  ont: ["verb", "avoir — prezent, III plural; auxiliar posibil", "au"],
  ai: ["verb", "avoir — prezent, I singular; auxiliar posibil", "am"],
  avons: ["verb", "avoir — prezent, I plural; auxiliar posibil", "avem"],
  avez: ["verb", "avoir — prezent, II plural; auxiliar posibil", "aveți"],
  avoir: ["verb", "infinitiv", "a avea"],
  leur: ["determinant / pronume posesiv", "dependent de context", "lor"],
  leurs: ["determinant posesiv", "plural", "lor"]
};
export function regularForms(lemma) {
  const key = normalize(lemma);
  if (!REGULAR_ER.has(key)) return null;
  const stem = key.slice(0, -2);
  return {
    infinitive: key,
    participle: stem + "é",
    present: PRESENT_ENDINGS.map(x => stem + x),
    imparfait: IMPARFAIT_ENDINGS.map(x => stem + x),
    futur: FUTUR_ENDINGS.map(x => key + x)
  };
}
export function verbFamily(word) {
  const key = normalize(word);
  for (const lemma of REGULAR_ER) {
    const f = regularForms(lemma);
    if ([lemma, f.participle, ...f.present, ...f.imparfait, ...f.futur].includes(key)) return f;
  }
  return null;
}
export function wordInfo(word) {
  const key = normalize(word);
  const entry = WORDS[key];
  if (entry) return { form: word, category: entry[0], details: entry[1], meaning: entry[2], source: "minilexicon verificabil" };
  const verb = verbFamily(key);
  if (verb) return { form: word, category: "verb", details: "familia lui «" + verb.infinitive + "» (forme regulate implementate)", meaning: "sensul nu este inclus", source: "generator morfologic local" };
  return { form: word, category: "neanalizat automat", details: "fără analiză sigură în pachetul inițial", meaning: "de descoperit", source: "niciun indiciu inventat" };
}
export function grammarChallenge(word) {
  const forms = verbFamily(word);
  if (!forms) return null;
  const seed = [...normalize(word)].reduce((acc, ch) => acc + ch.codePointAt(0), 0);
  const tense = ["present", "imparfait", "futur"][seed % 3];
  const person = Math.floor(seed / 3) % 6;
  const labels = { present: "prezent", imparfait: "imparfait", futur: "futur simple" };
  return {
    lemma: forms.infinitive,
    person: PEOPLE[person],
    tense: labels[tense],
    expected: forms[tense][person]
  };
}
export function newContextCheck(answer, word, source) {
  const actual = tokens(answer).map(t => t.key);
  const family = verbFamily(word);
  const allowed = family ? new Set([family.infinitive, family.participle, ...family.present, ...family.imparfait, ...family.futur]) : new Set([normalize(word)]);
  if (actual.length < 4) return { ok: false, message: "Scrie cel puțin patru cuvinte într-o propoziție nouă." };
  if (!actual.some(w => allowed.has(w))) return { ok: false, message: "Folosește cuvântul ales sau, când există, o formă verbală recunoscută." };
  const original = tokens(contextFor(source, word)).map(t => t.key).join(" ");
  if (actual.join(" ") === original) return { ok: false, message: "Propoziția trebuie să fie diferită de cea din text." };
  return { ok: true, message: "Verificări formale trecute. Corectitudinea gramaticală și sensul cer autoevaluare." };
}
export function syntaxWords(text) {
  const candidates = sentences(text);
  const chosen = candidates.find(s => tokens(s).length >= 3 && tokens(s).length <= 20) ?? candidates[0] ?? "";
  return tokens(chosen).slice(0, 20).map(t => t.form);
}
export function shuffledIndices(length) {
  const indices = Array.from({ length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = (i * 7 + 3) % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  if (indices.length > 1 && indices.every((v, i) => v === i)) indices.push(indices.shift());
  return indices;
}
export function syntaxCorrect(chosenIndices, text) {
  const expected = syntaxWords(text);
  return chosenIndices.length === expected.length && chosenIndices.every((v, i) => expected[v] !== undefined && normalize(expected[v]) === normalize(expected[i]));
}
export function emptyDoc(text, id) {
  return { id, text: String(text).trim(), createdAt: new Date().toISOString(), completion: {}, glosses: {}, productions: {}, syntaxDone: false };
}
export function wordStages(word) {
  return grammarChallenge(word) ? ["spell", "grammar", "transfer", "oral"] : ["spell", "transfer", "oral"];
}
export function firstOpenStage(doc, word) {
  const completed = doc.completion?.[normalize(word)] ?? {};
  return wordStages(word).find(stage => !completed[stage]) ?? null;
}
export function progressFor(doc) {
  const words = targets(doc.text);
  const needsSyntax = syntaxWords(doc.text).length > 1;
  let total = needsSyntax ? 1 : 0, done = needsSyntax && doc.syntaxDone ? 1 : 0, mastered = 0;
  for (const word of words) {
    const stages = wordStages(word.form);
    total += stages.length;
    const states = doc.completion?.[word.key] ?? {};
    done += stages.filter(stage => states[stage]).length;
    if (stages.every(stage => states[stage])) mastered++;
  }
  return { total, done, mastered, words: words.length, percentage: total ? Math.round(done / total * 100) : 0, complete: total > 0 && done === total };
}
