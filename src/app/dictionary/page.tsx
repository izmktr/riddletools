"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type DicEntry = { name: string; file: string };

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

function matchAnagram(pattern: PatternElement[], word: string): boolean {
  if (pattern.length !== word.length) return false;
  const chars = word.split("");
  const used = new Array(chars.length).fill(false);
  function backtrack(pi: number): boolean {
    if (pi === pattern.length) return true;
    const elem = pattern[pi];
    for (let ci = 0; ci < chars.length; ci++) {
      if (!used[ci] && elemMatches(elem, chars[ci])) {
        used[ci] = true;
        if (backtrack(pi + 1)) return true;
        used[ci] = false;
      }
    }
    return false;
  }
  return backtrack(0);
}

function parseCSV(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line) =>
      line.split(",").map((cell) => cell.trim())
    );
}

export default function DictionaryPage() {
  const [showHelp, setShowHelp] = useState(false);
  const [searchType, setSearchType] = useState<"partial" | "regex" | "anagram">("partial");
  const [searchText, setSearchText] = useState("");
  const [dicList, setDicList] = useState<DicEntry[]>([]);
  const [selectedDic, setSelectedDic] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [selectedCols, setSelectedCols] = useState<boolean[]>([]);
  const [matchedCells, setMatchedCells] = useState<Set<string>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resultExceeded, setResultExceeded] = useState(false);
  const MAX_RESULTS = 50;

  // dic/index.csv を読み込む
  useEffect(() => {
    fetch("/dic/index.csv")
      .then((res) => res.text())
      .then((text) => {
        const parsed = parseCSV(text);
        const entries: DicEntry[] = parsed
          .filter((row) => row.length >= 2)
          .map((row) => ({ name: row[0], file: row[1] }));
        setDicList(entries);
      })
      .catch((e) => {
        setLoadError(`index.csv の読み込みに失敗しました: ${e instanceof Error ? e.message : String(e)}`);
      });
  }, []);

  // 辞書ファイルを読み込む
  useEffect(() => {
    if (!selectedDic) return;
    setLoadError(null);
    fetch(`/dic/${selectedDic}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        return res.text();
      })
      .then((text) => {
        const parsed = parseCSV(text);
        if (parsed.length === 0) {
          setLoadError("辞書ファイルが空です");
          setHeaders([]);
          setRows([]);
          return;
        }
        const [header, ...dataRows] = parsed;
        setHeaders(header);
        setRows(dataRows);
        setSelectedCols(new Array(header.length).fill(false));
        setMatchedCells(new Set());
        setHasSearched(false);
        setResultExceeded(false);
        setSearchText("");
      })
      .catch((e) => {
        setLoadError(`辞書ファイルの読み込みに失敗しました: ${e instanceof Error ? e.message : String(e)}`);
        setHeaders([]);
        setRows([]);
      });
  }, [selectedDic]);

  // 検索実行
  const handleSearch = useCallback(() => {
    setHasSearched(true);
    setResultExceeded(false);
    if (searchText.trim() === "") {
      setMatchedCells(new Set());
      setHasSearched(false);
      return;
    }
    const activeCols =
      selectedCols.every((v) => !v)
        ? headers.map(() => true)
        : selectedCols;

    const matched = new Set<string>();
    let matchedRowCount = 0;
    let exceeded = false;
    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      let rowHit = false;
      for (let ci = 0; ci < headers.length; ci++) {
        if (!activeCols[ci]) continue;
        const cell = row[ci] ?? "";
        let hit = false;
        if (searchType === "partial") {
          hit = cell.includes(searchText);
        } else if (searchType === "anagram") {
          const pattern = parseAnagramPattern(searchText);
          hit = matchAnagram(pattern, cell);
        } else {
          try {
            const re = new RegExp(searchText);
            hit = re.test(cell);
          } catch {
            hit = false;
          }
        }
        if (hit) {
          matched.add(`${rowIdx}-${ci}`);
          rowHit = true;
        }
      }
      if (rowHit) {
        matchedRowCount++;
        if (matchedRowCount > MAX_RESULTS) {
          exceeded = true;
          break;
        }
      }
    }
    setResultExceeded(exceeded);
    setMatchedCells(matched);
  }, [searchText, searchType, selectedCols, headers, rows]);

  // 全選択 / 全解除
  const allSelected = selectedCols.length > 0 && selectedCols.every((v) => v);
  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedCols(new Array(headers.length).fill(false));
    } else {
      setSelectedCols(new Array(headers.length).fill(true));
    }
  };

  // 列コピー（選択カラムをコピー）
  const handleColCopy = () => {
    const activeCols = selectedCols.every((v) => !v)
      ? headers.map(() => true)
      : selectedCols;

    const activeColIndices = headers
      .map((_, ci) => ci)
      .filter((ci) => activeCols[ci]);

    const lines = rows.map((row) =>
      activeColIndices.map((ci) => row[ci] ?? "").join(",")
    );
    navigator.clipboard.writeText(lines.join("\n")).catch(() => {});
  };

  const visibleRows = rows
    .map((row, ri) => ({ row, ri }))
    .filter(({ ri }) => {
      if (!hasSearched) return ri < MAX_RESULTS;
      return headers.some((_, ci) => matchedCells.has(`${ri}-${ci}`));
    });

  const handleSingleColCopy = (ci: number) => {
    const lines = visibleRows.map(({ row }) => row[ci] ?? "");
    navigator.clipboard.writeText(lines.join("\n")).catch(() => {});
  };

  // カラムタイトルのトグル
  const toggleCol = (ci: number) => {
    setSelectedCols((prev) => {
      const next = [...prev];
      next[ci] = !next[ci];
      return next;
    });
  };

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <div className="mb-4">
        <Link href="/" className="text-blue-600 hover:underline text-sm">
          ← トップへ戻る
        </Link>
      </div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">検索・辞書</h1>
        <button
          onClick={() => setShowHelp((v) => !v)}
          className="text-sm border rounded px-3 py-1 hover:bg-gray-100 transition-colors"
        >
          {showHelp ? "閉じる" : "使い方"}
        </button>
      </div>

      {showHelp && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded text-sm leading-relaxed">
          <h2 className="font-bold mb-2">使い方</h2>
          <ol className="list-decimal list-inside space-y-1.5">
            <li>「辞書選択」で使いたい辞書を選びます。</li>
            <li>検索ワードを入力して「検索」ボタン（またはEnterキー）を押すと、ヒットした行がハイライト表示されます。</li>
            <li>
              <span className="font-semibold">部分一致</span>：入力文字列が含まれる行を検索します。
            </li>
            <li>
              <span className="font-semibold">正規表現</span>：正規表現パターンで検索します。例: <code className="bg-white px-1 rounded border">^あ</code>
            </li>
            <li>
              <span className="font-semibold">アナグラム</span>：文字の並び替えで一致する行を検索します。<code className="bg-white px-1 rounded border">.</code>は任意の1文字、<code className="bg-white px-1 rounded border">[あいう]</code>はいずれか1文字にマッチします。
            </li>
            <li>カラム見出しをクリックすると、そのカラムだけを検索対象に絞れます（複数選択可）。</li>
            <li>カラム見出し右端の <span className="inline-block align-middle"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline h-4 w-4"><rect x="9" y="9" width="10" height="10" rx="2"/><path d="M5 15V7a2 2 0 0 1 2-2h8"/></svg></span> アイコンを押すと、現在表示中のその列の値をクリップボードにコピーします。</li>
            <li>「全選択」で全カラムを選択、「列コピー」で選択中カラムの全データをコピーします。</li>
          </ol>
        </div>
      )}

      {/* 検索エリア */}
      <div className="flex flex-col gap-3 mb-4">
        {/* 区分 */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="radio"
              name="searchType"
              value="partial"
              checked={searchType === "partial"}
              onChange={() => setSearchType("partial")}
            />
            部分一致
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="radio"
              name="searchType"
              value="regex"
              checked={searchType === "regex"}
              onChange={() => setSearchType("regex")}
            />
            正規表現
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="radio"
              name="searchType"
              value="anagram"
              checked={searchType === "anagram"}
              onChange={() => setSearchType("anagram")}
            />
            アナグラム
          </label>
        </div>

        {/* 検索テキスト + ボタン */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            placeholder="検索単語を入力"
            className="border rounded px-3 py-1.5 w-52 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={handleSearch}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 rounded transition-colors"
          >
            検索
          </button>
          <button
            onClick={() => { setSearchText(""); setMatchedCells(new Set()); setHasSearched(false); setResultExceeded(false); }}
            className="bg-gray-200 hover:bg-gray-300 px-4 py-1.5 rounded transition-colors"
          >
            リセット
          </button>
        </div>
      </div>

      {/* 辞書選択 */}
      <div className="flex items-center gap-3 mb-4">
        <label className="font-semibold">辞書選択</label>
        <select
          value={selectedDic}
          onChange={(e) => setSelectedDic(e.target.value)}
          className="border rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">-- 辞書を選択してください --</option>
          {dicList.map((d) => (
            <option key={d.file} value={d.file}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* エラー表示 */}
      {loadError && (
        <div className="mb-4 px-4 py-2 bg-red-100 text-red-700 border border-red-300 rounded">
          {loadError}
        </div>
      )}

      {/* 全選択 / コピーボタン */}
      {headers.length > 0 && (
        <div className="flex gap-3 mb-3">
          <button
            onClick={handleSelectAll}
            className="bg-gray-200 hover:bg-gray-300 px-4 py-1.5 rounded transition-colors text-sm font-semibold"
          >
            {allSelected ? "全解除" : "全選択"}
          </button>
          <button
            onClick={handleColCopy}
            className="bg-gray-200 hover:bg-gray-300 px-4 py-1.5 rounded transition-colors text-sm font-semibold"
          >
            列コピー
          </button>
        </div>
      )}

      {/* 最大件数超過警告 */}
      {resultExceeded && (
        <div className="mb-3 px-4 py-2 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded">
          最大件数を超えました（先頤50件のみ表示）
        </div>
      )}

      {/* 辞書テーブル */}
      {headers.length > 0 && (
        <div className="overflow-x-auto">
          <table className="border-collapse text-sm">
            <thead>
              <tr>
                {headers.map((h, ci) => (
                  <th
                    key={ci}
                    onClick={() => toggleCol(ci)}
                    className={`border px-1.5 py-1 cursor-pointer select-none transition-colors whitespace-nowrap min-w-[4em] ${
                      selectedCols[ci]
                        ? "bg-blue-400 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>{h}</span>
                      <button
                        type="button"
                        aria-label={`${h}列をコピー`}
                        title={`${h}列をコピー`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSingleColCopy(ci);
                        }}
                        className="rounded p-0.5 hover:bg-black/10"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="h-4 w-4"
                        >
                          <rect x="9" y="9" width="10" height="10" rx="2" />
                          <path d="M5 15V7a2 2 0 0 1 2-2h8" />
                        </svg>
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(({ row, ri }) => (
                <tr
                  key={ri}
                  className={ri % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  {headers.map((_, ci) => (
                    <td
                      key={ci}
                      className={`border px-1.5 py-1 whitespace-nowrap min-w-[4em]${
                        matchedCells.has(`${ri}-${ci}`) ? " bg-yellow-200" : ""
                      }`}
                    >
                      {row[ci] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
