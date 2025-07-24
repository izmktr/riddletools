"use client";
import { useState } from "react";
import Link from "next/link";

export default function CountPage() {
  const [text, setText] = useState("");
  const [sortType, setSortType] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);

  // 文字ごとのカウント
  const charCount = Array.from(text.replace(/\r?\n/g, "")).reduce((acc, c) => {
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  let result = Object.entries(charCount);
  if (sortType === "char") result = result.sort((a, b) => a[0].localeCompare(b[0]));
  if (sortType === "count") result = result.sort((a, b) => b[1] - a[1]);
  if (filterType === "odd") result = result.filter(([_, count]) => count % 2 === 1);
  if (filterType === "even") result = result.filter(([_, count]) => count % 2 === 0);

  return (
    <main className="max-w-xl mx-auto p-6">
      <Link href="/" className="inline-block mb-4 px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">トップに戻る</Link>
      <h2 className="text-2xl font-bold mb-4">文字数カウントツール</h2>
      <textarea
        className="w-full h-32 p-2 border rounded mb-4"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="複数行入力できます"
      />
      <div className="flex gap-2 mb-4">
        <button className="px-3 py-1 bg-blue-200 rounded" onClick={() => setSortType("char")}>並び替え(文字)</button>
        <button className="px-3 py-1 bg-blue-200 rounded" onClick={() => setSortType("count")}>並び替え(個数)</button>
        <button className="px-3 py-1 bg-blue-200 rounded" onClick={() => setFilterType("odd")}>奇数個のみ表示</button>
        <button className="px-3 py-1 bg-blue-200 rounded" onClick={() => setFilterType("even")}>偶数個のみ表示</button>
        <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => {setSortType(null);setFilterType(null);setText("");}}>リセット</button>
      </div>
      <div>
        <table className="w-full border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2">文字</th>
              <th className="border px-2">数</th>
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
