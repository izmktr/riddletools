"use client";

import { useState } from "react";
import Link from "next/link";

type CellMark = "white" | "black" | null;
type LineState = "undecided" | "line" | "no-line";

type Notice = { message: string; type: "info" | "success" | "error" } | null;

const circleSvg = {
  white: (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-label="白丸" role="img">
      <circle cx="12" cy="12" r="10" fill="white" stroke="black" strokeWidth="2" />
    </svg>
  ),
  black: (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-label="黒丸" role="img">
      <circle cx="12" cy="12" r="10" fill="black" />
    </svg>
  ),
};

const createEmptyBoard = (width: number, height: number): CellMark[][] => {
  return Array(height)
    .fill(null)
    .map(() => Array(width).fill(null));
};

const createEmptyLines = (width: number, height: number): (LineState)[][] => {
  return Array(height)
    .fill(null)
    .map(() => Array(width).fill("undecided"));
};

const enforceLineEdges = (
  horizontal: (LineState)[][],
  vertical: (LineState)[][]
) => {
  const h = horizontal.length;
  const w = horizontal[0]?.length ?? 0;
  if (h === 0 || w === 0) return;

  for (let y = 0; y < h; y++) {
    horizontal[y][w - 1] = "no-line";
  }
  for (let x = 0; x < w; x++) {
    vertical[h - 1][x] = "no-line";
  }
};

type LineShapeState = "undecided" | "one-line" | "blank" | "turn" | "straight";

class Field {
  board: CellMark[][]; // 盤面の白丸/黒丸/空欄の情報
  boardState: LineShapeState[][]; // 各マスの線の状態（未確定/1本/空白/曲がる/直線）
  width: number; // 盤面の横幅
  height: number; // 盤面の縦幅
  horizontalLines: (LineState | undefined)[][]; // 水平線情報（右方向の線）
  verticalLines: (LineState | undefined)[][]; // 垂直線情報（下方向の線）

  constructor(board: CellMark[][]) {
    this.board = board;
    this.height = board.length;
    this.width = board[0]?.length ?? 0;
    this.horizontalLines = createEmptyLines(this.width, this.height);
    this.verticalLines = createEmptyLines(this.width, this.height);
    this.boardState = Array(this.height)
      .fill(null)
      .map(() => Array(this.width).fill("undecided"));
    enforceLineEdges(this.horizontalLines, this.verticalLines);
  }

  // 指定座標の白丸/黒丸/空欄を取得
  getCellMark(x: number, y: number): CellMark {
    return this.board[y]?.[x] ?? null;
  }

  // 指定座標の周囲4方向の線状態を取得（上・右・下・左）
  getSurroundingLines(
    x: number,
    y: number
  ): [LineState, LineState, LineState, LineState] {
    const up = y > 0 ? this.verticalLines[y - 1]?.[x] ?? "no-line" : "no-line";
    const right = this.horizontalLines[y]?.[x] ?? "no-line";
    const down = this.verticalLines[y]?.[x] ?? "no-line";
    const left = x > 0 ? this.horizontalLines[y]?.[x - 1] ?? "no-line" : "no-line";
    return [up, right, down, left];
  }

  // 指定座標の線形状（未確定/1本/空白/曲がる/直線）を判定
  getLineShapeState(x: number, y: number): LineShapeState {
    const [up, right, down, left] = this.getSurroundingLines(x, y);
    const lines = [up, right, down, left];
    const lineCount = lines.filter(v => v === "line").length;
    const undecidedCount = lines.filter(v => v === "undecided").length;

    if (lineCount === 0 && undecidedCount === 0) {
      return "blank";
    }
    if (lineCount === 0 && undecidedCount > 0) {
      return "undecided";
    }
    if (lineCount === 1) {
      return "one-line";
    }
    if (lineCount >= 2) {
      const isStraight = (up === "line" && down === "line") || (left === "line" && right === "line");
      const isTurn = (up === "line" || down === "line") && (left === "line" || right === "line");
      if (isStraight) return "straight";
      if (isTurn) return "turn";
    }

    return "undecided";
  }

  // 指定座標から確定線が向かう隣接マスの座標を取得
  getConfirmedLineTargets(x: number, y: number): [number, number][] {
    const targets: [number, number][] = [];
    const [up, right, down, left] = this.getSurroundingLines(x, y);

    if (up === "line" && y > 0) targets.push([x, y - 1]);
    if (right === "line" && x + 1 < this.width) targets.push([x + 1, y]);
    if (down === "line" && y + 1 < this.height) targets.push([x, y + 1]);
    if (left === "line" && x > 0) targets.push([x - 1, y]);

    return targets;
  }

  // 指定方向の線状態を更新（変更があればtrue）
  private setLineInDirection(
    x: number,
    y: number,
    direction: 0 | 1 | 2 | 3,
    state: LineState
  ): boolean {
    if (direction === 0) {
      if (y <= 0) return false;
      if (this.verticalLines[y - 1][x] !== state) {
        this.verticalLines[y - 1][x] = state;
        return true;
      }
    } else if (direction === 1) {
      if (x + 1 >= this.width) return false;
      if (this.horizontalLines[y][x] !== state) {
        this.horizontalLines[y][x] = state;
        return true;
      }
    } else if (direction === 2) {
      if (y + 1 >= this.height) return false;
      if (this.verticalLines[y][x] !== state) {
        this.verticalLines[y][x] = state;
        return true;
      }
    } else {
      if (x <= 0) return false;
      if (this.horizontalLines[y][x - 1] !== state) {
        this.horizontalLines[y][x - 1] = state;
        return true;
      }
    }

    return false;
  }

  // 自身と隣接セルのboardStateを再計算
  private updateBoardState(cells: Array<[number, number]>) {
    for (const [cx, cy] of cells) {
      if (cy < 0 || cy >= this.height || cx < 0 || cx >= this.width) continue;
      this.boardState[cy][cx] = this.getLineShapeState(cx, cy);
    }
  }

  private getNeighborByDirection(x: number, y: number, direction: 0 | 1 | 2 | 3): [number, number] {
    if (direction === 0) return [x, y - 1];
    if (direction === 1) return [x + 1, y];
    if (direction === 2) return [x, y + 1];
    return [x - 1, y];
  }

  // 汎用チェック：線の数と未確定数から確定を進める
  analyzeGeneric(x: number, y: number, force: boolean): boolean {
    let changed = false;
    const updatedCells: Array<[number, number]> = [[x, y]];
    const directions: Array<0 | 1 | 2 | 3> = [0, 1, 2, 3];
    const lines = this.getSurroundingLines(x, y);

    const undecidedIndices = directions.filter((_, idx) => lines[idx] === "undecided");
    const decidedIndices = directions.filter((_, idx) => lines[idx] !== "undecided");
    const lineCount = lines.filter(v => v === "line").length;

    if (lineCount === 3) {
      throw new Error("破綻しました");
    }

    if (decidedIndices.length === 3 && undecidedIndices.length === 1) {
      const target = undecidedIndices[0];
      const stateToSet: LineState = lineCount === 1 ? "line" : "no-line";
      if (this.setLineInDirection(x, y, target, stateToSet)) {
        changed = true;
        updatedCells.push(this.getNeighborByDirection(x, y, target));
      }
    }

    if (force && decidedIndices.length === 2 && undecidedIndices.length === 2) {
      for (const target of undecidedIndices) {
        if (this.setLineInDirection(x, y, target, "line")) {
          changed = true;
          updatedCells.push(this.getNeighborByDirection(x, y, target));
        }
      }
    }

    this.updateBoardState(updatedCells);
    return changed;
  }

  // 指定マスを直線として解析し、線情報とboardStateを更新
  analyzeStraight(x: number, y: number, force: boolean): boolean {
    let changed = false;
    const updatedCells: Array<[number, number]> = [[x, y]];
    const directions: Array<0 | 1 | 2 | 3> = [0, 1, 2, 3];
    const opposite: Record<0 | 1 | 2 | 3, 0 | 1 | 2 | 3> = {
      0: 2,
      1: 3,
      2: 0,
      3: 1,
    };

    const lines = this.getSurroundingLines(x, y);

    let hasNoLine = false;
    directions.forEach((dir, idx) => {
      if (lines[idx] === "no-line") {
        hasNoLine = true;
        const opp = opposite[dir];
        if (this.setLineInDirection(x, y, opp, "no-line")) {
          changed = true;
          if (opp === 0) updatedCells.push([x, y - 1]);
          if (opp === 1) updatedCells.push([x + 1, y]);
          if (opp === 2) updatedCells.push([x, y + 1]);
          if (opp === 3) updatedCells.push([x - 1, y]);
        }
      }
    });

    if (force && hasNoLine) {
      const afterNoLine = this.getSurroundingLines(x, y);
      directions.forEach((dir, idx) => {
        if (afterNoLine[idx] !== "no-line") {
          if (this.setLineInDirection(x, y, dir, "line")) {
            changed = true;
            if (dir === 0) updatedCells.push([x, y - 1]);
            if (dir === 1) updatedCells.push([x + 1, y]);
            if (dir === 2) updatedCells.push([x, y + 1]);
            if (dir === 3) updatedCells.push([x - 1, y]);
          }
        }
      });
    }

    const afterForce = this.getSurroundingLines(x, y);
    directions.forEach((dir, idx) => {
      if (afterForce[idx] === "line") {
        const opp = opposite[dir];
        if (this.setLineInDirection(x, y, opp, "line")) {
          changed = true;
          if (opp === 0) updatedCells.push([x, y - 1]);
          if (opp === 1) updatedCells.push([x + 1, y]);
          if (opp === 2) updatedCells.push([x, y + 1]);
          if (opp === 3) updatedCells.push([x - 1, y]);
        }
      }
    });
    this.updateBoardState(updatedCells);
    return changed;
  }

  // 指定マスをカーブとして解析し、線情報とboardStateを更新
  analyzeTurn(x: number, y: number, force: boolean): boolean {
    void force;
    let changed = false;
    const updatedCells: Array<[number, number]> = [[x, y]];
    const directions: Array<0 | 1 | 2 | 3> = [0, 1, 2, 3];
    const opposite: Record<0 | 1 | 2 | 3, 0 | 1 | 2 | 3> = {
      0: 2,
      1: 3,
      2: 0,
      3: 1,
    };

    const lines = this.getSurroundingLines(x, y);

    directions.forEach((dir, idx) => {
      const opp = opposite[dir];
      if (lines[idx] === "no-line") {
        if (this.setLineInDirection(x, y, opp, "line")) {
          changed = true;
          if (opp === 0) updatedCells.push([x, y - 1]);
          if (opp === 1) updatedCells.push([x + 1, y]);
          if (opp === 2) updatedCells.push([x, y + 1]);
          if (opp === 3) updatedCells.push([x - 1, y]);
        }
      } else if (lines[idx] === "line") {
        if (this.setLineInDirection(x, y, opp, "no-line")) {
          changed = true;
          if (opp === 0) updatedCells.push([x, y - 1]);
          if (opp === 1) updatedCells.push([x + 1, y]);
          if (opp === 2) updatedCells.push([x, y + 1]);
          if (opp === 3) updatedCells.push([x - 1, y]);
        }
      }
    });

    this.updateBoardState(updatedCells);
    return changed;
  }

  // 黒丸から伸びる線は必ず直線になるため、1つ先の線も確定させる
  extendStraightFromBlack(x: number, y: number): boolean {
    let changed = false;
    const updatedCells: Array<[number, number]> = [[x, y]];
    const [up, right, down, left] = this.getSurroundingLines(x, y);

    const handleDir = (
      dir: 0 | 1 | 2 | 3,
      nextX: number,
      nextY: number,
      nextDir: 0 | 1 | 2 | 3,
      dx: number,
      dy: number
    ) => {
      const firstInBounds = nextX >= 0 && nextX < this.width && nextY >= 0 && nextY < this.height;
      const secondX = nextX + dx;
      const secondY = nextY + dy;
      const secondInBounds = secondX >= 0 && secondX < this.width && secondY >= 0 && secondY < this.height;

      if (firstInBounds) {
        const nextLines = this.getSurroundingLines(nextX, nextY);
        if (nextLines[nextDir] === "no-line") {
          if (this.setLineInDirection(x, y, dir, "no-line")) changed = true;
          updatedCells.push([nextX, nextY]);
          return;
        }
      }

      if (!firstInBounds || !secondInBounds) {
        if (this.setLineInDirection(x, y, dir, "no-line")) changed = true;
        updatedCells.push([nextX, nextY], [secondX, secondY]);
        return;
      }

      if (this.setLineInDirection(nextX, nextY, nextDir, "line")) {
        changed = true;
      }
      updatedCells.push([nextX, nextY], [secondX, secondY]);
    };

    if (up === "line") {
      handleDir(0, x, y - 1, 0, 0, -1);
    }
    if (right === "line") {
      handleDir(1, x + 1, y, 1, 1, 0);
    }
    if (down === "line") {
      handleDir(2, x, y + 1, 2, 0, 1);
    }
    if (left === "line") {
      handleDir(3, x - 1, y, 3, -1, 0);
    }

    this.updateBoardState(updatedCells);
    return changed;
  }
}

const formatPosition = (x: number, y: number): string => `(${x + 1},${y + 1})`;

const sampleLines = [
  "・・◯・◯・・・・・",
  "・・・・◯・・・●・",
  "・・●・●・◯・・・",
  "・・　◯・・◯・・・",
  "●・・・・◯・・・◯",
  "・・◯・・・・◯・・",
  "・・●・・・◯・・・",
  "◯・・・●・・・・◯",
  "・・・・・・◯◯・・",
  "・・●・・・・・・●",
];

const renderMark = (cell: CellMark) => {
  if (cell === "white") return circleSvg.white;
  if (cell === "black") return circleSvg.black;
  return null;
};

export default function MashuPage() {
  const [width, setWidth] = useState(10);
  const [height, setHeight] = useState(10);
  const [inputWidth, setInputWidth] = useState("10");
  const [inputHeight, setInputHeight] = useState("10");
  const [board, setBoard] = useState<CellMark[][]>(() =>
    createEmptyBoard(10, 10)
  );
  const [field, setField] = useState<Field>(() => new Field(createEmptyBoard(10, 10)));
  const [selectedCell, setSelectedCell] = useState<{ x: number; y: number } | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [exportText, setExportText] = useState("");
  const [importText, setImportText] = useState("");
  const [notice, setNotice] = useState<Notice>(null);

  const showNotice = (message: string, type: "info" | "success" | "error" = "info") => {
    setNotice({ message, type });
    setTimeout(() => setNotice(null), 3000);
  };

  const analyze = () => {
    const newField = new Field(board);

    let changed = true;
    while (changed) {
      changed = false;
      let changedByGeneric = false;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const mark = newField.getCellMark(x, y);
          if (mark === "white") {
            if (newField.analyzeStraight(x, y, true)) changed = true;

            const targets = newField.getConfirmedLineTargets(x, y);
            if (targets.length === 1) {
              const [tx, ty] = targets[0];
              if (newField.analyzeTurn(tx, ty, true)) changed = true;
            } else if (targets.length === 2) {
              const [a, b] = targets;
              const aState = newField.boardState[a[1]]?.[a[0]];
              const bState = newField.boardState[b[1]]?.[b[0]];
              if (aState === "straight" && bState !== "turn") {
                if (newField.analyzeTurn(b[0], b[1], true)) changed = true;
              } else if (bState === "straight" && aState !== "turn") {
                if (newField.analyzeTurn(a[0], a[1], true)) changed = true;
              }
            }
          } else if (mark === "black") {
            if (newField.analyzeTurn(x, y, true)) changed = true;
            if (newField.extendStraightFromBlack(x, y)) changed = true;

            const targets = newField.getConfirmedLineTargets(x, y);
            if (targets.length === 2) {
              const [a, b] = targets;
              if (newField.analyzeStraight(a[0], a[1], true)) changed = true;
              if (newField.analyzeStraight(b[0], b[1], true)) changed = true;
            }
          }
        }
      }

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const mark = newField.getCellMark(x, y);
          if (mark === null) {
            if (newField.analyzeGeneric(x, y, false)) {
              changed = true;
              changedByGeneric = true;
            }
          }
        }
      }

      if (!changedByGeneric && !changed) {
        break;
      }
    }

    setField(newField);
  };

  const handleSizeChange = () => {
    const newWidth = Math.max(3, Math.min(20, parseInt(inputWidth) || 3));
    const newHeight = Math.max(3, Math.min(20, parseInt(inputHeight) || 3));

    const newBoard = createEmptyBoard(newWidth, newHeight);

    for (let y = 0; y < Math.min(newHeight, board.length); y++) {
      for (let x = 0; x < Math.min(newWidth, board[0]?.length || 0); x++) {
        newBoard[y][x] = board[y][x];
      }
    }

    setWidth(newWidth);
    setHeight(newHeight);
    setInputWidth(newWidth.toString());
    setInputHeight(newHeight.toString());
    setBoard(newBoard);
    setField(new Field(newBoard));
    setSelectedCell(null);
  };

  const handleReset = () => {
    const newBoard = createEmptyBoard(width, height);
    setBoard(newBoard);
    setField(new Field(newBoard));
    setSelectedCell(null);
  };

  const applyLinesToBoard = (lines: string[]) => {
    const rows = lines.map(line => Array.from(line));
    const newHeight = rows.length;
    const newWidth = Math.max(...rows.map(row => row.length), 0);

    if (newHeight === 0 || newWidth === 0) {
      showNotice("盤面が空です", "error");
      return;
    }

    const newBoard = createEmptyBoard(newWidth, newHeight);

    for (let y = 0; y < newHeight; y++) {
      for (let x = 0; x < newWidth; x++) {
        const ch = rows[y][x] ?? "・";
        if (ch === "◯") {
          newBoard[y][x] = "white";
        } else if (ch === "●") {
          newBoard[y][x] = "black";
        } else if (ch === "・" || ch === " " || ch === "　") {
          newBoard[y][x] = null;
        } else {
          showNotice(`不明な文字が含まれています: ${ch}`, "error");
          return;
        }
      }
    }

    setWidth(newWidth);
    setHeight(newHeight);
    setInputWidth(newWidth.toString());
    setInputHeight(newHeight.toString());
    setBoard(newBoard);
    setField(new Field(newBoard));
    setSelectedCell(null);
  };

  const handleSample = () => {
    applyLinesToBoard(sampleLines);
  };

  const handleAnalyze = () => {
    analyze();
  };

  const handleExport = () => {
    const lines = board.map(row =>
      row
        .map(cell => (cell === "white" ? "◯" : cell === "black" ? "●" : "・"))
        .join("")
    );
    const text = lines.join("\n");
    setExportText(text);
    setShowExport(true);
  };

  const handleCopyExport = () => {
    navigator.clipboard.writeText(exportText);
    showNotice("コピーしました！", "success");
  };

  const handleImport = () => {
    setImportText("");
    setShowImport(true);
  };

  const handleApplyImport = () => {
    const lines = importText
      .split("\n")
      .map(line => line.trimEnd())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      showNotice("テキストが空です", "error");
      return;
    }

    applyLinesToBoard(lines);
    setShowImport(false);
    showNotice("インポートしました！", "success");
  };

  const handleCellClick = (row: number, col: number) => {
    if (selectedCell && selectedCell.x === col && selectedCell.y === row) {
      setSelectedCell(null);
      return;
    }
    setSelectedCell({ x: col, y: row });
  };

  const handlePlace = (mark: CellMark) => {
    if (!selectedCell) return;
    const newBoard = board.map(row => row.slice());
    newBoard[selectedCell.y][selectedCell.x] = mark;
    setBoard(newBoard);
  };

  return (
    <main className="max-w-4xl mx-auto p-6">
      <div className="flex items-center mb-4 gap-2">
        <Link href="/" className="inline-block px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">
          トップに戻る
        </Link>
      </div>

      {notice && (
        <div
          className={`mb-4 p-3 rounded border text-sm ${
            notice.type === "success"
              ? "bg-green-100 border-green-400 text-green-800"
              : notice.type === "error"
                ? "bg-red-100 border-red-400 text-red-800"
                : "bg-blue-100 border-blue-400 text-blue-800"
          }`}
        >
          {notice.message}
        </div>
      )}

      {showExport && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 max-w-lg w-full relative">
            <button
              className="absolute top-2 right-2 px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => setShowExport(false)}
            >
              ✕
            </button>
            <h3 className="text-lg font-semibold mb-2">エクスポート</h3>
            <textarea
              className="w-full h-40 p-2 border rounded text-sm"
              value={exportText}
              readOnly
            />
            <div className="mt-3 flex gap-2">
              <button
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                onClick={handleCopyExport}
              >
                コピー
              </button>
              <button
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                onClick={() => setShowExport(false)}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 max-w-lg w-full relative">
            <button
              className="absolute top-2 right-2 px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => setShowImport(false)}
            >
              ✕
            </button>
            <h3 className="text-lg font-semibold mb-2">インポート</h3>
            <textarea
              className="w-full h-40 p-2 border rounded text-sm"
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder="◯・● の盤面を貼り付けてください"
            />
            <div className="mt-3 flex gap-2">
              <button
                className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200"
                onClick={handleApplyImport}
              >
                適用
              </button>
              <button
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                onClick={() => setShowImport(false)}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      <h2 className="text-2xl font-bold mb-4">ましゅソルバー</h2>

      <div className="mb-4 flex gap-4 items-center">
        <div className="flex items-center gap-2">
          <label>横:</label>
          <input
            type="number"
            min="3"
            max="20"
            value={inputWidth}
            onChange={e => setInputWidth(e.target.value)}
            className="w-16 p-1 border rounded"
          />
        </div>
        <div className="flex items-center gap-2">
          <label>縦:</label>
          <input
            type="number"
            min="3"
            max="20"
            value={inputHeight}
            onChange={e => setInputHeight(e.target.value)}
            className="w-16 p-1 border rounded"
          />
        </div>
        <button
          className="px-4 py-2 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
          onClick={handleSizeChange}
        >
          サイズ変更
        </button>
      </div>

      <div className="mb-4 flex gap-2 flex-wrap">
        <button
          className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200"
          onClick={handleAnalyze}
        >
          解析
        </button>
        <button
          className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
          onClick={handleReset}
        >
          リセット
        </button>
        <button
          className="px-4 py-2 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
          onClick={handleSample}
        >
          サンプル
        </button>
        <button
          className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          onClick={handleExport}
        >
          エクスポート
        </button>
        <button
          className="px-4 py-2 bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
          onClick={handleImport}
        >
          インポート
        </button>
      </div>

      <div className="mb-4">
        <h3 className="font-semibold mb-2">盤面（クリックで選択）</h3>
        <div className="flex items-start gap-4">
          <div className="inline-block border-2 border-gray-400">
            {board.map((row, rowIndex) => (
              <div key={rowIndex} className="flex">
                {row.map((cell, colIndex) => {
                  const isSelected =
                    selectedCell && selectedCell.x === colIndex && selectedCell.y === rowIndex;
                  const mark = renderMark(cell);
                  const hasRightLine = field.horizontalLines[rowIndex]?.[colIndex] === "line";
                  const hasLeftLine =
                    colIndex > 0 && field.horizontalLines[rowIndex]?.[colIndex - 1] === "line";
                  const hasDownLine = field.verticalLines[rowIndex]?.[colIndex] === "line";
                  const hasUpLine =
                    rowIndex > 0 && field.verticalLines[rowIndex - 1]?.[colIndex] === "line";
                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={`w-10 h-10 border border-gray-300 cursor-pointer flex items-center justify-center text-lg font-bold relative ${
                        isSelected ? "bg-yellow-100" : "bg-white hover:bg-gray-100"
                      }`}
                      onClick={() => handleCellClick(rowIndex, colIndex)}
                    >
                      {mark}
                      {hasRightLine && (
                        <div
                          className="absolute top-1/2 h-0.5 bg-red-500 -translate-y-1/2 pointer-events-none z-10"
                          style={{ left: "50%", right: "-1px" }}
                        />
                      )}
                      {hasLeftLine && (
                        <div
                          className="absolute top-1/2 h-0.5 bg-red-500 -translate-y-1/2 pointer-events-none z-10"
                          style={{ left: "-1px", right: "50%" }}
                        />
                      )}
                      {hasDownLine && (
                        <div
                          className="absolute left-1/2 w-0.5 bg-red-500 -translate-x-1/2 pointer-events-none z-10"
                          style={{ top: "50%", bottom: "-1px" }}
                        />
                      )}
                      {hasUpLine && (
                        <div
                          className="absolute left-1/2 w-0.5 bg-red-500 -translate-x-1/2 pointer-events-none z-10"
                          style={{ top: "-1px", bottom: "50%" }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <button
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
              onClick={() => handlePlace("white")}
              disabled={!selectedCell}
            >
              <span className="flex items-center justify-center">{circleSvg.white}</span>
            </button>
            <button
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
              onClick={() => handlePlace("black")}
              disabled={!selectedCell}
            >
              <span className="flex items-center justify-center">{circleSvg.black}</span>
            </button>
            <button
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
              onClick={() => handlePlace(null)}
              disabled={!selectedCell}
            >
              削除
            </button>
            <div className="text-xs text-gray-500 mt-1">
              {selectedCell ? `選択中: ${formatPosition(selectedCell.x, selectedCell.y)}` : "セル未選択"}
            </div>
          </div>
        </div>
      </div>

      {selectedCell && (
        <div className="mb-4 p-3 border rounded bg-gray-50 text-sm">
          <div className="font-semibold mb-1">周囲のLineState</div>
          {(() => {
            const [up, right, down, left] = field.getSurroundingLines(
              selectedCell.x,
              selectedCell.y
            );
            return (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div>上: {up}</div>
                <div>右: {right}</div>
                <div>下: {down}</div>
                <div>左: {left}</div>
              </div>
            );
          })()}
        </div>
      )}
    </main>
  );
}
