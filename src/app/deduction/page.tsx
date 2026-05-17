"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { solvePuzzle, type SolveResult } from "@/app/deduction/solver";

const SAMPLE_INPUT_1 = `名前[一郎,次郎,花子]
食べ物[カツ丼,ハンバーグ,カレー]
値段[800,900,1000]
順位[]
一郎=カツ丼
次郎=ハンバーグ
花子=1000
カツ丼=800
一郎.順位<次郎.順位
次郎.順位<花子.順位`;

const SAMPLE_INPUT_2 = `人物[A,B,C]
正直{}
犯人{}
正直.len>=1
犯人.len=1
犯人 -> !正直
A=正直:B=犯人
B=正直:A!=犯人
C=正直:B=犯人`;

export default function DeductionPage() {
  const [showManual, setShowManual] = useState(false);
  const [showGrammar, setShowGrammar] = useState(false);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<SolveResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortState, setSortState] = useState<{ col: number; direction: "asc" | "desc" } | null>(null);

  const toggleSort = (ci: number) => {
    setSortState((prev) => {
      if (!prev || prev.col !== ci) return { col: ci, direction: "asc" };
      if (prev.direction === "asc") return { col: ci, direction: "desc" };
      return null;
    });
  };

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
    setSortState(null);
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
    setSortState(null);
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
            setInput(SAMPLE_INPUT_1);
            setResult(null);
            setError(null);
          }}
        >
          サンプル1
        </button>
        <button
          className="px-4 py-2 bg-green-100 text-green-800 rounded hover:bg-green-200"
          onClick={() => {
            setInput(SAMPLE_INPUT_2);
            setResult(null);
            setError(null);
          }}
        >
          サンプル2
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
              <li>カテゴリとタグを先に定義します（例: 名前[一郎,次郎]、正直{}）。</li>
              <li>続けて条件定義を記述し、「解く」を押すと解の一覧を表示します。</li>
              <li>等号、不等号、射影、右辺リスト、四則演算に対応しています。</li>
              <li>{`タグの値を省略すると {true,false} として補完されます。`}</li>
              <li>等号条件でタグ名のみを書くと、そのタグの値1を指す糖衣構文です。</li>
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
              <h3 className="font-semibold">3. タグ定義</h3>
              <pre className="bg-gray-50 border rounded p-3 text-xs overflow-x-auto">
{`正直{}
判定{yes,no}`}
              </pre>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>タグは複数のセットにまたがって同じ値が選ばれてよい分類です。</li>
                <li>{`値を省略した場合 {} は {true,false} として補完されます。`}</li>
                <li>タグは2個以上の値が必要です。</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold">4. 等号条件</h3>
              <pre className="bg-gray-50 border rounded p-3 text-xs overflow-x-auto">
{`一郎 = カツ丼
次郎 != カレー
一郎 = カレー,ハンバーグ  # 一郎はカレーまたはハンバーグ
A = 正直                 # A=正直.true 
B != 正直                # B!=正直.true 
次郎.順位 = 2
一郎.順位 = 次郎.順位 + 1 # 次郎は一郎の次の順位
`}
              </pre>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>= は同じセット、!= は別セットを意味します。</li>
                <li>右辺をカンマ区切りで複数指定できます。</li>
                <li>= の右辺リストは OR、!= の右辺リストは AND として評価します。</li>
                <li>右辺にタグ名のみを書いた場合は、タグの値1を指します。</li>
                <li>左辺・右辺ともにカテゴリ名は省略可能ですが、曖昧ならエラーになります。</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold">5. 不等号条件</h3>
              <pre className="bg-gray-50 border rounded p-3 text-xs overflow-x-auto">
{`一郎.値段 < 次郎.値段
一郎.値段 <= 900
一郎.価格 < 次郎.価格*2
一郎.得点 < 次郎.順位*30
`}
              </pre>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>比較演算子は &lt;, &gt;, &lt;=, &gt;= が使えます。</li>
                <li>不等号条件の左右は、同一カテゴリ（または同一タグ）に属する必要があります。<br/>
                ただし、左右のどちらかに四則演算を含む場合はこの制約の対象外です。</li>
                <li>左辺は 比較対象.比較カテゴリ の形で指定します。</li>
                <li>数値に変換できない値は、カテゴリ内の位置 (1起源) で比較されます。</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold">6. 算術式</h3>
              <pre className="bg-gray-50 border rounded p-3 text-xs overflow-x-auto">
{`一郎.順位 = 次郎.順位+1
一郎.価格 < 次郎.価格*2
一郎.価格 < (次郎.価格+花子.価格)/2
一郎.単価*一郎.個数 <= 次郎.単価*次郎.個数
`}
              </pre>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>算術式では +, -, *, / が使えます。</li>
                <li>等号条件・不等号条件の左右辺に算術式を使えます。</li>
                <li>() を使うと評価の優先順位を操作できます。</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold">7. 論理演算子</h3>
              <pre className="bg-gray-50 border rounded p-3 text-xs overflow-x-auto">
{`A = 赤 | B = 赤 & A = 青
A = 赤 ^ B = 赤
A = 赤 : B = 赤
A = 赤 -> B = 赤`}
              </pre>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>論理演算子は &amp;, |, ^, :, -&gt; が使えます。</li>
                <li>&amp; は AND、| は OR、^ は XOR、: は NXOR (同値)、-&gt; は IMP (推論) です。</li>
                <li>IMP: A-&gt;B は「AならばB」を意味します（(not A) or B と等価）。</li>
                <li>優先順位は &amp; &gt; | &gt; ^ / : / -&gt; です。</li>
                <li>同じ優先順位の演算子は左結合です。</li>
                <li>() で囲むと先に評価されます。</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold">8. 個数制約</h3>
              <pre className="bg-gray-50 border rounded p-3 text-xs overflow-x-auto">
{`正直{}
正直.len >= 2
性別{男,女}
男.len >= 3
性別.女.len = 1`}
              </pre>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>タグ名.len でタグの値1（最初の値）を持つセットの個数を取得します。</li>
                <li>タグ名.値名.len で指定した値を持つセットの個数を取得します。</li>
                <li>不等号や等号と組み合わせて個数制約を記述できます。</li>
                <li>カテゴリ値には使えません。</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold">9. 全称構文</h3>
              <pre className="bg-gray-50 border rounded p-3 text-xs overflow-x-auto">
{`人物[A,B,C]
犯人{}
正直{}
犯人 -> !正直   # A=犯人 -> A!=正直 / B=犯人 -> B!=正直 / C=犯人 -> C!=正直 に展開`}
              </pre>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>タグ名のみ・!タグ名のみで構成された条件行は全称構文として扱われます。</li>
                <li>最初のカテゴリの全ての値に対して条件が展開されます。</li>
                <li>タグ名 → 値=タグ名、!タグ名 → 値!=タグ名 に置換されます。</li>
                <li>最初のカテゴリの値名とタグ名が同じ行に混在する場合はエラーです。</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold">10. 最小サンプル</h3>
              <pre className="bg-gray-50 border rounded p-3 text-xs overflow-x-auto">
{`名前[一郎,次郎,花子]
食べ物[カツ丼,ハンバーグ,カレー]
値段[800,900,1000]
順位[]
一郎=カツ丼
次郎=ハンバーグ
花子=1000
一郎.順位<次郎.順位
次郎.順位<花子.順位`}
              </pre>
              <pre className="bg-gray-50 border rounded p-3 text-xs overflow-x-auto">
{`人物[A,B,C]
正直{}
犯人{}
正直.len>=1
犯人.len=1
犯人 -> !正直
A=正直:B=犯人
B=正直:A!=犯人
C=正直:B=犯人`}
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

          {result.solutions.map((rows, index) => {
            const sortedRows = sortState
              ? [...rows].sort((a, b) => {
                  const category = result.categories[sortState.col];
                  const aIdx = category.values.indexOf(a[sortState.col] ?? "");
                  const bIdx = category.values.indexOf(b[sortState.col] ?? "");
                  return sortState.direction === "asc" ? aIdx - bIdx : bIdx - aIdx;
                })
              : rows;
            return (
              <div key={index} className="border rounded p-3 overflow-auto">
                <h3 className="font-bold mb-2">解 {index + 1}</h3>
                <table className="w-auto border text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      {result.categories.map((category, ci) => (
                        <th key={category.name} className="border px-2 py-1 text-left whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <span>{category.name}</span>
                            <button
                              type="button"
                              aria-label={`${category.name}列で並び替え`}
                              title={`${category.name}列で並び替え`}
                              onClick={() => toggleSort(ci)}
                              className={`rounded p-0.5 hover:bg-black/10 ${sortState?.col === ci ? "bg-black/10" : ""}`}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="h-4 w-4"
                              >
                                {sortState?.col === ci && sortState.direction === "asc" ? (
                                  <path d="m8 7 4-4 4 4M12 3v18" />
                                ) : sortState?.col === ci && sortState.direction === "desc" ? (
                                  <path d="m8 17 4 4 4-4M12 21V3" />
                                ) : (
                                  <><path d="m8 7 4-4 4 4" /><path d="M12 3v18" /><path d="m8 17 4 4 4-4" /></>
                                )}
                              </svg>
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td key={`${rowIndex}-${cellIndex}`} className="border px-2 py-1 whitespace-nowrap">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
