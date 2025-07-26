// スケルトンソルバーのロジック関数

export type CellState = "white" | "yellow";

export interface Position {
  row: number;
  col: number;
}

export interface Word {
  text: string;
  positions: Position[];
  direction: "horizontal" | "vertical";
  candidates: string[] | null;
}

// 連続するマスを取得
export const getConsecutiveCells = (board: CellState[][], boardWidth: number, boardHeight: number): Word[] => {
  const words: Word[] = [];
  
  // 横方向をチェック
  for (let row = 0; row < boardHeight; row++) {
    let start = -1;
    for (let col = 0; col <= boardWidth; col++) {
      if (col < boardWidth && board[row][col] === "yellow") {
        if (start === -1) start = col;
      } else {
        if (start !== -1 && col - start >= 2) {
          const positions: Position[] = [];
          for (let c = start; c < col; c++) {
            positions.push({ row, col: c });
          }
          words.push({
            text: "",
            positions,
            direction: "horizontal",
            candidates: null
          });
        }
        start = -1;
      }
    }
  }

  // 縦方向をチェック
  for (let col = 0; col < boardWidth; col++) {
    let start = -1;
    for (let row = 0; row <= boardHeight; row++) {
      if (row < boardHeight && board[row][col] === "yellow") {
        if (start === -1) start = row;
      } else {
        if (start !== -1 && row - start >= 2) {
          const positions: Position[] = [];
          for (let r = start; r < row; r++) {
            positions.push({ row: r, col });
          }
          words.push({
            text: "",
            positions,
            direction: "vertical",
            candidates: null
          });
        }
        start = -1;
      }
    }
  }

  return words;
};

// 交差点を見つける
export const findIntersections = (slots: Word[]): Map<string, { slots: number[], position: number[] }> => {
  const intersections = new Map<string, { slots: number[], position: number[] }>();

  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const slot1 = slots[i];
      const slot2 = slots[j];

      if (slot1.direction !== slot2.direction) {
        // 異なる方向のスロット間で交差をチェック
        // slot1を常に横線、slot2を縦線として処理を統一
        let horizontalSlot = slot1;
        let verticalSlot = slot2;
        let slot1Index = i;
        let slot2Index = j;
        
        // slot1が縦線の場合は交換
        if (slot1.direction === "vertical") {
          horizontalSlot = slot2;
          verticalSlot = slot1;
          slot1Index = j;
          slot2Index = i;
        }
        
        const horizontalRow = horizontalSlot.positions[0].row;
        const verticalCol = verticalSlot.positions[0].col;
        
        // 横線の範囲内に縦線の列があるかチェック
        const horizontalStart = horizontalSlot.positions[0].col;
        const horizontalEnd = horizontalSlot.positions[horizontalSlot.positions.length - 1].col;
        
        // 縦線の範囲内に横線の行があるかチェック
        const verticalStart = verticalSlot.positions[0].row;
        const verticalEnd = verticalSlot.positions[verticalSlot.positions.length - 1].row;
        
        if (verticalCol >= horizontalStart && verticalCol <= horizontalEnd &&
            horizontalRow >= verticalStart && horizontalRow <= verticalEnd) {
          const key = `${horizontalRow}-${verticalCol}`;
          const p1 = verticalCol - horizontalStart; // 横線内の位置
          const p2 = horizontalRow - verticalStart; // 縦線内の位置
          
          intersections.set(key, {
            slots: [slot1Index, slot2Index],
            position: [p1, p2]
          });
        }
      }
    }
  }

  return intersections;
};

// 部分配置での制約チェック（より緩い）
export const isValidPartialPlacement = (slot: Word, word: string, grid: string[][]): boolean => {
  for (let i = 0; i < slot.positions.length; i++) {
    const pos = slot.positions[i];
    const existingChar = grid[pos.row][pos.col];
    
    // 既に文字が配置されている場合は一致をチェック
    if (existingChar && existingChar !== word[i]) {
      return false;
    }
  }
  return true;
};

// 有効な配置かチェック
export const isValidPlacement = (
  slot: Word, 
  word: string, 
  grid: string[][], 
  intersections: Map<string, { slots: number[], position: number[] }>,
  currentSlotIndex: number
): boolean => {
  for (let i = 0; i < slot.positions.length; i++) {
    const pos = slot.positions[i];
    const key = `${pos.row}-${pos.col}`;
    const intersection = intersections.get(key);

    if (intersection) {
      const [slot1Index, slot2Index] = intersection.slots;

      // 現在のスロットが交差に関わる場合
      if (slot1Index === currentSlotIndex || slot2Index === currentSlotIndex) {
        const existingChar = grid[pos.row][pos.col];
        if (existingChar && existingChar !== word[i]) {
          return false; // 文字が一致しない
        }
      }
    }
  }

  return true;
};

// 単語を配置
export const placeWord = (slot: Word, word: string, grid: string[][]) => {
  for (let i = 0; i < word.length; i++) {
    const pos = slot.positions[i];
    grid[pos.row][pos.col] = word[i];
  }
};

// 単語を削除
export const removeWord = (slot: Word, grid: string[][]) => {
  for (const pos of slot.positions) {
    grid[pos.row][pos.col] = "";
  }
};

// 制約数をカウント（ヒューリスティック用）
export const countConstraints = (slot: Word, intersections: Map<string, { slots: number[], position: number[] }>): number => {
  let count = 0;
  for (const pos of slot.positions) {
    const key = `${pos.row}-${pos.col}`;
    if (intersections.has(key)) {
      count++;
    }
  }
  return count;
};

// 部分的な解析（制約を緩和）
export const solvePartial = (wordList: string[], slots: Word[], boardWidth: number, boardHeight: number): { grid: string[][], usedWords: Set<string> } | null => {
  const grid: string[][] = Array(boardHeight).fill(null).map(() => Array(boardWidth).fill(""));
  const usedWords = new Set<string>();

  // 交差点を事前計算
  const intersections = findIntersections(slots);

  // 制約の少ないスロットから順に試す（貪欲法）
  const sortedSlots = slots
    .map((slot, index) => ({ slot, index, constraints: countConstraints(slot, intersections) }))
    .sort((a, b) => a.constraints - b.constraints);

  for (const { slot } of sortedSlots) {
    const length = slot.positions.length;
    const candidates = wordList.filter(w => w.length === length && !usedWords.has(w));
    
    // 制約を満たす単語を探す
    for (const word of candidates) {
      if (isValidPartialPlacement(slot, word, grid)) {
        placeWord(slot, word, grid);
        usedWords.add(word);
        break; // この長さの最初の有効な単語を使用
      }
    }
  }

  // 何かしら配置できた場合は結果を返す
  if (usedWords.size > 0) {
    return { grid, usedWords };
  }

  return null;
};

// 制約充足問題として解く
export const solveConstraints = (wordList: string[], slots: Word[], boardWidth: number, boardHeight: number): { grid: string[][], usedWords: Set<string> } | null => {
  const grid: string[][] = Array(boardHeight).fill(null).map(() => Array(boardWidth).fill(""));
  const usedWords = new Set<string>();
  let bestResult: { grid: string[][], usedWords: Set<string> } | null = null;
  let maxPlaced = 0;

  // 交差点を事前計算
  const intersections = findIntersections(slots);

  // バックトラッキング（最良解も記録）
  const backtrack = (slotIndex: number): boolean => {
    // 現在の配置数が最良を上回った場合は記録
    if (usedWords.size > maxPlaced) {
      maxPlaced = usedWords.size;
      bestResult = {
        grid: grid.map(row => [...row]),
        usedWords: new Set(usedWords)
      };
    }

    if (slotIndex >= slots.length) {
      return true; // 全スロット埋まった（完全解）
    }

    const slot = slots[slotIndex];
    const length = slot.positions.length;
    const candidates = wordList.filter(w => w.length === length && !usedWords.has(w));

    for (const word of candidates) {
      // 制約チェック：交差部分の文字が一致するか
      if (isValidPlacement(slot, word, grid, intersections, slotIndex)) {
        // 配置を試す
        placeWord(slot, word, grid);
        usedWords.add(word);

        // 再帰的に次のスロットを試す
        if (backtrack(slotIndex + 1)) {
          return true; // 完全解が見つかった
        }

        // バックトラック：配置を取り消す
        removeWord(slot, grid);
        usedWords.delete(word);
      }
    }

    // このスロットをスキップして次へ
    if (backtrack(slotIndex + 1)) {
      return true;
    }

    return false;
  };

  // 制約の多いスロットから処理（ヒューリスティック）
  const sortedSlots = slots
    .map((slot, index) => ({ slot, index, constraints: countConstraints(slot, intersections) }))
    .sort((a, b) => b.constraints - a.constraints);

  if (backtrack(0)) {
    return { grid, usedWords }; // 完全解
  }

  // 完全解が見つからない場合は最良の部分解を返す
  return bestResult;
};
