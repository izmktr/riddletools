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
  wallGroup: Set<number>;  // 確定壁の場合、連結壁リスト

  constructor() {
    this.type = 'undecided';
    this.ownerIsland = null;
    this.confirmedOwners = [];
    this.reachableOwners = [];
    this.wallGroup = new Set<number>();
  }
}

class Island {
  x: number;
  y: number;
  roomSize: number;  // 部屋サイズ（数字）
  confirmedCells: Set<number>;  // 確定部屋リスト（ハッシュ値）
  reachableCells: Set<number>;  // 到達部屋リスト（ハッシュ値）
  isFixed: boolean;  // 確定マスと部屋サイズが同じになったら固定

  constructor(x: number, y: number, roomSize: number) {
    this.x = x;
    this.y = y;
    this.roomSize = roomSize;
    this.confirmedCells = new Set([new Position(x, y).toHash()]);
    this.reachableCells = new Set();
    this.isFixed = false;
  }
}

class Field {
  width: number;
  height: number;
  cells: Cell[][];
  islands: Island[];
  detachedIslands: Island[]; // 離れ小島のリスト
  wallGroups: Array<Set<number>>;  // 壁グループのリスト（各グループは連結した壁のハッシュ値のセット）
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
          const island = new Island(x, y, value);
          this.islands.push(island);
          this.cells[y][x].type = 'owner';
          this.cells[y][x].ownerIsland = island;
        }
      }
    }
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

  // 指定されたセルが他のオーナーの確定マスに隣接しているかチェック
  isAdjacentToOtherOwner(x: number, y: number, island: Island): boolean {
    const adjacents = this.getAdjacentPositions(x, y);
    for (const pos of adjacents) {
      const cell = this.cells[pos.y][pos.x];
      if (cell.type === 'owner' && cell.ownerIsland !== island) {
        return true;
      }
      if (cell.type === 'confirmed' && !cell.confirmedOwners.includes(island)) {
        return true;
      }
    }
    return false;
  }

  // 指定されたハッシュ値のセルから到達可能な未確定セルを収集
  collectReachableCellsFromHash(hash: number, island: Island, reachable: Set<number>, processed: Set<number>): void {
    const pos = Position.fromHash(hash);
    const adjacents = this.getAdjacentPositions(pos.x, pos.y);

    for (const adjPos of adjacents) {
      const adjHash = adjPos.toHash();
      if (processed.has(adjHash)) continue;

      const cell = this.cells[adjPos.y][adjPos.x];

      // 未確定マスで、他のオーナーに隣接していない場合
      if ((cell.type === 'undecided' || cell.type === 'preowner') && !this.isAdjacentToOtherOwner(adjPos.x, adjPos.y, island)) {
        reachable.add(adjHash);
      }
    }
  }

  // 指定されたハッシュ値のセルから到達可能な未確定セルを収集
  collectReachableCellsPreowner(hash: number, island: Island, reachable: Set<number>, processed: Set<number>): void {
    const pos = Position.fromHash(hash);
    const adjacents = this.getAdjacentPositions(pos.x, pos.y);

    for (const adjPos of adjacents) {
      const adjHash = adjPos.toHash();
      if (processed.has(adjHash)) continue;

      const cell = this.cells[adjPos.y][adjPos.x];

      // 未確定マスなら、到達部屋として記録
      if (cell.type === 'undecided') {
        reachable.add(adjHash);
      }
    }
  }

  // 指定されたハッシュ値のセルから到達可能な未確定セルを収集(壁用)
  collectReachableCellsFromHashWall(hash: number, reachable: Set<number>): void {
    const pos = Position.fromHash(hash);
    const adjacents = this.getAdjacentPositions(pos.x, pos.y);

    for (const adjPos of adjacents) {
      const adjHash = adjPos.toHash();

      const cell = this.cells[adjPos.y][adjPos.x];

      // 未確定マス隣接していれば、到達部屋として記録
      if (cell.type === 'undecided') {
        reachable.add(adjHash);
      }
    }
  }


  // 島を固定し、周囲の未確定マスを壁に変更
  fixIslandAndSurroundWithWalls(island: Island): boolean {
    let changed = false;
    island.isFixed = true;
    island.reachableCells.clear();

    // 確定マスの隣接で未確定マスをすべて確定壁に変更
    for (const hash of island.confirmedCells) {
      const pos = Position.fromHash(hash);
      const adjacents = this.getAdjacentPositions(pos.x, pos.y);
      for (const adjPos of adjacents) {
        if (this.addWall(adjPos.x, adjPos.y)) {
          changed = true;
        }
      }
    }
    return changed;
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

        // 3つが壁で、1つが未確定の場合
        if (wallCells.length === 3 && undecidedCells.length === 1) {
          const targetCell = undecidedCells[0];
          const targetX = targetCell.x;
          const targetY = targetCell.y;
          const targetHash = new Position(targetX, targetY).toHash();

          // 隣接する確定マスまたはオーナーマスを探す
          const adjacents = this.getAdjacentPositions(targetX, targetY);
          let foundIsland: Island | null = null;

          for (const adjPos of adjacents) {
            const adjCell = this.cells[adjPos.y][adjPos.x];
            if (adjCell.type === 'owner' && adjCell.ownerIsland) {
              foundIsland = adjCell.ownerIsland;
              break;
            } else if (adjCell.type === 'confirmed' && adjCell.confirmedOwners.length > 0) {
              foundIsland = adjCell.confirmedOwners[0];
              break;
            }
          }

          // 隣接する島が見つかった場合、その島の確定リストに追加
          if (foundIsland && !foundIsland.isFixed) {
            foundIsland.confirmedCells.add(targetHash);
            targetCell.cell.type = 'confirmed';
            targetCell.cell.confirmedOwners = [foundIsland];
            changed = true;
          }else{
            // 隣接する島が見つからない場合、離れ小島として登録
            const detachedIsland = new Island(targetX, targetY, 0);
            detachedIsland.confirmedCells.add(targetHash);
            this.detachedIslands.push(detachedIsland);
            targetCell.cell.type = 'preowner';
            targetCell.cell.confirmedOwners = [detachedIsland];
            targetCell.cell.ownerIsland = detachedIsland;
            changed = true; 
          }
        }
      }
    }

    return changed;
  }

  // 壁を追加する処理
  addWall(x: number, y: number): boolean {
    const cell = this.cells[y][x];
    if (cell.type === 'undecided') {
      this.remainingWalls--;
      cell.type = 'wall';
      const hash = new Position(x, y).toHash();
      cell.wallGroup = new Set<number>([hash]);
      this.wallGroups.push(cell.wallGroup);

      // 隣接するセルを調べて、壁なら連結リストに追加
      const adjacents = this.getAdjacentPositions(x, y);
      for (const adjPos of adjacents) {
        const adjCell = this.cells[adjPos.y][adjPos.x];
        // 壁が隣接していれば、壁グループをマージ
        if (adjCell.type === 'wall') {
          // サイズを比較して、小さい方を大きい方に吸収
          let absorbingGroup: Set<number>;  // 吸収側（要素が多い方）
          let disappearingGroup: Set<number>;  // 消滅側（要素が少ない方）
          
          if (cell.wallGroup.size >= adjCell.wallGroup.size) {
            absorbingGroup = cell.wallGroup;
            disappearingGroup = adjCell.wallGroup;
          } else {
            absorbingGroup = adjCell.wallGroup;
            disappearingGroup = cell.wallGroup;
          }
          
          for (const h of disappearingGroup) {
            // 消滅側のすべてのセルを吸収側に追加
            absorbingGroup.add(h);
            // hashからPositionを取得して、そのセルのwallGroupを更新
            const pos = Position.fromHash(h);
            this.cells[pos.y][pos.x].wallGroup = absorbingGroup;
          }

          // wallGroupsから消滅側のグループを削除
          this.wallGroups = this.wallGroups.filter(g => g !== disappearingGroup);
        }
      }
      return true;
    }
    return false;
  }

  // 解析処理のメイン
  analyze(): boolean {
    let changed = false;

    this.remainingWalls = this.width * this.height - this.islands.reduce((sum, island) => sum + island.roomSize, 0);

    // すべてのオーナー部屋に対して処理
    for (const island of this.islands) {
      if (island.isFixed) continue;

      // 確定マスと部屋サイズが同じ場合、固定する
      if (island.confirmedCells.size === island.roomSize) {
        // 部屋を囲む壁を確定
        if (this.fixIslandAndSurroundWithWalls(island)) {
          changed = true;
        }
        continue;
      }

      // 到達部屋リストをクリア
      const newReachable = new Set<number>();
      const processed = new Set<number>();

      // 確定マスの隣接を調べる
      const queue = Array.from(island.confirmedCells);
      
      while (queue.length > 0) {
        const hash = queue.shift()!;
        if (processed.has(hash)) continue;
        processed.add(hash);

        this.collectReachableCellsFromHash(hash, island, newReachable, processed);
      }

      // 到達部屋リストのサイズが1なら確定
      if (newReachable.size === 1) {
        const hash = Array.from(newReachable)[0];
        island.confirmedCells.add(hash);
        const pos = Position.fromHash(hash);
        const cell = this.cells[pos.y][pos.x];
        cell.type = 'confirmed';
        cell.confirmedOwners = [island];
        changed = true;
      }
      island.reachableCells = newReachable;
    }

    // 仮オーナー部屋の処理
    for (const detachedIsland of this.detachedIslands) {
      const newReachable = new Set<number>();
      const processed = new Set<number>();
      const queue = Array.from(detachedIsland.confirmedCells);

      // 隣接セルを調べる
      while (queue.length > 0) {
        const hash = queue.shift()!;
        if (processed.has(hash)) continue;
        processed.add(hash);

        this.collectReachableCellsPreowner(hash, detachedIsland, newReachable, processed);
      }

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
          if (cell.type === 'owner' && cell.ownerIsland) {
            foundOwner = cell.ownerIsland;
            break;
          }
          if (cell.type === 'confirmed' && cell.confirmedOwners.length > 0) {
            foundOwner = cell.confirmedOwners[0];
            break;
          }
        }

        if (foundOwner) {
          // オーナーが見つかったら確定部屋に追加
          for(const h of detachedIsland.confirmedCells) {
            foundOwner.confirmedCells.add(h);
            const pos = Position.fromHash(h);
            const hcell = this.cells[pos.y][pos.x];
            hcell.ownerIsland = foundOwner;
            hcell.type = 'confirmed';
            hcell.confirmedOwners = [foundOwner];
          }
        }else{
          // 隣接するオーナーが見つからなかった場合、そのまま仮オーナー部屋として確定
          detachedIsland.confirmedCells.add(hash);
          const pos = Position.fromHash(hash);
          const cell = this.cells[pos.y][pos.x];
          cell.type = 'preowner';
          cell.confirmedOwners = [detachedIsland];
          detachedIsland.reachableCells = newReachable;
        }
        changed = true;
      }

    }

    if (changed) { return changed; }

    // 2x2のパターンチェック: 3つが壁の場合、残り1つを部屋にする
    if (this.check2x2WallPattern()) {
      return true;
    }

    // 壁を伸ばす処理
    if (0 < this.remainingWalls){
      for (const wallGroup of this.wallGroups) {
        if (this.remainingWalls <= 0) break;

        const newReachable = new Set<number>();

        // 隣接セルを調べる
        for (const hash of wallGroup) {
          this.collectReachableCellsFromHashWall(hash, newReachable);
        }

        // 到達部屋リストのサイズが1なら確定
        if (newReachable.size === 1) {
          const hash = Array.from(newReachable)[0];
          const pos = Position.fromHash(hash);
          this.addWall(pos.x, pos.y);
          changed = true;
          break; // 壁を追加したらループを抜けて、analyzeを最初からやり直す
        }
      }
    }

    if (changed) { return changed; }

    // 到達可能リストを作成する
    for (const island of this.islands) {
      if (island.isFixed) continue;
      const processed = new Set<number>();
      
      // あと何部屋追加できるか
      const roomsLeft = island.roomSize - island.confirmedCells.size;

      const newqueue = Array.from(island.confirmedCells);
      for(let i = 0; i < roomsLeft; i++) {
        const queue = Array.from(newqueue);
        newqueue.length = 0;
        while (queue.length > 0) {
          const hash = queue.shift()!;
          if (processed.has(hash)) continue;
          processed.add(hash);

          const reachableCells = new Set<number>();
          this.collectReachableCellsFromHash(hash, island, reachableCells, processed);
          reachableCells.forEach(cell => island.reachableCells.add(cell));
          newqueue.push(...reachableCells);
        }
      }

      // 確定マスと到達マスの合計が部屋サイズと同じ場合、固定する
      if (island.reachableCells.size + island.confirmedCells.size === island.roomSize) {
        if (this.fixIslandAndSurroundWithWalls(island)) { 
          changed = true;
        }
      }
    }

    // オーナー部屋の探索がすべて終わっている場合、オーナー部屋でも到達しないセルを壁確定マスにする
    const allReachable = new Set<number>();
    for (const island of this.islands) {
      for (const hash of island.reachableCells) {
        allReachable.add(hash);
      }
      for (const hash of island.confirmedCells) {
        allReachable.add(hash);
      }
    }

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        const hash = new Position(x, y).toHash();
        if (cell.type === 'undecided' && !allReachable.has(hash)) {
          if (this.addWall(x, y)) {
            changed = true;
          }
        }
      }
    }
    return changed;
  }

  // 解析を繰り返し実行
  solve() {
    let iteration = 0;
    const maxIterations = this.width * this.height;
    
    while (iteration < maxIterations) {
      const changed = this.analyze();
      if (!changed) break;
      iteration++;
    }
  }
}

export default function NurikabePage() {
  const [width, setWidth] = useState(8);
  const [height, setHeight] = useState(8);
  const [board, setBoard] = useState<CellValue[][]>(() => 
    Array(8).fill(null).map(() => Array(8).fill(null))
  );
  const [showManual, setShowManual] = useState(false);
  const [isAnalyzeMode, setIsAnalyzeMode] = useState(false);
  const [field, setField] = useState<Field | null>(null);
  const [selectedCell, setSelectedCell] = useState<{x: number, y: number} | null>(null);
  const [highlightedCells, setHighlightedCells] = useState<Set<number>>(new Set());
  const [manualWalls, setManualWalls] = useState<Set<number>>(new Set());

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

  // セルクリック時の処理
  const handleCellClick = (row: number, col: number) => {
    if (isAnalyzeMode) {
      // 解析モード：セル情報を表示
      setSelectedCell({x: col, y: row});
      
      if (!field) return;
      
      const cell = field.cells[row][col];
      const highlighted = new Set<number>();
      
      if (cell.type === 'owner' && cell.ownerIsland) {
        // オーナー部屋：自身と確定部屋リストを濃い緑、到達部屋リストを薄い緑
        for (const hash of cell.ownerIsland.confirmedCells) {
          highlighted.add(hash);
        }
        for (const hash of cell.ownerIsland.reachableCells) {
          highlighted.add(hash);
        }
      } else if (cell.type === 'preowner') {
        // 仮オーナー部屋：自身のセルをハイライト
        highlighted.add(new Position(col, row).toHash());
      } else if (cell.type === 'confirmed') {
        // 確定部屋：すべての確定オーナーのセルをハイライト
        for (const owner of cell.confirmedOwners) {
          for (const hash of owner.confirmedCells) {
            highlighted.add(hash);
          }
        }
      } else if (cell.type === 'wall') {
        // 確定壁：連結壁グループ全体を赤に
        for (const hash of cell.wallGroup) {
          highlighted.add(hash);
        }
      } else if (cell.type === 'undecided') {
        // 未確定：自身をハイライト
        highlighted.add(new Position(col, row).toHash());
      }
      
      setHighlightedCells(highlighted);
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
    const newField = new Field(width, height);
    newField.initFromBoard(board);
    newField.solve();
    setField(newField);
    setIsAnalyzeMode(true);
  };

  // 手動壁を追加/削除
  const handleToggleManualWall = () => {
    if (!selectedCell || !field) return;
    const cell = field.cells[selectedCell.y][selectedCell.x];
    if (cell.type !== 'undecided') return;
    
    const hash = new Position(selectedCell.x, selectedCell.y).toHash();
    const newManualWalls = new Set(manualWalls);
    
    if (newManualWalls.has(hash)) {
      newManualWalls.delete(hash);
    } else {
      newManualWalls.add(hash);
    }
    
    setManualWalls(newManualWalls);
  };

  // 再解析
  const handleReanalyze = () => {
    if (!field) return;
    
    // 手動壁を追加
    for (const hash of manualWalls) {
      const pos = Position.fromHash(hash);
      field.addWall(pos.x, pos.y);
    }
    
    // 解析を続行
    field.solve();
    
    // 手動壁をクリア
    setManualWalls(new Set());
    setSelectedCell(null);
    setHighlightedCells(new Set());
    
    // フィールドを更新
    setField(field);
  };

  // 入力に戻る
  const handleBackToInput = () => {
    setIsAnalyzeMode(false);
    setField(null);
    setSelectedCell(null);
    setHighlightedCells(new Set());
    setManualWalls(new Set());
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
              className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
              onClick={handleReanalyze}
              disabled={manualWalls.size === 0}
            >再解析</button>
          </>
        )}
      </div>

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
                  
                  if (isAnalyzeMode && field) {
                    const fieldCell = field.cells[rowIndex][colIndex];
                    const hash = new Position(colIndex, rowIndex).toHash();
                    
                    // ハイライト状態をチェック
                    const isHighlighted = highlightedCells.has(hash);
                    
                    if (isHighlighted) {
                      if (fieldCell.type === 'wall') {
                        bgColor = "bg-red-400";
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
                        bgColor = "bg-orange-400";
                      } else if (fieldCell.type === 'confirmed') {
                        bgColor = "bg-yellow-200";
                      } else if (fieldCell.type === 'wall') {
                        bgColor = "bg-black";
                        textContent = "";
                      } else if (fieldCell.type === 'undecided' && manualWalls.has(hash)) {
                        // 手動で追加された壁
                        bgColor = "bg-gray-500";
                        textContent = "";
                      } else {
                        bgColor = "bg-white";
                        textContent = "";
                      }
                    }
                  }
                  
                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={`w-10 h-10 border border-gray-300 cursor-pointer flex items-center justify-center text-sm font-bold ${bgColor}`}
                      onClick={() => handleCellClick(rowIndex, colIndex)}
                    >
                      {textContent}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* セル情報表示 */}
      {isAnalyzeMode && selectedCell && field && (
        <div className="mb-4 p-4 border-2 border-gray-300 rounded bg-gray-50">
          <h3 className="font-semibold mb-2">セル情報 ({selectedCell.x}, {selectedCell.y})</h3>
          {(() => {
            const cell = field.cells[selectedCell.y][selectedCell.x];
            
            if (cell.type === 'owner' && cell.ownerIsland) {
              return (
                <div>
                  <p><strong>種類：</strong>オーナー部屋</p>
                  <p><strong>部屋サイズ：</strong>{cell.ownerIsland.roomSize}</p>
                  <p><strong>確定マス数：</strong>{cell.ownerIsland.confirmedCells.size}</p>
                  <p><strong>到達マス数：</strong>{cell.ownerIsland.reachableCells.size}</p>
                  <p><strong>固定状態：</strong>{cell.ownerIsland.isFixed ? '固定済み' : '未固定'}</p>
                </div>
              );
            } else if (cell.type === 'preowner') {
              return (
                <div>
                  <p><strong>種類：</strong>仮オーナー部屋</p>
                  <p><strong>説明：</strong>2x2パターンにより壁ではないと推定されたセル</p>
                </div>
              );
            } else if (cell.type === 'confirmed') {
              return (
                <div>
                  <p><strong>種類：</strong>確定部屋</p>
                  <p><strong>確定オーナー数：</strong>{cell.confirmedOwners.length}</p>
                  <p><strong>オーナー座標：</strong>
                    {cell.confirmedOwners.map(o => `(${o.x},${o.y})`).join(', ')}
                  </p>
                </div>
              );
            } else if (cell.type === 'wall') {
              return (
                <div>
                  <p><strong>種類：</strong>確定壁</p>
                </div>
              );
            } else {
              const hash = new Position(selectedCell.x, selectedCell.y).toHash();
              const isManualWall = manualWalls.has(hash);
              return (
                <div>
                  <p><strong>種類：</strong>未確定</p>
                  <p><strong>到達オーナー数：</strong>{cell.reachableOwners.length}</p>
                  {isManualWall && <p><strong>状態：</strong>手動壁（灰色）</p>}
                </div>
              );
            }
          })()}
        </div>
      )}

      <div className="text-sm text-gray-600">
        <p>※ ぬりかべは数字の島を作り、黒マスで海を表現するパズルです</p>
        <p>※ 解析機能は後で実装予定です</p>
      </div>
    </main>
  );
}
