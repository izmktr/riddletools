type PatternElement =
  | { type: "char"; value: string }
  | { type: "any" }
  | { type: "set"; values: string[]; min: number; max: number };

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
        const values = [...new Set(pattern.slice(i + 1, end).split(""))];
        i = end + 1;
        const quantifier = /^\{(\d*)(?:,(\d*))?\}/.exec(pattern.slice(i));
        if (quantifier && (quantifier[1] !== "" || quantifier[2] !== undefined)) {
          const hasRange = quantifier[2] !== undefined;
          const min = hasRange
            ? quantifier[1] === "" ? 0 : Number(quantifier[1])
            : Number(quantifier[1]);
          const max = hasRange
            ? quantifier[2] === "" ? values.length : Number(quantifier[2])
            : min;
          if (Number.isSafeInteger(min) && Number.isSafeInteger(max) && min <= max) {
            elems.push({ type: "set", values, min, max });
            i += quantifier[0].length;
            continue;
          }
        }
        elems.push({ type: "set", values, min: 1, max: 1 });
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
  const chars = word.split("");
  const used = new Array(chars.length).fill(false);

  function backtrack(patternIndex: number, matchedCount: number): boolean {
    if (patternIndex === pattern.length) return matchedCount === chars.length;
    const elem = pattern[patternIndex];
    if (elem.type === "set") {
      const setElem = elem;
      const selectedValues = new Set<string>();
      const max = Math.min(setElem.max, chars.length - matchedCount, setElem.values.length);

      function matchSet(usedCount: number): boolean {
        if (usedCount >= setElem.min && backtrack(patternIndex + 1, matchedCount + usedCount)) {
          return true;
        }
        if (usedCount === max) return false;

        for (let charIndex = 0; charIndex < chars.length; charIndex++) {
          const ch = chars[charIndex];
          if (used[charIndex] || selectedValues.has(ch) || !setElem.values.includes(ch)) continue;
          used[charIndex] = true;
          selectedValues.add(ch);
          if (matchSet(usedCount + 1)) return true;
          selectedValues.delete(ch);
          used[charIndex] = false;
        }
        return false;
      }

      return matchSet(0);
    }

    for (let charIndex = 0; charIndex < chars.length; charIndex++) {
      if (!used[charIndex] && elemMatches(elem, chars[charIndex])) {
        used[charIndex] = true;
        if (backtrack(patternIndex + 1, matchedCount + 1)) return true;
        used[charIndex] = false;
      }
    }
    return false;
  }

  return backtrack(0, 0);
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