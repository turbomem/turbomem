/**
 * Original Porter stemmer (1980), matching NLTK's PorterStemmer used by
 * snap-research/locomo `task_eval/evaluation.py`.
 */

function consonant(word: string, i: number): boolean {
  const ch = word[i];
  if ("aeiou".includes(ch)) return false;
  if (ch === "y") return i === 0 || !consonant(word, i - 1);
  return true;
}

function m(stem: string): number {
  let n = 0;
  let i = 0;
  const j = stem.length - 1;
  while (i <= j && consonant(stem, i)) i++;
  i++;
  while (i <= j) {
    while (i <= j && !consonant(stem, i)) i++;
    i++;
    n++;
    while (i <= j && consonant(stem, i)) i++;
    i++;
  }
  return n;
}

function vowelInStem(stem: string): boolean {
  for (let i = 0; i < stem.length; i++) {
    if (!consonant(stem, i)) return true;
  }
  return false;
}

function doubleC(word: string): boolean {
  const j = word.length - 1;
  if (j < 1) return false;
  return word[j] === word[j - 1] && consonant(word, j);
}

function cvc(word: string): boolean {
  const i = word.length - 1;
  if (i < 2 || !consonant(word, i) || consonant(word, i - 1) || !consonant(word, i - 2)) {
    return false;
  }
  const ch = word[i];
  return ch !== "w" && ch !== "x" && ch !== "y";
}

function replaceIf(word: string, suffix: string, repl: string, pred: (stem: string) => boolean): string | null {
  if (!word.endsWith(suffix)) return null;
  const stem = word.slice(0, word.length - suffix.length);
  return pred(stem) ? stem + repl : word;
}

function step1ab(word: string): string {
  if (word.endsWith("s")) {
    if (word.endsWith("sses")) word = word.slice(0, -2);
    else if (word.endsWith("ies")) word = word.slice(0, -2);
    else if (!word.endsWith("ss")) word = word.slice(0, -1);
  }

  if (word.endsWith("eed")) {
    const stem = word.slice(0, -3);
    if (m(stem) > 0) word = word.slice(0, -1);
  } else {
    let stem: string | null = null;
    if (word.endsWith("ed")) stem = word.slice(0, -2);
    else if (word.endsWith("ing")) stem = word.slice(0, -3);
    if (stem !== null && vowelInStem(stem)) {
      word = stem;
      if (word.endsWith("at") || word.endsWith("bl") || word.endsWith("iz")) {
        word += "e";
      } else if (doubleC(word)) {
        const ch = word[word.length - 1];
        if (ch !== "l" && ch !== "s" && ch !== "z") word = word.slice(0, -1);
      } else if (m(word) === 1 && cvc(word)) {
        word += "e";
      }
    }
  }
  return word;
}

function step1c(word: string): string {
  if (word.endsWith("y") && vowelInStem(word.slice(0, -1))) {
    return word.slice(0, -1) + "i";
  }
  return word;
}

function applyMap(word: string, pairs: [string, string][], pred: (stem: string) => boolean): string {
  for (const [suffix, repl] of pairs) {
    const next = replaceIf(word, suffix, repl, pred);
    if (next !== null) return next;
  }
  return word;
}

function step2(word: string): string {
  return applyMap(
    word,
    [
      ["ational", "ate"],
      ["tional", "tion"],
      ["enci", "ence"],
      ["anci", "ance"],
      ["izer", "ize"],
      ["abli", "able"],
      ["alli", "al"],
      ["entli", "ent"],
      ["eli", "e"],
      ["ousli", "ous"],
      ["ization", "ize"],
      ["ation", "ate"],
      ["ator", "ate"],
      ["alism", "al"],
      ["iveness", "ive"],
      ["fulness", "ful"],
      ["ousness", "ous"],
      ["aliti", "al"],
      ["iviti", "ive"],
      ["biliti", "ble"],
    ],
    (stem) => m(stem) > 0,
  );
}

function step3(word: string): string {
  return applyMap(
    word,
    [
      ["icate", "ic"],
      ["ative", ""],
      ["alize", "al"],
      ["iciti", "ic"],
      ["ical", "ic"],
      ["ful", ""],
      ["ness", ""],
    ],
    (stem) => m(stem) > 0,
  );
}

function step4(word: string): string {
  const suffixes = [
    "al",
    "ance",
    "ence",
    "er",
    "ic",
    "able",
    "ible",
    "ant",
    "ement",
    "ment",
    "ent",
    "ou",
    "ism",
    "ate",
    "iti",
    "ous",
    "ive",
    "ize",
  ];
  if (word.endsWith("ion")) {
    const stem = word.slice(0, -3);
    const last = stem[stem.length - 1];
    if ((last === "s" || last === "t") && m(stem) > 1) return stem;
    return word;
  }
  for (const suffix of suffixes) {
    const next = replaceIf(word, suffix, "", (stem) => m(stem) > 1);
    if (next !== null) return next;
  }
  return word;
}

function step5(word: string): string {
  if (word.endsWith("e")) {
    const stem = word.slice(0, -1);
    const mv = m(stem);
    if (mv > 1 || (mv === 1 && !cvc(stem))) word = stem;
  }
  if (word.endsWith("l") && doubleC(word) && m(word) > 1) {
    word = word.slice(0, -1);
  }
  return word;
}

export function porterStem(raw: string): string {
  if (raw.length <= 2) return raw.toLowerCase();
  let word = raw.toLowerCase();
  word = step1ab(word);
  word = step1c(word);
  word = step2(word);
  word = step3(word);
  word = step4(word);
  word = step5(word);
  return word;
}
