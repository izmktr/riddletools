"use client";
import { useState } from "react";
import Link from "next/link";

export default function ComparePage() {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");

  // リセットボタン用
  const handleReset = () => {
    setLeft("");
    setRight("");
  };

  const leftChars = Array.from(left.replace(/\r?\n/g, ""));
  const rightChars = Array.from(right.replace(/\r?\n/g, ""));

  // 文字ごとにカウント
  const leftCount: Record<string, number> = {};
  const rightCount: Record<string, number> = {};
  leftChars.forEach(c => { leftCount[c] = (leftCount[c] || 0) + 1; });
  rightChars.forEach(c => { rightCount[c] = (rightCount[c] || 0) + 1; });

  // 左だけにある文字
  const onlyLeftArr: string[] = [];
  Object.keys(leftCount).forEach(c => {
    const diff = leftCount[c] - (rightCount[c] || 0);
    if (diff > 0) onlyLeftArr.push(...Array(diff).fill(c));
  });
  // 右だけにある文字
  const onlyRightArr: string[] = [];
  Object.keys(rightCount).forEach(c => {
    const diff = rightCount[c] - (leftCount[c] || 0);
    if (diff > 0) onlyRightArr.push(...Array(diff).fill(c));
  });

  return (
    <main className="max-w-xl mx-auto p-6">
      <Link href="/" className="inline-block mb-4 px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">トップに戻る</Link>
      <h2 className="text-2xl font-bold mb-4">文字比較ツール</h2>
      <div className="flex gap-4 mb-4">
        <textarea
          className="w-1/2 h-32 p-2 border rounded"
          value={left}
          onChange={e => setLeft(e.target.value)}
          placeholder="左側の文字列を入力"
        />
        <textarea
          className="w-1/2 h-32 p-2 border rounded"
          value={right}
          onChange={e => setRight(e.target.value)}
          placeholder="右側の文字列を入力"
        />
      </div>
      <button
        className="mb-4 px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
        onClick={handleReset}
      >リセット</button>
       <div className="flex gap-8">
        <div className="w-1/2">
          <h3 className="font-semibold mb-2">左だけにある文字</h3>
          <div className="p-2 border rounded min-h-[40px]">{onlyLeftArr.join(" ")}</div>
        </div>
        <div className="w-1/2">
          <h3 className="font-semibold mb-2">右だけにある文字</h3>
          <div className="p-2 border rounded min-h-[40px]">{onlyRightArr.join(" ")}</div>
        </div>
      </div>
    </main>
  );
}
