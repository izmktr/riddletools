"use client";
import { useState } from "react";
import Link from "next/link";

export default function PickPage() {

  // useState宣言の直後にカスタムタイトルの紐づけ表生成ロジックを配置
  let customKeys: string[] = [];

  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [title, setTitle] = useState("");
  const [useTwoDigits, setUseTwoDigits] = useState(false);

  if (title) {
    let i = 0;
    while (i < title.length) {
      const c = title[i];
      if (/[A-Za-z]/.test(c)) {
        customKeys.push(c);
        i++;
      } else if (/[0-9]/.test(c)) {
        if (useTwoDigits && i + 1 < title.length && /[0-9]/.test(title[i + 1])) {
          const key = title.slice(i, i + 2);
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
  const rightLines = right.split(/\r?\n/).map(l => l.replace(/\s/g, ""));

  // 右側の各行ごとに数字・文字を抽出
  let keys: string[] = [];
  let values: string[] = [];
  rightLines.forEach((rLine, lineIdx) => {
    const rArr: string[] = [];
    let i = 0;
    let leftIdx = 0;
    const lStr = leftLines[lineIdx] ?? "";
    while (i < rLine.length) {
      const c = rLine[i];
      if (/[A-Za-z]/.test(c)) {
        rArr.push(c);
        keys.push(c);
        values.push(lStr[leftIdx] ?? "?");
        leftIdx++;
        i++;
      } else if (/[0-9]/.test(c)) {
        if (useTwoDigits && i + 1 < rLine.length && /[0-9]/.test(rLine[i + 1])) {
          const key = rLine.slice(i, i + 2);
          rArr.push(key);
          keys.push(key);
          values.push(lStr[leftIdx] ?? "?");
          leftIdx++;
          i += 2;
        } else {
          rArr.push(c);
          keys.push(c);
          values.push(lStr[leftIdx] ?? "?");
          leftIdx++;
          i++;
        }
      } else if (c === " ") {
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
      <Link href="/" className="inline-block mb-4 px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">トップに戻る</Link>
      <h2 className="text-2xl font-bold mb-4">文字拾いツール</h2>
      <div className="mb-4 flex gap-4">
        <textarea
          className="w-1/2 h-32 p-2 border rounded"
          value={left}
          onChange={e => setLeft(e.target.value)}
          placeholder="左：文字列（複数行可）"
        />
        <textarea
          className="w-1/2 h-32 p-2 border rounded"
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
