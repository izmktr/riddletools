type PatternElement =
  | { type: "char"; value: string }
  | { type: "any" }
  | { type: "set"; values: string[] };

function parseAnagramPattern(pattern: string): PatternElement[] {
  const elems: PatternElement[] = [];
  let i = 0;
  while (i < pattern.length) {
    if (pattern[i] === ".") {
      elems.push({ type: "any" });
      i++;
    } else if (pattern[i] === "[") {
      const end = pattern.indexOf("]", i + 1);
      if (end === -1) {
        elems.push({ type: "char", value: pattern[i] });
        i++;
      } else {
        const values = pattern.slice(i + 1, end).split("");
        elems.push({ type: "set", values });
        i = end + 1;
      }
    } else {
      elems.push({ type: "char", value: pattern[i] });
      i++;
    }
  }
  return elems;
}

function elemMatches(elem: PatternElement, ch: string): boolean {
  if (elem.type === "any") return true;
  if (elem.type === "char") return elem.value === ch;
  return elem.values.includes(ch);
}

export function matchAnagram(patternText: string, word: string): boolean {
  const pattern = parseAnagramPattern(patternText);
  if (pattern.length !== word.length) return false;
  const chars = word.split("");
  const used = new Array(chars.length).fill(false);

  function backtrack(patternIndex: number): boolean {
    if (patternIndex === pattern.length) return true;
    const elem = pattern[patternIndex];
    for (let charIndex = 0; charIndex < chars.length; charIndex++) {
      if (!used[charIndex] && elemMatches(elem, chars[charIndex])) {
        used[charIndex] = true;
        if (backtrack(patternIndex + 1)) return true;
        used[charIndex] = false;
      }
    }
    return false;
  }

  return backtrack(0);
}

function escapeRegexChar(ch: string): string {
  return /[\\^$.*+?()[\]{}|]/.test(ch) ? `\\${ch}` : ch;
}

export function buildNankuroRegex(pattern: string): RegExp | null {
  const captureGroupByDigit = new Map<string, number>();
  const parts: string[] = ["^"];
  let groupCount = 0;
  let i = 0;

  while (i < pattern.length) {
    const ch = pattern[i];

    if (ch === ".") {
      parts.push(".");
      i++;
      continue;
    }

    if (ch === "*") {
      parts.push(".*");
      i++;
      continue;
    }

    if (ch === "[") {
      const end = pattern.indexOf("]", i + 1);
      if (end === -1) {
        parts.push("\\[");
        i++;
      } else {
        parts.push(pattern.slice(i, end + 1));
        i = end + 1;
      }
      continue;
    }

    if (/[1-9]/.test(ch)) {
      const digit = ch;
      const existingGroup = captureGroupByDigit.get(digit);
      if (existingGroup === undefined) {
        groupCount++;
        captureGroupByDigit.set(digit, groupCount);
        parts.push("(.)");
      } else {
        parts.push(`\\${existingGroup}`);
      }
      i++;
      continue;
    }

    parts.push(escapeRegexChar(ch));
    i++;
  }

  parts.push("$");

  try {
    return new RegExp(parts.join(""));
  } catch {
    return null;
  }
}

export function matchNankuro(pattern: string, word: string): boolean {
  const regex = buildNankuroRegex(pattern);
  return regex ? regex.test(word) : false;
}