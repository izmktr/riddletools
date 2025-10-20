'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

type CellValue = string | null;
type SudokuBoard = CellValue[][];

export default function SudokuSolver() {
  const [board, setBoard] = useState<SudokuBoard>(() => 
    Array(9).fill(null).map(() => Array(9).fill(null))
  );
  const [selectedCell, setSelectedCell] = useState<{row: number, col: number} | null>(null);

  // セッションストレージから復元
  useEffect(() => {
    const saved = sessionStorage.getItem('sudoku-board');
    if (saved) {
      try {
        const parsedBoard = JSON.parse(saved);
        setBoard(parsedBoard);
      } catch (error) {
        console.error('Failed to parse saved board:', error);
      }
    }
  }, []);

  // セッションストレージに保存
  const saveToStorage = useCallback((newBoard: SudokuBoard) => {
    sessionStorage.setItem('sudoku-board', JSON.stringify(newBoard));
  }, []);

  // セルをクリック
  const handleCellClick = (row: number, col: number) => {
    setSelectedCell({ row, col });
  };

  // 数字ボタンをクリック
  const handleNumberClick = (value: string | null) => {
    if (!selectedCell) return;
    
    const newBoard = board.map((row, rowIndex) =>
      row.map((cell, colIndex) => {
        if (rowIndex === selectedCell.row && colIndex === selectedCell.col) {
          return value;
        }
        return cell;
      })
    );
    
    setBoard(newBoard);
    saveToStorage(newBoard);
  };

  // キーボード入力
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!selectedCell) return;
      
      let value: string | null = null;
      if (e.key >= '1' && e.key <= '9') {
        value = e.key;
      } else if (e.key === '0' || e.key.toLowerCase() === 'x') {
        value = null;
      } else {
        return;
      }
      
      handleNumberClick(value);
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedCell, board]);

  // リセット
  const handleReset = () => {
    const emptyBoard = Array(9).fill(null).map(() => Array(9).fill(null));
    setBoard(emptyBoard);
    saveToStorage(emptyBoard);
    setSelectedCell(null);
  };

  // 解析（仮データを入力）
  const handleAnalyze = () => {
    const newBoard = board.map((row, rowIndex) =>
      row.map((cell, colIndex) => {
        if (cell === null) {
          // 左上から詰めて1-9を入力
          const cellNumber = rowIndex * 9 + colIndex + 1;
          return ((cellNumber - 1) % 9 + 1).toString();
        }
        return cell;
      })
    );
    
    setBoard(newBoard);
    saveToStorage(newBoard);
  };

  // セルのスタイルを取得
  const getCellStyle = (row: number, col: number) => {
    const baseStyle = 'w-12 h-12 border border-gray-400 flex items-center justify-center cursor-pointer text-lg font-medium';
    const selectedStyle = selectedCell?.row === row && selectedCell?.col === col ? ' bg-blue-200' : '';
    const filledStyle = board[row][col] ? ' bg-yellow-100' : ' bg-white hover:bg-gray-100';
    
    // 境界線のスタイル
    let borderStyle = '';
    
    // 右境界（3列目と6列目は中太線、9列目は太線）
    if (col === 2 || col === 5) {
      borderStyle += ' border-r-2 border-r-gray-700';
    } else if (col === 8) {
      borderStyle += ' border-r-4 border-r-black';
    }
    
    // 下境界（3行目と6行目は中太線、9行目は太線）
    if (row === 2 || row === 5) {
      borderStyle += ' border-b-2 border-b-gray-700';
    } else if (row === 8) {
      borderStyle += ' border-b-4 border-b-black';
    }
    
    // 左境界（最初の列は太線）
    if (col === 0) {
      borderStyle += ' border-l-4 border-l-black';
    }
    
    // 上境界（最初の行は太線）
    if (row === 0) {
      borderStyle += ' border-t-4 border-t-black';
    }
    
    return baseStyle + selectedStyle + filledStyle + borderStyle;
  };

  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">数独ソルバー</h1>
      
      <div className="flex items-center mb-6 gap-2">
        <Link href="/" className="inline-block px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">
          トップに戻る
        </Link>
      </div>

      <div className="flex flex-col xl:flex-row gap-8">
        {/* 数独盤面 */}
        <div className="flex-1 flex justify-center">
          <div className="inline-block border-4 border-black">
            {board.map((row, rowIndex) => (
              <div key={rowIndex} className="flex">
                {row.map((cell, colIndex) => (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    className={getCellStyle(rowIndex, colIndex)}
                    onClick={() => handleCellClick(rowIndex, colIndex)}
                  >
                    {cell}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* コントロールパネル */}
        <div className="w-full xl:w-80">
          {/* 選択中のセル表示 */}
          <div className="mb-6 p-4 bg-gray-100 rounded">
            <p className="text-sm text-gray-600">
              選択中: {selectedCell ? `行${selectedCell.row + 1}, 列${selectedCell.col + 1}` : 'なし'}
            </p>
            {selectedCell && (
              <p className="text-sm text-gray-600 mt-1">
                現在の値: {board[selectedCell.row][selectedCell.col] || '空'}
              </p>
            )}
          </div>

          {/* 数字ボタン */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">数字を入力</h3>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  className="px-4 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 text-lg font-medium"
                  onClick={() => handleNumberClick(num.toString())}
                  disabled={!selectedCell}
                >
                  {num}
                </button>
              ))}
            </div>
            <button
              className="w-full px-4 py-3 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-300 text-lg font-medium"
              onClick={() => handleNumberClick(null)}
              disabled={!selectedCell}
            >
              X (消去)
            </button>
          </div>

          {/* 操作ボタン */}
          <div className="space-y-3">
            <button
              className="w-full px-4 py-3 bg-gray-500 text-white rounded hover:bg-gray-600 text-lg font-medium"
              onClick={handleReset}
            >
              リセット
            </button>
            <button
              className="w-full px-4 py-3 bg-green-500 text-white rounded hover:bg-green-600 text-lg font-medium"
              onClick={handleAnalyze}
            >
              解析（仮データ入力）
            </button>
          </div>

          {/* 操作説明 */}
          <div className="mt-8 p-4 bg-blue-50 rounded">
            <h3 className="font-medium mb-3">操作方法</h3>
            <ul className="text-sm text-gray-700 space-y-2">
              <li>• セルをクリックして選択（青色背景）</li>
              <li>• ボタンまたはキーボードで数字を入力</li>
              <li>• 0キーまたはXで消去</li>
              <li>• 数字入力されたセルは黄色背景</li>
              <li>• 太線は3×3ブロックの境界</li>
              <li>• データは自動保存されます</li>
            </ul>
          </div>

          {/* 数独のルール */}
          <div className="mt-6 p-4 bg-yellow-50 rounded">
            <h3 className="font-medium mb-3">数独のルール</h3>
            <ul className="text-sm text-gray-700 space-y-2">
              <li>• 各行に1〜9の数字を1つずつ</li>
              <li>• 各列に1〜9の数字を1つずつ</li>
              <li>• 各3×3ブロックに1〜9の数字を1つずつ</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}