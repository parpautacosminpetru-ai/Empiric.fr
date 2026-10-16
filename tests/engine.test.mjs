import test from "node:test";
import assert from "node:assert/strict";
import {
  tokens, targets, normalize, maskedContext, spellingCorrect,
  regularForms, verbFamily, grammarChallenge, newContextCheck,
  syntaxWords, shuffledIndices, syntaxCorrect, emptyDoc,
  progressFor, wordStages, firstOpenStage
} from "../src/engine.js";

test("extrage inclusiv cuvintele funcționale și repetările", () => {
  const text = "Le problème de la Renaissance. Le problème est important.";
  assert.equal(tokens(text).length, 10);
  const list = targets(text);
  assert.equal(list.find(w => w.key === "le").count, 2);
  assert.ok(list.some(w => w.key === "de"));
  assert.ok(list.some(w => w.key === "la"));
});
test("nu pierde apostroful și păstrează accentele", () => {
  assert.deepEqual(tokens("L’histoire d’une époque.").map(t => t.key), ["l'histoire", "d'une", "époque"]);
  assert.equal(spellingCorrect("probleme", "problème"), false);
  assert.equal(spellingCorrect("PROBLÈME", "problème"), true);
  assert.equal(normalize("L’AMOUR"), "l'amour");
});
test("maschează numai apariția cerută și păstrează punctuația", () => {
  assert.equal(maskedContext("Le problème était grand.", "problème"), "Le _____ était grand.");
});
test("conjugă numai verbele din clasa implementată", () => {
  assert.equal(regularForms("parler").present[3], "parlons");
  assert.equal(regularForms("chercher").imparfait[0], "cherchais");
  assert.equal(regularForms("trouver").futur[5], "trouveront");
  assert.equal(regularForms("aller"), null);
  assert.equal(verbFamily("trouvé").infinitive, "trouver");
  const item = grammarChallenge("cherché");
  assert.equal(typeof item.expected, "string");
});
test("transferul formal acceptă forme verbale noi, dar respinge copia originalului", () => {
  const src = "Ils ont cherché de nouvelles idées.";
  assert.equal(newContextCheck("Ils ont cherché de nouvelles idées.", "cherché", src).ok, false);
  assert.equal(newContextCheck("Nous cherchons une idée maintenant.", "cherché", src).ok, true);
  assert.equal(newContextCheck("Je suis ici.", "cherché", src).ok, false);
  assert.equal(newContextCheck("Je parle.", "parle", src).ok, false);
});
test("sintaxa lucrează cu indici pentru a păstra aparițiile duplicate", () => {
  const text = "Le problème de la Renaissance.";
  const words = syntaxWords(text);
  assert.deepEqual(words, ["Le", "problème", "de", "la", "Renaissance"]);
  const shuffled = shuffledIndices(words.length);
  assert.notDeepEqual(shuffled, [0,1,2,3,4]);
  assert.equal(syntaxCorrect([0,1,2,3,4], text), true);
  assert.equal(syntaxCorrect([1,0,2,3,4], text), false);
});
test("poarta de acoperire include fiecare cuvânt și sintaxa", () => {
  const d = emptyDoc("Le problème est complexe.", "example");
  const before = progressFor(d);
  assert.equal(before.mastered, 0);
  assert.equal(before.complete, false);
  assert.equal(firstOpenStage(d, "le"), "spell");
  for (const word of targets(d.text)) {
    d.completion[word.key] = {};
    for (const stage of wordStages(word.form)) d.completion[word.key][stage] = true;
  }
  assert.equal(progressFor(d).complete, false);
  d.syntaxDone = true;
  assert.equal(progressFor(d).complete, true);
  assert.equal(progressFor(d).percentage, 100);
});
