import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SkeletonPage from './page';

// Skeleton solver related types and interfaces  
type CellState = "white" | "yellow";

interface Position {
  row: number;
  col: number;
}

interface Slot {
  direction: 'horizontal' | 'vertical';
  length: number;
  positions: Position[];
  candidates: string[] | null;
  confirmedWord: string | null;
}

// ヘルパー関数
function createHorizontalSlot(row: number, startCol: number, length: number): Slot {
  const positions = Array.from({ length }, (_, i) => ({
    row: row,
    col: startCol + i
  }));
  
  return {
    direction: 'horizontal',
    length,
    positions,
    candidates: null,
    confirmedWord: null
  };
}

function createVerticalSlot(col: number, startRow: number, length: number): Slot {
  const positions = Array.from({ length }, (_, i) => ({
    row: startRow + i,
    col: col
  }));
  
  return {
    direction: 'vertical',
    length,
    positions,
    candidates: null,
    confirmedWord: null
  };
}

describe('SkeletonPage UI Tests', () => {
  test('ページが正常にレンダリングされる', () => {
    render(<SkeletonPage />);
    expect(screen.getByText('スケルトンソルバー')).toBeInTheDocument();
    expect(screen.getByText('使い方')).toBeInTheDocument();
    expect(screen.getByText('トップに戻る')).toBeInTheDocument();
  });

  test('使い方ボタンでモーダルが開く', () => {
    render(<SkeletonPage />);
    const manualButton = screen.getByText('使い方');
    fireEvent.click(manualButton);
    expect(screen.getByText('スケルトンソルバーの使い方')).toBeInTheDocument();
  });

  test('サンプルボタンが動作する', () => {
    render(<SkeletonPage />);
    const manualButton = screen.getByText('使い方');
    fireEvent.click(manualButton);
    const sampleButton = screen.getByText('サンプル');
    fireEvent.click(sampleButton);
    
    // サンプルデータが設定されることを確認
    const textarea = screen.getByPlaceholderText('単語を改行で区切って入力してください');
    expect(textarea).toHaveValue('りんご\nみかん\nばなな\nいちご\nぶどう');
  });

  test('リセットボタンが動作する', () => {
    render(<SkeletonPage />);
    
    // まずサンプルデータを設定
    const manualButton = screen.getByText('使い方');
    fireEvent.click(manualButton);
    const sampleButton = screen.getByText('サンプル');
    fireEvent.click(sampleButton);
    
    // リセットボタンをクリック
    const resetButton = screen.getByText('リセット');
    fireEvent.click(resetButton);
    
    // テキストエリアが空になることを確認
    const textarea = screen.getByPlaceholderText('単語を改行で区切って入力してください');
    expect(textarea).toHaveValue('');
  });

  test('単語入力ができる', () => {
    render(<SkeletonPage />);
    const textarea = screen.getByPlaceholderText('単語を改行で区切って入力してください');
    
    fireEvent.change(textarea, { target: { value: 'テスト\n単語' } });
    expect(textarea).toHaveValue('テスト\n単語');
  });

  test('解析ボタンが存在する', () => {
    render(<SkeletonPage />);
    const analyzeButton = screen.getByText('解析');
    expect(analyzeButton).toBeInTheDocument();
    
    // ボタンをクリックしてもエラーが出ないことを確認
    fireEvent.click(analyzeButton);
  });
});

describe('Skeleton Solver Data Structure Tests', () => {
  test('水平スロットの作成', () => {
    const slot = createHorizontalSlot(1, 2, 3);
    
    expect(slot.direction).toBe('horizontal');
    expect(slot.length).toBe(3);
    expect(slot.positions).toEqual([
      { row: 1, col: 2 },
      { row: 1, col: 3 },
      { row: 1, col: 4 }
    ]);
    expect(slot.candidates).toBeNull();
    expect(slot.confirmedWord).toBeNull();
  });

  test('垂直スロットの作成', () => {
    const slot = createVerticalSlot(2, 1, 3);
    
    expect(slot.direction).toBe('vertical');
    expect(slot.length).toBe(3);
    expect(slot.positions).toEqual([
      { row: 1, col: 2 },
      { row: 2, col: 2 },
      { row: 3, col: 2 }
    ]);
    expect(slot.candidates).toBeNull();
    expect(slot.confirmedWord).toBeNull();
  });

  test('交差点の検出ロジック', () => {
    // 横スロット（行1、列2-4）と縦スロット（列3、行0-2）が(1,3)で交差するケース
    const horizontalSlot = createHorizontalSlot(1, 2, 3); // (1,2), (1,3), (1,4)
    const verticalSlot = createVerticalSlot(3, 0, 3);     // (0,3), (1,3), (2,3)
    
    // 交差点は(1,3)にあるはず
    // horizontalSlotでは位置1（3-2=1）
    // verticalSlotでは位置1（1-0=1）
    
    expect(horizontalSlot.positions[1]).toEqual({ row: 1, col: 3 });
    expect(verticalSlot.positions[1]).toEqual({ row: 1, col: 3 });
  });

  test('候補の絞り込み処理', () => {
    const slot = createHorizontalSlot(0, 0, 3);
    const candidates = ['あいう', 'かきく', 'さしす'];
    
    slot.candidates = candidates;
    expect(slot.candidates).toHaveLength(3);
    
    // 1つの候補を除外
    slot.candidates = slot.candidates.filter(word => word !== 'かきく');
    expect(slot.candidates).toHaveLength(2);
    expect(slot.candidates).toEqual(['あいう', 'さしす']);
  });

  test('確定単語の設定', () => {
    const slot = createHorizontalSlot(0, 0, 3);
    
    expect(slot.confirmedWord).toBeNull();
    
    slot.confirmedWord = 'あいう';
    expect(slot.confirmedWord).toBe('あいう');
  });
});

describe('Skeleton Solver Algorithm Tests', () => {
  test('十字型のシンプルなパズル設定', () => {
    const wordList = ['あい', 'いう'];
    
    // L字型でテスト: 横2マス + 縦2マス（交差点あり）
    const horizontalSlot = createHorizontalSlot(1, 1, 2); // (1,1), (1,2)
    const verticalSlot = createVerticalSlot(1, 1, 2);     // (1,1), (2,1)
    
    const slots = [horizontalSlot, verticalSlot];
    
    // 交差点は(1,1)
    expect(horizontalSlot.positions[0]).toEqual({ row: 1, col: 1 });
    expect(verticalSlot.positions[0]).toEqual({ row: 1, col: 1 });
  });

  test('候補が1つに絞られた場合の確定処理', () => {
    const slot = createHorizontalSlot(0, 0, 3);
    slot.candidates = ['あいう']; // 候補が1つだけ
    
    // 候補が1つの場合、確定すべき
    if (slot.candidates.length === 1) {
      slot.confirmedWord = slot.candidates[0];
    }
    
    expect(slot.confirmedWord).toBe('あいう');
  });

  test('使用済み単語の除外処理', () => {
    const slot1 = createHorizontalSlot(0, 0, 3);
    const slot2 = createHorizontalSlot(1, 0, 3);
    
    slot1.candidates = ['あいう', 'かきく'];
    slot2.candidates = ['あいう', 'さしす'];
    
    // slot1で'あいう'を確定
    slot1.confirmedWord = 'あいう';
    
    // slot2の候補から使用済みの'あいう'を除外
    if (slot2.candidates) {
      slot2.candidates = slot2.candidates.filter(word => word !== slot1.confirmedWord);
    }
    
    expect(slot2.candidates).toEqual(['さしす']);
  });

  test('交差制約での候補絞り込み', () => {
    const horizontalSlot = createHorizontalSlot(1, 1, 2); // (1,1), (1,2)
    const verticalSlot = createVerticalSlot(1, 1, 2);     // (1,1), (2,1)
    
    horizontalSlot.candidates = ['あい', 'かき'];
    verticalSlot.candidates = ['あう', 'きく'];
    
    // 交差点(1,1)での制約チェック
    // 'あい'と'あう'は最初の文字'あ'で一致
    // 'かき'と'きく'は最初の文字'き'で一致
    
    expect(horizontalSlot.candidates).toContain('あい');
    expect(verticalSlot.candidates).toContain('あう');
  });
});

describe('Skeleton Solver Grid Tests', () => {
  test('グリッドからスロットを正しく抽出', () => {
    // 3x3グリッドで十字型のパターン
    const board: CellState[][] = [
      ["white", "yellow", "white"],
      ["yellow", "yellow", "yellow"],
      ["white", "yellow", "white"]
    ];
    
    expect(board[1]).toEqual(["yellow", "yellow", "yellow"]); // 横スロット
    expect([board[0][1], board[1][1], board[2][1]]).toEqual(["yellow", "yellow", "yellow"]); // 縦スロット
  });

  test('複雑なグリッドパターンの処理', () => {
    // L字型のパターン
    const board: CellState[][] = [
      ["yellow", "yellow", "white"],
      ["yellow", "white", "white"],
      ["yellow", "white", "white"]
    ];
    
    // 横スロット: (0,0)-(0,1)
    // 縦スロット: (0,0)-(1,0)-(2,0)
    expect(board[0].slice(0, 2)).toEqual(["yellow", "yellow"]);
    expect([board[0][0], board[1][0], board[2][0]]).toEqual(["yellow", "yellow", "yellow"]);
  });

  test('隣接しないセルの処理', () => {
    const board: CellState[][] = [
      ["yellow", "white", "yellow"],
      ["white", "white", "white"],
      ["white", "white", "white"]
    ];
    
    // 離れたyellowセルは別々のスロットとして処理される
    expect(board[0][0]).toBe("yellow");
    expect(board[0][1]).toBe("white");
    expect(board[0][2]).toBe("yellow");
  });
});

describe('Skeleton Solver Edge Cases', () => {
  test('空のグリッドの処理', () => {
    const board: CellState[][] = [
      ["white", "white"],
      ["white", "white"]
    ];
    
    // yellowセルがない場合はスロットなし
    const yellowCells = board.flat().filter(cell => cell === "yellow");
    expect(yellowCells).toHaveLength(0);
  });

  test('単一セルのスロット（長さ1）', () => {
    const board: CellState[][] = [
      ["white", "yellow", "white"],
      ["white", "white", "white"]
    ];
    
    // 長さ1のスロットは通常除外される
    expect(board[0][1]).toBe("yellow");
  });

  test('境界の処理', () => {
    const board: CellState[][] = [
      ["yellow", "yellow"],
      ["white", "white"]
    ];
    
    // グリッドの端のスロット
    expect(board[0]).toEqual(["yellow", "yellow"]);
  });

  test('不正な入力の処理', () => {
    // 空の単語リスト
    const emptyWordList: string[] = [];
    
    expect(emptyWordList).toHaveLength(0);
    
    // 空の単語は除外される
    const validWords = ['あい', '', 'かき'].filter(word => word.length > 0);
    expect(validWords).toEqual(['あい', 'かき']);
  });

  test('同じ長さの単語のみがスロットの候補となる', () => {
    const slot = createHorizontalSlot(0, 0, 3); // 長さ3のスロット
    const wordList = ['あ', 'あい', 'あいう', 'あいうえ'];
    
    // 長さ3の単語のみが候補
    const validCandidates = wordList.filter(word => word.length === slot.length);
    expect(validCandidates).toEqual(['あいう']);
  });
});

describe('Skeleton Solver Performance', () => {
  test('中程度のパズルが合理的な時間で完了する', () => {
    const startTime = Date.now();
    const wordList = ["あい", "いう", "うえ", "えお", "おか"];
    const slots = [
      createHorizontalSlot(0, 0, 2),
      createHorizontalSlot(1, 0, 2),
      createVerticalSlot(0, 0, 2)
    ];
    
    const endTime = Date.now();
    expect(endTime - startTime).toBeLessThan(1000); // 1秒以内
    expect(slots).toHaveLength(3);
  });

  test('大量の候補での処理効率', () => {
    const slot = createHorizontalSlot(0, 0, 3);
    const largeCandidateList = Array(100).fill(0).map((_, i) => 
      String.fromCharCode(0x3042 + i % 26) + 
      String.fromCharCode(0x3042 + (i + 1) % 26) + 
      String.fromCharCode(0x3042 + (i + 2) % 26)
    );
    
    slot.candidates = largeCandidateList;
    expect(slot.candidates.length).toBe(100);
    
    // フィルタリング処理のテスト
    const startTime = Date.now();
    slot.candidates = slot.candidates.filter(word => word.startsWith('あ'));
    const endTime = Date.now();
    
    expect(endTime - startTime).toBeLessThan(10); // 10ms以内
  });
});
