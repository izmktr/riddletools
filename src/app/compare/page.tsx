"use client";
import { useState } from "react";
import Link from "next/link";

export default function ComparePage() {
  const [showManual, setShowManual] = useState(false);
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
      <div className="mb-4">
        <Link href="/" className="text-blue-500 hover:text-blue-700 text-sm">
          ← トップに戻る
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-4">文字比較ツール</h1>
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
            <h3 className="text-xl font-bold mb-2">文字比較ツールの使い方</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>左側・右側のテキストエリアに比較したい文字列を入力してください（複数行可）。</li>
              <li>左だけにある文字・右だけにある文字がそれぞれ表示されます。</li>
              <li>リセットボタンで両方の入力を消去できます。</li>
              <li>空白や改行は無視され、文字ごとに個数を比較します。</li>
              <li>同じ文字が複数回出現する場合、相殺されて余った分だけ表示されます。</li>
            </ul>
          </div>
        </div>
      )}
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
