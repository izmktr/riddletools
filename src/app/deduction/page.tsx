"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { solvePuzzle, type SolveResult } from "@/app/deduction/solver";

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
  const [showManual, setShowManual] = useState(false);
  const [showGrammar, setShowGrammar] = useState(false);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<SolveResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formatErrorMessage = (message: string): string => {
    const match = message.match(/^L(\d+):\s*(.*)$/);
    if (!match) {
      return `エラー: ${message}`;
    }

    const lineNumber = Number(match[1]);
    const lineText = input.split(/\r?\n/)[lineNumber - 1] ?? "";
    const detail = match[2] || "不明なエラーが発生しました";

    return `${lineNumber}:${lineText}\nエラー: ${detail}`;
  };

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
      setError(formatErrorMessage(message));
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
      <div className="flex flex-wrap gap-2">
        <button
          className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200"
          onClick={() => setShowManual(true)}
        >
          使い方
        </button>
        <button
          className="px-4 py-2 bg-emerald-100 text-emerald-800 rounded hover:bg-emerald-200"
          onClick={() => setShowGrammar(true)}
        >
          文法
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

      {showManual && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 max-w-2xl w-full relative">
            <button
              className="absolute top-2 right-2 px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => setShowManual(false)}
            >
              閉じる
            </button>
            <h2 className="text-xl font-bold mb-3">使い方</h2>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>カテゴリ定義を先に記述します（例: 名前[一郎,次郎,花子]）。</li>
              <li>続けて条件定義を記述し、「解く」を押すと解の一覧を表示します。</li>
              <li>等号、不等号、射影、右辺リスト、四則演算に対応しています。</li>
              <li>解析エラーがある場合は「行番号:行内容」と「エラー:詳細」を表示します。</li>
              <li>「サンプル」で入力例を復元、「クリア」で入力と結果を消去できます。</li>
            </ul>
          </div>
        </div>
      )}

      {showGrammar && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 max-w-3xl w-full max-h-[85vh] overflow-auto relative space-y-4">
            <button
              className="absolute top-2 right-2 px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => setShowGrammar(false)}
            >
              閉じる
            </button>

            <h2 className="text-xl font-bold pr-16">文法ガイド</h2>
            <p className="text-sm text-gray-700">
              このスクリプトは、上から順にカテゴリ定義と条件定義を並べて記述します。条件行はすべてANDで評価されます。
            </p>

            <section className="space-y-2">
              <h3 className="font-semibold">1. 基本ルール</h3>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>1行に1つの定義を書きます。</li>
                <li>半角スペースとタブは無視されます。</li>
                <li># 以降はコメントとして無視されます。</li>
                <li>カテゴリ名・値名には . , [ ] と空白は使えません。</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold">2. カテゴリ定義</h3>
              <pre className="bg-gray-50 border rounded p-3 text-xs overflow-x-auto">
{`カテゴリ名[値1,値2,値3]
カテゴリ名[]`}
              </pre>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>最初のカテゴリは1個以上の値が必要です。</li>
                <li>以降のカテゴリは、最初と同じ値数か空配列 [] を指定します。</li>
                <li>[] を使うと 1,2,3,... の連番が自動補完されます。</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold">3. 等号条件</h3>
              <pre className="bg-gray-50 border rounded p-3 text-xs overflow-x-auto">
{`一郎=カツ丼
次郎!=カレー
一郎=カレー,ハンバーグ
次郎.順位=2
一郎.順位=次郎.順位+1`}
              </pre>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>= は同じセット、!= は別セットを意味します。</li>
                <li>右辺をカンマ区切りで複数指定できます。</li>
                <li>= の右辺リストは OR、!= の右辺リストは AND として評価します。</li>
                <li>左辺・右辺ともにカテゴリ名は省略可能ですが、曖昧ならエラーになります。</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold">4. 論理演算子</h3>
              <pre className="bg-gray-50 border rounded p-3 text-xs overflow-x-auto">
{`性別{男,女}
A=赤|B=赤&A=青
A=赤^A=赤
A=赤!^A=赤`}
              </pre>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>論理演算子は &amp;, |, ^, !^ が使えます。</li>
                <li>優先順位は &amp; &gt; ^ / !^ &gt; | です。</li>
                <li>同じ優先順位の演算子は左結合です。</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold">5. 不等号条件と算術式</h3>
              <pre className="bg-gray-50 border rounded p-3 text-xs overflow-x-auto">
{`一郎.値段<次郎
一郎.値段<=900
一郎.価格<次郎.価格*2`}
              </pre>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>比較演算子は &lt;, &gt;, &lt;=, &gt;= が使えます。</li>
                <li>算術式では +, -, *, / が使えます。</li>
                <li>数値に変換できない値は、カテゴリ内の位置 (1起源) で比較されます。</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold">6. 最小サンプル</h3>
              <pre className="bg-gray-50 border rounded p-3 text-xs overflow-x-auto">
{`名前[一郎,次郎,花子]
食べ物[カツ丼,ハンバーグ,カレー]
値段[800,900,1000]
順位[]
一郎=カツ丼
次郎=ハンバーグ
花子=1000
一郎.順位<次郎
次郎.順位<花子`}
              </pre>
            </section>
          </div>
        </div>
      )}

      <p className="text-sm text-gray-700">
        推理パズルを解きます。
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

      </div>

      {error && (
        <div className="border border-red-300 bg-red-50 text-red-800 rounded p-3 whitespace-pre-wrap">
          {error}
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
