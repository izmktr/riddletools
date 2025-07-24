"use client";
import { useState } from "react";
import Link from "next/link";

export default function PickPage() {
  const [showManual, setShowManual] = useState(false);

  // サンプル挿入用
  const handleSample = () => {
    setLeft("おや\nひとさし\nなか\nくすり\nこ");
    setRight("14\na3d2\n65\n.cb\n7\n8");
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
  // 右側は全角→半角変換してから分割
  const normalizedRight = toHalfWidth(right);
  const rightLines = normalizedRight.split(/\r?\n/).map(l => l.replace(/\s/g, ""));

  // 右側の各行ごとに数字・文字を抽出
  const keys: string[] = [];
  const values: string[] = [];
  rightLines.forEach((rLine, lineIdx) => {
    let i = 0;
    let leftIdx = 0;
    const lStr = leftLines[lineIdx] ?? "";
    while (i < rLine.length) {
      const c = rLine[i];
      if (/[A-Za-z]/.test(c)) {
        keys.push(c);
        values.push(lStr[leftIdx] ?? "?");
        leftIdx++;
        i++;
      } else if (/[0-9]/.test(c)) {
        if (useTwoDigits && i + 1 < rLine.length && /[0-9]/.test(rLine[i + 1])) {
          const key = rLine.slice(i, i + 2);
          keys.push(key);
          values.push(lStr[leftIdx] ?? "?");
          leftIdx++;
          i += 2;
        } else {
          keys.push(c);
          values.push(lStr[leftIdx] ?? "?");
          leftIdx++;
          i++;
        }
      } else if (c === " " || c === "　") {
        // 空白は無視
        i++;
      } else {
        // 数字・アルファベット・空白以外の文字は何とも紐づかない扱いで左を1文字ずらす
        leftIdx++;
        i++;
      }
    }
  });

  // 表示用にキーをソート
  const sortedKeys = Array.from(new Set(keys)).sort((a, b) => {
    if (/^\d+$/.test(a) && /^\d+$/.test(b)) return Number(a) - Number(b);
    if (/^\d+$/.test(a)) return -1;
    if (/^\d+$/.test(b)) return 1;
    return a.localeCompare(b);
  });

  // 紐づけ結果を作成
  const mapping: Record<string, string> = {};
  sortedKeys.forEach(k => {
    // 最初に出現した値のみ表示
    const idx = keys.indexOf(k);
    mapping[k] = idx !== -1 ? values[idx] : "?";
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
      </div>
        <button
          className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded ml-2"
          onClick={() => { setLeft(""); setRight(""); setTitle(""); }}
        >リセット</button>
      <div className="mb-2 font-semibold">{"出力"}</div>
      <div className="overflow-x-auto mb-6">
        <table className="border w-full">
          <thead>
            <tr>
              {sortedKeys.map((k, i) => (
                <th key={i} className="border px-2 py-1 max-w-[2em] truncate text-center">{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {sortedKeys.map((k, i) => (
                <td key={i} className="border px-2 py-1 max-w-[2em] truncate text-center">
                  {mapping[k] ?? "?"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {title && (
        <div className="mb-2 font-semibold">カスタム出力対応表</div>
      )}
      {title && (
        <div className="overflow-x-auto">
          <table className="border w-full">
            <thead>
              <tr>
                {customKeys.map((k, i) => (
                    <th key={i} className="border px-2 py-1 max-w-[2em] truncate text-center">{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {customKeys.map((k, i) => {
                  return <th key={i} className="border px-2 py-1 max-w-[2em] truncate text-center">{mapping[k] ?? "?"}</th>;
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
