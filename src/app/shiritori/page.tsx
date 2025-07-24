"use client";
import { useState } from "react";
import Link from "next/link";

function findAllShiritoriChains(words: string[]): string[][] {
  const unused = [...words];
  const chains: string[][] = [];
  while (unused.length > 0) {
    let maxPath: string[] = [];
    function dfs(path: string[], rest: string[]) {
      if (path.length > maxPath.length) maxPath = [...path];
      const last = path[path.length - 1];
      const nexts = rest.filter(w => last[last.length - 1] === w[0]);
      for (const next of nexts) {
        dfs([...path, next], rest.filter(w => w !== next));
      }
    }
    for (const w of unused) {
      dfs([w], unused.filter(x => x !== w));
    }
    if (maxPath.length === 0) {
      // 余った単語がしりとりできない場合
      maxPath = [unused[0]];
    }
    chains.push(maxPath);
    // 使った単語をunusedから除去
    maxPath.forEach(w => {
      const idx = unused.indexOf(w);
      if (idx !== -1) unused.splice(idx, 1);
    });
  }
  return chains;
}

export default function ShiritoriPage() {
  const [showManual, setShowManual] = useState(false);
  const [input, setInput] = useState("");
  const words = input.split(/\r?\n/).map(w => w.trim()).filter(Boolean);
  const chains = words.length > 0 ? findAllShiritoriChains(words) : [];

  // リセットボタン用
  const handleReset = () => {
    setInput("");
  };

  return (
    <main className="max-w-xl mx-auto p-6">
      <div className="flex items-center mb-4 gap-2">
        <button
          className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200"
          onClick={() => setShowManual(true)}
        >使い方</button>
        <Link href="/" className="inline-block px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">トップに戻る</Link>
      </div>
      {showManual && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 max-w-lg w-full relative">
            <button
              className="absolute top-2 right-2 px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => setShowManual(false)}
            >閉じる</button>
            <h3 className="text-xl font-bold mb-2">しりとりソルバーの使い方</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>テキストエリアに単語を改行区切りで入力してください。</li>
              <li>すべての単語を使った最長のしりとり組み合わせが表示されます。</li>
              <li>余った単語がしりとりできない場合は、その単語のみ表示されます。</li>
              <li>リセットボタンで入力を消去できます。</li>
            </ul>
          </div>
        </div>
      )}
      <h2 className="text-2xl font-bold mb-4">しりとりソルバー</h2>
      <textarea
        className="w-full h-32 p-2 border rounded mb-4"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="単語を改行で区切って入力してください"
      />
      <button
        className="mb-4 px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
        onClick={handleReset}
      >リセット</button>
      <div>
        <h3 className="font-semibold mb-2">すべての単語を使ったしりとり組み合わせ</h3>
        <div className="p-2 border rounded min-h-[40px] space-y-2">
          {chains.length > 0
            ? chains.map((chain, i) => (
                <div key={i}>{chain.join(" → ")}</div>
              ))
            : "結果がここに表示されます"}
        </div>
      </div>
    </main>
  );
}
