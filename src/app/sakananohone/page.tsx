"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function SakananohonePage() {
  const [wordList, setWordList] = useState("");
  const [positionList, setPositionList] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [result, setResult] = useState<string[][] | null>(null);
  const [highlightPositions, setHighlightPositions] = useState<Array<{row: number, col: number}>>([]);
  const [rowNumberPositions, setRowNumberPositions] = useState<Array<{row: number, col: number}>>([]);
  const [isVertical, setIsVertical] = useState(false);
  const [rowNumberType, setRowNumberType] = useState<"数字" | "ABC" | "あいう" | "いろは">("数字");

  // 行番号を指定した文字種に変換する関数
  const convertRowNumber = (index: number): string => {
    const oneBasedIndex = index + 1;
    
    switch (rowNumberType) {
      case "数字":
        return oneBasedIndex.toString();
      case "ABC":
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        if (oneBasedIndex > alphabet.length) {
          return ""; // 文字が足りない場合は空欄
        }
        return alphabet[oneBasedIndex - 1];
      case "あいう":
        const aiueo = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん";
        if (oneBasedIndex > aiueo.length) {
          return ""; // 文字が足りない場合は空欄
        }
        return aiueo[oneBasedIndex - 1];
      case "いろは":
        const iroha = "いろはにほへとちりぬるをわかよたれそつねならむうゐのおくやまけふこえてあさきゆめみしゑひも";
        if (oneBasedIndex > iroha.length) {
          return ""; // 文字が足りない場合は空欄
        }
        return iroha[oneBasedIndex - 1];
      default:
        return oneBasedIndex.toString();
    }
  };

  // リアルタイム生成用のuseEffect
  useEffect(() => {
    if (!wordList.trim() || !positionList.trim()) {
      setResult(null);
      setHighlightPositions([]);
      setRowNumberPositions([]);
      return;
    }

    const words = wordList.split('\n').map(w => w.trim()).filter(w => w);
    const positions = positionList.split('\n').map(p => p.trim()).filter(p => p);

    if (words.length !== positions.length) {
      setResult(null);
      setHighlightPositions([]);
      return;
    }

    const positionNumbers = positions.map(p => parseInt(p)).filter(n => !isNaN(n));
    if (positionNumbers.length !== positions.length) {
      setResult(null);
      setHighlightPositions([]);
      setRowNumberPositions([]);
      return;
    }

    if (isVertical) {
      generateVerticalTable(words, positionNumbers);
    } else {
      generateHorizontalTable(words, positionNumbers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordList, positionList, isVertical, rowNumberType]);

  // 横書き（従来）の表生成
  const generateHorizontalTable = (words: string[], positionNumbers: number[]) => {
    // 基準位置（読む位置の最大値）
    const basePosition = Math.max(...positionNumbers);
    
    // 単語最大長
    const maxWordLength = Math.max(...words.map(w => w.length));
    
    // 表のサイズ
    const tableWidth = basePosition + maxWordLength;
    const tableHeight = words.length;

    // 表を初期化
    const table: string[][] = Array(tableHeight).fill(null).map(() => Array(tableWidth).fill(''));
    const highlights: Array<{row: number, col: number}> = [];
    const rowNumPositions: Array<{row: number, col: number}> = [];

    // 各行を処理
    words.forEach((word, rowIndex) => {
      const position = positionNumbers[rowIndex];
      const startCol = basePosition - position;
      
      // 行番号を配置
      table[rowIndex][startCol] = convertRowNumber(rowIndex);
      rowNumPositions.push({row: rowIndex, col: startCol});
      
      // 単語を配置
      for (let i = 0; i < word.length; i++) {
        table[rowIndex][startCol + 1 + i] = word[i];
      }
      
      // 読む位置に対応する文字をハイライト
      if (startCol + position < tableWidth) {
        highlights.push({row: rowIndex, col: startCol + position});
      }
    });

    setResult(table);
    setHighlightPositions(highlights);
    setRowNumberPositions(rowNumPositions);
  };

  // 縦書きの表生成
  const generateVerticalTable = (words: string[], positionNumbers: number[]) => {
    // 基準位置（読む位置の最大値）
    const basePosition = Math.max(...positionNumbers);
    
    // 単語最大長
    const maxWordLength = Math.max(...words.map(w => w.length));
    
    // 表のサイズ（横と縦が転置）
    const tableWidth = words.length;
    const tableHeight = basePosition + maxWordLength;

    // 表を初期化
    const table: string[][] = Array(tableHeight).fill(null).map(() => Array(tableWidth).fill(''));
    const highlights: Array<{row: number, col: number}> = [];
    const rowNumPositions: Array<{row: number, col: number}> = [];

    // 各列を処理（元の行が列になる）
    words.forEach((word, colIndex) => {
      const position = positionNumbers[colIndex];
      const startRow = basePosition - position;
      
      // 列番号を配置
      table[startRow][colIndex] = convertRowNumber(colIndex);
      rowNumPositions.push({row: startRow, col: colIndex});
      
      // 単語を縦に配置
      for (let i = 0; i < word.length; i++) {
        table[startRow + 1 + i][colIndex] = word[i];
      }
      
      // 読む位置に対応する文字をハイライト
      if (startRow + position < tableHeight) {
        highlights.push({row: startRow + position, col: colIndex});
      }
    });

    setResult(table);
    setHighlightPositions(highlights);
    setRowNumberPositions(rowNumPositions);
  };

  // リセット機能
  const handleReset = () => {
    setWordList("");
    setPositionList("");
    setResult(null);
    setHighlightPositions([]);
    setRowNumberPositions([]);
  };

  // サンプル入力
  const handleSample = () => {
    setWordList("さんぷる\nなかま\nなのはな\nきのこ\nすまほ\nきねんひん");
    setPositionList("1\n2\n4\n2\n3\n2");
  };

  // セルが空かどうかチェック
  const isCellEmpty = (table: string[][], row: number, col: number) => {
    return !table[row][col] || table[row][col] === '';
  };

  // セルが行番号位置かどうかをチェック
  const isRowNumberPosition = (row: number, col: number): boolean => {
    return rowNumberPositions.some(pos => pos.row === row && pos.col === col);
  };

  // セルに枠線が必要かチェック
  const needsBorder = (table: string[][], row: number, col: number) => {
    // 行番号位置の場合は枠線を表示しない
    if (isRowNumberPosition(row, col)) {
      return false;
    }
    
    // 読む位置のセルは空欄でも枠線を表示
    if (isHighlighted(row, col)) {
      return true;
    }
    
    // 通常のセルは空でない場合のみ枠線を表示
    if (isCellEmpty(table, row, col)) return false;
    
    return true;
  };

  // セルがハイライト対象かチェック
  const isHighlighted = (row: number, col: number) => {
    return highlightPositions.some(pos => pos.row === row && pos.col === col);
  };

  return (
    <main className="max-w-6xl mx-auto p-6">
      <div className="flex items-center mb-4 gap-2">
        <button
          className="px-4 py-2 bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
          onClick={() => setShowManual(true)}
        >使い方</button>
        <Link href="/" className="inline-block px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">トップに戻る</Link>
      </div>

      {showManual && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 max-w-2xl w-full relative max-h-96 overflow-y-auto">
            <button
              className="absolute top-2 right-2 px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => setShowManual(false)}
            >閉じる</button>
            <h3 className="text-xl font-bold mb-2">魚の骨ツールの使い方</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm mb-4">
              <li>左側に単語リスト、右側に読む位置を入力します。</li>
              <li>単語リストと読む位置は改行区切りで入力し、同じ行数で対応させます。</li>
              <li>読む位置は数値で入力してください（例：1、2、3）。</li>
              <li>「縦書き」チェックボックスをONにすると、単語が縦方向に配置されます。</li>
              <li>行番号の種類を「数字」「ABC」「あいう」「いろは」から選択できます。</li>
              <li>文字が足りない場合は空欄になります。</li>
              <li>入力内容を変更すると自動的に魚の骨形の表が生成されます。</li>
              <li>読む位置に対応する文字が黄色でハイライトされます。</li>
              <li>「サンプル」ボタンで例のデータを入力できます。</li>
            </ul>
            <h4 className="font-bold mb-2">例:</h4>
            <div className="text-sm text-gray-600">
              <p>単語リスト: さんぷる、なかま、なのはな...</p>
              <p>読む位置: 1、2、4...</p>
              <p>結果: 魚の骨のような形で単語が配置され、指定位置の文字がハイライト</p>
            </div>
          </div>
        </div>
      )}

      <h2 className="text-2xl font-bold mb-4">魚の骨ツール</h2>

      {/* 入力エリア */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="font-semibold mb-2">単語リスト（左側）</h3>
          <textarea
            value={wordList}
            onChange={e => setWordList(e.target.value)}
            className="w-full h-40 p-3 border rounded resize-none"
            placeholder="さんぷる&#10;なかま&#10;なのはな&#10;きのこ&#10;すまほ&#10;きねんひん"
          />
        </div>
        <div>
          <h3 className="font-semibold mb-2">読む位置（右側）</h3>
          <textarea
            value={positionList}
            onChange={e => setPositionList(e.target.value)}
            className="w-full h-40 p-3 border rounded resize-none"
            placeholder="1&#10;2&#10;4&#10;2&#10;3&#10;2"
          />
        </div>
      </div>

      {/* オプションとボタン */}
      <div className="mb-6">
        <div className="mb-4 space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isVertical}
              onChange={(e) => setIsVertical(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium">縦書き（単語を縦方向に配置）</span>
          </label>
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">行番号の種類:</span>
            <select
              value={rowNumberType}
              onChange={(e) => setRowNumberType(e.target.value as "数字" | "ABC" | "あいう" | "いろは")}
              className="px-3 py-1 border rounded text-sm"
            >
              <option value="数字">数字 (1,2,3...)</option>
              <option value="ABC">ABC (A,B,C...)</option>
              <option value="あいう">あいう (あ,い,う...)</option>
              <option value="いろは">いろは (い,ろ,は...)</option>
            </select>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            onClick={handleReset}
          >リセット</button>
          <button
            className="px-6 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200"
            onClick={handleSample}
          >サンプル</button>
        </div>
      </div>

      {/* 結果表示 */}
      {result && (
        <div className="mb-4">
          <h3 className="font-semibold mb-2">魚の骨表</h3>
          <div className="overflow-auto">
            <table className="border-collapse">
              <tbody>
                {result.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, colIndex) => {
                      const isEmpty = isCellEmpty(result, rowIndex, colIndex);
                      const hasBorder = needsBorder(result, rowIndex, colIndex);
                      const highlighted = isHighlighted(rowIndex, colIndex);
                      const isRowNum = isRowNumberPosition(rowIndex, colIndex);
                      
                      return (
                        <td
                          key={colIndex}
                          className={`
                            w-8 h-8 text-center text-sm font-mono
                            ${hasBorder ? 'border border-gray-400' : ''}
                            ${highlighted ? 'bg-yellow-200' : (isEmpty && !isRowNum) ? '' : 'bg-white'}
                          `}
                          style={{
                            minWidth: '32px',
                            minHeight: '32px'
                          }}
                        >
                          {cell}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="text-sm text-gray-600">
        <p>※ 黄色でハイライトされた文字が「読む位置」に対応しています</p>
        <p>※ 縦書きモードでは、各単語が縦（列）方向に配置されます</p>
        <p>※ 行番号は選択した文字種で表示され、文字が足りない場合は空欄になります</p>
      </div>
    </main>
  );
}