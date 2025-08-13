"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import pako from 'pako';

type CellState = "white" | "yellow";

interface Position {
  row: number;
  col: number;
}

interface Slot {
  positions: Position[];
  direction: "horizontal" | "vertical";
  length: number;
  candidates: string[];              /* 候補単語 */
  confirmedWord: string | null;      /* 確定した単語 */
}

interface Intersection{
  verticalSlots: Slot;
  verticalLetterPosition: number;
  horizontalSlots: Slot;
  horizontalLetterPosition: number;
}

interface ExportData {
  words: string;
  board: CellState[][];
}

interface CompressedData {
  words: string;
  board: {x: number, y: number, w: number, h: number, v: string};
}

const BOARD_WIDTH = 24;
const BOARD_HEIGHT = 16;

export default function SkeletonPage() {
  const [showManual, setShowManual] = useState(false);
  const [words, setWords] = useState("");
  const [board, setBoard] = useState<CellState[][]>(
    Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill("white"))
  );
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<CellState>("white");
  const [unusedWords, setUnusedWords] = useState<string[]>([]);
  const [solvedGrid, setSolvedGrid] = useState<string[][] | null>(null);
  const [exportUrl, setExportUrl] = useState<string>("");
  const [showExportModal, setShowExportModal] = useState(false);
  const [wordStats, setWordStats] = useState<{
    inputTotal: number;
    inputByLength: Map<number, number>;
    boardTotal: number;
    boardByLength: Map<number, number>;
  } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // データ解凍関数
  const decompressData = useCallback((compressed: string): ExportData | CompressedData | null => {
    // 1. URIエンコードされたJSONかチェック (フォールバック or 古い形式)
    if (compressed.startsWith('%7B') || compressed.startsWith('{')) {
      try {
        return JSON.parse(decodeURIComponent(compressed));
      } catch (e) {
        console.error('Failed to parse URI-encoded data:', e);
        return null;
      }
    }

    // これ以降はBase64エンコードされていると仮定
    let binaryString: string;
    try {
      // URL-safeなBase64を通常のBase64に戻す
      let base64 = compressed.replace(/-/g, '+').replace(/_/g, '/');

      // 削除されたパディングを復元
      while (base64.length % 4) {
        base64 += '=';
      }

      binaryString = atob(base64);
    } catch (e) {
      console.error('Failed to decode Base64 string:', e);
      return null;
    }

    // 2. 新しいpako形式を試す
    try {
      // バイナリ文字列をUint8Arrayに変換
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const restored = pako.inflate(bytes, { to: 'string' });
      const data = JSON.parse(restored);
      
      // 新しい圧縮形式のボードデータを復元
      if (data.board && typeof data.board === 'object' && 'x' in data.board) {
        data.board = restoreBoard(data.board);
      }
      
      return data;
    } catch (pakoError) {
      // pakoが失敗した場合
      console.error('Failed to decompress data with pako:', pakoError);
      return null;
    }
  }, []);

  // ページ読み込み時にURLパラメータから状態を復元
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const dataParam = urlParams.get('data');
    
    if (dataParam) {
      try {
        const data = decompressData(dataParam);
        
        if (data) {
          if (data.words) {
            setWords(data.words);
          }
          if (data.board && Array.isArray(data.board) && data.board.length === BOARD_HEIGHT) {
            setBoard(data.board);
          }
        }
      } catch (e) {
        console.error('Failed to restore data from URL:', e);
      }
    }
  }, [decompressData]);

  // データ圧縮関数
  const compressData = (data: ExportData): string => {
      try {
        // ボードデータを効率的な形式に変換
        const compressedData = {
          words: data.words,
          board: compressBoard(data.board)
        };
        
        const jsonString = JSON.stringify(compressedData);
        // pakoを使用してzlib互換の圧縮を実行 (Uint8Array)
        const compressed = pako.deflate(jsonString);

        // Uint8Arrayをbtoaで扱えるバイナリ文字列に変換
        const binaryString = Array.from(compressed).map(byte => String.fromCharCode(byte)).join('');

        // Base64エンコードし、URL-safeな形式に変換
        return btoa(binaryString)
          .replace(/\+/g, '-') // + -> -
          .replace(/\//g, '_') // / -> _
          .replace(/=/g, '');  // パディングを削除
      } catch (e) {
        console.error('Failed to compress data:', e);
        // 圧縮に失敗した場合は、フォールバックとして単純なURIエンコードを行う
        return encodeURIComponent(JSON.stringify(data));
      }
  };

  // ボードを効率的に圧縮、復元する関数
  const compressBoard = (board: CellState[][]): {x: number, y: number, w: number, h: number, v: string} => {
    // 黄色のマスの範囲を特定
    let minX = BOARD_WIDTH, maxX = -1;
    let minY = BOARD_HEIGHT, maxY = -1;
    
    for (let row = 0; row < BOARD_HEIGHT; row++) {
      for (let col = 0; col < BOARD_WIDTH; col++) {
        if (board[row][col] === "yellow") {
          minX = Math.min(minX, col);
          maxX = Math.max(maxX, col);
          minY = Math.min(minY, row);
          maxY = Math.max(maxY, row);
        }
      }
    }
    
    // 黄色のマスがない場合
    if (maxX === -1) {
      return {x: 0, y: 0, w: 0, h: 0, v: ""};
    }
    
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    
    // 範囲内のデータを文字列に変換
    let valueString = "";
    for (let row = minY; row <= maxY; row++) {
      for (let col = minX; col <= maxX; col++) {
        valueString += board[row][col] === "yellow" ? "1" : "0";
      }
    }
    
    return {
      x: minX,
      y: minY,
      w: width,
      h: height,
      v: valueString
    };
  };

  const restoreBoard = (compressed: {x: number, y: number, w: number, h: number, v: string}): CellState[][] => {
    // 初期化（全て白）
    const board: CellState[][] = Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill("white"));
    
    // データがない場合は白いボードを返す
    if (compressed.w === 0 || compressed.h === 0 || !compressed.v) {
      return board;
    }
    
    // 圧縮されたデータを復元
    let index = 0;
    for (let row = 0; row < compressed.h; row++) {
      for (let col = 0; col < compressed.w; col++) {
        if (index < compressed.v.length) {
          const boardRow = compressed.y + row;
          const boardCol = compressed.x + col;
          
          // ボード範囲内かチェック
          if (boardRow >= 0 && boardRow < BOARD_HEIGHT && boardCol >= 0 && boardCol < BOARD_WIDTH) {
            board[boardRow][boardCol] = compressed.v[index] === "1" ? "yellow" : "white";
          }
          index++;
        }
      }
    }
    
    return board;
  };

  // エクスポート機能
  const handleExport = () => {
    const data = {
      words: words,
      board: board
    };
    
    const compressed = compressData(data);
    const baseUrl = window.location.origin + window.location.pathname;
    const url = `${baseUrl}?data=${compressed}`;
    setExportUrl(url);
    setShowExportModal(true);
  };

  // クリップボードにコピー
  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(exportUrl);
      alert('URLをクリップボードにコピーしました！');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      alert('コピーに失敗しました。URLを手動でコピーしてください。');
    }
  };

  // サンプル挿入用
  const handleSample = () => {
    setWords("かんでんち\nでんわせん\nわしんとん\nかしわ\nわだい");
    // サンプル用のボード設定（十字の形）
    const newBoard = Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill("white"));
    const sampleBoard = [
      [1, 1, 1, 1, 1],
      [0, 0, 1, 0, 0],
      [1, 0, 1, 1, 1],
      [1, 0, 1, 0, 0],
      [1, 1, 1, 1, 1],
    ];
    for (let col = 0; col < 5; col++) {
      for (let row = 0; row < 5; row++) {
        if (sampleBoard[row][col] === 1) {
          newBoard[row + 5][col + 9] = "yellow";
        }
      }
    }
    setBoard(newBoard);
    // 解析結果もクリア
    setUnusedWords([]);
    setSolvedGrid(null);
    setWordStats(null);
    setShowManual(false);
  };

  // リセット
  const handleReset = () => {
    setWords("");
    setBoard(Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill("white")));
    setUnusedWords([]);
    setSolvedGrid(null);
    setWordStats(null);
  };

  // マスのクリック
  const handleCellClick = (row: number, col: number) => {
    const newBoard = [...board];
    newBoard[row][col] = newBoard[row][col] === "white" ? "yellow" : "white";
    setBoard(newBoard);
  };

  // ドラッグ開始
  const handleMouseDown = (row: number, col: number) => {
    setIsDragging(true);
    const currentState = board[row][col];
    setDragMode(currentState === "white" ? "yellow" : "white");
    handleCellClick(row, col);
  };

  // ドラッグ中
  const handleMouseEnter = (row: number, col: number) => {
    if (isDragging) {
      const newBoard = [...board];
      newBoard[row][col] = dragMode;
      setBoard(newBoard);
    }
  };

  // ドラッグ終了
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 連続するマスを取得
  const getConsecutiveCells = (): Slot[] => {
    const words: Slot[] = [];
    
    // 横方向をチェック
    for (let row = 0; row < BOARD_HEIGHT; row++) {
      let start = -1;
      for (let col = 0; col <= BOARD_WIDTH; col++) {
        if (col < BOARD_WIDTH && board[row][col] === "yellow") {
          if (start === -1) start = col;
        } else {
          if (start !== -1 && col - start >= 2) {
            const positions: Position[] = [];
            for (let c = start; c < col; c++) {
              positions.push({ row, col: c });
            }
            words.push({
              positions,
              direction: "horizontal",
              length: col - start,
              candidates: [],
              confirmedWord: null
            });
          }
          start = -1;
        }
      }
    }

    // 縦方向をチェック
    for (let col = 0; col < BOARD_WIDTH; col++) {
      let start = -1;
      for (let row = 0; row <= BOARD_HEIGHT; row++) {
        if (row < BOARD_HEIGHT && board[row][col] === "yellow") {
          if (start === -1) start = row;
        } else {
          if (start !== -1 && row - start >= 2) {
            const positions: Position[] = [];
            for (let r = start; r < row; r++) {
              positions.push({ row: r, col });
            }
            words.push({
              positions,
              direction: "vertical",
              length: row - start,
              candidates: [],
              confirmedWord: null
            });
          }
          start = -1;
        }
      }
    }

    return words;
  };

  // 交差点を見つける
  const findIntersections = (slots: Slot[]): Intersection[] => {
    const intersections: Intersection[] = [];

    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const slot1 = slots[i];
        const slot2 = slots[j];
        const intersection = createIntersection(slot1, slot2);
        if (intersection) {
          intersections.push(intersection);
        }
      }
    }

    return intersections;
  };

  // 単語統計を計算
  const calculateWordStats = (inputWords: string[], slots: Slot[]) => {
    const inputByLength = new Map<number, number>();
    const boardByLength = new Map<number, number>();

    // 入力単語の統計
    inputWords.forEach(word => {
      const length = word.length;
      inputByLength.set(length, (inputByLength.get(length) || 0) + 1);
    });

    // ボードのスロット統計
    slots.forEach(slot => {
      const length = slot.length;
      boardByLength.set(length, (boardByLength.get(length) || 0) + 1);
    });

    return {
      inputTotal: inputWords.length,
      inputByLength,
      boardTotal: slots.length,
      boardByLength
    };
  };

  // 高度な解析実行
  const handleAnalyze = () => {
    const wordList = words.split(/\r?\n/).map((w: string) => w.trim()).filter(Boolean);
    const slots = getConsecutiveCells();
    
    // 文字数別に単語を分ける
    const lengthMap = createLengthMap(wordList);

    // 交差点を事前計算
    const intersections = findIntersections(slots);

    // 制約解法
    const result = solveConstraints(lengthMap, slots, intersections);

    if (result) {
      // 使われなかった単語
      const unused = wordList.filter((w: string) => !result.usedWords.has(w));
      setUnusedWords(unused);
      
      // 解析結果をボードに表示
      setSolvedGrid(result.grid);
      
      // 統計情報を計算
      setWordStats(calculateWordStats(wordList, slots));
    } else {
      // 完全解が見つからない場合でも部分解を試す
      const partialResult = solvePartial(wordList, slots);
      if (partialResult) {
        const unused = wordList.filter((w: string) => !partialResult.usedWords.has(w));
        setUnusedWords([...unused, "（部分解析結果）"]);
        setSolvedGrid(partialResult.grid);
        
        // 統計情報を計算
        setWordStats(calculateWordStats(wordList, slots));
      } else {
        setUnusedWords(["解が見つかりませんでした"]);
        setSolvedGrid(null);
        setWordStats(null);
      }
    }
  };

  const createIntersection = (slot1: Slot, slot2: Slot): Intersection | null => {
    // 同じ方向のスロットは交差しない
    if (slot1.direction === slot2.direction) {
      return null;
    }

    // slot1を横、slot2を縦として処理を統一
    let horizontalSlot = slot1;
    let verticalSlot = slot2;
    
    // slot1が縦の場合は交換
    if (slot1.direction === "vertical") {
      horizontalSlot = slot2;
      verticalSlot = slot1;
    }

    const horizontalRow = horizontalSlot.positions[0].row;
    const verticalCol = verticalSlot.positions[0].col;
    
    // 横線の範囲
    const horizontalStart = horizontalSlot.positions[0].col;
    const horizontalEnd = horizontalSlot.positions[horizontalSlot.positions.length - 1].col;
    
    // 縦線の範囲
    const verticalStart = verticalSlot.positions[0].row;
    const verticalEnd = verticalSlot.positions[verticalSlot.positions.length - 1].row;
    
    // 交差するかチェック
    if (verticalCol >= horizontalStart && verticalCol <= horizontalEnd &&
        horizontalRow >= verticalStart && horizontalRow <= verticalEnd) {
      
      return {
        verticalSlots: verticalSlot,
        verticalLetterPosition: horizontalRow - verticalStart,
        horizontalSlots: horizontalSlot,
        horizontalLetterPosition: verticalCol - horizontalStart
      };
    }

    return null;
  };

  // 部分的な解析（制約を緩和）
  const solvePartial = (wordList: string[], slots: Slot[]): { grid: string[][], usedWords: Set<string> } | null => {
    const grid: string[][] = Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(""));
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

  // 部分配置での制約チェック（より緩い）
  const isValidPartialPlacement = (slot: Slot, word: string, grid: string[][]): boolean => {
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

  // 交点に入る文字を確定し、そこから、Slotに入りうる候補を探していく
  const intersectionLetter = (intersection: Intersection) => {
    // 両方とも確定済みなら何もしない
    if (intersection.verticalSlots.confirmedWord && intersection.horizontalSlots.confirmedWord) return;

    //　縦のスロットに入りうる文字の一覧
    const verticalLetters = new Set<string>(
      intersection.verticalSlots.confirmedWord ?
        [intersection.verticalSlots.confirmedWord[intersection.verticalLetterPosition]] :
        intersection.verticalSlots.candidates.map(c => c[intersection.verticalLetterPosition])
    );

    // 横のスロットに入りうる文字の一覧
    const horizontalLetters = new Set<string>(
      intersection.horizontalSlots.confirmedWord ?
        [intersection.horizontalSlots.confirmedWord[intersection.horizontalLetterPosition]] :
        intersection.horizontalSlots.candidates.map(c => c[intersection.horizontalLetterPosition])
    );

    // 交差点の文字を抽出
    const letters = verticalLetters.intersection(horizontalLetters);

    // まだ未確定なら情報を絞る
    if (!intersection.verticalSlots.confirmedWord){
      // 交点の文字から、候補の単語を抽出する
      intersection.verticalSlots.candidates = intersection.verticalSlots.candidates.filter(word => 
        letters.has(word[intersection.verticalLetterPosition])
      );
    }

    if (!intersection.horizontalSlots.confirmedWord){
      // 交点の文字から、候補の単語を抽出する
      intersection.horizontalSlots.candidates = intersection.horizontalSlots.candidates.filter(word => 
        letters.has(word[intersection.horizontalLetterPosition])
      );
    } 

  }

  const createLengthMap = (wordList: string[]) => {
    const lengthMap = new Map<number, string[]>();
    for (const word of wordList) {
      const length = word.length;
      if (!lengthMap.has(length)) {
        lengthMap.set(length, [word]);
      } else {
        lengthMap.get(length)!.push(word);
      }
    }
    return lengthMap;
  }


  // 各スロットに確定した文字を探して入れていく
  const solveConstraints = (lengthMap: Map<number, string[]>, slots: Slot[], intersections: Intersection[]):
   { grid: string[][], usedWords: Set<string> } | null => {
    const grid: string[][] = Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(""));

    // 各スロットに候補を設定
    for (const slot of slots) {
      slot.candidates = lengthMap.get(slot.length) ?? [];
    }

    // すべての交点に対して、交差する文字から候補を絞る
    for (const intersection of intersections) {
      intersectionLetter(intersection);
    }

    // スロットのうち、候補が1個しかないものをuseListに追加する
    // 確定できる単語を順次配置していく（無限ループ）
    while (true) {
      const trashSlots : Slot[] = [];
      
      // 候補が1個しかないスロットを確定
      slots.forEach(slot => {
        if (slot.confirmedWord == null && slot.candidates.length === 1) {
          slot.confirmedWord = slot.candidates[0];
          trashSlots.push(slot);
        }
      });

      if (trashSlots.length === 0) {
        break; // これ以上確定できる単語がない
      }

      // 確定したスロットを持つ交点から絞り込みをする
      for (const intersection of intersections) {
        if (trashSlots.some(slot => slot === intersection.verticalSlots || slot === intersection.horizontalSlots)) {
          intersectionLetter(intersection);
        }
      }

      // 確定した単語を候補から除外
      for (const s of slots) {
        if (s.confirmedWord === null) {
          s.candidates = s.candidates.filter(
            candidate => trashSlots.every(trash => trash.confirmedWord !== candidate)
          );
        }
      }
    }

  // 確定した単語をグリッドに配置
    const usedWords = new Set<string>();
    for (const slot of slots) {
      if (slot.confirmedWord) {
        placeWord(slot, slot.confirmedWord, grid);
        usedWords.add(slot.confirmedWord);
      }
    }

    return { grid, usedWords };

  };

  // 単語を配置
  const placeWord = (slot: Slot, word: string, grid: string[][]) => {
    for (let i = 0; i < word.length; i++) {
      const pos = slot.positions[i];
      grid[pos.row][pos.col] = word[i];
    }
  };

  // 制約数をカウント（ヒューリスティック用）
  const countConstraints = (slot: Slot, intersections: Intersection[]): number => {
    let count = 0;
    for (const intersection of intersections) {
      // このスロットが交差点のペアに含まれているかを直接チェックする
      if (intersection.horizontalSlots === slot || intersection.verticalSlots === slot) {
        count++;
      }
    }
    return count;
  };

  return (
    <main className="max-w-4xl mx-auto p-6">
      <div className="mb-4">
        <Link href="/" className="text-blue-500 hover:text-blue-700 text-sm">
          ← トップに戻る
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-4">スケルトンソルバー</h1>
      <div className="flex items-center mb-4 gap-2">
        <button
          className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200"
          onClick={() => setShowManual(true)}
        >使い方</button>
      </div>
      
      {showManual && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 max-w-lg w-full relative">
            <button
              className="absolute top-2 right-2 px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => setShowManual(false)}
            >閉じる</button>
            <h3 className="text-xl font-bold mb-2">スケルトンソルバーの使い方</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm mb-4">
              <li>単語入力領域に候補単語を改行区切りで入力してください。</li>
              <li>ボード領域でマスをクリックして黄色にし、単語を配置する場所を指定してください。</li>
              <li>ドラッグで複数のマスを一度に切り替えできます。</li>
              <li>解析ボタンで、連続する黄色マスに単語を配置します。</li>
              <li>使われなかった単語は下部に表示されます。</li>
            </ul>
            <button
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 mr-2"
              onClick={handleSample}
            >サンプル</button>
          </div>
        </div>
      )}

      {/* エクスポートモーダル */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 max-w-2xl w-full relative">
            <button
              className="absolute top-2 right-2 px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => setShowExportModal(false)}
            >閉じる</button>
            <h3 className="text-xl font-bold mb-4">エクスポート</h3>
            <p className="mb-4 text-sm text-gray-600">
              以下のURLを共有することで、現在の盤面と単語の状態を他の人と共有できます。
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                共有URL:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={exportUrl}
                  readOnly
                  className="flex-1 p-2 border rounded bg-gray-50 text-sm"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  onClick={handleCopyToClipboard}
                >
                  コピー
                </button>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              <p>※ URLには盤面の配置と入力された単語が含まれています</p>
              <p>※ 解析結果は含まれませんので、共有先で再度解析を実行してください</p>
            </div>
          </div>
        </div>
      )}

      <h2 className="text-2xl font-bold mb-4">スケルトンソルバー</h2>
      
      <div className="mb-4">
        <h3 className="font-semibold mb-2">単語入力</h3>
        <textarea
          className="w-full h-32 p-2 border rounded"
          value={words}
          onChange={e => setWords(e.target.value)}
          placeholder="単語を改行で区切って入力してください"
        />
      </div>

      <div className="mb-4 flex gap-2">
        <button
          className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
          onClick={handleReset}
        >リセット</button>
        <button
          className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          onClick={handleAnalyze}
        >解析</button>
        <button
          className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200"
          onClick={handleExport}
        >エクスポート</button>
      </div>

      <div className="mb-4">
        <h3 className="font-semibold mb-2">ボード（クリック・ドラッグで黄色/白を切り替え）</h3>
        <div 
          ref={boardRef}
          className="inline-block border-2 border-gray-400 select-none"
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {board.map((row, rowIndex) => (
            <div key={rowIndex} className="flex">
              {row.map((cell, colIndex) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={`w-6 h-6 border border-gray-300 cursor-pointer flex items-center justify-center text-xs font-bold ${
                    cell === "yellow" ? "bg-yellow-200" : "bg-white"
                  }`}
                  onMouseDown={() => handleMouseDown(rowIndex, colIndex)}
                  onMouseEnter={() => handleMouseEnter(rowIndex, colIndex)}
                >
                  {solvedGrid && solvedGrid[rowIndex][colIndex] ? solvedGrid[rowIndex][colIndex] : ""}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* 統計情報表示 */}
      {wordStats && (
        <div className="mb-4 p-4 border rounded bg-blue-50">
          <h3 className="font-semibold mb-2">単語統計</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-sm mb-1">入力単語 (総数: {wordStats.inputTotal}個)</h4>
              <div className="text-sm">
                {Array.from(wordStats.inputByLength.entries())
                  .sort(([a], [b]) => a - b)
                  .map(([length, count]) => (
                    <span key={length} className="inline-block mr-3">
                      {length}文字: {count}個
                    </span>
                  ))}
              </div>
            </div>
            <div>
              <h4 className="font-medium text-sm mb-1">ボードのマス (総数: {wordStats.boardTotal}個)</h4>
              <div className="text-sm">
                {Array.from(wordStats.boardByLength.entries())
                  .sort(([a], [b]) => a - b)
                  .map(([length, count]) => (
                    <span key={length} className="inline-block mr-3">
                      {length}文字: {count}個
                    </span>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {unusedWords.length > 0 && (
        <div>
          <h3 className="font-semibold mb-2">
            {unusedWords.includes("（部分解析結果）") ? "部分解析結果 - 使われなかった単語" : "使われなかった単語"}
          </h3>
          <div className="p-2 border rounded bg-gray-50">
            {unusedWords.join("、")}
          </div>
          {unusedWords.includes("（部分解析結果）") && (
            <div className="mt-2 text-sm text-orange-600">
              ※ 完全解が見つからなかったため、制約を満たす範囲で部分的に配置しました
            </div>
          )}
        </div>
      )}
    </main>
  );
}
