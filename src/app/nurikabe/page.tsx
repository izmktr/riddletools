"use client";
import { useState } from "react";
import Link from "next/link";

type CellValue = number | null;

class Position {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  toHash(): number {
    return this.x << 0x10000 + this.y;
  }
  static fromHash(hash: number): Position {
    const x = hash >> 0x10000;
    const y = hash & 0xFFFF;
    return new Position(x, y);
  }
}

class Cell{
  confirmed: Ocean | Island | null;      /* 確定した単語 */
  isOcean(): boolean {
    return this.confirmed instanceof Object && 'positions' in this.confirmed && 'candidates' in this.confirmed;
  }
constructor() {
    this.confirmed = null;
}
}

class Ocean {
  positions: Position[];
  candidates: string[];              /* 候補単語 */
  confirmedWord: string | null;      /* 確定した単語 */

  constructor() {
    this.positions = [];
    this.candidates = [];
    this.confirmedWord = null;
  }
}

class Island{
  x : number;
  y : number;
  power : number; // 島のパワー
  cells: Cell[];

  constructor(x : number, y : number, power : number) {
    this.x = x;
    this.y = y;
    this.power = power;
    this.cells = [];
  }
}

class Field {
    cells: Cell[][];
    oceans: Ocean[];
    islands: Island[];

    constructor(width : number, height : number) {
        this.cells = Array(height).fill(null).map(() => Array(width).fill(null));
        this.oceans = [];
        this.islands = [];
    }

    // x,yに島を配置
    setIsland(x: number, y: number, power: number) {
        const island = new Island(x, y, power);
        this.islands.push(island);

        // 島のセルを設定
        this.cells[y][x].confirmed = island;
    }

    getLockedCells(island : Island): Set<number> {
      const lockedCells = new Set<number>();
      for (let y = 0; y < this.cells.length; y++) {
          for (let x = 0; x < this.cells[0].length; x++) {
              const cell = this.cells[y][x];
              // 自分の島ではない島マスを発見
              if (cell && cell.confirmed instanceof Island && cell.confirmed !== island) {
                  // 周囲4マスを不可侵にする
                  for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
                      const newy = y + dy;
                      const newx = x + dx;
                      if (newy >= 0 && newy < this.cells.length && newx >= 0 && newx < this.cells[0].length) {
                          lockedCells.add(new Position(newx, newy).toHash());
                      }
                  }
              }
          }
      }
      return lockedCells;
    }

    // 島ごとに到達可能なマスを取得
    getReachableCells(island: Island): Position[] {
        if (!island) return [];

        const reachable: Position[] = [];
        const queue: Position[] = new Array();
        const visited = new Set<number>();

        // 不可侵マス
        const lockedCells = this.getLockedCells(island);

        queue.push(new Position(island.x, island.y));
        let power = island.power;

        while (power > 0) {
          const newqueue :Position[] = [];

          while (queue.length > 0) {
            const newpos = queue.shift()!;
            const key = newpos.toHash();
            if (visited.has(key)) continue;
            visited.add(key);

            // 隣接するマスをチェック
            for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
                const newRow = newpos.y + dy;
                const newCol = newpos.x + dx;
                const position = new Position(newCol, newRow);
                const poshash = position.toHash();

                // 範囲外ならスキップ
                if (newRow < 0 || newRow >= this.cells.length || newCol < 0 || newCol >= this.cells[0].length) continue;

                // すでに訪問済みならスキップ
                if (visited.has(poshash)) continue;

                // 不可侵マスならスキップ
                if (lockedCells.has(poshash)) continue;

                const cell = this.cells[newRow][newCol];
                if (cell && cell.confirmed === island) {
                    reachable.push(position);
                    newqueue.push(position);
                }
            }
          }
          // 新たに発見したマスをキューに追加
          queue.push(...newqueue);
          power = power - 1;
        }

        return reachable;
    }

  // 2x2のマスを調べ、塊ができないようにする
  checkForInvalidBlocks() {
    for (let row = 0; row < this.cells.length - 1; row++) {
      for (let col = 0; col < this.cells[0].length - 1; col++) {
        const blockcells = [this.cells[row][col], this.cells[row + 1][col], this.cells[row][col + 1], this.cells[row + 1][col + 1]];

        // 2x2の塊が同じ数字で埋まっているかチェック
        const countOcean = blockcells.filter(c => c && c.isOcean()).length;
        if (countOcean === 3) {
          const islandcell = blockcells.find(c => c.confirmed == null);
            if (islandcell && islandcell.confirmed == null) {
                //this.setIsland(islandcell.x, islandcell.y, 0);
                islandcell.confirmed = null;
            }
          return true;
        }
      }
    }
    return false;
  }



}

export default function NurikabePage() {
  const [width, setWidth] = useState(8);
  const [height, setHeight] = useState(8);
  const [board, setBoard] = useState<CellValue[][]>(() => 
    Array(8).fill(null).map(() => Array(8).fill(null))
  );
  const [showManual, setShowManual] = useState(false);

  // 盤面サイズ変更
  const handleSizeChange = () => {
    const newBoard: CellValue[][] = Array(height).fill(null).map(() => Array(width).fill(null));
    
    // 既存のデータを可能な範囲でコピー
    for (let row = 0; row < Math.min(height, board.length); row++) {
      for (let col = 0; col < Math.min(width, board[0].length); col++) {
        newBoard[row][col] = board[row][col];
      }
    }
    
    setBoard(newBoard);
  };

  // セルクリック時の数字入力
  const handleCellClick = (row: number, col: number) => {
    const input = prompt("数字を入力してください (1-99、空白の場合は0またはキャンセル):");
    
    if (input === null) return; // キャンセル
    
    const value = input.trim();
    let cellValue: CellValue = null;
    
    if (value === "" || value === "0") {
      cellValue = null;
    } else {
      const num = parseInt(value);
      if (!isNaN(num) && num >= 1 && num <= 99) {
        cellValue = num;
      } else {
        alert("1-99の数字を入力してください");
        return;
      }
    }
    
    const newBoard = [...board];
    newBoard[row][col] = cellValue;
    setBoard(newBoard);
  };


  // 解析実行（後で実装）
  const handleSolve = () => {
    const newField = new Field(width, height);
  };

  // リセット
  const handleReset = () => {
    setBoard(Array(height).fill(null).map(() => Array(width).fill(null)));
  };

  return (
    <main className="max-w-4xl mx-auto p-6">
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
            <h3 className="text-xl font-bold mb-2">ぬりかべソルバーの使い方</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm mb-4">
              <li>盤面サイズを縦・横で設定し、「サイズ変更」ボタンで盤面を変更できます。</li>
              <li>盤面のマスをクリックして数字(1-99)を入力できます。</li>
              <li>空白にしたい場合は0を入力するかキャンセルしてください。</li>
              <li>解析ボタンでぬりかべパズルを解きます（後で実装予定）。</li>
              <li>リセットボタンで盤面を初期化できます。</li>
            </ul>
          </div>
        </div>
      )}

      <h2 className="text-2xl font-bold mb-4">ぬりかべソルバー</h2>

      {/* サイズ設定 */}
      <div className="mb-4 flex gap-4 items-center">
        <div className="flex items-center gap-2">
          <label>横:</label>
          <input
            type="number"
            min="3"
            max="20"
            value={width}
            onChange={e => setWidth(Math.max(3, Math.min(20, parseInt(e.target.value) || 3)))}
            className="w-16 p-1 border rounded"
          />
        </div>
        <div className="flex items-center gap-2">
          <label>縦:</label>
          <input
            type="number"
            min="3"
            max="20"
            value={height}
            onChange={e => setHeight(Math.max(3, Math.min(20, parseInt(e.target.value) || 3)))}
            className="w-16 p-1 border rounded"
          />
        </div>
        <button
          className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          onClick={handleSizeChange}
        >サイズ変更</button>
      </div>

      {/* ボタン */}
      <div className="mb-4 flex gap-2">
        <button
          className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200"
          onClick={handleSolve}
        >解析</button>
        <button
          className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
          onClick={handleReset}
        >リセット</button>
      </div>

      {/* 盤面 */}
      <div className="mb-4">
        <h3 className="font-semibold mb-2">盤面（クリックで数字入力）</h3>
        <div className="inline-block border-2 border-gray-400">
          {board.map((row, rowIndex) => (
            <div key={rowIndex} className="flex">
              {row.map((cell, colIndex) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className="w-10 h-10 border border-gray-300 cursor-pointer flex items-center justify-center text-sm font-bold bg-white hover:bg-gray-100"
                  onClick={() => handleCellClick(rowIndex, colIndex)}
                >
                  {cell !== null ? cell : ""}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="text-sm text-gray-600">
        <p>※ ぬりかべは数字の島を作り、黒マスで海を表現するパズルです</p>
        <p>※ 解析機能は後で実装予定です</p>
      </div>
    </main>
  );
}
