"use client";
import { useState } from "react";

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
  const [input, setInput] = useState("");
  const words = input.split(/\r?\n/).map(w => w.trim()).filter(Boolean);
  const chains = words.length > 0 ? findAllShiritoriChains(words) : [];

  return (
    <main className="max-w-xl mx-auto p-6">
      <a href="/" className="inline-block mb-4 px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">トップに戻る</a>
      <h2 className="text-2xl font-bold mb-4">しりとりソルバー</h2>
      <textarea
        className="w-full h-32 p-2 border rounded mb-4"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="単語を改行で区切って入力してください"
      />
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
