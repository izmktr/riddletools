"use client";
import { useState } from "react";
import Link from "next/link";

export default function PickPage() {
  const [showManual, setShowManual] = useState(false);

  // サンプル挿入用
  const handleSample = () => {
    setLeft("おや\nひとさし\nなか\nくすり\nこ");
    setRight("14\na3d2\n65\n.cb\n7");
    setTitle("732a5bdc");
    setShowManual(false);
  };

  // 全角→半角変換関数
  const toHalfWidth = (str: string) => str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));

  // useState宣言の直後にカスタムタイトルの紐づけ表生成ロジックを配置
  const customKeys: string[] = [];

  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [title, setTitle] = useState("");
  const [useTwoDigits, setUseTwoDigits] = useState(false);
  const [showInputTable, setShowInputTable] = useState(false);

  const normalizedTitle = toHalfWidth(title);
  if (normalizedTitle) {
    let i = 0;
    while (i < normalizedTitle.length) {
      const c = normalizedTitle[i];
      if (/[A-Za-z0-9]/.test(c)) {
        if (/[0-9]/.test(c) && useTwoDigits && i + 1 < normalizedTitle.length && /[0-9]/.test(normalizedTitle[i + 1])) {
          const key = normalizedTitle.slice(i, i + 2);
          customKeys.push(key);
          i += 2;
        } else {
          customKeys.push(c);
          i++;
        }
      } else {
        i++;
      }
    }
  }

  // 左右のテキストを行ごとに分割
  const leftLines = left.split(/\r?\n/).map(l => l.replace(/\s/g, ""));
  // 右側は全角→半角変換してから分割（空白は保持）
  const normalizedRight = toHalfWidth(right);
  const rightLines = normalizedRight.split(/\r?\n/);

  // 右側の各行ごとに数字・文字を抽出し、辞書を作成
  const dic: Record<string, string[]> = {};

  rightLines.forEach((rLine, lineIdx) => {
    let i = 0;
    let leftIdx = 0;
    const lStr = leftLines[lineIdx] ?? "";
    while (i < rLine.length) {
      const char = rLine[i];
      let key: string | null = null;
      let consumed = 1;

      if (/[A-Za-z]/.test(char)) {
        key = char;
      } else if (/[0-9]/.test(char)) {
        if (useTwoDigits && i + 1 < rLine.length && /[0-9]/.test(rLine[i + 1])) {
          // 次の文字が数字で、間に空白がない場合のみ2桁として扱う
          key = rLine.slice(i, i + 2);
          consumed = 2;
        } else {
          key = char;
        }
      } else if (char === " " || char === "　") {
        // 空白は無視。leftIdxも進めない
        i += consumed;
        continue;
      }

      // キーが見つかったか、その他の文字だった場合
      const value = lStr[leftIdx] ?? "?";
      if (key) {
        if (!dic[key]) {
          dic[key] = [];
        }
        // 重複しない場合のみ追加
        if (!dic[key].includes(value)) {
          dic[key].push(value);
        }
      }

      leftIdx++;
      i += consumed;
    }
  });

  // 表示用にキーをソート
  const sortedKeys = Object.keys(dic).sort((a, b) => {
    if (/^\d+$/.test(a) && /^\d+$/.test(b)) return Number(a) - Number(b);
    if (/^\d+$/.test(a)) return -1;
    if (/^\d+$/.test(b)) return 1;
    return a.localeCompare(b);
  });

  // 紐づけ結果を作成
  const mapping: Record<string, string> = {};
  sortedKeys.forEach(k => {
    mapping[k] = dic[k]?.join("") ?? "?";
  });

  // 逆引き用の辞書を作成（値からキーを引く）
  const valueToKeyMap: Record<string, string> = {};
  Object.entries(dic).forEach(([key, values]) => {
    values.forEach(value => {
      if (value !== '?') {
        // 複数のキーが同じ値に紐づく場合、最初のキーを優先する
        if (!valueToKeyMap[value]) {
          valueToKeyMap[value] = key;
        }
      }
    });
  });
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
            <h3 className="text-xl font-bold mb-2">文字拾いツールの使い方</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm mb-4">
              <li>左・右のテキストエリアに文字列や数字を入力してください（複数行可）。</li>
              <li>空白は無視されます。</li>
              <li>右側の数字・文字に応じて、左側の文字列から対応する文字を拾い出します。</li>
              <li>「カスタム出力」欄に文字や数字を入力すると、対応表が下部に表示されます。</li>
              <li>「2桁を使う」にチェックすると、右側・カスタム出力の数字が2桁単位で認識されます。</li>
              <li>「2桁を使う」場合で1桁をいれる場合は空白を挟んでください。</li>
              <li>リセットボタンで全入力を消去できます。</li>
            </ul>
            <button
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 mr-2"
              onClick={handleSample}
            >サンプル</button>
          </div>
        </div>
      )}
      <h2 className="text-2xl font-bold mb-4">文字拾いツール</h2>
      <div className="mb-4 flex gap-4">
        <textarea
          className="w-1/2 h-64 p-2 border rounded"
          value={left}
          onChange={e => setLeft(e.target.value)}
          placeholder="左：文字列（複数行可）"
        />
        <textarea
          className="w-1/2 h-64 p-2 border rounded"
          value={right}
          onChange={e => setRight(e.target.value)}
          placeholder="右：数字・文字（複数行可）"
        />
      </div>
      <div className="mb-4 flex gap-4 items-center">
        <input
          className="border rounded px-2 py-1 flex-1"
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="カスタム出力"
        />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={useTwoDigits}
            onChange={e => setUseTwoDigits(e.target.checked)}
          />
          2桁を使う
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showInputTable}
            onChange={e => setShowInputTable(e.target.checked)}
          />
          入力を表示する
        </label>
      </div>
        <button
          className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded ml-2"
          onClick={() => { setLeft(""); setRight(""); setTitle(""); }}
        >リセット</button>
      {showInputTable && (
        <div className="mb-2 mt-6 font-semibold">入力</div>
      )}
      {showInputTable && (
        <div className="flex flex-wrap mb-6 -mt-px -ml-px">
          {(() => {
            // 左右のテキストを行ごとに分割して処理
            const leftLines = left.split(/\r?\n/);
            const rightLines = normalizedRight.split(/\r?\n/);
            const maxLines = Math.max(leftLines.length, rightLines.length);
            
            const cells = [];
            
            for (let lineIndex = 0; lineIndex < maxLines; lineIndex++) {
              const leftLine = leftLines[lineIndex] || '';
              const rightLine = rightLines[lineIndex] || '';
              
              // 左側の行から文字を抽出（空白を除く）
              const leftChars = leftLine.split('').filter(char => char !== ' ' && char !== '　');
              
              // 右側の行から文字を抽出（空白は保持して処理）
              const rightChars = [];
              for (let i = 0; i < rightLine.length; i++) {
                const char = rightLine[i];
                if (char !== ' ' && char !== '　') {
                  rightChars.push(char);
                }
              }
              
              // この行での最大文字数
              const maxCharsInLine = Math.max(leftChars.length, rightChars.length);
              
              // 行の文字を処理
              for (let charIndex = 0; charIndex < maxCharsInLine; charIndex++) {
                const leftChar = leftChars[charIndex] || '';
                const rightChar = rightChars[charIndex] || '';
                
                cells.push(
                  <div key={`${lineIndex}-${charIndex}`} className="relative w-12 h-12 border border-gray-300 flex items-center justify-center bg-green-50">
                    {leftChar && valueToKeyMap[leftChar] && (
                      <span className="absolute top-0 left-1 text-[10px] text-gray-400 select-none">{valueToKeyMap[leftChar]}</span>
                    )}
                    {!leftChar && rightChar && /[A-Za-z0-9]/.test(rightChar) && (
                      <span className="absolute top-0 left-1 text-[10px] text-red-400 select-none">{rightChar}</span>
                    )}
                    <span className="text-xl font-bold">{leftChar || ''}</span>
                  </div>
                );
              }
              
              // 行の終わりで改行を追加（最後の行以外）
              if (lineIndex < maxLines - 1) {
                cells.push(<div key={`br-${lineIndex}`} className="w-full h-2" />);
              }
            }
            
            return cells;
          })()}
        </div>
      )}
      <div className="mb-2 font-semibold">{"出力"}</div>
      <div className="flex flex-wrap mb-6 -mt-px -ml-px">
        {sortedKeys.map((k, i) => (
          <div key={i} className="relative w-12 h-12 border border-gray-300 flex items-center justify-center bg-gray-50">
            <span className="absolute top-0 left-1 text-[10px] text-gray-400 select-none">{k}</span>
            <span className="text-xl font-bold">{mapping[k] ?? "?"}</span>
          </div>
        ))}
      </div>
      {title && (
        <div className="mb-2 font-semibold">カスタム出力</div>
      )}
      {title && (
        <div className="flex flex-wrap -mt-px -ml-px">
          {customKeys.map((k, i) => (
            <div key={i} className="relative w-12 h-12 border border-gray-300 flex items-center justify-center bg-blue-50">
              <span className="absolute top-0 left-1 text-[10px] text-gray-400 select-none">{k}</span>
              <span className="text-xl font-bold">{mapping[k] ?? "?"}</span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
