'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

type CellValue = string | null;
type SudokuBoard = CellValue[][];
type PossibleNumbers = Set<number>;
type PossibleBoard = (PossibleNumbers | null)[][];

export default function SudokuSolver() {
  const [board, setBoard] = useState<SudokuBoard>(() => 
    Array(9).fill(null).map(() => Array(9).fill(null))
  );
  const [possibleNumbers, setPossibleNumbers] = useState<PossibleBoard>(() => 
    Array(9).fill(null).map(() => Array(9).fill(null))
  );
  const [initialBoard, setInitialBoard] = useState<SudokuBoard>(() => 
    Array(9).fill(null).map(() => Array(9).fill(null))
  );
  const [selectedCell, setSelectedCell] = useState<{row: number, col: number} | null>(null);
  const [alternateSolutions, setAlternateSolutions] = useState<SudokuBoard[]>([]);

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
  const handleNumberClick = useCallback((value: string | null) => {
    if (!selectedCell) return;
    
    const newBoard = board.map((row, rowIndex) =>
      row.map((cell, colIndex) => {
        if (rowIndex === selectedCell.row && colIndex === selectedCell.col) {
          return value;
        }
        return cell;
      })
    );
    
    // 使用可能数字をクリア
    const newPossible = possibleNumbers.map((row, rowIndex) =>
      row.map((cell, colIndex) => {
        if (rowIndex === selectedCell.row && colIndex === selectedCell.col) {
          return null;
        }
        return cell;
      })
    );
    
    setBoard(newBoard);
    setPossibleNumbers(newPossible);
    saveToStorage(newBoard);
  }, [selectedCell, board, possibleNumbers, saveToStorage]);

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
  }, [selectedCell, board, handleNumberClick]);

  // リセット
  const handleReset = () => {
    const emptyBoard = Array(9).fill(null).map(() => Array(9).fill(null));
    setBoard(emptyBoard);
    setPossibleNumbers(Array(9).fill(null).map(() => Array(9).fill(null)));
    setInitialBoard(Array(9).fill(null).map(() => Array(9).fill(null)));
    setAlternateSolutions([]);
    saveToStorage(emptyBoard);
    setSelectedCell(null);
  };

  // サンプル問題を読み込み
  const handleLoadSample = () => {
    const sampleData = [
      '53..7....',
      '6..195...',
      '.98....6.',
      '8...6...3',
      '4..8.3..1',
      '7...2...6',
      '.6....28.',
      '...419..5',
      '....8..79'
    ];
    
    const sampleBoard: SudokuBoard = sampleData.map(row => 
      row.split('').map(char => char === '.' ? null : char)
    );
    
    setBoard(sampleBoard);
    setPossibleNumbers(Array(9).fill(null).map(() => Array(9).fill(null)));
    setInitialBoard(Array(9).fill(null).map(() => Array(9).fill(null)));
    saveToStorage(sampleBoard);
    setSelectedCell(null);
  };

  // ブロック番号を取得（0-8）
  const getBlockIndex = (row: number, col: number): number => {
    return Math.floor(row / 3) * 3 + Math.floor(col / 3);
  };

  // 同じブロック内のセル座標を取得
  const getBlockCells = (blockIndex: number): Array<{row: number, col: number}> => {
    const cells: Array<{row: number, col: number}> = [];
    const startRow = Math.floor(blockIndex / 3) * 3;
    const startCol = (blockIndex % 3) * 3;
    for (let r = startRow; r < startRow + 3; r++) {
      for (let c = startCol; c < startCol + 3; c++) {
        cells.push({row: r, col: c});
      }
    }
    return cells;
  };

  // 使用可能数字を初期化
  const initializePossibleNumbers = (currentBoard: SudokuBoard): PossibleBoard => {
    const possible: PossibleBoard = Array(9).fill(null).map(() => Array(9).fill(null));
    
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (currentBoard[row][col] === null) {
          possible[row][col] = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        }
      }
    }
    
    return possible;
  };

  // 確定数字から使用可能数字を削除
  const eliminateByHints = (currentBoard: SudokuBoard, possible: PossibleBoard): void => {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const value = currentBoard[row][col];
        if (value !== null) {
          const num = parseInt(value);
          
          // 同じ行の空白マスから削除
          for (let c = 0; c < 9; c++) {
            if (possible[row][c]) {
              possible[row][c]!.delete(num);
            }
          }
          
          // 同じ列の空白マスから削除
          for (let r = 0; r < 9; r++) {
            if (possible[r][col]) {
              possible[r][col]!.delete(num);
            }
          }
          
          // 同じブロックの空白マスから削除
          const blockCells = getBlockCells(getBlockIndex(row, col));
          for (const cell of blockCells) {
            if (possible[cell.row][cell.col]) {
              possible[cell.row][cell.col]!.delete(num);
            }
          }
        }
      }
    }
  };

  // 使用可能数字が1個のマスを確定
  const findSinglePossible = (currentBoard: SudokuBoard, possible: PossibleBoard): boolean => {
    let changed = false;
    
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (currentBoard[row][col] === null && possible[row][col] && possible[row][col]!.size === 1) {
          const num = Array.from(possible[row][col]!)[0];
          currentBoard[row][col] = num.toString();
          possible[row][col] = null;
          changed = true;
        }
      }
    }
    
    return changed;
  };

  // 行/列/ブロック内で唯一の候補となる数字を確定
  const findUniqueCandidate = (currentBoard: SudokuBoard, possible: PossibleBoard): boolean => {
    let changed = false;
    const toConfirm: Array<{row: number, col: number, num: number}> = [];
    
    // 各行をチェック
    for (let row = 0; row < 9; row++) {
      for (let num = 1; num <= 9; num++) {
        // この行で既にnumが確定しているかチェック
        let alreadyPlaced = false;
        for (let c = 0; c < 9; c++) {
          if (currentBoard[row][c] === num.toString()) {
            alreadyPlaced = true;
            break;
          }
        }
        if (alreadyPlaced) continue;
        
        const candidates: number[] = [];
        for (let col = 0; col < 9; col++) {
          if (possible[row][col]?.has(num)) {
            candidates.push(col);
          }
        }
        if (candidates.length === 1) {
          const col = candidates[0];
          if (currentBoard[row][col] === null) {
            toConfirm.push({row, col, num});
          }
        }
      }
    }
    
    // 各列をチェック
    for (let col = 0; col < 9; col++) {
      for (let num = 1; num <= 9; num++) {
        // この列で既にnumが確定しているかチェック
        let alreadyPlaced = false;
        for (let r = 0; r < 9; r++) {
          if (currentBoard[r][col] === num.toString()) {
            alreadyPlaced = true;
            break;
          }
        }
        if (alreadyPlaced) continue;
        
        const candidates: number[] = [];
        for (let row = 0; row < 9; row++) {
          if (possible[row][col]?.has(num)) {
            candidates.push(row);
          }
        }
        if (candidates.length === 1) {
          const row = candidates[0];
          if (currentBoard[row][col] === null) {
            toConfirm.push({row, col, num});
          }
        }
      }
    }
    
    // 各ブロックをチェック
    for (let blockIndex = 0; blockIndex < 9; blockIndex++) {
      const cells = getBlockCells(blockIndex);
      for (let num = 1; num <= 9; num++) {
        // このブロックで既にnumが確定しているかチェック
        let alreadyPlaced = false;
        for (const cell of cells) {
          if (currentBoard[cell.row][cell.col] === num.toString()) {
            alreadyPlaced = true;
            break;
          }
        }
        if (alreadyPlaced) continue;
        
        const candidates: Array<{row: number, col: number}> = [];
        for (const cell of cells) {
          if (possible[cell.row][cell.col]?.has(num)) {
            candidates.push(cell);
          }
        }
        if (candidates.length === 1) {
          const {row, col} = candidates[0];
          if (currentBoard[row][col] === null) {
            toConfirm.push({row, col, num});
          }
        }
      }
    }
    
    // 確定処理（重複チェック付き）
    for (const {row, col, num} of toConfirm) {
      if (currentBoard[row][col] === null) {
        currentBoard[row][col] = num.toString();
        possible[row][col] = null;
        changed = true;
      }
    }
    
    return changed;
  };

  // 盤面が完成しているかチェック
  const isComplete = (currentBoard: SudokuBoard): boolean => {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (currentBoard[row][col] === null) {
          return false;
        }
      }
    }
    return true;
  };

  // バックトラック法で解を探す
  const solveWithBacktrack = (
    currentBoard: SudokuBoard, 
    possible: PossibleBoard, 
    solutions: SudokuBoard[], 
    maxSolutions: number
  ): void => {
    if (solutions.length >= maxSolutions) return;

    // 基本的な解法を適用
    let changed = true;
    while (changed) {
      changed = false;
      eliminateByHints(currentBoard, possible);
      
      if (findSinglePossible(currentBoard, possible)) {
        changed = true;
        eliminateByHints(currentBoard, possible);
      }
      
      if (findUniqueCandidate(currentBoard, possible)) {
        changed = true;
        eliminateByHints(currentBoard, possible);
      }
    }

    // 完成チェック
    if (isComplete(currentBoard)) {
      solutions.push(currentBoard.map(row => [...row]));
      return;
    }

    // 候補が最も少ないマスを探す
    let minSize = 10;
    let targetRow = -1;
    let targetCol = -1;

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (currentBoard[row][col] === null && possible[row][col]) {
          const size = possible[row][col]!.size;
          if (size > 0 && size < minSize) {
            minSize = size;
            targetRow = row;
            targetCol = col;
          }
        }
      }
    }

    // 空きマスがない、または候補がないマスがある場合は矛盾
    if (targetRow === -1) return;

    // 各候補を試す
    const candidates = Array.from(possible[targetRow][targetCol]!);
    for (const num of candidates) {
      if (solutions.length >= maxSolutions) return;

      // 盤面と候補をコピー
      const newBoard = currentBoard.map(row => [...row]);
      const newPossible: PossibleBoard = possible.map(row => 
        row.map(cell => cell ? new Set(cell) : null)
      );

      // 仮置き
      newBoard[targetRow][targetCol] = num.toString();
      newPossible[targetRow][targetCol] = null;

      // 再帰的に解く
      solveWithBacktrack(newBoard, newPossible, solutions, maxSolutions);
    }
  };

  // 解析実行
  const handleAnalyze = () => {
    // 現在の盤面をコピー
    const currentBoard: SudokuBoard = board.map(row => [...row]);
    
    // 初期盤面を保存（解析前の状態）
    setInitialBoard(board.map(row => [...row]));
    
    // 使用可能数字を初期化
    const possible = initializePossibleNumbers(currentBoard);
    
    let iterations = 0;
    const maxIterations = 100;
    
    while (iterations < maxIterations) {
      iterations++;
      
      // ヒントから使用可能数字を削除
      eliminateByHints(currentBoard, possible);
      
      // 変更があったかフラグ
      let changed = false;
      
      // 使用可能数字が1個のマスを確定
      const singleChanged = findSinglePossible(currentBoard, possible);
      if (singleChanged) {
        changed = true;
        // 確定した数字の影響を即座に反映
        eliminateByHints(currentBoard, possible);
      }
      
      // 唯一の候補を確定
      const uniqueChanged = findUniqueCandidate(currentBoard, possible);
      if (uniqueChanged) {
        changed = true;
        // 確定した数字の影響を即座に反映
        eliminateByHints(currentBoard, possible);
      }
      
      // 変更がなければ終了
      if (!changed) {
        break;
      }
    }

    // 基本解法で解けない場合、バックトラック法を試す
    if (!isComplete(currentBoard)) {
      const solutions: SudokuBoard[] = [];
      const boardCopy = currentBoard.map(row => [...row]);
      const possibleCopy: PossibleBoard = possible.map(row => 
        row.map(cell => cell ? new Set(cell) : null)
      );
      
      solveWithBacktrack(boardCopy, possibleCopy, solutions, 3); // 最大3つの解を探す
      
      if (solutions.length > 0) {
        // 最初の解を表示
        setBoard(solutions[0]);
        setPossibleNumbers(Array(9).fill(null).map(() => Array(9).fill(null)));
        saveToStorage(solutions[0]);
        
        // 別解があれば保存（最大2つ）
        if (solutions.length > 1) {
          setAlternateSolutions(solutions.slice(1, 3));
        } else {
          setAlternateSolutions([]);
        }
      } else {
        // 解が見つからない
        setBoard(currentBoard);
        setPossibleNumbers(possible);
        saveToStorage(currentBoard);
        setAlternateSolutions([]);
      }
    } else {
      // 基本解法で完成した場合でも、別解を探す
      const solutions: SudokuBoard[] = [];
      
      const boardCopy = board.map(row => [...row]); // 初期盤面から
      const possibleCopy = initializePossibleNumbers(boardCopy);
      
      solveWithBacktrack(boardCopy, possibleCopy, solutions, 3); // 最大3つの解を探す
      
      setBoard(currentBoard);
      setPossibleNumbers(possible);
      saveToStorage(currentBoard);
      
      // 別解があれば保存（最大2つ、現在の解を除いて2つ以上あるかチェック）
      if (solutions.length > 1) {
        // 現在の解と異なる解のみを抽出
        const alternates = solutions.filter((sol, index) => {
          // 最初の解は現在の解と同じ可能性が高いのでスキップ
          if (index === 0) {
            // 現在の解と完全一致するかチェック
            const isSame = sol.every((row, r) => 
              row.every((cell, c) => cell === currentBoard[r][c])
            );
            return !isSame;
          }
          return true;
        }).slice(0, 2);
        
        setAlternateSolutions(alternates);
      } else {
        setAlternateSolutions([]);
      }
    }
  };

  // セルのスタイルを取得
  const getCellStyle = (row: number, col: number) => {
    const hasPossible = possibleNumbers[row][col] !== null;
    const isInitial = initialBoard[row][col] !== null;
    const isFilled = board[row][col] !== null;
    
    const baseStyle = hasPossible 
      ? 'w-12 h-12 border border-gray-400 flex items-center justify-center cursor-pointer text-[6px] font-medium p-0.5'
      : 'w-12 h-12 border border-gray-400 flex items-center justify-center cursor-pointer text-lg font-medium';
    const selectedStyle = selectedCell?.row === row && selectedCell?.col === col ? ' bg-blue-200' : '';
    
    // 色分け: 初期マス=黄、解析マス=青、未確定=緑、空白=白
    let filledStyle = '';
    if (isFilled && isInitial) {
      filledStyle = ' bg-yellow-100'; // 初期ヒント
    } else if (isFilled) {
      filledStyle = ' bg-blue-100'; // 解析で確定
    } else if (hasPossible) {
      filledStyle = ' bg-green-50'; // 未確定
    } else {
      filledStyle = ' bg-white hover:bg-gray-100'; // 空白
    }
    
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
        {/* 左側: 数独盤面と別解 */}
        <div className="flex-1">
          {/* メイン盤面 */}
          <div className="flex justify-center mb-8">
            <div className="inline-block">
              {board.map((row, rowIndex) => (
                <div key={rowIndex} className="flex">
                  {row.map((cell, colIndex) => (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={getCellStyle(rowIndex, colIndex)}
                      onClick={() => handleCellClick(rowIndex, colIndex)}
                    >
                      {cell || (possibleNumbers[rowIndex][colIndex] ? (
                        <div className="grid grid-cols-3 gap-0 w-full h-full text-[6px] leading-none">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                            <div key={num} className="flex items-center justify-center">
                              {possibleNumbers[rowIndex][colIndex]!.has(num) ? num : ''}
                            </div>
                          ))}
                        </div>
                      ) : '')}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* 別解の表示 */}
          {alternateSolutions.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-4 text-center">別解</h2>
              <div className="flex flex-wrap gap-8 justify-center">
                {alternateSolutions.map((solution, index) => (
                  <div key={index} className="flex flex-col items-center">
                    <h3 className="text-lg font-medium mb-2">別解 {index + 1}</h3>
                    <div className="inline-block">
                      {solution.map((row, rowIndex) => (
                        <div key={rowIndex} className="flex">
                          {row.map((cell, colIndex) => {
                            const isInitial = initialBoard[rowIndex][colIndex] !== null;
                            
                            const baseStyle = 'w-12 h-12 border border-gray-400 flex items-center justify-center text-lg font-medium';
                            const filledStyle = isInitial ? ' bg-yellow-100' : ' bg-blue-100';
                            let borderStyle = '';
                            
                            if (colIndex === 2 || colIndex === 5) {
                              borderStyle += ' border-r-2 border-r-gray-700';
                            } else if (colIndex === 8) {
                              borderStyle += ' border-r-4 border-r-black';
                            }
                            
                            if (rowIndex === 2 || rowIndex === 5) {
                              borderStyle += ' border-b-2 border-b-gray-700';
                            } else if (rowIndex === 8) {
                              borderStyle += ' border-b-4 border-b-black';
                            }
                            
                            if (colIndex === 0) {
                              borderStyle += ' border-l-4 border-l-black';
                            }
                            
                            if (rowIndex === 0) {
                              borderStyle += ' border-t-4 border-t-black';
                            }
                            
                            return (
                              <div
                                key={`${rowIndex}-${colIndex}`}
                                className={baseStyle + filledStyle + borderStyle}
                              >
                                {cell}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 右側: コントロールパネル */}
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
              className="w-full px-4 py-3 bg-purple-500 text-white rounded hover:bg-purple-600 text-lg font-medium"
              onClick={handleLoadSample}
            >
              サンプル問題
            </button>
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
              解析
            </button>
          </div>

          {/* 操作説明 */}
          <div className="mt-8 p-4 bg-blue-50 rounded">
            <h3 className="font-medium mb-3">操作方法</h3>
            <ul className="text-sm text-gray-700 space-y-2">
              <li>• セルをクリックして選択</li>
              <li>• ボタンまたはキーボードで数字を入力</li>
              <li>• 0キーまたはXで消去</li>
              <li>• <span className="inline-block w-4 h-4 bg-yellow-100 border border-gray-400 align-middle"></span> 初期ヒント（黄色）</li>
              <li>• <span className="inline-block w-4 h-4 bg-blue-100 border border-gray-400 align-middle"></span> 解析で確定（青色）</li>
              <li>• <span className="inline-block w-4 h-4 bg-green-50 border border-gray-400 align-middle"></span> 未確定マス（緑色、候補数字表示）</li>
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