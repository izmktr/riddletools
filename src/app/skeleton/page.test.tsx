import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SkeletonPage from './page';
import {
  getConsecutiveCells,
  findIntersections,
  isValidPartialPlacement,
  isValidPlacement,
  placeWord,
  removeWord,
  countConstraints,
  solvePartial,
  solveConstraints,
  type CellState,
  type Word
} from './solver';

describe('SkeletonPage', () => {
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

  test('リセットボタンが動作する', () => {
    render(<SkeletonPage />);
    const resetButton = screen.getByText('リセット');
    fireEvent.click(resetButton);
    // リセット後の状態を確認
  });

  test('サンプルボタンが動作する', () => {
    render(<SkeletonPage />);
    const manualButton = screen.getByText('使い方');
    fireEvent.click(manualButton);
    const sampleButton = screen.getByText('サンプル');
    fireEvent.click(sampleButton);
    // サンプルデータが設定されることを確認
  });
});

describe('Skeleton Solver Logic', () => {
  test('横方向の連続セルを正しく検出する', () => {
    const board: CellState[][] = [
      ["white", "yellow", "yellow", "yellow", "white"],
      ["white", "white", "white", "white", "white"]
    ];
    const result = getConsecutiveCells(board, 5, 2);
    
    expect(result).toHaveLength(1);
    expect(result[0].direction).toBe("horizontal");
    expect(result[0].positions).toEqual([
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 3 }
    ]);
  });

  test('縦方向の連続セルを正しく検出する', () => {
    const board: CellState[][] = [
      ["white", "yellow", "white"],
      ["white", "yellow", "white"],
      ["white", "yellow", "white"],
      ["white", "white", "white"]
    ];
    const result = getConsecutiveCells(board, 3, 4);
    
    expect(result).toHaveLength(1);
    expect(result[0].direction).toBe("vertical");
    expect(result[0].positions).toEqual([
      { row: 0, col: 1 },
      { row: 1, col: 1 },
      { row: 2, col: 1 }
    ]);
  });

  test('交差点の検出が正しく動作する', () => {
    const slots: Word[] = [
      {
        text: "",
        positions: [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }],
        direction: "horizontal",
        candidates: null
      },
      {
        text: "",
        positions: [{ row: 0, col: 2 }, { row: 1, col: 2 }, { row: 2, col: 2 }],
        direction: "vertical",
        candidates: null
      }
    ];
    
    const intersections = findIntersections(slots);
    expect(intersections.size).toBe(1);
    expect(intersections.has("1-2")).toBe(true);
    
    const intersection = intersections.get("1-2");
    expect(intersection?.slots).toEqual([0, 1]);
    expect(intersection?.position).toEqual([1, 1]);
  });

  test('部分配置の制約チェックが正しく動作する', () => {
    const slot: Word = {
      text: "",
      positions: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }],
      direction: "horizontal",
      candidates: null
    };
    const grid = [
      ["", "あ", ""],
      ["", "", ""]
    ];
    
    // "かあき"は配置可能
    expect(isValidPartialPlacement(slot, "かあき", grid)).toBe(true);
    // "かいき"は配置不可（2文字目が一致しない）
    expect(isValidPartialPlacement(slot, "かいき", grid)).toBe(false);
  });

  test('単語の配置と削除が正しく動作する', () => {
    const slot: Word = {
      text: "",
      positions: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }],
      direction: "horizontal",
      candidates: null
    };
    const grid = [
      ["", "", ""],
      ["", "", ""]
    ];
    
    // 単語を配置
    placeWord(slot, "あいう", grid);
    expect(grid[0]).toEqual(["あ", "い", "う"]);
    
    // 単語を削除
    removeWord(slot, grid);
    expect(grid[0]).toEqual(["", "", ""]);
  });

  test('制約の数をカウントする', () => {
    const slot: Word = {
      text: "",
      positions: [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }],
      direction: "horizontal",
      candidates: null
    };
    const intersections = new Map([
      ["1-2", { slots: [0, 1], position: [1, 1] }]
    ]);
    
    const count = countConstraints(slot, intersections);
    expect(count).toBe(1);
  });
});


describe('Skeleton Solver Integration', () => {
  test('簡単なパズルが解ける', () => {
    const wordList = ["あい", "いう"];
    const slots: Word[] = [
      {
        text: "",
        positions: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
        direction: "horizontal",
        candidates: null
      },
      {
        text: "",
        positions: [{ row: 0, col: 1 }, { row: 1, col: 1 }],
        direction: "vertical",
        candidates: null
      }
    ];
    
    const result = solveConstraints(wordList, slots, 3, 3);
    expect(result).not.toBeNull();
    expect(result?.usedWords.size).toBe(2);
    expect(result?.usedWords.has("あい")).toBe(true);
    expect(result?.usedWords.has("いう")).toBe(true);
  });

  test('解けないパズルで部分解を返す', () => {
    const wordList = ["あああ", "いいい"];
    const slots: Word[] = [
      {
        text: "",
        positions: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
        direction: "horizontal",
        candidates: null
      }
    ];
    
    // 2文字のスロットに3文字の単語は入らない
    const result = solvePartial(wordList, slots, 3, 3);
    expect(result).toBeNull(); // 部分解も見つからない
  });

  test('部分解が正しく動作する', () => {
    const wordList = ["あい", "かき"];
    const slots: Word[] = [
      {
        text: "",
        positions: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
        direction: "horizontal",
        candidates: null
      },
      {
        text: "",
        positions: [{ row: 1, col: 0 }, { row: 1, col: 1 }],
        direction: "horizontal",
        candidates: null
      }
    ];
    
    const result = solvePartial(wordList, slots, 3, 3);
    expect(result).not.toBeNull();
    expect(result?.usedWords.size).toBeGreaterThan(0);
  });
});

describe('Skeleton Solver Performance', () => {
  test('中程度のパズルが合理的な時間で完了する', () => {
    const startTime = Date.now();
    const wordList = ["あい", "いう", "うえ", "えお", "おか"];
    const slots: Word[] = Array(3).fill(0).map((_, i) => ({
      text: "",
      positions: [{ row: i, col: 0 }, { row: i, col: 1 }],
      direction: "horizontal",
      candidates: null
    }));
    
    solveConstraints(wordList, slots, 5, 5);
    const endTime = Date.now();
    expect(endTime - startTime).toBeLessThan(1000); // 1秒以内
  });
});
