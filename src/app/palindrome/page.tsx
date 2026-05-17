"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type KnownToken = {
  kind: "known";
  id: number;
  word: string;
};

type UnknownToken = {
  kind: "unknown";
  id: number;
};

type Token = KnownToken | UnknownToken;

type CharEntry =
  | {
      type: "const";
      char: string;
    }
  | {
      type: "var";
      key: string;
    };

type SolveResult = {
  sequenceParts: {
    text: string;
    isUnknown: boolean;
  }[];
  palindromeText: string;
  unknownWords: string[];
  totalUnknownLength: number;
};

const MAX_UNKNOWN_LENGTH = 8;
const MAX_SOLUTIONS = 100;

function reverseString(value: string): string {
  return Array.from(value).reverse().join("");
}

function isPalindrome(value: string): boolean {
  return value === reverseString(value);
}

function normalizeWords(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function hasAdjacentUnknown(tokens: Token[]): boolean {
  for (let i = 1; i < tokens.length; i += 1) {
    if (tokens[i - 1].kind === "unknown" && tokens[i].kind === "unknown") {
      return true;
    }
  }
  return false;
}

function meetsUnknownEdgeRule(tokens: Token[], placeUnknownAtEnd: boolean): boolean {
  const first = tokens[0];
  const last = tokens[tokens.length - 1];

  if (!first || !last) {
    return false;
  }

  // 先頭は常に既知単語のみ許可
  if (first.kind !== "known") {
    return false;
  }

  if (placeUnknownAtEnd) {
    return last.kind === "unknown";
  }

  return last.kind === "known";
}

function buildCharEntries(tokens: Token[], unknownLengths: number[]): CharEntry[] {
  const entries: CharEntry[] = [];

  for (const token of tokens) {
    if (token.kind === "known") {
      for (const char of Array.from(token.word)) {
        entries.push({ type: "const", char });
      }
      continue;
    }

    const length = unknownLengths[token.id];
    for (let offset = 0; offset < length; offset += 1) {
      entries.push({ type: "var", key: `${token.id}:${offset}` });
    }
  }

  return entries;
}

// 合計値 total を count 個の整数（各 1〜maxPart）に分割する全組み合わせを返す
function generateCompositions(count: number, total: number, maxPart: number): number[][] {
  const result: number[][] = [];
  const current: number[] = [];

  const recurse = (remaining: number, partsLeft: number) => {
    if (partsLeft === 0) {
      if (remaining === 0) {
        result.push([...current]);
      }
      return;
    }
    const maxVal = Math.min(maxPart, remaining - (partsLeft - 1));
    for (let v = 1; v <= maxVal; v += 1) {
      current.push(v);
      recurse(remaining - v, partsLeft - 1);
      current.pop();
    }
  };

  recurse(total, count);
  return result;
}

function solveUnknownWords(tokens: Token[], unknownCount: number): string[][] {
  if (unknownCount === 0) {
    const joined = tokens
      .map((token) => (token.kind === "known" ? token.word : ""))
      .join("");
    return isPalindrome(joined) ? [[]] : [];
  }

  const dedup = new Map<string, string[]>();

  // 合計長が小さい順に探索し、解が見つかった合計長より大きい合計長は探索しない
  for (let targetSum = unknownCount; targetSum <= unknownCount * MAX_UNKNOWN_LENGTH; targetSum += 1) {
    const tuples = generateCompositions(unknownCount, targetSum, MAX_UNKNOWN_LENGTH);
    for (const lengths of tuples) {
      const solved = solveWithLengthPattern(tokens, lengths);
      if (solved) {
        const key = solved.join("\u0001");
        if (!dedup.has(key)) {
          dedup.set(key, solved);
        }
      }
      if (dedup.size >= MAX_SOLUTIONS) {
        break;
      }
    }
    // この合計長で解が見つかった場合、それより大きい合計長は探索しない
    if (dedup.size > 0) {
      break;
    }
  }

  return Array.from(dedup.values());
}

function solveWithLengthPattern(tokens: Token[], unknownLengths: number[]): string[] | null {
  const entries = buildCharEntries(tokens, unknownLengths);
  const parent = new Map<string, string>();
  const rootConst = new Map<string, string>();

  const ensureNode = (key: string) => {
    if (!parent.has(key)) {
      parent.set(key, key);
    }
  };

  const find = (key: string): string => {
    ensureNode(key);
    const current = parent.get(key)!;
    if (current === key) {
      return key;
    }
    const root = find(current);
    parent.set(key, root);
    return root;
  };

  const assignConst = (key: string, value: string): boolean => {
    const root = find(key);
    const existing = rootConst.get(root);
    if (existing && existing !== value) {
      return false;
    }
    rootConst.set(root, value);
    return true;
  };

  const union = (left: string, right: string): boolean => {
    const rootLeft = find(left);
    const rootRight = find(right);

    if (rootLeft === rootRight) {
      return true;
    }

    parent.set(rootRight, rootLeft);

    const leftConst = rootConst.get(rootLeft);
    const rightConst = rootConst.get(rootRight);

    if (leftConst && rightConst && leftConst !== rightConst) {
      return false;
    }

    if (!leftConst && rightConst) {
      rootConst.set(rootLeft, rightConst);
    }

    rootConst.delete(rootRight);
    return true;
  };

  const totalLength = entries.length;

  for (let i = 0; i < Math.floor(totalLength / 2); i += 1) {
    const left = entries[i];
    const right = entries[totalLength - 1 - i];

    if (left.type === "const" && right.type === "const") {
      if (left.char !== right.char) {
        return null;
      }
      continue;
    }

    if (left.type === "const" && right.type === "var") {
      if (!assignConst(right.key, left.char)) {
        return null;
      }
      continue;
    }

    if (left.type === "var" && right.type === "const") {
      if (!assignConst(left.key, right.char)) {
        return null;
      }
      continue;
    }

    if (left.type === "var" && right.type === "var") {
      if (!union(left.key, right.key)) {
        return null;
      }
    }
  }

  // 不明文字は「逆側から確定した文字」のみ許可する。
  // どこからも文字が確定しない連結成分は解として無効にする。
  const charForKey = (key: string): string | null => {
    const root = find(key);
    return rootConst.get(root) ?? null;
  };

  const words = new Array<string>(unknownLengths.length).fill("");
  for (let unknownId = 0; unknownId < unknownLengths.length; unknownId += 1) {
    const chars: string[] = [];
    for (let offset = 0; offset < unknownLengths[unknownId]; offset += 1) {
      const resolved = charForKey(`${unknownId}:${offset}`);
      if (resolved === null) {
        return null;
      }
      chars.push(resolved);
    }
    words[unknownId] = chars.join("");
  }

  const palindromeText = tokens
    .map((token) => (token.kind === "known" ? token.word : words[token.id]))
    .join("");

  if (!isPalindrome(palindromeText)) {
    return null;
  }

  return words;
}

function enumerateSequences(words: string[], unknownCount: number, placeUnknownAtEnd: boolean): SolveResult[] {
  const knownTokens: KnownToken[] = words.map((word, index) => ({ kind: "known", id: index, word }));
  const unknownTokens: UnknownToken[] = Array.from({ length: unknownCount }, (_, index) => ({ kind: "unknown", id: index }));

  const left: Token[] = [];
  const right: Token[] = [];
  const knownUsed = new Array<boolean>(knownTokens.length).fill(false);
  const unknownUsed = new Array<boolean>(unknownTokens.length).fill(false);

  const results = new Map<string, SolveResult>();
  const totalTokenCount = knownTokens.length + unknownTokens.length;

  const tokenText = (token: Token, unknownWords: string[]): string => {
    if (token.kind === "known") {
      return token.word;
    }
    return unknownWords[token.id];
  };

  const pushResult = (tokens: Token[], unknownWords: string[]) => {
    // 複数の不明単語が同じ文字列の場合は除外（並び替えると重複結果になるため）
    if (new Set(unknownWords).size < unknownWords.length) {
      return;
    }

    const totalUnknownLength = unknownWords.reduce((sum, w) => sum + w.length, 0);

    const displayWordMap = new Map<string, string>();
    for (const word of unknownWords) {
      const reversed = reverseString(word);
      const normalized = word.localeCompare(reversed, "ja") <= 0
        ? `${word}\u0001${reversed}`
        : `${reversed}\u0001${word}`;

      if (!displayWordMap.has(normalized)) {
        if (word === reversed) {
          displayWordMap.set(normalized, word);
        } else if (word.localeCompare(reversed, "ja") <= 0) {
          displayWordMap.set(normalized, `${word} / ${reversed}`);
        } else {
          displayWordMap.set(normalized, `${reversed} / ${word}`);
        }
      }
    }
    const displayWords = Array.from(displayWordMap.values());

    const sequenceParts = tokens.map((token) => ({
      text: tokenText(token, unknownWords),
      isUnknown: token.kind === "unknown",
    }));
    const palindromeText = tokens
      .map((token) => tokenText(token, unknownWords))
      .join("");

    const key = displayWords.join("\u0001");
    if (!results.has(key)) {
      results.set(key, {
        sequenceParts,
        palindromeText,
        unknownWords: displayWords,
        totalUnknownLength,
      });
    }
  };

  const placeNext = () => {
    if (results.size >= MAX_SOLUTIONS) {
      return;
    }

    if (left.length + right.length === totalTokenCount) {
      const tokens = [...left, ...right.slice().reverse()];

      if (!meetsUnknownEdgeRule(tokens, placeUnknownAtEnd)) {
        return;
      }

      if (hasAdjacentUnknown(tokens)) {
        return;
      }

      const unknownCandidates = solveUnknownWords(tokens, unknownCount);
      for (const candidate of unknownCandidates) {
        pushResult(tokens, candidate);
        if (results.size >= MAX_SOLUTIONS) {
          break;
        }
      }
      return;
    }

    const targetSide = left.length <= right.length ? "left" : "right";

    for (let knownIndex = 0; knownIndex < knownTokens.length; knownIndex += 1) {
      if (knownUsed[knownIndex]) {
        continue;
      }

      knownUsed[knownIndex] = true;
      const token = knownTokens[knownIndex];

      if (targetSide === "left") {
        left.push(token);
        placeNext();
        left.pop();
      } else {
        right.push(token);
        placeNext();
        right.pop();
      }

      knownUsed[knownIndex] = false;

      if (results.size >= MAX_SOLUTIONS) {
        return;
      }
    }

    for (let unknownIndex = 0; unknownIndex < unknownTokens.length; unknownIndex += 1) {
      if (unknownUsed[unknownIndex]) {
        continue;
      }

      // 先頭位置には不明単語を置かない
      if (targetSide === "left" && left.length === 0) {
        continue;
      }

      unknownUsed[unknownIndex] = true;
      const token = unknownTokens[unknownIndex];

      if (targetSide === "left") {
        left.push(token);
        placeNext();
        left.pop();
      } else {
        right.push(token);
        placeNext();
        right.pop();
      }

      unknownUsed[unknownIndex] = false;

      if (results.size >= MAX_SOLUTIONS) {
        return;
      }
    }
  };

  placeNext();

  return Array.from(results.values());
}

export default function PalindromePage() {
  const [showManual, setShowManual] = useState(false);
  const [wordsInput, setWordsInput] = useState("");
  const [unknownCount, setUnknownCount] = useState(1);
  const [placeUnknownAtEnd, setPlaceUnknownAtEnd] = useState(false);
  const [results, setResults] = useState<SolveResult[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  const wordList = useMemo(() => normalizeWords(wordsInput), [wordsInput]);

  const handleSolve = () => {
    setErrorMessage("");

    if (wordList.length === 0) {
      setResults([]);
      setErrorMessage("単語を1つ以上入力してください。");
      return;
    }

    if (unknownCount < 0) {
      setResults([]);
      setErrorMessage("不明単語数は0以上で入力してください。");
      return;
    }

    if (placeUnknownAtEnd && unknownCount === 0) {
      setResults([]);
      setErrorMessage("「不明単語を端に置く」がONの場合、不明単語数は1以上にしてください。");
      return;
    }

    if (wordList.length + unknownCount > 10) {
      setResults([]);
      setErrorMessage("探索量が大きいため、単語数 + 不明単語数は10以下にしてください。");
      return;
    }

    const minUnknownCount = placeUnknownAtEnd ? 1 : 0;
    let solved: SolveResult[] = [];

    for (let currentUnknownCount = minUnknownCount; currentUnknownCount <= unknownCount; currentUnknownCount += 1) {
      solved = enumerateSequences(wordList, currentUnknownCount, placeUnknownAtEnd);
      if (solved.length > 0) {
        break;
      }
    }

    solved.sort((a, b) => a.totalUnknownLength - b.totalUnknownLength);
    setResults(solved);

    if (solved.length === 0) {
      setErrorMessage("条件に合う回文は見つかりませんでした。");
    }
  };

  const handleReset = () => {
    setWordsInput("");
    setUnknownCount(1);
    setPlaceUnknownAtEnd(false);
    setResults([]);
    setErrorMessage("");
  };

  return (
    <main className="max-w-5xl mx-auto p-6">
      <div className="mb-4">
        <Link href="/" className="text-blue-500 hover:text-blue-700 text-sm">
          ← トップに戻る
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-4">回文ソルバー</h1>

      <div className="flex items-center mb-4 gap-2">
        <button
          className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200"
          onClick={() => setShowManual(true)}
        >
          使い方
        </button>
      </div>

      {showManual && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 max-w-2xl w-full relative">
            <button
              className="absolute top-2 right-2 px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => setShowManual(false)}
            >
              閉じる
            </button>
            <h2 className="text-xl font-bold mb-2">回文ソルバーの使い方</h2>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>単語を改行区切りで入力します。</li>
              <li>不明単語数を指定します（初期値は1）。0個からその個数まで、少ない個数を優先して探索します。</li>
              <li>先頭の単語は常に既知単語です（不明単語にはなりません）。</li>
              <li>不明単語は1〜8文字のワイルドカードとして扱います。</li>
              <li>不明単語どうしが連続する並びは除外します。</li>
              <li>「不明単語を端に置く」ON: 末尾単語を不明単語に固定します。</li>
              <li>「不明単語を端に置く」OFF: 末尾単語から不明単語を除外します。</li>
              <li>先頭単語と末尾単語が既知単語同士のとき、先頭 &lt; 末尾 の解だけを採用します。</li>
              <li>結果では不明単語候補を表示し、非回文の候補は 通常順 / 逆順 で表示します。</li>
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <section className="space-y-3">
          <label className="block text-sm font-medium">単語入力（改行区切り）</label>
          <textarea
            className="w-full h-56 p-3 border rounded"
            value={wordsInput}
            onChange={(event) => setWordsInput(event.target.value)}
            placeholder={"例:\nabc\nc\nba"}
          />
          <div className="text-sm text-gray-600">入力単語数: {wordList.length}</div>
        </section>

        <section className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="unknownCount">
            不明単語数の上限
          </label>
          <input
            id="unknownCount"
            type="number"
            min={0}
            max={8}
            className="w-28 p-2 border rounded"
            value={unknownCount}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isNaN(next)) {
                setUnknownCount(0);
              } else {
                setUnknownCount(Math.max(0, Math.min(8, Math.floor(next))));
              }
            }}
          />
          <p className="text-sm text-gray-600">各不明単語は1〜8文字で探索します。</p>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={placeUnknownAtEnd}
              onChange={(event) => setPlaceUnknownAtEnd(event.target.checked)}
            />
            不明単語を端に置く
          </label>

          <div className="flex gap-2">
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={handleSolve}
            >
              回文を探索
            </button>
            <button
              className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
              onClick={handleReset}
            >
              リセット
            </button>
          </div>

          {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
          <p className="text-xs text-gray-500">探索上限: {MAX_SOLUTIONS}件</p>
        </section>
      </div>

      <section>
        <h2 className="text-xl font-semibold mb-3">結果 ({results.length}件)</h2>
        {results.length === 0 ? (
          <div className="p-4 border rounded text-sm text-gray-600">探索結果はここに表示されます。</div>
        ) : (
          <div className="space-y-3">
            {results.map((result, index) => (
              <article
                key={`${result.sequenceParts.map((part) => part.text).join("|")}-${index}`}
                className="border rounded p-4 bg-white"
              >
                <div className="text-sm mb-1">
                  <span className="font-semibold">並び:</span>{" "}
                  {result.sequenceParts.map((part, partIndex) => (
                    <span key={`${part.text}-${partIndex}`}>
                      {partIndex > 0 && <span className="text-gray-500"> | </span>}
                      <span
                        className={part.isUnknown
                          ? "inline-block px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-900 font-semibold"
                          : ""
                        }
                      >
                        {part.text}
                      </span>
                    </span>
                  ))}
                </div>
                <div className="text-sm mb-2 break-all">
                  <span className="font-semibold">回文文字列:</span> {result.palindromeText}
                </div>
                <div className="text-sm">
                  <span className="font-semibold">不明単語候補:</span>{" "}
                  {result.unknownWords.length === 0 ? "なし" : result.unknownWords.join(" , ")}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
