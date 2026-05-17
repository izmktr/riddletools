"use client";

import { useState, useEffect } from "react";
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
  horizontal: LineState[][],
  vertical: LineState[][]
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
type CellTraitState = "undecided" | "turn" | "straight";
type HypothesisAssignment = {
  x: number;
  y: number;
  direction: 0 | 1 | 2 | 3;
  state: LineState;
};
const waitForNextTick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

type TerminalPair = {
  a: string;
  b: string;
};

class Field {
  board: CellMark[][]; // 盤面の白丸/黒丸/空欄の情報
  boardState: LineShapeState[][]; // 各マスの線の状態（未確定/1本/空白/曲がる/直線）
  cellTraitState: CellTraitState[][]; // 各マスが通るなら直進/曲がるの属性
  width: number; // 盤面の横幅
  height: number; // 盤面の縦幅
  horizontalLines: LineState[][]; // 水平線情報（右方向の線）
  verticalLines: LineState[][]; // 垂直線情報（下方向の線）
  terminalPairs: Map<number, TerminalPair>; // 終端同士のペア（a===b は閉ループ）
  terminalEndpointToPairId: Map<string, number>; // 終端座標キー -> ペアID
  nextTerminalPairId: number;

  constructor(board: CellMark[][]) {
    this.board = board;
    this.height = board.length;
    this.width = board[0]?.length ?? 0;
    this.horizontalLines = createEmptyLines(this.width, this.height);
    this.verticalLines = createEmptyLines(this.width, this.height);
    this.boardState = Array(this.height)
      .fill(null)
      .map(() => Array(this.width).fill("undecided"));
    this.cellTraitState = Array(this.height)
      .fill(null)
      .map(() => Array(this.width).fill("undecided"));
    this.terminalPairs = new Map();
    this.terminalEndpointToPairId = new Map();
    this.nextTerminalPairId = 1;
    enforceLineEdges(this.horizontalLines, this.verticalLines);
    this.recomputeAllStates();
  }

  private coordKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  private getLineDegree(x: number, y: number): number {
    return this.getSurroundingLines(x, y).filter(v => v === "line").length;
  }

  private addTerminalPairByKey(a: string, b: string) {
    const pairId = this.nextTerminalPairId++;
    this.terminalPairs.set(pairId, { a, b });
    this.terminalEndpointToPairId.set(a, pairId);
    if (b !== a) {
      this.terminalEndpointToPairId.set(b, pairId);
    }
  }

  private removeTerminalPair(pairId: number): TerminalPair | null {
    const pair = this.terminalPairs.get(pairId);
    if (!pair) return null;

    if (this.terminalEndpointToPairId.get(pair.a) === pairId) {
      this.terminalEndpointToPairId.delete(pair.a);
    }
    if (pair.b !== pair.a && this.terminalEndpointToPairId.get(pair.b) === pairId) {
      this.terminalEndpointToPairId.delete(pair.b);
    }

    this.terminalPairs.delete(pairId);
    return pair;
  }

  private getTerminalPairInfo(endpointKey: string): { pairId: number; partnerKey: string } | null {
    const pairId = this.terminalEndpointToPairId.get(endpointKey);
    if (pairId === undefined) return null;
    const pair = this.terminalPairs.get(pairId);
    if (!pair) return null;

    if (pair.a === endpointKey) {
      return { pairId, partnerKey: pair.b };
    }
    if (pair.b === endpointKey) {
      return { pairId, partnerKey: pair.a };
    }

    return null;
  }

  private updateTerminalPairsOnLineAdd(x1: number, y1: number, x2: number, y2: number) {
    const key1 = this.coordKey(x1, y1);
    const key2 = this.coordKey(x2, y2);
    const degree1 = this.getLineDegree(x1, y1);
    const degree2 = this.getLineDegree(x2, y2);

    if (degree1 >= 2 || degree2 >= 2) {
      throw new Error(
        `破綻しました: ${formatPosition(x1, y1)}-${formatPosition(x2, y2)} / 理由: 1マスから3本以上の線が出ます`
      );
    }

    const pairInfo1 = degree1 === 1 ? this.getTerminalPairInfo(key1) : null;
    const pairInfo2 = degree2 === 1 ? this.getTerminalPairInfo(key2) : null;

    if (degree1 === 1 && !pairInfo1) {
      throw new Error("終端管理の整合性が崩れました (endpoint-1)");
    }
    if (degree2 === 1 && !pairInfo2) {
      throw new Error("終端管理の整合性が崩れました (endpoint-2)");
    }

    if (degree1 === 0 && degree2 === 0) {
      this.addTerminalPairByKey(key1, key2);
      return;
    }

    if (degree1 === 1 && degree2 === 0) {
      const info = pairInfo1!;
      const partner = info.partnerKey;
      this.removeTerminalPair(info.pairId);
      this.addTerminalPairByKey(partner, key2);
      return;
    }

    if (degree1 === 0 && degree2 === 1) {
      const info = pairInfo2!;
      const partner = info.partnerKey;
      this.removeTerminalPair(info.pairId);
      this.addTerminalPairByKey(partner, key1);
      return;
    }

    if (degree1 === 1 && degree2 === 1) {
      const info1 = pairInfo1!;
      const info2 = pairInfo2!;

      if (info1.pairId === info2.pairId) {
        this.removeTerminalPair(info1.pairId);
        this.addTerminalPairByKey(key1, key1);

        if (this.terminalPairs.size !== 1) {
          throw new Error(
            `破綻しました: ${formatPosition(x1, y1)}-${formatPosition(x2, y2)} / 理由: 小さいループが完成しました`
          );
        }
        return;
      }

      const partner1 = info1.partnerKey;
      const partner2 = info2.partnerKey;
      this.removeTerminalPair(info1.pairId);
      this.removeTerminalPair(info2.pairId);
      this.addTerminalPairByKey(partner1, partner2);
    }
  }

  private recomputeAllStates() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.boardState[y][x] = this.getLineShapeState(x, y);
      }
    }
    this.recomputeCellTraits();
  }

  // 指定座標の白丸/黒丸/空欄を取得
  getCellMark(x: number, y: number): CellMark {
    return this.board[y]?.[x] ?? null;
  }

  getCellTraitState(x: number, y: number): CellTraitState {
    return this.cellTraitState[y]?.[x] ?? "undecided";
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
    let nx = x;
    let ny = y;

    if (direction === 0) {
      if (y <= 0) return false;
      if (this.verticalLines[y - 1][x] !== state) {
        nx = x;
        ny = y - 1;
        if (state === "line") {
          this.updateTerminalPairsOnLineAdd(x, y, nx, ny);
        }
        this.verticalLines[y - 1][x] = state;
        return true;
      }
    } else if (direction === 1) {
      if (x + 1 >= this.width) return false;
      if (this.horizontalLines[y][x] !== state) {
        nx = x + 1;
        ny = y;
        if (state === "line") {
          this.updateTerminalPairsOnLineAdd(x, y, nx, ny);
        }
        this.horizontalLines[y][x] = state;
        return true;
      }
    } else if (direction === 2) {
      if (y + 1 >= this.height) return false;
      if (this.verticalLines[y][x] !== state) {
        nx = x;
        ny = y + 1;
        if (state === "line") {
          this.updateTerminalPairsOnLineAdd(x, y, nx, ny);
        }
        this.verticalLines[y][x] = state;
        return true;
      }
    } else {
      if (x <= 0) return false;
      if (this.horizontalLines[y][x - 1] !== state) {
        nx = x - 1;
        ny = y;
        if (state === "line") {
          this.updateTerminalPairsOnLineAdd(x, y, nx, ny);
        }
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
    this.recomputeCellTraits();
  }

  private getBaseCellTraitState(x: number, y: number): CellTraitState {
    const shapeState = this.boardState[y]?.[x];
    if (shapeState === "straight") return "straight";
    if (shapeState === "turn") return "turn";

    const mark = this.getCellMark(x, y);
    if (mark === "black") return "turn";
    if (mark === "white") return "straight";

    const [up, right, down, left] = this.getSurroundingLines(x, y);
    const noLineCount = [up, right, down, left].filter(v => v === "no-line").length;

    if (
      (up === "line" && down === "no-line") ||
      (down === "line" && up === "no-line") ||
      (left === "line" && right === "no-line") ||
      (right === "line" && left === "no-line")
    ) {
      return "turn";
    }

    if (noLineCount === 2) {
      if ((up === "no-line" && down === "no-line") || (left === "no-line" && right === "no-line")) {
        return "straight";
      }
      if (
        (up === "no-line" && right === "no-line") ||
        (right === "no-line" && down === "no-line") ||
        (down === "no-line" && left === "no-line") ||
        (left === "no-line" && up === "no-line")
      ) {
        return "turn";
      }
    }

    return "undecided";
  }

  private recomputeCellTraits() {
    const nextTraits: CellTraitState[][] = Array(this.height)
      .fill(null)
      .map(() => Array(this.width).fill("undecided"));

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        nextTraits[y][x] = this.getBaseCellTraitState(x, y);
      }
    }

    let changed = true;
    while (changed) {
      changed = false;

      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          if (this.getCellMark(x, y) === "white") {
            const targets = this.getConfirmedLineTargets(x, y);
            if (targets.length === 2) {
              const [a, b] = targets;
              const aTrait = nextTraits[a[1]]?.[a[0]] ?? "undecided";
              const bTrait = nextTraits[b[1]]?.[b[0]] ?? "undecided";

              if (aTrait === "straight" && bTrait === "undecided") {
                nextTraits[b[1]][b[0]] = "turn";
                changed = true;
              }
              if (bTrait === "straight" && aTrait === "undecided") {
                nextTraits[a[1]][a[0]] = "turn";
                changed = true;
              }
            }
          }
        }
      }
    }

    this.cellTraitState = nextTraits;
  }

  private getNeighborByDirection(x: number, y: number, direction: 0 | 1 | 2 | 3): [number, number] {
    if (direction === 0) return [x, y - 1];
    if (direction === 1) return [x + 1, y];
    if (direction === 2) return [x, y + 1];
    return [x - 1, y];
  }

  private getLineStateByDirection(x: number, y: number, direction: 0 | 1 | 2 | 3): LineState {
    return this.getSurroundingLines(x, y)[direction];
  }

  clone(): Field {
    const cloned = new Field(this.board.map(row => row.slice()));
    cloned.horizontalLines = this.horizontalLines.map(row => row.slice());
    cloned.verticalLines = this.verticalLines.map(row => row.slice());
    cloned.boardState = this.boardState.map(row => row.slice()) as LineShapeState[][];
    cloned.cellTraitState = this.cellTraitState.map(row => row.slice()) as CellTraitState[][];
    cloned.terminalPairs = new Map(
      Array.from(this.terminalPairs.entries()).map(([pairId, pair]) => [pairId, { ...pair }])
    );
    cloned.terminalEndpointToPairId = new Map(this.terminalEndpointToPairId);
    cloned.nextTerminalPairId = this.nextTerminalPairId;
    return cloned;
  }

  applyLineAssignments(assignments: HypothesisAssignment[]): boolean {
    for (const assignment of assignments) {
      const current = this.getLineStateByDirection(assignment.x, assignment.y, assignment.direction);
      if (current !== "undecided" && current !== assignment.state) {
        return false;
      }
    }

    let changed = false;
    const updatedCells: Array<[number, number]> = [];

    const pushCell = (cx: number, cy: number) => {
      if (cx < 0 || cx >= this.width || cy < 0 || cy >= this.height) return;
      if (!updatedCells.some(([ux, uy]) => ux === cx && uy === cy)) {
        updatedCells.push([cx, cy]);
      }
    };

    for (const assignment of assignments) {
      if (this.setLineInDirection(assignment.x, assignment.y, assignment.direction, assignment.state)) {
        changed = true;
        pushCell(assignment.x, assignment.y);
        const [nx, ny] = this.getNeighborByDirection(assignment.x, assignment.y, assignment.direction);
        pushCell(nx, ny);
      }
    }

    if (changed) {
      this.updateBoardState(updatedCells);
    }
    return changed;
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
      throw new Error(`破綻しました: ${formatPosition(x, y)} / 理由: 周囲の線が3本確定しています`);
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

  // 線が2本確定しているマスの残りの辺にno-lineをセット（×印）
  blockPassedEdges(x: number, y: number): boolean {
    let changed = false;
    const updatedCells: Array<[number, number]> = [[x, y]];
    const directions: Array<0 | 1 | 2 | 3> = [0, 1, 2, 3];
    const lines = this.getSurroundingLines(x, y);

    const lineCount = lines.filter(v => v === "line").length;
    const undecidedIndices = directions.filter((_, idx) => lines[idx] === "undecided");

    if (lineCount === 2 && undecidedIndices.length > 0) {
      for (const target of undecidedIndices) {
        if (this.setLineInDirection(x, y, target, "no-line")) {
          changed = true;
          updatedCells.push(this.getNeighborByDirection(x, y, target));
        }
      }
    }

    this.updateBoardState(updatedCells);
    return changed;
  }

  // 黒丸から各方向に2マス延ばせない場合（外周・盤面端にぶつかる）、その方向を no-line にする
  checkBlackCanExtend(x: number, y: number): boolean {
    let changed = false;
    const updatedCells: Array<[number, number]> = [[x, y]];

    const checkDirs: Array<[0 | 1 | 2 | 3, number, number]> = [
      [0,  0, -1], // 上
      [1,  1,  0], // 右
      [2,  0,  1], // 下
      [3, -1,  0], // 左
    ];

    for (const [dir, dx, dy] of checkDirs) {
      const firstX = x + dx;
      const firstY = y + dy;
      const secondX = x + dx * 2;
      const secondY = y + dy * 2;

      const firstInBounds = firstX >= 0 && firstX < this.width && firstY >= 0 && firstY < this.height;
      const secondInBounds = secondX >= 0 && secondX < this.width && secondY >= 0 && secondY < this.height;

      if (!firstInBounds || !secondInBounds) {
        // 1マス目または2マス目が盤面外 → その方向は引けない
        if (this.setLineInDirection(x, y, dir, "no-line")) {
          changed = true;
          if (firstInBounds) updatedCells.push([firstX, firstY]);
        }
      } else if (firstInBounds) {
        // 1マス目で直進できないか確認
        const firstLines = this.getSurroundingLines(firstX, firstY);

        // 条件1: 直進先がno-line
        const straightBlocked = firstLines[dir] === "no-line";

        // 条件2: 1マス目に横断方向のlineがある（直進すると3本になる）
        // dir=0,2（縦直進）の横断辺: right(1), left(3)
        // dir=1,3（横直進）の横断辺: up(0), down(2)
        const [td1, td2] = (dir === 0 || dir === 2) ? [1, 3] : [0, 2];
        const transverseBlocked = firstLines[td1] === "line" || firstLines[td2] === "line";

        if (straightBlocked || transverseBlocked) {
          if (this.setLineInDirection(x, y, dir, "no-line")) {
            changed = true;
            updatedCells.push([firstX, firstY]);
          }
        }
      }
    }

    this.updateBoardState(updatedCells);
    return changed;
  }

  // 隣のマスが黒丸の場合、その方向に線をつけない（×印）
  checkAdjacentBlackCells(x: number, y: number): boolean {
    let changed = false;
    const updatedCells: Array<[number, number]> = [[x, y]];
    const directions: Array<0 | 1 | 2 | 3> = [0, 1, 2, 3];
    const neighbors = [
      { x, y: y - 1 }, // 上（方向0）
      { x: x + 1, y }, // 右（方向1）
      { x, y: y + 1 }, // 下（方向2）
      { x: x - 1, y }, // 左（方向3）
    ];

    for (let i = 0; i < 4; i++) {
      const { x: nx, y: ny } = neighbors[i];
      if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
        const neighborMark = this.getCellMark(nx, ny);
        if (neighborMark === "black") {
          if (this.setLineInDirection(x, y, directions[i], "no-line")) {
            changed = true;
            updatedCells.push([nx, ny]);
          }
        }
      }
    }

    this.updateBoardState(updatedCells);
    return changed;
  }

  // 白マスが同一直線上で両側にある場合、中央の白マスはその方向に直進できない
  // 例: 左右が白なら中央は上下直進、上下が白なら中央は左右直進
  enforceWhiteChainDirection(x: number, y: number): boolean {
    if (this.getCellMark(x, y) !== "white") return false;

    let changed = false;
    const updatedCells: Array<[number, number]> = [[x, y]];

    const hasWhiteLeft = x > 0 && this.getCellMark(x - 1, y) === "white";
    const hasWhiteRight = x + 1 < this.width && this.getCellMark(x + 1, y) === "white";
    const hasWhiteUp = y > 0 && this.getCellMark(x, y - 1) === "white";
    const hasWhiteDown = y + 1 < this.height && this.getCellMark(x, y + 1) === "white";

    if (hasWhiteLeft && hasWhiteRight) {
      if (this.setLineInDirection(x, y, 1, "no-line")) {
        changed = true;
        updatedCells.push([x + 1, y]);
      }
      if (this.setLineInDirection(x, y, 3, "no-line")) {
        changed = true;
        updatedCells.push([x - 1, y]);
      }
    }

    if (hasWhiteUp && hasWhiteDown) {
      if (this.setLineInDirection(x, y, 0, "no-line")) {
        changed = true;
        updatedCells.push([x, y - 1]);
      }
      if (this.setLineInDirection(x, y, 2, "no-line")) {
        changed = true;
        updatedCells.push([x, y + 1]);
      }
    }

    if (changed) {
      this.updateBoardState(updatedCells);
    }
    return changed;
  }

  applyTraitConstraints(x: number, y: number): boolean {
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
    const trait = this.getCellTraitState(x, y);

    if (trait === "straight") {
      directions.forEach((dir, idx) => {
        if (lines[idx] === "no-line") {
          const opp = opposite[dir];
          if (this.setLineInDirection(x, y, opp, "no-line")) {
            changed = true;
            updatedCells.push(this.getNeighborByDirection(x, y, opp));
          }
        }
      });
    }

    if (this.getCellMark(x, y) === "black") {
      directions.forEach(dir => {
        const [nx, ny] = this.getNeighborByDirection(x, y, dir);
        if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) return;
        if (this.getCellTraitState(nx, ny) === "turn") {
          if (this.setLineInDirection(x, y, dir, "no-line")) {
            changed = true;
            updatedCells.push([nx, ny]);
          }
        }
      });
    }

    if (changed) {
      this.updateBoardState(updatedCells);
    }
    return changed;
  }

  // 終端マスから確定線を辿り、次の終端マスまでのセル列を返す
  // startX/Y: 辿り始めるセル, fromDir: "来た方向"（逆走しない）
  private traceToTerminal(
    startX: number, startY: number, fromDir: 0 | 1 | 2 | 3
  ): { cells: Array<[number, number]>; reachedTerminal: boolean } {
    const cells: Array<[number, number]> = [];
    const visited = new Set<string>();
    let cx = startX, cy = startY, lastFromDir = fromDir;
    const directions: Array<0 | 1 | 2 | 3> = [0, 1, 2, 3];

    while (true) {
      const key = `${cx},${cy}`;
      if (visited.has(key)) return { cells, reachedTerminal: false };
      visited.add(key);
      cells.push([cx, cy]);

      const lines = this.getSurroundingLines(cx, cy);
      const lineCount = lines.filter(v => v === "line").length;

      if (lineCount === 1) return { cells, reachedTerminal: true };
      if (lineCount !== 2) return { cells, reachedTerminal: false };

      const nextDir = directions.find(d => d !== lastFromDir && lines[d] === "line");
      if (nextDir === undefined) return { cells, reachedTerminal: false };

      const [nx, ny] = this.getNeighborByDirection(cx, cy, nextDir);
      if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) return { cells, reachedTerminal: false };

      const reverseDir = ([2, 3, 0, 1] as const)[nextDir];
      cx = nx; cy = ny; lastFromDir = reverseDir;
    }
  }

  // 終端マス同士を繋ぐと局所ループになる場合、その辺をno-lineにする
  checkPrematureLoop(x: number, y: number): boolean {
    let changed = false;
    const lines = this.getSurroundingLines(x, y);
    const lineCount = lines.filter(v => v === "line").length;
    if (lineCount !== 1) return false;

    const directions: Array<0 | 1 | 2 | 3> = [0, 1, 2, 3];
    const updatedCells: Array<[number, number]> = [[x, y]];

    const aLineDir = directions.find(d => lines[d] === "line");
    if (aLineDir === undefined) return false;

    const [firstX, firstY] = this.getNeighborByDirection(x, y, aLineDir);
    if (firstX < 0 || firstX >= this.width || firstY < 0 || firstY >= this.height) return false;

    const fromFirstDir = ([2, 3, 0, 1] as const)[aLineDir];
    const { cells: chainCells, reachedTerminal } = this.traceToTerminal(firstX, firstY, fromFirstDir);
    if (!reachedTerminal) return false;

    const chainEnd = chainCells[chainCells.length - 1];

    for (const dir of directions) {
      if (lines[dir] !== "undecided") continue;

      const [nx, ny] = this.getNeighborByDirection(x, y, dir);
      if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;

      // 隣マスも終端マスか確認
      const neighborLines = this.getSurroundingLines(nx, ny);
      const neighborLineCount = neighborLines.filter(v => v === "line").length;
      if (neighborLineCount !== 1) continue;

      // chain の末端が隣マスと一致 → A-B を繋ぐと閉ループになる
      if (chainEnd[0] !== nx || chainEnd[1] !== ny) continue;

      // ループ外に確定 line がある = 局所ループ → no-line
      const loopCellSet = new Set<string>();
      loopCellSet.add(`${x},${y}`);
      for (const [cx, cy] of chainCells) loopCellSet.add(`${cx},${cy}`);

      let hasOutsideLines = false;
      outer: for (let gy = 0; gy < this.height; gy++) {
        for (let gx = 0; gx < this.width; gx++) {
          if (loopCellSet.has(`${gx},${gy}`)) continue;
          const gLines = this.getSurroundingLines(gx, gy);
          if (gLines.some(v => v === "line")) {
            hasOutsideLines = true;
            break outer;
          }
        }
      }

      if (hasOutsideLines) {
        if (this.setLineInDirection(x, y, dir, "no-line")) {
          changed = true;
          updatedCells.push([nx, ny]);
        }
      }
    }

    this.updateBoardState(updatedCells);
    return changed;
  }

  // ループが完成しているか確認
  isSolved(): boolean {
    // 1. 全辺が確定しているか（undecidedがない）
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const [up, right, down, left] = this.getSurroundingLines(x, y);
        if (up === "undecided" || right === "undecided" || down === "undecided" || left === "undecided") {
          return false;
        }
      }
    }

    // 2. 全マスの線が0本か2本（1本だけあるマスはNG）
    let hasAnyLine = false;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const [up, right, down, left] = this.getSurroundingLines(x, y);
        const lineCount = [up, right, down, left].filter(v => v === "line").length;
        if (lineCount !== 0 && lineCount !== 2) return false;
        if (lineCount === 2) hasAnyLine = true;
      }
    }
    if (!hasAnyLine) return false;

    // 3. 線が1つの連続したループを形成しているか（BFS）
    let firstCell: [number, number] | null = null;
    for (let y = 0; y < this.height && !firstCell; y++) {
      for (let x = 0; x < this.width && !firstCell; x++) {
        const [up, right, down, left] = this.getSurroundingLines(x, y);
        if ([up, right, down, left].some(v => v === "line")) {
          firstCell = [x, y];
        }
      }
    }
    if (!firstCell) return false;

    const visited = new Set<string>();
    const queue: [number, number][] = [firstCell];
    visited.add(`${firstCell[0]},${firstCell[1]}`);

    while (queue.length > 0) {
      const [cx, cy] = queue.shift()!;
      const [up, right, down, left] = this.getSurroundingLines(cx, cy);
      const neighbors: Array<[number, number, LineState]> = [
        [cx, cy - 1, up],
        [cx + 1, cy, right],
        [cx, cy + 1, down],
        [cx - 1, cy, left],
      ];
      for (const [nx, ny, state] of neighbors) {
        if (state !== "line") continue;
        if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;
        const key = `${nx},${ny}`;
        if (!visited.has(key)) {
          visited.add(key);
          queue.push([nx, ny]);
        }
      }
    }

    // 線が通っている全セルを訪問できたか
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const [up, right, down, left] = this.getSurroundingLines(x, y);
        if ([up, right, down, left].some(v => v === "line") && !visited.has(`${x},${y}`)) {
          return false;
        }
      }
    }

    return true;
  }
}

const formatPosition = (x: number, y: number): string => `(${x + 1},${y + 1})`;

const sampleLines = [
  "・・◯・◯・・・・・",
  "・・・・◯・・・●・",
  "・・●・●・◯・・・",
  "・・・◯・・◯・・・",
  "●・・・・◯・・・◯",
  "・・◯・・・・◯・・",
  "・・●・・・◯・・・",
  "◯・・・●・・・・◯",
  "・・・・・・◯◯・・",
  "・・●・・・・・・●",
];

const sampleLines2 = [
  "・◯◯・・・・",
  "・・・・・・●",
  "・・・・・・・",
  "●・・・・・・",
  "・・・●●・・",
  "◯・◯・・・◯",
  "・・・・◯・・",
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
  const [solved, setSolved] = useState(false);
  const [isReanalysisMode, setIsReanalysisMode] = useState(false);
  const [reanalysisProgress, setReanalysisProgress] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const showNotice = (message: string, type: "info" | "success" | "error" = "info") => {
    setNotice({ message, type });
  };

  const checkDeadEndCells = (newField: Field) => {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const lines = newField.getSurroundingLines(x, y);
        const lineCount = lines.filter(v => v === "line").length;
        const undecidedCount = lines.filter(v => v === "undecided").length;

        if (lineCount === 1 && undecidedCount === 0) {
          throw new Error(`破綻しました: ${formatPosition(x, y)} / 理由: 1箇所だけ線が確定し、残り3辺に線が通らないことが確定しています`);
        }
      }
    }
  };

  /**
   * 白丸マスの解析処理
   * 白丸は直線になるため、周囲の線を確認して推論を進める
   */
  const analyzeWhiteCells = (newField: Field): boolean => {
    let changed = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const mark = newField.getCellMark(x, y);
        if (mark === "white") {
          const lines = newField.getSurroundingLines(x, y);
          const lineCount = lines.filter(v => v === "line").length;
          const undecidedCount = lines.filter(v => v === "undecided").length;
          const isResolved = lineCount === 2 && undecidedCount === 0;

          if (lineCount === 0 && undecidedCount === 0) {
            throw new Error(`破綻しました: ${formatPosition(x, y)} / 理由: 白マスなのに線が通らないことが確定しています`);
          }

          // 確定済みセルは自己確定処理だけ省略し、近傍への伝播は継続する
          if (!isResolved) {
            // 白が3連続以上になる並びの中央は、並び方向に直進できない
            if (newField.enforceWhiteChainDirection(x, y)) changed = true;

            // 白丸は直線で通るため、対向する線を確定させる
            if (newField.analyzeStraight(x, y, true)) changed = true;
          }

          // 確定した線の先のマスの状態を判定
          const targets = newField.getConfirmedLineTargets(x, y);
          if (targets.length === 1) {
            // 1方向にのみ線が確定している場合、その先のマスは曲がる必要がある
            const [tx, ty] = targets[0];
            if (newField.analyzeTurn(tx, ty, true)) changed = true;
          } else if (targets.length === 2) {
            // 2方向に線が確定している場合、どちらが直線かを判定して処理
            const [a, b] = targets;
            const aState = newField.boardState[a[1]]?.[a[0]];
            const bState = newField.boardState[b[1]]?.[b[0]];
            if (aState === "straight" && bState !== "turn") {
              if (newField.analyzeTurn(b[0], b[1], true)) changed = true;
            } else if (bState === "straight" && aState !== "turn") {
              if (newField.analyzeTurn(a[0], a[1], true)) changed = true;
            }
          }
        }
      }
    }

    return changed;
  };

  /**
   * 黒丸マスの解析処理
   * 黒丸は曲がるため、対向する線をブロックして直線を拡張する
   */
  const analyzeBlackCells = (newField: Field): boolean => {
    let changed = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const mark = newField.getCellMark(x, y);
        if (mark === "black") {
          const lines = newField.getSurroundingLines(x, y);
          const lineCount = lines.filter(v => v === "line").length;
          const undecidedCount = lines.filter(v => v === "undecided").length;
          const isResolved = lineCount === 2 && undecidedCount === 0;

          if (lineCount === 0 && undecidedCount === 0) {
            throw new Error(`破綻しました: ${formatPosition(x, y)} / 理由: 黒マスなのに線が通らないことが確定しています`);
          }

          // 確定済みセルは自己確定処理だけ省略し、近傍への伝播は継続する
          if (!isResolved) {
            // 黒丸から2マス延ばせない方向（外周に近い）を no-line にする
            if (newField.checkBlackCanExtend(x, y)) changed = true;

            // 隣が黒丸の場合、その方向に線をつけない（×印）
            if (newField.checkAdjacentBlackCells(x, y)) changed = true;

            // 黒丸は曲がるため、対向する線を確定させない
            if (newField.analyzeTurn(x, y, true)) changed = true;
          }

          // 黒丸から伸びる直線は、次のマスでも直線が続く
          if (newField.extendStraightFromBlack(x, y)) changed = true;

          // 確定した2方向の線の先が直線であることを確定させる
          const targets = newField.getConfirmedLineTargets(x, y);
          if (targets.length === 2) {
            const [a, b] = targets;
            if (newField.analyzeStraight(a[0], a[1], true)) changed = true;
            if (newField.analyzeStraight(b[0], b[1], true)) changed = true;
          }
        }
      }
    }

    return changed;
  };

  /**
   * 通過済みマスの残り辺にxをつける処理
   * 全マスを対象に、線が2本確定していたら残りの辺をno-lineにする
   */
  const analyzePassedCells = (newField: Field): boolean => {
    let changed = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const lines = newField.getSurroundingLines(x, y);
        const undecidedCount = lines.filter(v => v === "undecided").length;
        if (undecidedCount === 0) continue;

        // 線が2本確定しているマスの残り辺にxをつける
        if (newField.blockPassedEdges(x, y)) changed = true;
      }
    }

    return changed;
  };

  const analyzeTraitCells = (newField: Field): boolean => {
    let changed = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const lines = newField.getSurroundingLines(x, y);
        const undecidedCount = lines.filter(v => v === "undecided").length;
        if (undecidedCount === 0) continue;

        if (newField.applyTraitConstraints(x, y)) changed = true;
      }
    }

    return changed;
  };

  /**
   * 空マスの解析処理
   * 未確定の線について、周囲の確定線から推論を進める
   */
  const analyzeEmptyCells = (newField: Field): boolean => {
    let changedByGeneric = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const mark = newField.getCellMark(x, y);
        if (mark === null) {
          const lines = newField.getSurroundingLines(x, y);
          const lineCount = lines.filter(v => v === "line").length;
          const undecidedCount = lines.filter(v => v === "undecided").length;

          if (lineCount === 3) {
            throw new Error(`破綻しました: ${formatPosition(x, y)} / 理由: 周囲の線が3本確定しています`);
          }

          if (undecidedCount === 0) {
            continue;
          }

          // 汎用ルール：確定線の数から未確定線を推論する
          if (newField.analyzeGeneric(x, y, false)) {
            changedByGeneric = true;
          }
        }
      }
    }

    return changedByGeneric;
  };

  /**
   * 局所ループ防止チェック
   * 終端マス同士を繋ぐと全体を含まない閉ループになる辺にxをつける
   */
  const analyzePrematureLoops = (newField: Field): boolean => {
    let changed = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const lines = newField.getSurroundingLines(x, y);
        const undecidedCount = lines.filter(v => v === "undecided").length;
        if (undecidedCount === 0) continue;

        if (newField.checkPrematureLoop(x, y)) changed = true;
      }
    }

    return changed;
  };

  /**
   * 決定論的解析の内側ループ（矛盾なしで繰り返し）
   */
  const runInnerAnalysis = (f: Field) => {
    let changed = true;
    while (changed) {
      checkDeadEndCells(f);
      changed = false;

      if (analyzeWhiteCells(f)) changed = true;
      if (analyzeBlackCells(f)) changed = true;
      if (analyzeTraitCells(f)) changed = true;
      if (analyzePassedCells(f)) changed = true;
      if (analyzePrematureLoops(f)) changed = true;
      const changedByGeneric = analyzeEmptyCells(f);
      if (changedByGeneric) changed = true;
      if (!changedByGeneric && !changed) break;
    }
  };

  /**
   * 仮定のアサインを適用して解析し、矛盾が発生するかどうかを確認する
   * 矛盾する場合は true、問題なければ false を返す
   */
  const tryContradiction = (trialField: Field, assignments: HypothesisAssignment[]): boolean => {
    const preConflict = assignments.some(a => {
      const lines = trialField.getSurroundingLines(a.x, a.y);
      const current = lines[a.direction];
      return current !== "undecided" && current !== a.state;
    });
    if (preConflict) return true;
    try {
      if (assignments.length > 0) trialField.applyLineAssignments(assignments);
      runInnerAnalysis(trialField);
      return false;
    } catch {
      return true;
    }
  };

  /**
   * 背理法による解析
   * 黒・白・終端マスについて仮定を置いて解析し、
   * 破綻するケースから no-line を確定させる
   */
  const analyzeByContradiction = (newField: Field): boolean => {
    let changed = false;
    const opposite = ([2, 3, 0, 1] as const);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const mark = newField.getCellMark(x, y);
        // lineCount は "line" 本数のみ参照し、スキャン中は増えないため一度だけ取得
        const lineCount = newField.getSurroundingLines(x, y).filter(v => v === "line").length;

        // 黒マス：L字の各方向を仮定して解析
        if (mark === "black" && lineCount < 2) {
          const turns: Array<[0 | 1 | 2 | 3, 0 | 1 | 2 | 3]> = [
            [0, 1], [1, 2], [2, 3], [3, 0],
          ];

          for (const dir of [0, 1, 2, 3] as const) {
            // 方向ごとに最新の線状態を取得（同セル内の前の処理で変化している場合がある）
            const freshLines = newField.getSurroundingLines(x, y);
            if (freshLines[dir] !== "undecided") continue;

            // このdirをlineとして使う有効なL字パターンを収集
            const turnsWithDir = turns.filter(
              ([a, b]) => (a === dir || b === dir) && freshLines[a] !== "no-line" && freshLines[b] !== "no-line"
            );

            if (turnsWithDir.length === 0) {
              if (newField.applyLineAssignments([{ x, y, direction: dir, state: "no-line" }])) changed = true;
              continue;
            }

            // このdirを含む全パターンが破綻するなら no-line
            const allFail = turnsWithDir.every(([a, b]) => {
              const trial = newField.clone();
              const assignments: HypothesisAssignment[] = [];
              if (freshLines[a] !== "line") assignments.push({ x, y, direction: a, state: "line" });
              if (freshLines[b] !== "line") assignments.push({ x, y, direction: b, state: "line" });
              if (freshLines[opposite[a]] !== "no-line") assignments.push({ x, y, direction: opposite[a], state: "no-line" });
              if (freshLines[opposite[b]] !== "no-line") assignments.push({ x, y, direction: opposite[b], state: "no-line" });
              return tryContradiction(trial, assignments);
            });

            if (allFail) {
              if (newField.applyLineAssignments([{ x, y, direction: dir, state: "no-line" }])) changed = true;
            }
          }
        }

        // 白マス：縦・横の直線を仮定して解析
        else if (mark === "white" && lineCount < 2) {
          // [lineA, lineB] が直線方向、[perpA, perpB] が垂直方向（no-line にする）
          const straightPairs: Array<{
            lineA: 0 | 1 | 2 | 3; lineB: 0 | 1 | 2 | 3;
            perpA: 0 | 1 | 2 | 3; perpB: 0 | 1 | 2 | 3;
          }> = [
            { lineA: 0, lineB: 2, perpA: 1, perpB: 3 }, // 縦 (上・下) → 横がno-line
            { lineA: 1, lineB: 3, perpA: 0, perpB: 2 }, // 横 (右・左) → 縦がno-line
          ];

          for (const { lineA, lineB, perpA, perpB } of straightPairs) {
            // 最新状態を取得
            const freshLines = newField.getSurroundingLines(x, y);
            if (freshLines[lineA] === "no-line" || freshLines[lineB] === "no-line") continue;
            if (freshLines[lineA] === "line" && freshLines[lineB] === "line") continue;

            const trial = newField.clone();
            const assignments: HypothesisAssignment[] = [];
            if (freshLines[lineA] !== "line") assignments.push({ x, y, direction: lineA, state: "line" });
            if (freshLines[lineB] !== "line") assignments.push({ x, y, direction: lineB, state: "line" });
            if (freshLines[perpA] !== "no-line") assignments.push({ x, y, direction: perpA, state: "no-line" });
            if (freshLines[perpB] !== "no-line") assignments.push({ x, y, direction: perpB, state: "no-line" });

            if (tryContradiction(trial, assignments)) {
              // 破綻した直線方向をno-lineにする
              for (const d of [lineA, lineB] as const) {
                const cur = newField.getSurroundingLines(x, y)[d];
                if (cur === "undecided") {
                  if (newField.applyLineAssignments([{ x, y, direction: d, state: "no-line" }])) changed = true;
                }
              }
            }
          }
        }

        // 終端マス（線が1本確定）：未確定方向への延伸を仮定して解析
        else if (lineCount === 1) {
          for (const dir of [0, 1, 2, 3] as const) {
            const freshLines = newField.getSurroundingLines(x, y);
            if (freshLines[dir] !== "undecided") continue;
            const trial = newField.clone();
            if (tryContradiction(trial, [{ x, y, direction: dir, state: "line" }])) {
              if (newField.applyLineAssignments([{ x, y, direction: dir, state: "no-line" }])) changed = true;
            }
          }
        }
      }
    }

    return changed;
  };

  const solveDeterministically = (newField: Field) => {
    runInnerAnalysis(newField);
  };

  const solveByContradiction = (newField: Field): boolean => {
    let contradictionChanged = true;
    let hadContradictionProgress = false;

    while (contradictionChanged) {
      runInnerAnalysis(newField);
      if (newField.isSolved()) {
        return true;
      }

      contradictionChanged = analyzeByContradiction(newField);
      if (contradictionChanged) {
        hadContradictionProgress = true;
      }
    }

    return hadContradictionProgress;
  };

  const runReanalysis = async (newField: Field): Promise<Field> => {
    solveByContradiction(newField);
    if (!newField.isSolved()) {
      throw new Error("再解析できませんでした");
    }
    return newField;
  };

  /**
   * パズル全体の解析
   * 白丸・黒丸・空マスを順に処理し、変更がなくなるまで繰り返す
   */
  const analyze = () => {
    let newField: Field | null = null;
    try {
      newField = new Field(board);

      solveDeterministically(newField);

      setField(newField);
      const isSolved = newField.isSolved();
      setSolved(isSolved);
      if (isSolved) {
        showNotice("完成しました！", "success");
        setIsReanalysisMode(false);
      } else {
        showNotice("解析が完了しませんでした。再解析できます。", "info");
        setIsReanalysisMode(true);
      }
    } catch (error) {
      if (newField) {
        // 破綻時も、ここまでに確定した線情報を盤面へ反映する
        setField(newField);
      }
      setSolved(false);
      setIsReanalysisMode(false);
      if (error instanceof Error) {
        showNotice(error.message, "error");
      } else {
        showNotice("破綻しました", "error");
      }
    }
  };

  const handleSizeChange = () => {
    const newWidth = Math.max(3, Math.min(50, parseInt(inputWidth) || 3));
    const newHeight = Math.max(3, Math.min(50, parseInt(inputHeight) || 3));

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
    setSolved(false);
    setIsReanalysisMode(false);
  };

  const handleReset = () => {
    const newBoard = createEmptyBoard(width, height);
    setBoard(newBoard);
    setField(new Field(newBoard));
    setSelectedCell(null);
    setSolved(false);
    setNotice(null);
    setIsReanalysisMode(false);
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
    setSolved(false);
    setIsReanalysisMode(false);
  };

  const handleSample = () => {
    applyLinesToBoard(sampleLines);
  };

  const handleAnalyze = async () => {
    if (isAnalyzing) return;

    setNotice(null);
    if (isReanalysisMode) {
      setIsAnalyzing(true);
      setReanalysisProgress("解析中... 背理法で再解析します");
      await waitForNextTick();
      try {
        const newField = await runReanalysis(field.clone());
        setField(newField);
        const isSolved = newField.isSolved();
        setSolved(isSolved);
        setIsReanalysisMode(!isSolved);
        setReanalysisProgress(null);
        if (isSolved) {
          showNotice("完成しました！", "success");
        } else {
          showNotice("再解析が完了しませんでした。", "info");
        }
      } catch (error) {
        setSolved(false);
        setIsReanalysisMode(true);
        setReanalysisProgress(null);
        if (error instanceof Error) {
          showNotice(error.message, "error");
        } else {
          showNotice("再解析できませんでした", "error");
        }
      } finally {
        setIsAnalyzing(false);
      }
      return;
    }

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

  const isConfirmedCell = (x: number, y: number): boolean => {
    const lines = field.getSurroundingLines(x, y);
    const lineCount = lines.filter(v => v === "line").length;
    const noLineCount = lines.filter(v => v === "no-line").length;
    return lineCount === 2 || noLineCount === 4;
  };

  const handlePlace = (mark: CellMark) => {
    if (!selectedCell) return;
    const newBoard = board.map(row => row.slice());
    newBoard[selectedCell.y][selectedCell.x] = mark;
    setBoard(newBoard);
    setIsReanalysisMode(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedCell) return;

      if (e.key === "1") {
        e.preventDefault();
        handlePlace("white");
      } else if (e.key === "2") {
        e.preventDefault();
        handlePlace("black");
      } else if (e.key === "3") {
        e.preventDefault();
        handlePlace(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedCell, handlePlace]);

  return (
    <main className="max-w-4xl mx-auto p-6">
      <div className="flex items-center mb-4 gap-2">
        <Link href="/" className="inline-block px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">
          トップに戻る
        </Link>
      </div>

      {reanalysisProgress && (
        <div className="mb-4 p-3 rounded border text-sm bg-yellow-100 border-yellow-400 text-yellow-800 animate-pulse">
          {reanalysisProgress}
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
            max="50"
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
            max="50"
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
          disabled={isAnalyzing}
        >
          {isAnalyzing ? "再解析中..." : isReanalysisMode ? "再解析" : "解析"}
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

      <div className="mb-4">
        <h3 className="font-semibold mb-2">盤面（クリックで選択）</h3>
        <div className="flex items-start gap-4">
          <div className="inline-block border-2 border-gray-400">
            {board.map((row, rowIndex) => (
              <div key={rowIndex} className="flex">
                {row.map((cell, colIndex) => {
                  const isSelected =
                    selectedCell && selectedCell.x === colIndex && selectedCell.y === rowIndex;
                  const isConfirmed = !solved && isConfirmedCell(colIndex, rowIndex);
                  const mark = renderMark(cell);
                  const hasRightLine = field.horizontalLines[rowIndex]?.[colIndex] === "line";
                  const hasLeftLine =
                    colIndex > 0 && field.horizontalLines[rowIndex]?.[colIndex - 1] === "line";
                  const hasDownLine = field.verticalLines[rowIndex]?.[colIndex] === "line";
                  const hasUpLine =
                    rowIndex > 0 && field.verticalLines[rowIndex - 1]?.[colIndex] === "line";
                  // 外周を除いたno-line（重複描画なし：右辺・下辺のみ）
                  const hasRightNoLine = colIndex < width - 1 && field.horizontalLines[rowIndex]?.[colIndex] === "no-line";
                  const hasDownNoLine = rowIndex < height - 1 && field.verticalLines[rowIndex]?.[colIndex] === "no-line";
                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={`w-10 h-10 border border-gray-300 cursor-pointer flex items-center justify-center text-lg font-bold relative ${
                        isSelected
                          ? "bg-yellow-200"
                          : isConfirmed
                            ? "bg-yellow-50 hover:bg-yellow-100"
                            : "bg-white hover:bg-gray-100"
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
                      {!solved && hasRightNoLine && (
                        <div
                          className="absolute text-blue-500 font-bold pointer-events-none z-10 select-none"
                          style={{ left: "100%", top: "50%", fontSize: "11px", transform: "translate(-50%, -50%)", lineHeight: 1 }}
                        >
                          ×
                        </div>
                      )}
                      {!solved && hasDownNoLine && (
                        <div
                          className="absolute text-blue-500 font-bold pointer-events-none z-10 select-none"
                          style={{ left: "50%", top: "100%", fontSize: "11px", transform: "translate(-50%, -50%)", lineHeight: 1 }}
                        >
                          ×
                        </div>
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
    </main>
  );
}
