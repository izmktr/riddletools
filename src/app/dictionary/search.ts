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

type NankuroToken =
  | { type: "char"; value: string }
  | { type: "any" }
  | { type: "star" }
  | { type: "digit"; value: string; variableLength: boolean }
  | { type: "class"; value: string; regex: RegExp };

type NankuroWordGroup = {
  assignments: Map<string, string>;
  wordIndices: Map<string, number[]>;
};

function parseNankuroPatterns(patterns: string[]): NankuroToken[][] | null {
  if (patterns.length === 0 || patterns.some((pattern) => pattern === "")) return null;
  const parsedPatterns: NankuroToken[][] = [];
  let variableLengthMode = false;
  let hasSeenDigit = false;

  for (const pattern of patterns) {
    const tokens: NankuroToken[] = [];
    let i = 0;

    while (i < pattern.length) {
      const ch = pattern[i];
      if (ch === ".") {
        tokens.push({ type: "any" });
        i++;
      } else if (ch === "*") {
        if (tokens[tokens.length - 1]?.type !== "star") {
          tokens.push({ type: "star" });
        }
        i++;
      } else if (ch === "[") {
        const end = pattern.indexOf("]", i + 1);
        if (end === -1) {
          tokens.push({ type: "char", value: ch });
          i++;
        } else {
          const value = pattern.slice(i, end + 1);
          try {
            tokens.push({ type: "class", value, regex: new RegExp(`^(?:${value})$`) });
          } catch {
            return null;
          }
          i = end + 1;
        }
      } else if (/[1-9]/.test(ch)) {
        const hasPlus = pattern[i + 1] === "+";
        if (hasPlus && !variableLengthMode) {
          if (hasSeenDigit) return null;
          variableLengthMode = true;
        }
        tokens.push({ type: "digit", value: ch, variableLength: variableLengthMode });
        hasSeenDigit = true;
        i += hasPlus ? 2 : 1;
      } else if (ch === "+") {
        return null;
      } else {
        tokens.push({ type: "char", value: ch });
        i++;
      }
    }

    parsedPatterns.push(tokens);
  }

  return parsedPatterns;
}

export function buildNankuroRegex(pattern: string): RegExp | null {
  const tokensByPattern = parseNankuroPatterns([pattern]);
  if (!tokensByPattern) return null;

  const captureGroupByDigit = new Map<string, number>();
  const parts: string[] = ["^"];
  let groupCount = 0;

  for (const token of tokensByPattern[0]) {
    if (token.type === "char") {
      parts.push(escapeRegexChar(token.value));
    } else if (token.type === "any") {
      parts.push(".");
    } else if (token.type === "star") {
      parts.push(".*");
    } else if (token.type === "class") {
      parts.push(token.value);
    } else {
      const existingGroup = captureGroupByDigit.get(token.value);
      if (existingGroup === undefined) {
        groupCount++;
        captureGroupByDigit.set(token.value, groupCount);
        parts.push(token.variableLength ? "(.+)" : "(.)");
      } else {
        parts.push(`\\${existingGroup}`);
      }
    }
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

function assignmentKey(assignments: Map<string, string>): string {
  return JSON.stringify([...assignments.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function findWordAssignments(tokens: NankuroToken[], word: string): Map<string, string>[] {
  const chars = word.split("");
  const assignments = new Map<string, string>();
  const visited = new Set<string>();
  const matches = new Map<string, Map<string, string>>();

  function visit(tokenIndex: number, charIndex: number): void {
    const stateKey = `${tokenIndex}:${charIndex}:${assignmentKey(assignments)}`;
    if (visited.has(stateKey)) return;
    visited.add(stateKey);

    if (tokenIndex === tokens.length) {
      if (charIndex === chars.length) {
        const key = assignmentKey(assignments);
        if (!matches.has(key)) matches.set(key, new Map(assignments));
      }
      return;
    }

    const token = tokens[tokenIndex];
    if (token.type === "star") {
      for (let nextIndex = charIndex; nextIndex <= chars.length; nextIndex++) {
        visit(tokenIndex + 1, nextIndex);
      }
      return;
    }
    if (charIndex >= chars.length) return;

    const ch = chars[charIndex];
    if (token.type === "char") {
      if (token.value === ch) visit(tokenIndex + 1, charIndex + 1);
    } else if (token.type === "any" || (token.type === "class" && token.regex.test(ch))) {
      visit(tokenIndex + 1, charIndex + 1);
    } else if (token.type === "digit") {
      const assigned = assignments.get(token.value);
      if (assigned !== undefined) {
        if (word.startsWith(assigned, charIndex)) {
          visit(tokenIndex + 1, charIndex + assigned.length);
        }
      } else if (token.variableLength) {
        for (let endIndex = charIndex + 1; endIndex <= chars.length; endIndex++) {
          assignments.set(token.value, chars.slice(charIndex, endIndex).join(""));
          visit(tokenIndex + 1, endIndex);
          assignments.delete(token.value);
        }
      } else {
        assignments.set(token.value, ch);
        visit(tokenIndex + 1, charIndex + 1);
        assignments.delete(token.value);
      }
    }
  }

  visit(0, 0);
  return [...matches.values()];
}

function mergeAssignments(
  current: Map<string, string>,
  next: Map<string, string>,
): Map<string, string> | null {
  const merged = new Map(current);
  for (const [digit, ch] of next) {
    const existing = merged.get(digit);
    if (existing !== undefined && existing !== ch) return null;
    merged.set(digit, ch);
  }
  return merged;
}

function canChooseDistinctWords(groups: NankuroWordGroup[], fixedIndex: number, fixedWord: string): boolean {
  const wordOwner = new Map<string, number>([[fixedWord, fixedIndex]]);

  function assignWord(groupIndex: number, visitedWords: Set<string>): boolean {
    for (const word of groups[groupIndex].wordIndices.keys()) {
      if (visitedWords.has(word) || word === fixedWord) continue;
      visitedWords.add(word);
      const owner = wordOwner.get(word);
      if (owner === undefined || assignWord(owner, visitedWords)) {
        wordOwner.set(word, groupIndex);
        return true;
      }
    }
    return false;
  }

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    if (groupIndex === fixedIndex) continue;
    if (!assignWord(groupIndex, new Set())) return false;
  }
  return true;
}

export function matchNankuroPatterns(patterns: string[], words: string[]): Set<number> | null {
  const parsedPatterns = parseNankuroPatterns(patterns);
  if (!parsedPatterns) return null;

  const groupsByPattern: NankuroWordGroup[][] = parsedPatterns.map((tokens) => {
    const groupsByAssignment = new Map<string, NankuroWordGroup>();
    words.forEach((word, wordIndex) => {
      for (const assignments of findWordAssignments(tokens, word)) {
        const key = assignmentKey(assignments);
        let group = groupsByAssignment.get(key);
        if (!group) {
          group = { assignments, wordIndices: new Map() };
          groupsByAssignment.set(key, group);
        }
        const indices = group.wordIndices.get(word);
        if (indices) {
          indices.push(wordIndex);
        } else {
          group.wordIndices.set(word, [wordIndex]);
        }
      }
    });

    return [...groupsByAssignment.values()];
  });

  if (groupsByPattern.some((groups) => groups.length === 0)) return new Set();

  const orderedGroups = [...groupsByPattern].sort((a, b) => a.length - b.length);
  const matchedIndices = new Set<number>();
  const chosenGroups: NankuroWordGroup[] = [];

  function collectParticipatingWords(): void {
    chosenGroups.forEach((group, groupIndex) => {
      for (const [word, indices] of group.wordIndices) {
        if (!canChooseDistinctWords(chosenGroups, groupIndex, word)) continue;
        indices.forEach((index) => matchedIndices.add(index));
      }
    });
  }

  function visit(patternIndex: number, assignments: Map<string, string>): void {
    if (patternIndex === orderedGroups.length) {
      collectParticipatingWords();
      return;
    }

    const groups = orderedGroups[patternIndex];
    let candidates: NankuroWordGroup[] | undefined;
    for (const [digit, ch] of assignments) {
      const matching = groups.filter((group) => {
        const assigned = group.assignments.get(digit);
        return assigned === undefined || assigned === ch;
      });
      if (matching.length === 0) return;
      if (!candidates || matching.length < candidates.length) candidates = matching;
    }

    for (const group of candidates ?? groups) {
      const merged = mergeAssignments(assignments, group.assignments);
      if (!merged) continue;
      chosenGroups.push(group);
      visit(patternIndex + 1, merged);
      chosenGroups.pop();
    }
  }

  visit(0, new Map());
  return matchedIndices;
}