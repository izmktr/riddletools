"use client";
import { useState } from "react";
import Link from "next/link";

type CellValue = number | null;

// 破綻エラークラス
class ContradictionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContradictionError';
  }
}

class Position {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  toHash(): number {
    return (this.x << 16) + this.y;
  }
  static fromHash(hash: number): Position {
    const x = hash >> 16;
    const y = hash & 0xFFFF;
    return new Position(x, y);
  }
}

type CellType = 'owner' | 'preowner' | 'confirmed' | 'wall' | 'undecided';

class Cell {
  type: CellType;  // オーナー部屋 | 仮オーナー部屋 | 確定部屋 | 確定壁 | 未確定
  ownerIsland: Island | null;  // このセルが属するオーナー部屋
  confirmedOwners: Island[];  // 確定部屋の場合、確定オーナーリスト
  reachableOwners: Island[];  // 未確定の場合、到達オーナーリスト
  wallGroup: CellGroup | null;  // 確定壁の場合、連結壁リスト
  reason: string;  // 確定理由（デバッグ用）

  constructor() {
    this.type = 'undecided';
    this.ownerIsland = null;
    this.confirmedOwners = [];
    this.reachableOwners = [];
    this.wallGroup = null;
    this.reason = "";
  }
}

class ReachableCellsByDistance {
  cellsByDistance: Map<number, Set<number>>; // 距離ごとのセルのハッシュ値リスト
  
  constructor() {
    this.cellsByDistance = new Map<number, Set<number>>();
  }

  // 指定した距離のセルを取得
  getCellsAtDistance(distance: number): Set<number> {
    return this.cellsByDistance.get(distance) || new Set<number>();
  }

  // 指定した距離にセルを追加
  addCellAtDistance(distance: number, hash: number): void {
    if (!this.cellsByDistance.has(distance)) {
      this.cellsByDistance.set(distance, new Set<number>());
    }
    this.cellsByDistance.get(distance)!.add(hash);
  }

  // すべてのセルを取得
  getAllCells(): Set<number> {
    const allCells = new Set<number>();
    for (const cells of this.cellsByDistance.values()) {
      for (const hash of cells) {
        allCells.add(hash);
      }
    }
    return allCells;
  }

  // 確定マスを除いたセルを取得(距離1以上のセル)
  getCellsExcludingConfirmed(): Set<number> {
    const cells = new Set<number>();
    for (const distance of this.cellsByDistance.keys()) {
      if (distance === 0) continue;
      for (const hash of this.cellsByDistance.get(distance)!) {
        cells.add(hash);
      }
    }
    return cells;
  }

  // 最大距離を取得
  getMaxDistance(): number {
    return Math.max(-1, ...Array.from(this.cellsByDistance.keys()));
  }

  // セルの総数を取得
  size(): number {
    let total = 0;
    for (const cells of this.cellsByDistance.values()) {
      total += cells.size;
    }
    return total;
  }

  has(hash: number): boolean {
    for (const cells of this.cellsByDistance.values()) {
      if (cells.has(hash)) {
        return true;
      }
    }
    return false;
  }

  // クリア
  clear(): void {
    this.cellsByDistance.clear();
  }
}

class CellGroup{
  cells: Set<number>; // セルのハッシュ値リスト
  edgecells : Set<number>; // エッジセルのハッシュ値リスト
  search : (x: number, y: number) => Position[];
  constructor() {
    this.cells = new Set<number>();
    this.edgecells = new Set<number>();
    this.search = () => [];
  }

  add(hash: number) {
    this.cells.add(hash);
    this.edgecells.add(hash);
  }

  addCellGroup(other: CellGroup) {
    for (const hash of other.cells) {
      this.cells.add(hash);
      this.edgecells.add(hash);
    }
  }

  //隣接セルの取得
  getAdjacent(): Set<number> {
    const removeedge = new Set<number>();
    const adjacentCells = new Set<number>();
    for (const hash of this.edgecells) {
      const pos = Position.fromHash(hash);
      const adjacents = this.search(pos.x, pos.y);

      if (adjacents.length === 0) {
        removeedge.add(hash);
        continue;
      }

      for (const adjPos of adjacents) {
        const adjHash = adjPos.toHash();
        if (!this.cells.has(adjHash)) {
          adjacentCells.add(adjHash);
        }
      }
    }
    this.edgecells = new Set([...this.edgecells].filter(h => !removeedge.has(h)));
    return adjacentCells;
  }
  
  merge(other : CellGroup) {
    for (const hash of other.cells) {
      this.cells.add(hash);
    }
    for (const hash of other.edgecells) {
      this.edgecells.add(hash);
    }
    other.cells.clear();
    other.edgecells.clear();
  }

  clear() {
    this.cells.clear();
    this.edgecells.clear();
  }

  size(): number {
    return this.cells.size;
  }
  
}

class Island {
  x: number;
  y: number;
  roomSize: number;  // 部屋サイズ（数字）
  confirmedCells: CellGroup;  // 確定部屋リスト（ハッシュ値）
  detachedConfirmedCells: Island[]; // 離れ小島用のconfirmedCells
  reachableCells: ReachableCellsByDistance;  // 距離ごとの到達部屋リスト
  unreachableCells: Set<number>; // 到達不可能セルリスト
  isFixed: boolean;  // 確定マスと部屋サイズが同じになったら固定

  constructor(field: Field, x: number, y: number, roomSize: number) {
    this.x = x;
    this.y = y;
    this.roomSize = roomSize;
    this.confirmedCells = new CellGroup();
    this.confirmedCells.add(new Position(x, y).toHash());
    this.confirmedCells.search = (x: number, y: number) => {
      return field.getReachableOwners(x, y, this);
    };

    this.reachableCells = new ReachableCellsByDistance();

    this.detachedConfirmedCells = [];
    this.unreachableCells = new Set<number>();
    this.isFixed = false;
  }

  detachedSize() {
    return this.detachedConfirmedCells.reduce((sum, di) => sum + di.confirmedCells.size(), 0);
  }

  remainingRoomSize(): number {
    return this.roomSize - this.confirmedCells.size() - this.detachedSize();
  }
}

class Field {
  width: number;
  height: number;
  cells: Cell[][];
  islands: Island[];
  detachedIslands: Island[]; // 離れ小島のリスト
  wallGroups: Array<CellGroup>;  // 壁グループのリスト（各グループは連結した壁のハッシュ値のセット）
  remainingWalls: number;  // 残り配置壁

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.cells = Array(height).fill(null).map(() => 
      Array(width).fill(null).map(() => new Cell())
    );
    this.islands = [];
    this.detachedIslands = [];
    this.wallGroups = [];
    this.remainingWalls = 0;
  }

  // 盤面の初期化：数字が入っているマスをオーナー部屋にする
  initFromBoard(board: CellValue[][]) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const value = board[y][x];
        if (value !== null && value > 0) {
          const island = new Island(this, x, y, value);
          this.islands.push(island);
          this.cells[y][x].type = 'owner';
          this.cells[y][x].ownerIsland = island;
        }
      }
    }
  }

  // 離れ小島が到達可能範囲に含まれているかチェック,含まれてない場合Trueを返す
  // そのマスが壁になると小部屋に到達しない場合、Trueを返す
  isNeedCellForDetachedIslands(island: Island, reachable: Set<number>): boolean {
    if (island.detachedConfirmedCells.length === 0) {
      return false;
    }
    for (const di of island.detachedConfirmedCells) {
      // 離れ小島が到達可能範囲に隣接しているか
      const isolated = this.isDetachedIslandsAdjacentFromReachable(di, reachable);
      if (!isolated) return true;
    }

    return false;
  }

  // 離れ小島が到達可能セルに隣接しているかチェック
  isDetachedIslandsAdjacentFromReachable(detachedIsland : Island, reachable: Set<number>): boolean {
    // 離れ小島の隣接マスが到達可能マスに含まれているかチェック
    const diHashes = detachedIsland.confirmedCells.edgecells;
    for (const hash of diHashes) {
      const pos = Position.fromHash(hash);
      const adjacents = this.getAdjacentPositions(pos.x, pos.y);
      for (const adjPos of adjacents) {
        if (reachable.has(adjPos.toHash())) {
          return true;
        }
      }
    }
  
    return false;
  }

  // 離れ小島を島にマージする処理
  mergeIslandDetached(targetIsland: Island, detachedIsland: Island): void {
    // 離れ小島のすべてのセルを島に追加
    for (const h of detachedIsland.confirmedCells.cells) {
      // 仮オーナーが島に結合される場合は理由は入れない(仮オーナーの理由を引き継ぐ)
      this.confirmCellForIsland(h, targetIsland);
    }
    // 離れ小島リストから削除
    this.detachedIslands = this.detachedIslands.filter(di => di !== detachedIsland);
    // もし、島が離れ小島リストに含まれていたら削除
    targetIsland.detachedConfirmedCells = targetIsland.detachedConfirmedCells.filter(di => di !== detachedIsland);
  }

  // 2つの離れ小島をマージする処理（大きい方に小さい方を吸収）
  mergeTwoDetachedIslands(island1: Island, island2: Island): void {
    // サイズを比較して、小さい方を大きい方に吸収
    let absorbingIsland: Island;
    let disappearingIsland: Island;
    
    if (island1.confirmedCells.size() >= island2.confirmedCells.size()) {
      absorbingIsland = island1;
      disappearingIsland = island2;
    } else {
      absorbingIsland = island2;
      disappearingIsland = island1;
    }

    for (const h of disappearingIsland.confirmedCells.cells) {
      // hashからPositionを取得して、そのセルのownerIslandを更新
      const pos = Position.fromHash(h);
      this.cells[pos.y][pos.x].ownerIsland = absorbingIsland;
    }
    // 消滅側のすべてのセルを吸収側に追加
    absorbingIsland.confirmedCells.merge(disappearingIsland.confirmedCells);

    // detachedIslandsから消滅側のグループを削除
    this.detachedIslands = this.detachedIslands.filter(di => di !== disappearingIsland);
  }

  // 隣接セルの取得
  getAdjacentPositions(x: number, y: number): Position[] {
    const positions: Position[] = [];
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const newX = x + dx;
      const newY = y + dy;
      if (newY >= 0 && newY < this.height && newX >= 0 && newX < this.width) {
        positions.push(new Position(newX, newY));
      }
    }
    return positions;
  }

  // オーナー部屋の拡張用
  getReachableOwners(x: number, y: number, island: Island): Position[] {
    const adjacents = this.getAdjacentPositions(x, y);
    const positions: Position[] = [];
    for (const adjPos of adjacents) {
      const cell = this.cells[adjPos.y][adjPos.x];
      if (cell.type === 'undecided' || cell.type === 'preowner') {
        if (!this.isAdjacentToOtherOwner(adjPos.x, adjPos.y, island, island.remainingRoomSize())) {
          positions.push(adjPos);
        }
      }
    }
    return positions;
  }

  // プレオーナー部屋の拡張用
  getReachableOwnersPreowner(x: number, y: number): Position[] {
    const adjacents = this.getAdjacentPositions(x, y);
    const positions: Position[] = [];
    for (const adjPos of adjacents) {
      const cell = this.cells[adjPos.y][adjPos.x];
      if (cell.type === 'undecided' || cell.type === 'preowner') {
        positions.push(adjPos);
      }
    }
    return positions;
  }
  // 壁拡張用
  getReachableWall(x: number, y: number): Position[] {
    const adjacents = this.getAdjacentPositions(x, y);
    const positions: Position[] = [];

    for (const adjPos of adjacents) {
      const cell = this.cells[adjPos.y][adjPos.x];
      if (cell.type === 'undecided') {
        positions.push(adjPos);
      }
    }
    return positions;
  }

  // 指定されたセルが他のオーナーの確定マスに隣接しているかチェック
  // return true: 隣接している、false: 隣接していない
  isAdjacentToOtherOwner(x: number, y: number, island: Island, restsize: number): boolean {
    const adjacents = this.getAdjacentPositions(x, y);
    for (const pos of adjacents) {
      const cell = this.cells[pos.y][pos.x];
      if ((cell.type === 'owner' || cell.type === 'confirmed') && cell.ownerIsland !== island) {
        return true;
      }
      // 仮オーナーの場合、部屋サイズがオーバーしてないか確認
      if (cell.type === 'preowner'){
        if (cell.ownerIsland && restsize <= cell.ownerIsland.confirmedCells.size()){
          // すでに自分の島の離れ小島の場合は除外
          if (island.detachedConfirmedCells.includes(cell.ownerIsland)) continue;
          // 自分自身のマスが仮オーナーの場合は除外
          const mycell = this.cells[y][x];
          if (mycell.type === 'preowner') continue;
          return true;
        }
      }
    }
    return false;
  }

  // セルを島の確定セルとして追加する
  confirmCellForIsland(hash: number, island: Island, reason?: string): void {
    island.confirmedCells.add(hash);
    const pos = Position.fromHash(hash);
    const cell = this.cells[pos.y][pos.x];
    cell.type = 'confirmed';
    cell.confirmedOwners = [island];
    cell.ownerIsland = island;
    if (reason) cell.reason = reason;
  }

  preownerCellForIsland(hash: number, island: Island, reason?: string): void {
    island.confirmedCells.add(hash);
    const pos = Position.fromHash(hash);
    const cell = this.cells[pos.y][pos.x];
    cell.type = 'preowner';
    cell.confirmedOwners = [island];
    cell.ownerIsland = island;
    if (reason) cell.reason = reason;
  }

  // 到達可能な未確定セルを収集
  collectReachableCells(island: Island, cellgroup: CellGroup, reachable: Set<number>, processed: Set<number>, restsize: number): void {
    for (const hash of cellgroup.getAdjacent()) {
      if (processed.has(hash)) continue;

      const adjPos = Position.fromHash(hash);

      // 未確定マスで、他のオーナーに隣接していない場合
      if (!this.isAdjacentToOtherOwner(adjPos.x, adjPos.y, island, restsize)) {
        reachable.add(hash);
      }
    }
  }

  // 到達可能な未確定セルを収集（仮オーナー用）
  collectReachableCellsPreowner(cellgroup: CellGroup, reachable: Set<number>, processed: Set<number>): void {
    for (const hash of cellgroup.getAdjacent()) {
      if (processed.has(hash)) continue;

      // 未確定マスで、他のオーナーに隣接していない場合
      reachable.add(hash);
    }
  }

  // 到達可能な未確定セルを収集（壁用）
  collectReachableCellsWall(wallGroup: CellGroup, reachable: Set<number>): void {
    const adjHash = wallGroup.getAdjacent();

    if(adjHash.size === 1){
      const hash = Array.from(adjHash)[0];
      const pos = Position.fromHash(hash);
      if (this.cells[pos.y][pos.x].type === 'undecided') {
        reachable.add(hash);
      }
    }
  }


  // 島を固定し、周囲の未確定マスを壁に変更
  fixIslandAndSurroundWithWalls(island: Island): boolean {
    let changed = false;
    island.isFixed = true;
    island.reachableCells.clear();

    // 確定マスの隣接で未確定マスをすべて確定壁に変更
    for (const hash of island.confirmedCells.cells) {
      const pos = Position.fromHash(hash);
      const adjacents = this.getAdjacentPositions(pos.x, pos.y);
      for (const adjPos of adjacents) {
        if (this.addWall(adjPos.x, adjPos.y, `オーナー部屋確定による周囲壁確定${formatPosition(island.x, island.y)}/${formatPosition(pos.x, pos.y)}`)) {
          changed = true;
        }
      }
    }
    return changed;
  }

  // 各島の拡張処理
  processIslands(): boolean {
    let changed = false;

    for (const island of this.islands) {
      if (island.isFixed) continue;

      // 到達可能セルと部屋サイズが同じで、離れ小島がない場合、確定マスに追加
      if (island.reachableCells.size() == island.roomSize && island.detachedConfirmedCells.length === 0) {
        for (const hash of island.reachableCells.getCellsExcludingConfirmed()) {
          this.confirmCellForIsland(hash, island);
        }
      }

      // 確定マスと部屋サイズが同じ場合、固定する
      if (island.confirmedCells.size() === island.roomSize) {
        // 部屋を囲む壁を確定
        if (this.fixIslandAndSurroundWithWalls(island)) {
          changed = true;
        }
        continue;
      }
    }

    return changed;
  }

  // 仮オーナー部屋の処理
  processDetachedIslands(): boolean {
    for (const detachedIsland of this.detachedIslands) {
      const newReachable = new Set<number>();
      const processed = new Set<number>();

      // 隣接セルを調べる
      this.collectReachableCellsPreowner(detachedIsland.confirmedCells, newReachable, processed);

      // 到達部屋リストのサイズが1なら確定
      if (newReachable.size === 1) {
        const hash = Array.from(newReachable)[0];
        detachedIsland.confirmedCells.add(hash);

        // もし、この部屋が他のオーナー部屋に隣接していたらそのオーナーの確定部屋に追加する
        let foundOwner: Island | null = null;
        const posCheck = Position.fromHash(hash);
        const adjacents = this.getAdjacentPositions(posCheck.x, posCheck.y);
        for (const adjPos of adjacents) {
          const cell = this.cells[adjPos.y][adjPos.x];
          if ((cell.type === 'owner' || cell.type === 'confirmed') && cell.ownerIsland) {
            foundOwner = cell.ownerIsland;
            break;
          }
        }

        if (foundOwner) {
          // オーナーが見つかったら確定部屋に追加
          this.mergeIslandDetached(foundOwner, detachedIsland);
          return true; // 仮オーナー部屋を確定したらループを抜けて、analyzeを最初からやり直す
        }
        
        // 隣接するオーナーが見つからなかった場合、そのまま仮オーナー部屋として確定
        this.preownerCellForIsland(hash, detachedIsland, "到達部屋リストが1つのため確定(仮オーナー)");

        // もし、この部屋が他のオーナー部屋に隣接していなかったら、そのまま仮オーナー部屋として確定
        // もし、他の仮オーナーに隣接する場合、マージする
        let changedMerge = false;
        for (const adjPos of adjacents) {
          const adjCell = this.cells[adjPos.y][adjPos.x];
          // 仮オーナーが隣接していれば、仮オーナーグループをマージ
          if (adjCell.type === 'preowner' && adjCell.ownerIsland !== detachedIsland && adjCell.ownerIsland) {
            this.mergeTwoDetachedIslands(detachedIsland, adjCell.ownerIsland);
            changedMerge = true;
          }
        }
        if(changedMerge){
          return true;
        }
      }
    }
    return false;
  }

  // 壁を伸ばす処理
  extendWalls(): boolean {
    if (this.remainingWalls <= 0) return false;

    for (const wallGroup of this.wallGroups) {
      if (this.remainingWalls <= 0) break;

      // 隣接セルを調べる
      const adjHash = wallGroup.getAdjacent();

      // 到達部屋リストのサイズが1なら確定
      if (adjHash.size === 1) {
        const hash = Array.from(adjHash)[0];
        const pos = Position.fromHash(hash);
        this.addWall(pos.x, pos.y, "壁拡張による確定");
        return true; // 壁を追加したら処理を終了
      }
    }

    return false;
  }

  // 到達可能リストを計算し、島を固定する処理
  calculateReachableAndFixIslands(): boolean {
    const changed = false;

    for (const island of this.islands) {
      if (island.isFixed) continue;
      const processed = new Set<number>(island.confirmedCells.cells);
      
      // あと何部屋追加できるか
      const roomsLeft = island.remainingRoomSize();

      island.reachableCells.clear();
      
      // 距離0: confirmedCellsのセル
      island.confirmedCells.cells.forEach(hash => {
        island.reachableCells.addCellAtDistance(0, hash);
      });

      // 距離ごとに拡張
      for(let distance = 1; distance <= roomsLeft; distance++) {
        const reachableCells = new Set<number>();
        const prevDistanceCells = island.reachableCells.getCellsAtDistance(distance - 1);
        
        // 前の距離のセルから隣接セルを探索
        const tempGroup = new CellGroup();
        tempGroup.cells = new Set(prevDistanceCells);
        tempGroup.edgecells = new Set(prevDistanceCells);
        tempGroup.search = (x: number, y: number) => {
          return this.getReachableOwners(x, y, island);
        };
        
        this.collectReachableCells(island, tempGroup, reachableCells, processed, roomsLeft - distance + 1);
        reachableCells.forEach(cell => {
          island.reachableCells.addCellAtDistance(distance, cell);
          processed.add(cell);
        });
      }
      // 到達部屋のサイズが部屋サイズより小さい場合は矛盾
      if (island.reachableCells.size() < island.roomSize - island.detachedSize()) {
        throw new ContradictionError(`到達可能セル矛盾: ${formatPosition(island.x, island.y)}の部屋の到達可能セルが部屋サイズに満たしていません`);
      }
    }

    return changed;
  }

  // オーナー部屋から到達不可能なセルを壁に確定する処理
  markUnreachableAsWalls(): boolean {
    let changed = false;

    // オーナー部屋の探索がすべて終わっている場合、オーナー部屋でも到達しないセルを壁確定マスにする
    const allReachable = new Set<number>();
    for (const island of this.islands) {
      for (const hash of island.reachableCells.getAllCells()) {
        allReachable.add(hash);
      }
      for (const hash of island.confirmedCells.cells) {
        allReachable.add(hash);
      }
    }

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        const hash = new Position(x, y).toHash();
        if (cell.type === 'undecided' && !allReachable.has(hash)) {
          if (this.addWall(x, y, "オーナー部屋から到達不可による確定")) {
            changed = true;
          }
        }
      }
    }

    return changed;
  }

  // 壁仮定による確定セル判定処理
  checkWallAssumption(): boolean {
    let changed = false;

    for (const island of this.islands) {
      if (island.isFixed) continue;

      // 残りの部屋数を求める（部屋サイズ - 確定サイズ）
      const remainingRoomSize = island.remainingRoomSize();

      // 残り部屋サイズが0以下なら次の島へ
      if (remainingRoomSize <= 0) continue;

      // 距離ごとの候補セル数をカウント
      const maxDistance = island.reachableCells.getMaxDistance();

      // n=1からトータル部屋数まで繰り返す
      for (let n = 1; n <= maxDistance; n++) {
        // 距離1～nの部屋候補の数を求める
        let candidatesUpToN = 0;
        for (let d = 1; d <= n && d <= maxDistance; d++) {
          candidatesUpToN += island.reachableCells.getCellsAtDistance(d).size;
        }

        // 候補数がトータル部屋数より多いなら繰り返しを中断
        // 離れ小島がある場合はn=1は継続
        if (remainingRoomSize < candidatesUpToN && (2 <= n || island.detachedConfirmedCells.length === 0)) {
          break;
        }

        // 距離nのセルを1つずつ壁として仮定
        const cellsAtDistanceN = island.reachableCells.getCellsAtDistance(n);
        
        for (const assumedWallHash of cellsAtDistanceN) {
          // この壁を仮定した状態で、残りの到達可能なセルの数を調べる
          const reachable = this.countReachableWithoutCell(island, assumedWallHash);
          // 離れ小島にとって必要なマスかチェック
          const isNeedCell = this.isNeedCellForDetachedIslands(island, reachable);
          
          // もし到達可能なセル数が残りの部屋数未満なら、このセルは確定セル
          if (isNeedCell || reachable.size < remainingRoomSize) {
            const pos = Position.fromHash(assumedWallHash);
            if (n === 1) {
              // 距離1なら確定セルとして登録
              this.confirmCellForIsland(assumedWallHash, island, `壁仮定により確定（距離${n}）`);
            } else {
              // 距離2以上なら離れ小島として登録
              if (this.addConfirmedCell(pos.x, pos.y, `壁仮定により確定（距離${n}、離れ小島）`)) {
                // 追加した離れ小島と島を関連付け
                const cell = this.cells[pos.y][pos.x];
                if (cell.type === 'preowner' && cell.ownerIsland) {
                  const detachedIsland = cell.ownerIsland;
                  detachedIsland.detachedConfirmedCells = [island];
                  island.detachedConfirmedCells.push(detachedIsland);
                }
              }
            }
            changed = true;
          }
        }
      }
    }

    return changed;
  }

  // 指定したセルを壁と仮定した場合、島から到達可能なセルを求める
  countReachableWithoutCell(island: Island, excludeHash: number): Set<number> {
    const processed = new Set<number>([...island.confirmedCells.cells]);
    const reachable = new Set<number>();

    // 特定のセルを除いても到達可能セルを探索
    for(let distance = 1; distance <= island.reachableCells.getMaxDistance(); distance++) {
      const distanceCells = island.reachableCells.getCellsAtDistance(distance);
      for (const hash of distanceCells) {
        if (processed.has(hash)) continue;
        const pos = Position.fromHash(hash);
        const adjacents = this.getAdjacentPositions(pos.x, pos.y);

        const reachableFromPrev = adjacents.some(adjPos => {
          const adjHash = adjPos.toHash();
          return processed.has(adjHash) && adjHash !== excludeHash;
        });
        if (reachableFromPrev) {
          reachable.add(hash);
          processed.add(hash);
        }
      }
    }

    return reachable;
  }

  // 2x2のパターンをチェックし、3つが壁の場合残りを部屋にする
  check2x2WallPattern(): boolean {
    let changed = false;

    for (let y = 0; y < this.height - 1; y++) {
      for (let x = 0; x < this.width - 1; x++) {
        const cells = [
          { cell: this.cells[y][x], x, y },
          { cell: this.cells[y][x + 1], x: x + 1, y },
          { cell: this.cells[y + 1][x], x, y: y + 1 },
          { cell: this.cells[y + 1][x + 1], x: x + 1, y: y + 1 }
        ];

        // 壁の数をカウント
        const wallCells = cells.filter(c => c.cell.type === 'wall');
        const undecidedCells = cells.filter(c => c.cell.type === 'undecided');

        // 4つとも壁の場合は矛盾
        if (wallCells.length === 4) {
          throw new ContradictionError(`2x2の壁マス矛盾: ${formatPosition(x, y)}を含む2x2がすべて壁です`);
        }

        // 3つが壁で、1つが未確定の場合
        if (wallCells.length === 3 && undecidedCells.length === 1) {
          const targetCell = undecidedCells[0];
          const targetX = targetCell.x;
          const targetY = targetCell.y;

          // 確定マスまたは離れ小島として追加
          if (this.addConfirmedCell(targetX, targetY, "2x2壁パターンによる確定")) {
            changed = true;
          }
        }
      }
    }

    return changed;
  }

  // 壁を追加する処理
  addWall(x: number, y: number, reason: string): boolean {
    const cell = this.cells[y][x];
    if (cell.type === 'undecided') {
      this.remainingWalls--;
      cell.type = 'wall';
      const hash = new Position(x, y).toHash();
      cell.reason = reason;
      cell.wallGroup = new CellGroup();
      cell.wallGroup.add(hash);
      cell.wallGroup.search = (x: number, y: number) => {
        return this.getReachableWall(x, y);
      };
      this.wallGroups.push(cell.wallGroup);

      // 隣接するセルを調べて、壁なら連結リストに追加
      const adjacents = this.getAdjacentPositions(x, y);
      for (const adjPos of adjacents) {
        const adjCell = this.cells[adjPos.y][adjPos.x];
        // 壁が隣接していれば、壁グループをマージ
        if (adjCell.type === 'wall' && adjCell.wallGroup) {
          // サイズを比較して、小さい方を大きい方に吸収
          let absorbingGroup: CellGroup;  // 吸収側（要素が多い方）
          let disappearingGroup: CellGroup;  // 消滅側（要素が少ない方）
          
          if (cell.wallGroup.size() >= adjCell.wallGroup.size()) {
            absorbingGroup = cell.wallGroup;
            disappearingGroup = adjCell.wallGroup;
          } else {
            absorbingGroup = adjCell.wallGroup;
            disappearingGroup = cell.wallGroup;
          }

          for (const h of disappearingGroup.cells) {
            // hashからPositionを取得して、そのセルのwallGroupを更新
            const pos = Position.fromHash(h);
            this.cells[pos.y][pos.x].wallGroup = absorbingGroup;
          }
          absorbingGroup.merge(disappearingGroup);

          // wallGroupsから消滅側のグループを削除
          this.wallGroups = this.wallGroups.filter(g => g !== disappearingGroup);
        }
      }
      return true;
    }
    return false;
  }

  // 確定マスまたは離れ小島として追加する処理
  addConfirmedCell(x: number, y: number, reason: string): boolean {
    const cell = this.cells[y][x];
    const hash = new Position(x, y).toHash();

    if (cell.type === 'undecided') {
      // 隣接する確定マスまたはオーナーマスを探す
      const adjacents = this.getAdjacentPositions(x, y);
      const preowners : Island [] = [];
      let foundIsland : Island | null = null;

      for (const adjPos of adjacents) {
        const adjCell = this.cells[adjPos.y][adjPos.x];
        if (adjCell.type === 'owner' || adjCell.type === 'confirmed' && adjCell.ownerIsland) {
          if (!foundIsland){
            foundIsland = adjCell.ownerIsland;
          } else {
            throw new ContradictionError(`確定マス矛盾: ${formatPosition(x, y)}の隣接に複数のオーナー部屋があります`);
          }
        } else if (adjCell.type === 'preowner' && adjCell.ownerIsland) {
          preowners.push(adjCell.ownerIsland);
          break;
        }
      }

      // 隣接する島が見つかった場合、その島の確定リストに追加
      if (foundIsland){
        this.confirmCellForIsland(hash, foundIsland, reason);
        for(const di of preowners) {
          // 離れ小島も含めて確定マスに追加
          this.mergeIslandDetached(foundIsland, di);
        }
        return true;
      } else if (preowners.length > 0){
        this.preownerCellForIsland(hash, preowners[0], reason);

        for(const di of preowners.slice(1)) {
          // 離れ小島をマージする
          this.mergeTwoDetachedIslands(preowners[0], di);
        }
        return true;
      } else {
        // 隣接する島が見つからない場合、離れ小島として登録
        const detachedIsland = new Island(this, x, y, 0);
        detachedIsland.confirmedCells.add(hash);
        detachedIsland.confirmedCells.search = (x: number, y: number) => {
          return this.getReachableOwnersPreowner(x, y);
        };
        this.detachedIslands.push(detachedIsland);
        this.preownerCellForIsland(hash, detachedIsland, reason);
        return true;
      }
    }
    return false;
  }

  processDetachedPreislands(): boolean {
    let result = false;

    for (const detachedIsland of this.detachedIslands) {
      const detachedIslandHash = new Position(detachedIsland.x, detachedIsland.y).toHash();

      // すでにどこかの島に属した場合はスキップ
      if (detachedIsland.detachedConfirmedCells.length == 1) continue;

      // 候補の島を見つける
      const islands = this.islands.filter(island => {
        // 固定されている島は除外
        if (island.isFixed) return false;

        // 離れ小島からの距離が部屋サイズ以上なら除外
        const distances = Math.abs(detachedIsland.x - island.x) + Math.abs(detachedIsland.y - island.y);
        if (island.roomSize <= distances) return false;

        // 到達候補の中に離れ小島が含まれていなければ除外
        if (!island.reachableCells.has(detachedIslandHash)) return false;

        return true;
      });

      if (islands.length === 1){
        const island = islands[0];
        // 候補が1つだけなら、その島に確定
        island.detachedConfirmedCells.push(detachedIsland);
        detachedIsland.detachedConfirmedCells = islands;
        result = true;
      }else if (islands.length > 1){
        detachedIsland.detachedConfirmedCells = islands;
      }
    }
    return result;
  }

  // 解析処理のメイン
  analyze(): boolean {
    this.remainingWalls = this.width * this.height - this.islands.reduce((sum, island) => sum + island.roomSize, 0);

    // すべてのオーナー部屋に対して処理
    if (this.processIslands()) {
      return true;
    }

    // 2x2のパターンチェック: 3つが壁の場合、残り1つを部屋にする
    if (this.check2x2WallPattern()) {
      return true;
    }

    // 仮オーナー部屋の処理
    if (this.processDetachedIslands()) {
      return true;
    }

    // 到達可能リストを計算し、島を固定する処理
    if (this.calculateReachableAndFixIslands()) {
      return true;
    }

    // 壁を伸ばす処理
    if (this.extendWalls()) {
      return true;
    }

    // オーナー部屋から到達不可能なセルを壁に確定する処理
    if (this.markUnreachableAsWalls()) {
      return true;
    }

    // 壁にすると部屋が確定しない場合の処理
    if (this.checkWallAssumption()) {
      return true;
    }

    // オーナーから到達可能な仮オーナー部屋を確定する処理
    if (this.processDetachedPreislands()) {
      return true;
    }


    return false;
  }
  

  // 解析を繰り返し実行（破綻時は例外をスロー）
  solve(): void {
    let iteration = 0;
    const maxIterations = this.width * this.height;
    
    while (iteration < maxIterations) {
      const changed = this.analyze();
      if (!changed) break;
      iteration++;
    }
  }

  // フィールドのディープコピーを作成
  clone(): Field {
    const cloned = new Field(this.width, this.height);
    
    // セルの状態をコピー
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const originalCell = this.cells[y][x];
        const clonedCell = cloned.cells[y][x];
        clonedCell.type = originalCell.type;
        clonedCell.reason = originalCell.reason;
      }
    }
    
    // 島のマッピングを作成（オリジナル島 -> クローン島）
    const islandMap = new Map<Island, Island>();
    
    // 島を再作成
    for (const originalIsland of this.islands) {
      const clonedIsland = new Island(cloned, originalIsland.x, originalIsland.y, originalIsland.roomSize);
      clonedIsland.isFixed = originalIsland.isFixed;
      
      // confirmedCellsをコピー
      clonedIsland.confirmedCells.cells = new Set(originalIsland.confirmedCells.cells);
      clonedIsland.confirmedCells.edgecells = new Set(originalIsland.confirmedCells.edgecells);
      
      // reachableCellsをコピー
      clonedIsland.reachableCells.cellsByDistance = new Map();
      for (const [distance, cells] of originalIsland.reachableCells.cellsByDistance) {
        clonedIsland.reachableCells.cellsByDistance.set(distance, new Set(cells));
      }
      
      cloned.islands.push(clonedIsland);
      islandMap.set(originalIsland, clonedIsland);
    }
    
    // 離れ小島を再作成
    const detachedIslandMap = new Map<Island, Island>();
    for (const originalDetached of this.detachedIslands) {
      const clonedDetached = new Island(cloned, originalDetached.x, originalDetached.y, originalDetached.roomSize);
      clonedDetached.confirmedCells.cells = new Set(originalDetached.confirmedCells.cells);
      clonedDetached.confirmedCells.edgecells = new Set(originalDetached.confirmedCells.edgecells);
      cloned.detachedIslands.push(clonedDetached);
      detachedIslandMap.set(originalDetached, clonedDetached);
    }
    
    // セルの参照を更新
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const originalCell = this.cells[y][x];
        const clonedCell = cloned.cells[y][x];
        
        // ownerIslandの参照を更新
        if (originalCell.ownerIsland) {
          clonedCell.ownerIsland = islandMap.get(originalCell.ownerIsland) || detachedIslandMap.get(originalCell.ownerIsland) || null;
        }
        
        // confirmedOwnersの参照を更新
        clonedCell.confirmedOwners = originalCell.confirmedOwners
          .map(owner => islandMap.get(owner) || detachedIslandMap.get(owner))
          .filter((owner): owner is Island => owner !== undefined);
        
        // reachableOwnersの参照を更新
        clonedCell.reachableOwners = originalCell.reachableOwners
          .map(owner => islandMap.get(owner) || detachedIslandMap.get(owner))
          .filter((owner): owner is Island => owner !== undefined);
      }
    }
    
    // 壁グループを再作成
    const wallGroupMap = new Map<CellGroup, CellGroup>();
    for (const originalWallGroup of this.wallGroups) {
      const clonedWallGroup = new CellGroup();
      clonedWallGroup.cells = new Set(originalWallGroup.cells);
      clonedWallGroup.edgecells = new Set(originalWallGroup.edgecells);
      clonedWallGroup.search = (x: number, y: number) => {
        return cloned.getReachableWall(x, y);
      };
      cloned.wallGroups.push(clonedWallGroup);
      wallGroupMap.set(originalWallGroup, clonedWallGroup);
    }
    
    // セルのwallGroupの参照を更新
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const originalCell = this.cells[y][x];
        const clonedCell = cloned.cells[y][x];
        if (originalCell.wallGroup) {
          clonedCell.wallGroup = wallGroupMap.get(originalCell.wallGroup) || null;
        }
      }
    }
    
    // 残り配置壁をコピー
    cloned.remainingWalls = this.remainingWalls;
    
    return cloned;
  }
}

// 座標を表示用の文字列に変換する関数（1-originで表示）
const formatPosition = (x: number, y: number): string => {
  return `(${x + 1},${y + 1})`;
};

// ハッシュ値から座標を表示用の文字列に変換する関数（デバッグ用）
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const formatPositionFromHash = (hash: number): string => {
  const pos = Position.fromHash(hash);
  return formatPosition(pos.x, pos.y);
};

export default function NurikabePage() {
  const [width, setWidth] = useState(8);
  const [height, setHeight] = useState(8);
  const [inputWidth, setInputWidth] = useState("8");
  const [inputHeight, setInputHeight] = useState("8");
  const [board, setBoard] = useState<CellValue[][]>(() => 
    Array(8).fill(null).map(() => Array(8).fill(null))
  );
  const [showManual, setShowManual] = useState(false);
  const [isAnalyzeMode, setIsAnalyzeMode] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isContradiction, setIsContradiction] = useState(false);
  const [contradictionReason, setContradictionReason] = useState("");
  const [field, setField] = useState<Field | null>(null);
  const [fieldHistory, setFieldHistory] = useState<Field[]>([]);
  const [selectedCell, setSelectedCell] = useState<{x: number, y: number} | null>(null);
  const [highlightedCells, setHighlightedCells] = useState<Set<number>>(new Set());
  const [selectedCellDistances, setSelectedCellDistances] = useState<Map<number, number>>(new Map());
  const [manualWalls, setManualWalls] = useState<Set<number>>(new Set());
  const [manualEmptyCells, setManualEmptyCells] = useState<Set<number>>(new Set());
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [exportText, setExportText] = useState("");
  const [importText, setImportText] = useState("");

  // エクスポート処理
  const handleExport = () => {
    let text = `${width}, ${height}\n`;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const value = board[y][x];
        if (value !== null && value > 0) {
          text += `${x + 1} ${y + 1} ${value}\n`;
        }
      }
    }
    setExportText(text);
    setShowExport(true);
  };

  // エクスポートテキストをコピー
  const handleCopyExport = () => {
    navigator.clipboard.writeText(exportText);
    alert("コピーしました！");
  };

  // インポート処理
  const handleImport = () => {
    setImportText("");
    setShowImport(true);
  };

  // インポートテキストを適用
  const handleApplyImport = () => {
    try {
      const lines = importText.trim().split('\n');
      if (lines.length === 0) {
        alert("テキストが空です");
        return;
      }

      // 1行目: width, height
      const [w, h] = lines[0].split(',').map(s => parseInt(s.trim()));
      if (isNaN(w) || isNaN(h) || w < 3 || w > 20 || h < 3 || h > 20) {
        alert("盤面サイズが不正です (3-20の範囲)");
        return;
      }

      // 新しい盤面を作成
      const newBoard: CellValue[][] = Array(h).fill(null).map(() => Array(w).fill(null));

      // 2行目以降: x y num (1-origin)
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const [x, y, num] = line.split(/\s+/).map(s => parseInt(s));
        if (isNaN(x) || isNaN(y) || isNaN(num)) {
          alert(`${i + 1}行目が不正です: ${line}`);
          return;
        }
        if (x < 1 || x > w || y < 1 || y > h) {
          alert(`${i + 1}行目の座標が範囲外です: (${x}, ${y})`);
          return;
        }
        if (num < 1 || num > 99) {
          alert(`${i + 1}行目の数字が不正です: ${num} (1-99の範囲)`);
          return;
        }

        newBoard[y - 1][x - 1] = num;
      }

      // 盤面を更新
      setWidth(w);
      setHeight(h);
      setBoard(newBoard);
      setShowImport(false);
      alert("インポートしました！");
    } catch {
      alert("インポートに失敗しました。形式を確認してください。");
    }
  };

  // 盤面サイズ変更
  const handleSizeChange = () => {
    // 入力値をパースして適用
    const newWidth = Math.max(3, Math.min(20, parseInt(inputWidth) || 3));
    const newHeight = Math.max(3, Math.min(20, parseInt(inputHeight) || 3));
    
    setWidth(newWidth);
    setHeight(newHeight);
    setInputWidth(newWidth.toString());
    setInputHeight(newHeight.toString());
    
    const newBoard: CellValue[][] = Array(newHeight).fill(null).map(() => Array(newWidth).fill(null));
    
    // 既存のデータを可能な範囲でコピー
    for (let row = 0; row < Math.min(newHeight, board.length); row++) {
      for (let col = 0; col < Math.min(newWidth, board[0]?.length || 0); col++) {
        newBoard[row][col] = board[row][col];
      }
    }
    
    setBoard(newBoard);
    
    // 解析結果をリセット
    setIsAnalyzeMode(false);
    setField(null);
    setManualWalls(new Set<number>());
    setManualEmptyCells(new Set<number>());
    setHighlightedCells(new Set<number>());
    setSelectedCellDistances(new Map());
    setSelectedCell(null);
  };

  // セルクリック時の処理
  const handleCellClick = (row: number, col: number) => {
    if (isAnalyzeMode) {
      // 同じセルをクリックした場合は選択解除
      if (selectedCell && selectedCell.x === col && selectedCell.y === row) {
        setSelectedCell(null);
        setHighlightedCells(new Set());
        setSelectedCellDistances(new Map());
        return;
      }
      
      // 解析モード：セル情報を表示
      setSelectedCell({x: col, y: row});
      
      if (!field) return;
      
      const cell = field.cells[row][col];
      const highlighted = new Set<number>();
      const distances = new Map<number, number>();
      
      if (cell.type === 'owner' && cell.ownerIsland) {
        // オーナー部屋：自身と確定部屋リストを濃い緑、到達部屋リストを薄い緑
        for (const hash of cell.ownerIsland.confirmedCells.cells) {
          highlighted.add(hash);
          distances.set(hash, 0);
        }
        // 距離ごとに候補マスを追加
        const maxDistance = cell.ownerIsland.reachableCells.getMaxDistance();
        for (let d = 1; d <= maxDistance; d++) {
          for (const hash of cell.ownerIsland.reachableCells.getCellsAtDistance(d)) {
            highlighted.add(hash);
            distances.set(hash, d);
          }
        }
      } else if (cell.type === 'preowner' && cell.ownerIsland) {
        // 仮オーナー部屋：仮オーナーのconfirmedCellsをハイライト
        for (const hash of cell.ownerIsland.confirmedCells.cells) {
          highlighted.add(hash);
          distances.set(hash, 0);
        }
        // detachedConfirmedCellsの島のセルもハイライト（距離1として表示）
        for (const island of cell.ownerIsland.detachedConfirmedCells) {
          for (const hash of island.confirmedCells.cells) {
            highlighted.add(hash);
            distances.set(hash, 1);
          }
        }
      } else if (cell.type === 'confirmed') {
        // 確定部屋：すべての確定オーナーのセルをハイライト
        for (const owner of cell.confirmedOwners) {
          for (const hash of owner.confirmedCells.cells) {
            highlighted.add(hash);
            distances.set(hash, 0);
          }
          // 距離ごとに候補マスを追加
          const maxDistance = owner.reachableCells.getMaxDistance();
          for (let d = 1; d <= maxDistance; d++) {
            for (const hash of owner.reachableCells.getCellsAtDistance(d)) {
              highlighted.add(hash);
              distances.set(hash, d);
            }
          }
        }
      } else if (cell.type === 'wall' && cell.wallGroup) {
        // 確定壁：連結壁グループ全体を赤に
        for (const hash of cell.wallGroup.cells) {
          highlighted.add(hash);
        }
      } else if (cell.type === 'undecided') {
        // 未確定：自身をハイライト
        highlighted.add(new Position(col, row).toHash());
      }
      
      setHighlightedCells(highlighted);
      setSelectedCellDistances(distances);
    } else {
      // 入力モード：数字入力
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
    }
  };


  // 解析実行
  const handleSolve = () => {
    try {
      const newField = new Field(width, height);
      newField.initFromBoard(board);
      newField.solve();
      setField(newField);
      setIsAnalyzeMode(true);
      setIsContradiction(false);
      setContradictionReason("");
      setFieldHistory([]);
      
      // 完成判定
      checkCompletion(newField);
    } catch (error: unknown) {
      if (error instanceof ContradictionError) {
        setIsContradiction(true);
        setContradictionReason(error.message);
        setIsAnalyzeMode(true);
        setFieldHistory([]);
        // 破綻したフィールドも表示用に保存
        const newField = new Field(width, height);
        newField.initFromBoard(board);
        try {
          newField.solve();
        } catch {}
        setField(newField);
      } else {
        throw error;
      }
    }
  };

  // 完成判定関数
  const checkCompletion = (field: Field) => {
    // すべての未確定セルがないかチェック
    let hasUndecided = false;
    for (let y = 0; y < field.height; y++) {
      for (let x = 0; x < field.width; x++) {
        if (field.cells[y][x].type === 'undecided') {
          hasUndecided = true;
          break;
        }
      }
      if (hasUndecided) break;
    }
    
    // すべての島が固定済みかチェック
    const allIslandsFixed = field.islands.every(island => island.isFixed);
    
    // 未確定セルがなく、すべての島が固定済みなら完成
    setIsCompleted(!hasUndecided && allIslandsFixed);
  };

  // 手動壁を追加/削除
  const handleToggleManualWall = () => {
    if (!selectedCell || !field) return;
    const cell = field.cells[selectedCell.y][selectedCell.x];
    if (cell.type !== 'undecided') return;
    
    const hash = new Position(selectedCell.x, selectedCell.y).toHash();
    const newManualWalls = new Set(manualWalls);
    const newManualEmptyCells = new Set(manualEmptyCells);
    
    if (newManualWalls.has(hash)) {
      newManualWalls.delete(hash);
    } else {
      newManualWalls.add(hash);
      // 同じマスが確定マスに指定されていれば削除
      if (newManualEmptyCells.has(hash)) {
        newManualEmptyCells.delete(hash);
      }
    }
    
    setManualWalls(newManualWalls);
    setManualEmptyCells(newManualEmptyCells);
  };

  // 手動確定マスを追加/削除
  const handleToggleManualEmptyCell = () => {
    if (!selectedCell || !field) return;
    const cell = field.cells[selectedCell.y][selectedCell.x];
    if (cell.type !== 'undecided') return;
    
    const hash = new Position(selectedCell.x, selectedCell.y).toHash();
    const newManualEmptyCells = new Set(manualEmptyCells);
    const newManualWalls = new Set(manualWalls);
    
    if (newManualEmptyCells.has(hash)) {
      newManualEmptyCells.delete(hash);
    } else {
      newManualEmptyCells.add(hash);
      // 同じマスが壁マスに指定されていれば削除
      if (newManualWalls.has(hash)) {
        newManualWalls.delete(hash);
      }
    }
    
    setManualEmptyCells(newManualEmptyCells);
    setManualWalls(newManualWalls);
  };

  // 再解析
  const handleReanalyze = () => {
    if (!field) return;
    
    // 現在のフィールドのディープコピーを履歴に追加
    setFieldHistory([...fieldHistory, field.clone()]);
    
    try {
      // 手動壁を追加
      for (const hash of manualWalls) {
        const pos = Position.fromHash(hash);
        field.addWall(pos.x, pos.y, "手動壁による確定");
      }
      
      // 手動確定マスを追加
      for (const hash of manualEmptyCells) {
        const pos = Position.fromHash(hash);
        field.addConfirmedCell(pos.x, pos.y, "手動確定マスによる確定");
      }
      
      // 解析を続行
      field.solve();
      
      // 手動壁と確定マスをクリア
      setManualWalls(new Set());
      setManualEmptyCells(new Set());
      setSelectedCell(null);
      setHighlightedCells(new Set());
      setSelectedCellDistances(new Map());
      
      // フィールドを更新
      setField(field);
      setIsContradiction(false);
      setContradictionReason("");
      
      // 完成判定
      checkCompletion(field);
    } catch (error: unknown) {
      if (error instanceof ContradictionError) {
        setIsContradiction(true);
        setContradictionReason(error.message);
        // 破綻したフィールドも表示用に設定
        setField(field);
      } else {
        throw error;
      }
    }
  };

  // 入力に戻る
  const handleBackToInput = () => {
    setIsAnalyzeMode(false);
    setIsCompleted(false);
    setIsContradiction(false);
    setContradictionReason("");
    setField(null);
    setFieldHistory([]);
    setSelectedCell(null);
    setHighlightedCells(new Set());
    setSelectedCellDistances(new Map());
    setManualWalls(new Set());
    setManualEmptyCells(new Set());
  };

  // １つ前に戻る
  const handleBackPrevious = () => {
    if (fieldHistory.length === 0) return;
    
    const previousField = fieldHistory[fieldHistory.length - 1];
    const newHistory = fieldHistory.slice(0, -1);
    
    setField(previousField);
    setFieldHistory(newHistory);
    setIsContradiction(false);
    setContradictionReason("");
    setManualWalls(new Set());
    setManualEmptyCells(new Set());
    setSelectedCell(null);
    setHighlightedCells(new Set());
    setSelectedCellDistances(new Map());
    
    // 完成判定
    checkCompletion(previousField);
  };

  // リセット
  const handleReset = () => {
    setBoard(Array(height).fill(null).map(() => Array(width).fill(null)));
  };

  // サンプル問題を読み込む
  const handleSample = () => {
    const sampleData = [
      [2, null, 3, null, null, null, null],
      [null, null, null, null, null, null, 4],
      [null, null, null, null, 1, null, null],
      [null, null, null, null, null, 4, null],
      [null, null, null, null, null, null, null],
      [null, null, 2, null, 2, null, null],
      [null, 5, null, null, null, null, null]
    ];
    setWidth(7);
    setHeight(7);
    setBoard(sampleData);
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

      {/* エクスポートモーダル */}
      {showExport && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 max-w-lg w-full relative">
            <button
              className="absolute top-2 right-2 px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => setShowExport(false)}
            >閉じる</button>
            <h3 className="text-xl font-bold mb-4">エクスポート</h3>
            <textarea
              className="w-full h-64 p-2 border rounded font-mono text-sm"
              value={exportText}
              readOnly
            />
            <div className="mt-4 flex gap-2">
              <button
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                onClick={handleCopyExport}
              >コピー</button>
              <button
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                onClick={() => setShowExport(false)}
              >閉じる</button>
            </div>
          </div>
        </div>
      )}

      {/* インポートモーダル */}
      {showImport && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 max-w-lg w-full relative">
            <button
              className="absolute top-2 right-2 px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => setShowImport(false)}
            >閉じる</button>
            <h3 className="text-xl font-bold mb-4">インポート</h3>
            <p className="text-sm text-gray-600 mb-2">形式: 1行目に「幅, 高さ」、2行目以降に「x y 数字」（座標は1から開始）</p>
            <textarea
              className="w-full h-64 p-2 border rounded font-mono text-sm"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="例:&#10;7, 7&#10;1 1 2&#10;3 1 3&#10;7 2 4"
            />
            <div className="mt-4 flex gap-2">
              <button
                className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200"
                onClick={handleApplyImport}
              >適用</button>
              <button
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                onClick={() => setShowImport(false)}
              >キャンセル</button>
            </div>
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
          className={`px-4 py-2 rounded ${isAnalyzeMode ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
          onClick={handleSizeChange}
          disabled={isAnalyzeMode}
        >サイズ変更</button>
      </div>

      {/* ボタン */}
      <div className="mb-4 flex gap-2">
        {!isAnalyzeMode ? (
          <>
            <button
              className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200"
              onClick={handleSolve}
            >解析</button>
            <button
              className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
              onClick={handleReset}
            >リセット</button>
            <button
              className="px-4 py-2 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
              onClick={handleSample}
            >サンプル</button>
            <button
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              onClick={handleExport}
            >エクスポート</button>
            <button
              className="px-4 py-2 bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
              onClick={handleImport}
            >インポート</button>
          </>
        ) : (
          <>
            <button
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              onClick={handleBackToInput}
            >入力に戻る</button>
            <button
              className="px-4 py-2 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50"
              onClick={handleToggleManualWall}
              disabled={!selectedCell || !field || field.cells[selectedCell.y][selectedCell.x].type !== 'undecided'}
            >
              {selectedCell && field && field.cells[selectedCell.y][selectedCell.x].type === 'undecided' && manualWalls.has(new Position(selectedCell.x, selectedCell.y).toHash()) ? '壁を削除' : '壁を追加'}
            </button>
            <button
              className="px-4 py-2 bg-cyan-100 text-cyan-700 rounded hover:bg-cyan-200 disabled:opacity-50"
              onClick={handleToggleManualEmptyCell}
              disabled={!selectedCell || !field || field.cells[selectedCell.y][selectedCell.x].type !== 'undecided'}
            >
              {selectedCell && field && field.cells[selectedCell.y][selectedCell.x].type === 'undecided' && manualEmptyCells.has(new Position(selectedCell.x, selectedCell.y).toHash()) ? '確定マスを解除' : '確定マスを追加'}
            </button>
            <button
              className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
              onClick={handleReanalyze}
              disabled={manualWalls.size === 0 && manualEmptyCells.size === 0}
            >再解析</button>
            <button
              className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 disabled:opacity-50"
              onClick={handleBackPrevious}
              disabled={fieldHistory.length === 0}
            >１つ前に戻る</button>
          </>
        )}
      </div>

      {/* 完成メッセージ */}
      {isAnalyzeMode && isCompleted && (
        <div className="mb-4 p-3 bg-green-100 border-2 border-green-500 rounded text-green-800 font-bold text-center">
          ✨ 完成しました！ ✨
        </div>
      )}

      {/* 破綻メッセージ */}
      {isAnalyzeMode && isContradiction && (
        <div className="mb-4 p-3 bg-red-100 border-2 border-red-500 rounded text-red-800 font-bold text-center">
          ❌ 破綻しました<br/>{contradictionReason}
        </div>
      )}

      {/* 盤面 */}
      <div className="mb-4">
        <h3 className="font-semibold mb-2">{isAnalyzeMode ? "解析結果（クリックで情報表示）" : "盤面（クリックで数字入力）"}</h3>
        <div className="inline-block border-2 border-gray-400">
          {board.map((row, rowIndex) => {
            return (
              <div key={rowIndex} className="flex">
                {row.map((cell, colIndex) => {
                  let bgColor = "bg-white hover:bg-gray-100";
                  let textContent: string | number = cell !== null ? cell : "";
                  const hash = new Position(colIndex, rowIndex).toHash();
                  
                  if (isAnalyzeMode && field) {
                    const fieldCell = field.cells[rowIndex][colIndex];
                    
                    // ハイライト状態をチェック
                    const isHighlighted = highlightedCells.has(hash);
                    
                    if (isHighlighted) {
                      if (fieldCell.type === 'wall') {
                        bgColor = "bg-red-400";
                      } else if (fieldCell.type === 'undecided' && manualWalls.has(hash)) {
                        // 手動壁がハイライトされている場合は暗い灰色
                        bgColor = "bg-gray-700";
                        textContent = "";
                      } else if (fieldCell.type === 'undecided' && manualEmptyCells.has(hash)) {
                        // 手動確定マスがハイライトされている場合は明るい青
                        bgColor = "bg-blue-300";
                        textContent = "・";
                      } else if (fieldCell.type === 'owner' || fieldCell.type === 'confirmed') {
                        // オーナー部屋と確定部屋は濃い緑
                        bgColor = "bg-green-600";
                      } else {
                        // 到達可能部屋は薄い緑
                        bgColor = "bg-green-300";
                      }
                    } else {
                      // 通常状態の色
                      if (fieldCell.type === 'owner') {
                        bgColor = "bg-yellow-500";
                      } else if (fieldCell.type === 'preowner') {
                        bgColor = "bg-orange-200";
                      } else if (fieldCell.type === 'confirmed') {
                        bgColor = "bg-yellow-200";
                      } else if (fieldCell.type === 'wall') {
                        bgColor = "bg-black";
                        textContent = "";
                      } else if (fieldCell.type === 'undecided' && manualWalls.has(hash)) {
                        // 手動で追加された壁
                        bgColor = "bg-gray-500";
                        textContent = "";
                      } else if (fieldCell.type === 'undecided' && manualEmptyCells.has(hash)) {
                        // 手動で追加された確定マス
                        bgColor = "bg-blue-100";
                        textContent = "・";
                      } else {
                        bgColor = "bg-white";
                        textContent = "";
                      }
                    }
                  }
                  
                  const distance = selectedCellDistances.get(hash);
                  
                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={`w-10 h-10 border border-gray-300 cursor-pointer flex items-center justify-center text-sm font-bold ${bgColor} relative`}
                      onClick={() => handleCellClick(rowIndex, colIndex)}
                    >
                      {textContent}
                      {distance !== undefined && distance > 0 && (
                        <span className="absolute bottom-0 right-0 text-[8px] font-normal px-0.5 bg-white bg-opacity-70 rounded-tl">
                          {distance}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* セル情報表示 */}
      {isAnalyzeMode && field && (
        <div className="mb-4 p-4 border-2 border-gray-300 rounded bg-gray-50">
          <h3 className="font-semibold mb-2">
            セル情報 {selectedCell ? formatPosition(selectedCell.x, selectedCell.y) : '未選択'}
          </h3>
          {selectedCell ? (() => {
            const cell = field.cells[selectedCell.y][selectedCell.x];
            
            if (cell.type === 'owner' && cell.ownerIsland) {
              return (
                <div>
                  <p><strong>種類：</strong>オーナー部屋</p>
                  <p><strong>部屋サイズ：</strong>{cell.ownerIsland.roomSize}</p>
                  <p><strong>確定マス数：</strong>{cell.ownerIsland.confirmedCells.size()}</p>
                  <p><strong>到達マス数：</strong>{cell.ownerIsland.reachableCells.size()}</p>
                  <p><strong>固定状態：</strong>{cell.ownerIsland.isFixed ? '固定済み' : '未固定'}</p>
                  {cell.ownerIsland.detachedConfirmedCells.length > 0 && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                      <p className="font-semibold">離れ小島 ({cell.ownerIsland.detachedConfirmedCells.length}個):</p>
                      {cell.ownerIsland.detachedConfirmedCells.map((detached, idx) => (
                        <div key={idx} className="ml-4 mt-1 text-sm">
                          <p>#{idx + 1}: 位置 {formatPosition(detached.x, detached.y)}, 確定マス数: {detached.confirmedCells.size()}</p>
                          <p className="text-xs text-gray-600 ml-2">
                            座標: {Array.from(detached.confirmedCells.cells).map(hash => {
                              const pos = Position.fromHash(hash);
                              return formatPosition(pos.x, pos.y);
                            }).join(', ')}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  {cell.reason && <p><strong>確定理由：</strong>{cell.reason}</p>}
                </div>
              );
            } else if (cell.type === 'preowner') {
              return (
                <div>
                  <p><strong>種類：</strong>仮オーナー部屋</p>
                  <p><strong>確定マス数：</strong>{cell.ownerIsland ? cell.ownerIsland.confirmedCells.size() : 0}</p>
                  {cell.ownerIsland && cell.ownerIsland.detachedConfirmedCells.length > 0 && (
                    <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded">
                      <p className="font-semibold">関連する島 ({cell.ownerIsland.detachedConfirmedCells.length}個):</p>
                      {cell.ownerIsland.detachedConfirmedCells.map((island, idx) => (
                        <div key={idx} className="ml-4 mt-1 text-sm">
                          <p>#{idx + 1}: 位置 {formatPosition(island.x, island.y)}, 部屋サイズ: {island.roomSize}, 確定マス数: {island.confirmedCells.size()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {cell.reason && <p><strong>確定理由：</strong>{cell.reason}</p>}
                </div>
              );
            } else if (cell.type === 'confirmed') {
              return (
                <div>
                  <p><strong>種類：</strong>確定部屋</p>
                  <p><strong>確定オーナー数：</strong>{cell.confirmedOwners.length}</p>
                  <p><strong>オーナー座標：</strong>
                    {cell.confirmedOwners.map(o => formatPosition(o.x, o.y)).join(', ')}
                  </p>
                  {cell.reason && <p><strong>確定理由：</strong>{cell.reason}</p>}
                </div>
              );
            } else if (cell.type === 'wall') {
              return (
                <div>
                  <p><strong>種類：</strong>確定壁</p>
                  {cell.reason && <p><strong>確定理由：</strong>{cell.reason}</p>}
                </div>
              );
            } else {
              const hash = new Position(selectedCell.x, selectedCell.y).toHash();
              const isManualWall = manualWalls.has(hash);
              const isManualEmptyCell = manualEmptyCells.has(hash);
              return (
                <div>
                  <p><strong>種類：</strong>未確定</p>
                  <p><strong>到達オーナー数：</strong>{cell.reachableOwners.length}</p>
                  {isManualWall && <p><strong>状態：</strong>手動壁（灰色）</p>}
                  {isManualEmptyCell && <p><strong>状態：</strong>手動確定マス（青・）</p>}
                  {cell.reason && <p><strong>確定理由：</strong>{cell.reason}</p>}
                </div>
              );
            }
          })() : (
            <p className="text-gray-500">クリックしてセルを選択してください</p>
          )}
        </div>
      )}

      <div className="text-sm text-gray-600">
        <p>※ ぬりかべは数字の島を作り、黒マスで海を表現するパズルです</p>
        <p>※ 現在、完全に解析できません</p>
      </div>
    </main>
  );
}
