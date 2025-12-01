"use client";
import { useState } from "react";
import Link from "next/link";

export default function CountPage() {
  const [showManual, setShowManual] = useState(false);
  const [text, setText] = useState("");
  const [sortType, setSortType] = useState<string | null>("count");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [filterType, setFilterType] = useState<string | null>(null);

  // 文字ごとのカウント
  const charCount = Array.from(text.replace(/\r?\n/g, "")).reduce((acc, c) => {
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  let result = Object.entries(charCount);
  if (sortType === "char") {
    result = sortOrder === "asc" 
      ? result.sort((a, b) => a[0].localeCompare(b[0]))
      : result.sort((a, b) => b[0].localeCompare(a[0]));
  }
  if (sortType === "count") {
    result = sortOrder === "asc"
      ? result.sort((a, b) => a[1] - b[1])
      : result.sort((a, b) => b[1] - a[1]);
  }
  if (filterType === "odd") result = result.filter(([, count]) => count % 2 === 1);
  if (filterType === "even") result = result.filter(([, count]) => count % 2 === 0);

  const handleSortClick = (type: string) => {
    if (sortType === type) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortType(type);
      setSortOrder("asc");
    }
  };

  return (
    <main className="max-w-xl mx-auto p-6">
      <div className="mb-4">
        <Link href="/" className="text-blue-500 hover:text-blue-700 text-sm">
          ← トップに戻る
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-4">文字数カウントツール</h1>
      <div className="flex items-center mb-4 gap-2">
        <button
          className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200"
          onClick={() => setShowManual(true)}
        >使い方</button>
      </div>
      {showManual && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 max-w-lg w-full relative">
            <button
              className="absolute top-2 right-2 px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => setShowManual(false)}
            >閉じる</button>
            <h3 className="text-xl font-bold mb-2">文字数カウントツールの使い方</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>テキストエリアに文字列を入力してください（複数行可）。</li>
              <li>各文字の出現個数が表で表示されます。</li>
              <li>並び替え（文字/個数）、奇数・偶数個のみ表示のフィルタが利用できます。</li>
              <li>奇数個のみの表示は「ババ抜きしろ」の問題に最適です。</li>
              <li>リセットボタンで入力とフィルタをすべて消去できます。</li>
              <li>空白や改行は無視され、文字ごとにカウントされます。</li>
            </ul>
          </div>
        </div>
      )}
      <h2 className="text-2xl font-bold mb-4">文字数カウントツール</h2>
      <textarea
        className="w-full h-32 p-2 border rounded mb-4"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="複数行入力できます"
      />
      <div className="mb-4">
        <div className="mb-2">
          <span className="text-sm font-semibold mr-2">並び替え:</span>
          <div className="inline-flex gap-2">
            <button 
              className={`px-3 py-1 rounded ${sortType === "count" ? "bg-blue-500 text-white" : "bg-blue-200"}`}
              onClick={() => handleSortClick("count")}
            >
              個数({sortType === "count" ? (sortOrder === "asc" ? "昇順" : "降順") : "昇順"})
            </button>
            <button 
              className={`px-3 py-1 rounded ${sortType === "char" ? "bg-blue-500 text-white" : "bg-blue-200"}`}
              onClick={() => handleSortClick("char")}
            >
              文字({sortType === "char" ? (sortOrder === "asc" ? "昇順" : "降順") : "昇順"})
            </button>
          </div>
        </div>
        <div className="mb-2">
          <span className="text-sm font-semibold mr-2">絞り込み:</span>
          <div className="inline-flex gap-2">
            <button 
              className={`px-3 py-1 rounded ${filterType === null ? "bg-blue-500 text-white" : "bg-blue-200"}`}
              onClick={() => setFilterType(null)}
            >
              なし
            </button>
            <button 
              className={`px-3 py-1 rounded ${filterType === "odd" ? "bg-blue-500 text-white" : "bg-blue-200"}`}
              onClick={() => setFilterType("odd")}
            >
              奇数個のみ
            </button>
            <button 
              className={`px-3 py-1 rounded ${filterType === "even" ? "bg-blue-500 text-white" : "bg-blue-200"}`}
              onClick={() => setFilterType("even")}
            >
              偶数個のみ
            </button>
          </div>
        </div>
        <div>
          <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => {setSortType(null);setSortOrder("asc");setFilterType(null);setText("");}}>リセット</button>
        </div>
      </div>
      <div>
        <table className="w-full border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2">文字</th>
              <th className="border px-2">個数</th>
            </tr>
          </thead>
          <tbody>
            {result.map(([char, count]) => (
              <tr key={char}>
                <td className="border px-2">{char === " " ? "(空白)" : char}</td>
                <td className="border px-2">{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
