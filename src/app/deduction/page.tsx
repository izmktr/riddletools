"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { solvePuzzle, type SolveResult } from "./solver";

const SAMPLE_INPUT = `名前[一郎,次郎,花子]
食べ物[カツ丼,ハンバーグ,カレー]
値段[800,900,1000]
順位[]
一郎=カツ丼
次郎=ハンバーグ
花子=1000
カツ丼=800
一郎.順位<次郎
次郎.順位<花子`;

export default function DeductionPage() {
  const [input, setInput] = useState(SAMPLE_INPUT);
  const [result, setResult] = useState<SolveResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const solutionCountText = useMemo(() => {
    if (!result) {
      return "";
    }
    if (result.solutions.length === 0) {
      return "解なし";
    }
    if (result.hasMore) {
      return `${result.solutions.length}件以上（表示上限に到達）`;
    }
    return `${result.solutions.length}件`;
  }, [result]);

  const handleSolve = () => {
    try {
      const solved = solvePuzzle(input, 100);
      setResult(solved);
      setError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "不明なエラーが発生しました";
      setError(message);
      setResult(null);
    }
  };

  const handleClear = () => {
    setInput("");
    setResult(null);
    setError(null);
  };

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-4">
      <div>
        <Link href="/" className="text-blue-500 hover:text-blue-700 text-sm">
          ← トップに戻る
        </Link>
      </div>

      <h1 className="text-2xl font-bold">推理パズルソルバー</h1>

      <p className="text-sm text-gray-700">
        仕様どおりの定義文を入力して、条件を満たすすべての解を探索します。
      </p>

      <textarea
        className="w-full h-72 border rounded p-3 font-mono text-sm"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        aria-label="推理パズル定義入力"
        placeholder="カテゴリ定義と条件定義を入力"
      />

      <div className="flex flex-wrap gap-2">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={handleSolve}
        >
          解く
        </button>
        <button
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          onClick={handleClear}
        >
          クリア
        </button>
        <button
          className="px-4 py-2 bg-green-100 text-green-800 rounded hover:bg-green-200"
          onClick={() => {
            setInput(SAMPLE_INPUT);
            setResult(null);
            setError(null);
          }}
        >
          サンプル
        </button>
      </div>

      {error && (
        <div className="border border-red-300 bg-red-50 text-red-800 rounded p-3">
          エラー: {error}
        </div>
      )}

      {result && !error && (
        <section className="space-y-4">
          {result.warnings.length > 0 && (
            <div className="border border-yellow-300 bg-yellow-50 text-yellow-900 rounded p-3">
              <h2 className="font-bold mb-1">警告</h2>
              <ul className="list-disc pl-5 text-sm">
                {result.warnings.map((warning, idx) => (
                  <li key={`${warning.line}-${idx}`}>
                    L{warning.line}: {warning.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-sm font-semibold">解の件数: {solutionCountText}</div>

          {result.solutions.map((rows, index) => (
            <div key={index} className="border rounded p-3 overflow-auto">
              <h3 className="font-bold mb-2">解 {index + 1}</h3>
              <table className="min-w-full border text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    {result.categories.map((category) => (
                      <th key={category.name} className="border px-2 py-1 text-left">
                        {category.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td key={`${rowIndex}-${cellIndex}`} className="border px-2 py-1">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
