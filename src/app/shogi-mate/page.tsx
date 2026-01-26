"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

type PieceType = '歩' | '香' | '桂' | '銀' | '金' | '王' | '玉' | '飛' | '角' | 'と' | '成香' | '成桂' | '成銀' | '龍' | '馬' | null;
type Side = 'self' | 'opponent' | null;
type Status = 'none' | 'success' | 'failure' | 'done';

interface Piece {
  type: PieceType;
  side: Side;
}

const PIECE_TYPES: PieceType[] = ['歩', '香', '桂', '銀', '金', '王', '飛', '角'];

// 成り駒の対応
const PROMOTED_MAP: {[key: string]: PieceType} = {
  '歩': 'と',
  '香': '成香',
  '桂': '成桂',
  '銀': '成銀',
  '飛': '龍',
  '角': '馬',
};

// 成り駒から元の駒への逆引き
const UNPROMOTED_MAP: {[key: string]: PieceType} = {
  'と': '歩',
  '成香': '香',
  '成桂': '桂',
  '成銀': '銀',
  '龍': '飛',
  '馬': '角',
};

// 遠距離ユニット
const LONG_RANGE_PIECES: PieceType[] = ['飛', '角', '龍', '馬', '香'];

// 数字を漢数字に変換
const KANJI_NUMBERS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

// --- Zobrist Hashing ---
const ALL_PIECE_TYPES_FOR_ZOBRIST = [...Object.keys(PROMOTED_MAP), ...Object.keys(UNPROMOTED_MAP), '王', '玉'] as PieceType[];
const CAPTURABLE_PIECES_FOR_ZOBRIST = ['歩', '香', '桂', '銀', '金', '飛', '角'] as PieceType[];

const zobristKeys = {
  board: new Map<PieceType, bigint[][]>(),
  captured: new Map<PieceType, bigint>(),
  turn: 0n,
};

let zobristInitialized = false;

function initZobrist() {
  if (zobristInitialized) return;

  const randomBigInt = () => BigInt(Math.floor(Math.random() * 2**32)) << 32n | BigInt(Math.floor(Math.random() * 2**32));

  ALL_PIECE_TYPES_FOR_ZOBRIST.forEach(pt => {
    if (!pt) return;
    const pieceKeys: bigint[][] = Array(9).fill(null).map(() => Array(9).fill(0n));
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        pieceKeys[r][c] = randomBigInt();
      }
    }
    zobristKeys.board.set(pt, pieceKeys);
  });

  CAPTURABLE_PIECES_FOR_ZOBRIST.forEach(pt => {
    zobristKeys.captured.set(pt, randomBigInt());
  });

  zobristKeys.turn = randomBigInt();
  zobristInitialized = true;
}
// --- End Zobrist Hashing ---


export default function ShogiMatePage() {
  const [board, setBoard] = useState<(Piece | null)[][]>(() => 
    Array(9).fill(null).map(() => Array(9).fill(null))
  );
  // ... (rest of the state declarations are unchanged)
  const [selectedCell, setSelectedCell] = useState<{row: number, col: number} | null>(null);
  const [capturedPieces, setCapturedPieces] = useState<PieceType[]>([]);
  const [selectedCapturedIndex, setSelectedCapturedIndex] = useState<number | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [exportText, setExportText] = useState("");
  const [importText, setImportText] = useState("");
  const [solutionSteps, setSolutionSteps] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [initialField, setInitialField] = useState<Field | null>(null);
  const [rootMoves, setRootMoves] = useState<MovePiece[]>([]);
  const [currentPath, setCurrentPath] = useState<MovePiece[]>([]);
  const [solutionPath, setSolutionPath] = useState<MovePiece[] | null>(null);
  const [selectedPieceInView, setSelectedPieceInView] = useState<Coordinate | PieceType | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<Coordinate | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<{queueSize: number, maxDepth: number} | null>(null);


  // ページタイトルとZobristキーを設定
  useEffect(() => {
    document.title = "詰将棋ソルバー | RiddleTools";
    initZobrist();
  }, []);

  // 盤面のセルをクリック
  const handleCellClick = (row: number, col: number) => {
    setSelectedCell({row, col});
    setSelectedCapturedIndex(null);
  };
  // ... (the rest of the component is the same until Field class)

  // 持ち駒をクリック
  const handleCapturedClick = (index: number) => {
    setSelectedCapturedIndex(index);
    setSelectedCell(null);
  };

  // 駒を配置（既に駒がある場合は上書き、同じ駒なら成り駒に）
  const handlePlacePiece = (pieceType: PieceType, side: Side) => {
    // 持ち駒への配置
    if (selectedCapturedIndex !== null) {
      if (side !== 'self') {
        alert("持ち駒には自分の駒だけ配置できます");
        return;
      }
      const newCaptured = [...capturedPieces];
      // 成り駒は元の駒に戻して配置
      let actualPiece = pieceType;
      if (pieceType && pieceType in UNPROMOTED_MAP) {
        actualPiece = UNPROMOTED_MAP[pieceType as string];
      }
      newCaptured[selectedCapturedIndex] = actualPiece;
      setCapturedPieces(newCaptured);
      // 新しい空欄を選択
      setSelectedCapturedIndex(newCaptured.length);
      return;
    }
    
    if (!selectedCell) return;
    
    const {row, col} = selectedCell;
    const currentPiece = board[row][col];
    
    const newBoard = board.map(r => [...r]);
    
    // 既に同じ駒がある場合、成り駒に変換
    if (currentPiece && currentPiece.side === side) {
      // 現在の駒が成り駒かどうかチェック
      const isCurrentPromoted = currentPiece.type && currentPiece.type in UNPROMOTED_MAP;
      const isCurrentUnpromoted = currentPiece.type && currentPiece.type in PROMOTED_MAP;
      
      // 配置しようとしている駒が成り駒かどうかチェック
      const isPlacingPromoted = pieceType && pieceType in UNPROMOTED_MAP;
      const isPlacingUnpromoted = pieceType && pieceType in PROMOTED_MAP;
      
      // 現在の駒と配置しようとしている駒が同じかチェック
      let isSamePiece = currentPiece.type === pieceType;
      
      // 成り駒と元の駒の関係をチェック
      if (!isSamePiece && isCurrentPromoted && isPlacingUnpromoted) {
        isSamePiece = UNPROMOTED_MAP[currentPiece.type as string] === pieceType;
      }
      if (!isSamePiece && isCurrentUnpromoted && isPlacingPromoted) {
        isSamePiece = PROMOTED_MAP[currentPiece.type as string] === pieceType;
      }
      
      if (isSamePiece) {
        // 同じ駒の場合、成り駒に変換
        if (isCurrentUnpromoted && pieceType && pieceType in PROMOTED_MAP) {
          // 元の駒 → 成り駒
          const promoted = PROMOTED_MAP[pieceType as string];
          newBoard[row][col] = { type: promoted, side };
        } else if (isCurrentPromoted && currentPiece.type && currentPiece.type in UNPROMOTED_MAP) {
          // 成り駒 → 元の駒（トグル）
          const unpromoted = UNPROMOTED_MAP[currentPiece.type as string];
          newBoard[row][col] = { type: unpromoted, side };
        } else {
          // 金や王（玉）は変化なし
          newBoard[row][col] = { type: pieceType, side };
        }
        setBoard(newBoard);
        return;
      }
    }
    
    // それ以外の場合は普通に配置
    newBoard[row][col] = { type: pieceType, side };
    setBoard(newBoard);
  };

  // 駒を削除
  const handleDeletePiece = () => {
    // 持ち駒の削除
    if (selectedCapturedIndex !== null) {
      const newCaptured = capturedPieces.filter((_, i) => i !== selectedCapturedIndex);
      setCapturedPieces(newCaptured);
      setSelectedCapturedIndex(null);
      return;
    }
    
    if (!selectedCell) return;
    
    const {row, col} = selectedCell;
    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = null;
    setBoard(newBoard);
  };

  // 駒の表示（相手の駒は180度回転）
  const renderPiece = (piece: Piece | null) => {
    if (!piece) return '';
    
    // 成り駒かどうか判定
    const isPromoted = piece.type! in UNPROMOTED_MAP;
    
    // 相手の駒は180度回転
    if (piece.side === 'opponent') {
      return (
        <span className={`inline-block ${isPromoted ? 'underline underline-offset-4' : ''}`} style={{transform: 'rotate(180deg)'}}>
          {piece.type}
        </span>
      );
    }
    
    return <span className={isPromoted ? 'underline underline-offset-4' : ''}>{piece.type}</span>;
  };

  // リセット
  const handleReset = () => {
    setBoard(Array(9).fill(null).map(() => Array(9).fill(null)));
    setSelectedCell(null);
    setCapturedPieces([]);
    setSelectedCapturedIndex(null);
    setViewMode(false);
    setSolutionSteps([]);
    setRootMoves([]);
    setCurrentPath([]);
    setSolutionPath(null);
    setSelectedPieceInView(null);
    setSelectedDestination(null);
  };

  // 入力に戻る
  const handleBackToInput = () => {
    setViewMode(false);
    setCurrentPath([]);
    setSolutionPath(null);
    setRootMoves([]);
    setSelectedPieceInView(null);
    setSelectedDestination(null);
  };

  // 前の手に戻る
  const handlePrevStep = () => {
    if (currentPath.length > 0) {
      setCurrentPath(currentPath.slice(0, -1));
      setSelectedPieceInView(null);
      setSelectedDestination(null);
    }
  };

  // 0手目（初期状態）に戻る
  const handleResetToStart = () => {
    setCurrentPath([]);
    setSelectedPieceInView(null);
    setSelectedDestination(null);
  };

  // 次の手に進む（詰み筋がある場合のみ）
  const handleNextStep = () => {
    if (solutionPath && currentPath.length < solutionPath.length) {
      const nextMove = solutionPath[currentPath.length];
      setCurrentPath([...currentPath, nextMove]);
      setSelectedPieceInView(null);
      setSelectedDestination(null);
    }
  };

  // 手を選択
  const handleSelectMove = (move: MovePiece) => {
    setCurrentPath([...currentPath, move]);
    setSelectedPieceInView(null);
    setSelectedDestination(null);
  };

  // エクスポート処理
  const handleExport = () => {
    let text = "";
    // 盤面データ
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        const piece = board[y][x];
        if (piece) {
          const side = piece.side === 'self' ? 'S' : 'O';
          text += `${x + 1} ${y + 1} ${side} ${piece.type}\n`;
        }
      }
    }
    // 持ち駒データ
    if (capturedPieces.length > 0) {
      text += "CAPTURED: " + capturedPieces.join(",") + "\n";
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
      const newBoard: (Piece | null)[][] = Array(9).fill(null).map(() => Array(9).fill(null));
      const newCaptured: PieceType[] = [];

      for (const line of lines) {
        if (!line.trim()) continue;
        
        if (line.startsWith('CAPTURED:')) {
          const captured = line.substring(9).trim().split(',');
          captured.forEach(p => {
            const piece = p.trim() as PieceType;
            if (piece) newCaptured.push(piece);
          });
        } else {
          const parts = line.trim().split(/\s+/);
          if (parts.length !== 4) continue;
          
          const [x, y, side, pieceType] = parts;
          const col = parseInt(x) - 1;
          const row = parseInt(y) - 1;
          
          if (col >= 0 && col < 9 && row >= 0 && row < 9) {
            newBoard[row][col] = {
              type: pieceType as PieceType,
              side: side === 'S' ? 'self' : 'opponent'
            };
          }
        }
      }

      setBoard(newBoard);
      setCapturedPieces(newCaptured);
      setShowImport(false);
      alert("インポートしました！");
    } catch {
      alert("インポートに失敗しました。形式を確認してください。");
    }
  };

  // 解析処理
  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setSolutionSteps([]);
    setAnalysisProgress({ queueSize: 0, maxDepth: 0 });
    
    const timeoutMs = 30000; // 30秒でタイムアウト
    const abortController = new AbortController();
    
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, timeoutMs);
    
    try {
      const result = await analyzeMateAsync(board, capturedPieces, abortController.signal, (progress) => {
        setAnalysisProgress({ queueSize: progress.nodeCount, maxDepth: progress.maxDepth });
      });
      clearTimeout(timeoutId);
      
      setInitialField(result.initialField);
      setRootMoves(result.rootMoves);
      
      // UIをビューモードに移行
      setViewMode(true);
      setCurrentPath([]);
      
      if (result.moves.length > 0) {
        setSolutionPath(result.moves);
        setSolutionSteps(result.steps);
        alert(`詰み発見！ ${result.moves.length}手詰`);
      } else if (result.timedOut) {
        setSolutionPath(null);
        const queueInfo = `タイムアウトしました\n\n` +
          `探索した手数: 最大${result.maxStepReached ?? 0}手目まで\n\n` +
          `※ 現在の解析状態をビューモードで確認できます`;
        alert(queueInfo);
      } else {
        setSolutionPath(null);
        alert('詰みが見つかりませんでした');
      }
    } catch (error) {
      if (error instanceof Error && error.message !== "Timeout") {
        alert('エラーが発生しました: ' + error.message);
      } else if (abortController.signal.aborted) {
         setSolutionPath(null);
         alert('解析がタイムアウトしました。');
      }
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(null);
    }
  };

  // 座標クラス
  class Coordinate {
    row: number;
    col: number;
    constructor(row: number, col: number) {
      this.row = row;
      this.col = col;
    }

    isEnemyField(): boolean {
      return this.row <= 2;
    }

    hash(): number {
      return this.row * 9 + this.col;
    }

    static fromHash(hash: number): Coordinate {
      return new Coordinate(Math.floor(hash / 9), hash % 9);
    }

    equals(other: Coordinate): boolean {
      return this.row === other.row && this.col === other.col;
    }

    toString(): string {
      return `${9 - this.col}${KANJI_NUMBERS[this.row + 1]}`;
    }
  }
  
  // 手を保存するクラス
  class MovePiece {
    step: number;
    piece: PieceType
    from: Coordinate | null;
    to: Coordinate;
    change : boolean;
    // UI表示用に、次の手の候補を保持する
    nextMove: MovePiece[] = [];

    constructor(step: number, piece: PieceType, from: Coordinate | null, to: Coordinate, change: boolean = false) {
      this.step = step;
      this.piece = piece;
      this.from = from;
      this.to = to;
      this.change = change;
    }

    IsDrop(): boolean {
      return this.from === null;
    }

    IsSelfStep(): boolean {
      return this.step % 2 === 0;
    }
  }

  // 座標と駒タイプのペア
  class PiecePosition {
    position: Coordinate;
    piece: PieceType;
    constructor(position: Coordinate, piece: PieceType) {
      this.position = position;
      this.piece = piece;
    }
  }

  // フィールドクラス
  class Field {
    opponentking: PiecePosition;
    opponentpieces: PiecePosition[];
    selfpieces: PiecePosition[];
    capturedPieces: Map<PieceType, number>;
    zobristKey: bigint;

    constructor(opponentking: PiecePosition, opponentpieces: PiecePosition[], selfpieces: PiecePosition[], capturedPieces: Map<PieceType, number> = new Map(), zobristKey: bigint = 0n) {
      this.opponentking = opponentking;
      this.opponentpieces = opponentpieces;
      this.selfpieces = selfpieces;
      this.capturedPieces = capturedPieces;
      this.zobristKey = zobristKey;
    }
    
    clone(): Field {
      const cloneCoordinate = (coord: Coordinate): Coordinate => new Coordinate(coord.row, coord.col);
      const clonePiecePosition = (pp: PiecePosition): PiecePosition => new PiecePosition(cloneCoordinate(pp.position), pp.piece);
      
      const newOpponentKing = clonePiecePosition(this.opponentking);
      const newOpponentPieces = this.opponentpieces.map(clonePiecePosition);
      const newSelfPieces = this.selfpieces.map(clonePiecePosition);
      const newCapturedPieces = new Map(this.capturedPieces);
      
      return new Field(newOpponentKing, newOpponentPieces, newSelfPieces, newCapturedPieces, this.zobristKey);
    }

    applyMove(move: MovePiece): Field {
        const newField = this.clone();
        const { piece, from, to, change, IsSelfStep, IsDrop } = move;

        let key = newField.zobristKey;
        key ^= zobristKeys.turn; // Flip turn

        const moverSide = IsSelfStep() ? newField.selfpieces : newField.opponentpieces;
        const opponentSide = IsSelfStep() ? newField.opponentpieces : newField.selfpieces;

        if (IsDrop()) {
            key ^= zobristKeys.board.get(piece!)![to.row][to.col];
            moverSide.push(new PiecePosition(to, piece));
            if (IsSelfStep()) {
                key ^= zobristKeys.captured.get(piece!)!;
                const currentCount = newField.capturedPieces.get(piece!)! - 1;
                if (currentCount === 0) newField.capturedPieces.delete(piece!);
                else newField.capturedPieces.set(piece!, currentCount);
            }
        } else {
            const pieceToMoveIdx = moverSide.findIndex(p => p.position.equals(from!));
            if (pieceToMoveIdx === -1) throw new Error("Piece to move not found");
            const pieceToMove = moverSide[pieceToMoveIdx];
            const originalPiece = pieceToMove.piece;
            
            key ^= zobristKeys.board.get(originalPiece!)![from!.row][from!.col];

            const capturedPieceIdx = opponentSide.findIndex(p => p.position.equals(to));
            if (capturedPieceIdx !== -1) {
                const capturedPiece = opponentSide.splice(capturedPieceIdx, 1)[0];
                key ^= zobristKeys.board.get(capturedPiece.piece!)![to.row][to.col];
                if (IsSelfStep()) {
                    const unpromoted = UNPROMOTED_MAP[capturedPiece.piece as string] || capturedPiece.piece;
                    key ^= zobristKeys.captured.get(unpromoted!)!;
                    newField.capturedPieces.set(unpromoted, (newField.capturedPieces.get(unpromoted) || 0) + 1);
                }
            }

            pieceToMove.position = to;
            if (change) {
                pieceToMove.piece = piece;
            }
            
            key ^= zobristKeys.board.get(pieceToMove.piece!)![to.row][to.col];

            if (pieceToMove.piece === '王' || pieceToMove.piece === '玉') {
                newField.opponentking.position = to;
            }
        }
        newField.zobristKey = key;
        return newField;
    }

    static fromBoard(board: (Piece | null)[][], capturedArray: PieceType[], isSelfTurn: boolean): Field {
      let opponentKing: PiecePosition | null = null;
      const opponentPieces: PiecePosition[] = [];
      const selfPieces: PiecePosition[] = [];
      let key = 0n;

      if (isSelfTurn) {
        key ^= zobristKeys.turn;
      }

      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
          const piece = board[row][col];
          if (piece?.type) {
            const pos = new Coordinate(row, col);
            key ^= zobristKeys.board.get(piece.type)![row][col];
            if (piece.side === 'opponent') {
              if (piece.type === '王' || piece.type === '玉') {
                opponentKing = new PiecePosition(pos, piece.type);
              } else {
                opponentPieces.push(new PiecePosition(pos, piece.type));
              }
            } else {
              selfPieces.push(new PiecePosition(pos, piece.type));
            }
          }
        }
      }

      if (!opponentKing) throw new Error('相手の玉が見つかりません');
      
      const capturedMap = new Map<PieceType, number>();
      capturedArray.forEach(p => {
        capturedMap.set(p, (capturedMap.get(p) || 0) + 1);
        key ^= zobristKeys.captured.get(p)!;
      });

      return new Field(opponentKing, opponentPieces, selfPieces, capturedMap, key);
    }
    
    toBoard(): (Piece | null)[][] {
      const board: (Piece | null)[][] = Array(9).fill(null).map(() => Array(9).fill(null));
      
      const placePiece = (pp: PiecePosition, side: Side) => {
        board[pp.position.row][pp.position.col] = { type: pp.piece, side };
      }

      placePiece(this.opponentking, 'opponent');
      this.opponentpieces.forEach(p => placePiece(p, 'opponent'));
      this.selfpieces.forEach(p => placePiece(p, 'self'));
      
      return board;
    }
  }

  const fieldToBoard = (field: Field): (Piece | null)[][] => field.toBoard();
  
  const hashField = (field: Field): bigint => field.zobristKey;

  enum TranspositionNodeType { EXACT, LOWER_BOUND, UPPER_BOUND }
  type TranspositionEntry = {
    depth: number;
    path: MovePiece[] | null; // null for non-mate
    type: TranspositionNodeType;
  };

  const analyzeMateAsync = async (
    initialBoard: (Piece | null)[][],
    initialCaptured: PieceType[],
    abortSignal?: AbortSignal,
    progressCallback?: (progress: { nodeCount: number, maxDepth: number }) => void
  ): Promise<{
    steps: string[], moves: MovePiece[], initialField: Field, rootMoves: MovePiece[], timedOut?: boolean, maxStepReached?: number,
  }> => {
    const initialField = Field.fromBoard(initialBoard, initialCaptured, true);
    const transpositionTable = new Map<bigint, TranspositionEntry>();
    let nodeCount = 0;
    const yieldInterval = 5000;
    
    const alphaBetaSearch = async (field: Field, depth: number, ply: number, alpha: MovePiece[] | null, beta: MovePiece[] | null): Promise<MovePiece[] | null> => {
      nodeCount++;
      if (nodeCount % yieldInterval === 0) {
        if (abortSignal?.aborted) throw new Error("Timeout");
        progressCallback?.({ nodeCount, maxDepth: depth });
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      
      const hash = hashField(field);
      const entry = transpositionTable.get(hash);
      if (entry && entry.depth >= depth - ply) {
        switch (entry.type) {
            case TranspositionNodeType.EXACT: return entry.path;
            case TranspositionNodeType.LOWER_BOUND: if (alpha && entry.path && entry.path.length <= alpha.length) return alpha; break;
            case TranspositionNodeType.UPPER_BOUND: if (beta && entry.path && entry.path.length >= beta.length) return beta; break;
        }
      }

      const isAttackerTurn = ply % 2 === 0;

      if (isAttackerTurn) { // Attacker (OR node)
        if (ply === depth) return null;
        const moves = generateSelfMoves(field, ply);
        let bestPath: MovePiece[] | null = null;
        for (const move of moves) {
          const path = await alphaBetaSearch(field.applyMove(move), depth, ply + 1, bestPath, beta);
          if (path) {
            if (!bestPath || path.length < bestPath.length) {
              bestPath = [move, ...path];
              if (beta && bestPath.length < beta.length) { // Alpha-beta pruning
                transpositionTable.set(hash, { depth: depth - ply, path: bestPath, type: TranspositionNodeType.EXACT });
                return bestPath;
              }
            }
          }
        }
        transpositionTable.set(hash, { depth: depth - ply, path: bestPath, type: bestPath ? TranspositionNodeType.LOWER_BOUND : TranspositionNodeType.EXACT });
        return bestPath;
      } else { // Defender (AND node)
        const moves = generateOpponentMoves(field, ply);
        if (moves.length === 0) {
          const parentMove = arguments[3] as MovePiece; // A bit of a hack to get the last move
          if (parentMove?.piece === '歩' && parentMove.IsDrop()) return null; // Uchifu-zume
          return []; // Mate! Return empty path.
        }
        if (ply === depth) return null; // Reached depth limit

        let worstPath: MovePiece[] | null = null;
        for (const move of moves) {
            const path = await alphaBetaSearch(field.applyMove(move), depth, ply + 1, alpha, worstPath);
            if (!path) { // Found an escape
              transpositionTable.set(hash, { depth: depth - ply, path: null, type: TranspositionNodeType.EXACT });
              return null;
            }
            if (!worstPath || path.length > worstPath.length) {
              worstPath = [move, ...path];
               if (alpha && worstPath.length > alpha.length) { // Alpha-beta pruning
                 transpositionTable.set(hash, { depth: depth - ply, path: worstPath, type: TranspositionNodeType.UPPER_BOUND });
                 return worstPath;
               }
            }
        }
        transpositionTable.set(hash, { depth: depth - ply, path: worstPath, type: worstPath ? TranspositionNodeType.UPPER_BOUND : TranspositionNodeType.EXACT });
        return worstPath;
      }
    };

    const maxMateDepth = 29;
    let solution: MovePiece[] | null = null;
    let lastSearchedDepth = 0;

    for (let depth = 1; depth <= maxMateDepth; depth += 2) {
      if (abortSignal?.aborted) break;
      lastSearchedDepth = depth;
      const path = await alphaBetaSearch(initialField, depth, 0, null, null);
      if (path) {
        solution = path;
        break;
      }
    }
    
    const rootMoves = generateSelfMoves(initialField, 0); // Generate for UI
    
    return {
      steps: solution ? solution.map(m => formatMove(m)) : [],
      moves: solution || [],
      initialField,
      rootMoves,
      timedOut: abortSignal?.aborted,
      maxStepReached: lastSearchedDepth
    };
  };

  const getPieceMoves = (board: (Piece | null)[][], pos : Coordinate, pieceType : PieceType, side : Side = 'self', trample :boolean = false): Coordinate[] => {
    const moves: Coordinate[] = [];
    const directions = getPieceDirections(pieceType, side);
    
    for (const [dr, dc, range] of directions) {
      for (let i = 1; i <= range; i++) {
        const newRow = pos.row + dr * i;
        const newCol = pos.col + dc * i;
        
        if (newRow < 0 || newRow >= 9 || newCol < 0 || newCol >= 9) break;
        
        const target = board[newRow][newCol];
        if (target && target.side === side && !(trample && (target.type === '王' || target.type === '玉'))) break;
        
        moves.push(new Coordinate(newRow, newCol));
        
        if (target) break;
      }
    }
    return moves;
  };
  
  const getPieceDirections = (pieceType: PieceType, side: Side): [number, number, number][] => {
    const isOpponent = side === 'opponent';
    const forward = isOpponent ? 1 : -1;
    
    switch (pieceType) {
      case '歩': return [[forward, 0, 1]];
      case '香': return [[forward, 0, 9]];
      case '桂': return [[forward * 2, -1, 1], [forward * 2, 1, 1]];
      case '銀': return [[forward, -1, 1], [forward, 0, 1], [forward, 1, 1], [-forward, -1, 1], [-forward, 1, 1]];
      case '金': case 'と': case '成香': case '成桂': case '成銀':
        return [[forward, -1, 1], [forward, 0, 1], [forward, 1, 1], [0, -1, 1], [0, 1, 1], [-forward, 0, 1]];
      case '王': case '玉':
        return [[-1, -1, 1], [-1, 0, 1], [-1, 1, 1], [0, -1, 1], [0, 1, 1], [1, -1, 1], [1, 0, 1], [1, 1, 1]];
      case '飛': return [[-1, 0, 9], [1, 0, 9], [0, -1, 9], [0, 1, 9]];
      case '龍': return [[-1, 0, 9], [1, 0, 9], [0, -1, 9], [0, 1, 9], [-1, -1, 1], [-1, 1, 1], [1, -1, 1], [1, 1, 1]];
      case '角': return [[-1, -1, 9], [-1, 1, 9], [1, -1, 9], [1, 1, 9]];
      case '馬': return [[-1, -1, 9], [-1, 1, 9], [1, -1, 9], [1, 1, 9], [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1]];
      default: return [];
    }
  };

  const PIECE_VALUES: {[key in PieceType & string]: number} = {
    '歩': 10, '香': 30, '桂': 40, '銀': 50, '金': 60, '角': 80, '飛': 90,
    'と': 60, '成香': 60, '成桂': 60, '成銀': 60, '龍': 110, '馬': 100,
    '王': 1000, '玉': 1000,
  };

  const generateSelfMoves = (field: Field, steps: number): MovePiece[] => {
    const scoredMoves: {move: MovePiece, score: number}[] = [];
    const board = fieldToBoard(field);
    const kingPos = field.opponentking.position;

    const addMoveIfCheck = (move: MovePiece, score: number) => {
        const nextBoard = fieldToBoard(field.applyMove(move));
        const kingAttackingMoves = getPieceMoves(nextBoard, move.to, move.piece, 'self', true);
        if (kingAttackingMoves.some(m => m.equals(kingPos))) {
          scoredMoves.push({move, score});
        }
    };
    
    // Board moves
    field.selfpieces.forEach(pp => {
      if (!pp.position) return;
      const pieceMoves = getPieceMoves(board, pp.position, pp.piece, 'self');
      
      pieceMoves.forEach(moveTo => {
        let score = 0;
        const captured = field.opponentpieces.find(op => op.position.equals(moveTo));
        if (captured) {
            score = 100 + (PIECE_VALUES[captured.piece!] || 0) - (PIECE_VALUES[pp.piece!] || 0);
        }
        
        // Normal move
        addMoveIfCheck(new MovePiece(steps, pp.piece, pp.position, moveTo, false), score);

        // Promotion
        if (pp.piece in PROMOTED_MAP && (pp.position.isEnemyField() || moveTo.isEnemyField())) {
          const promotedPiece = PROMOTED_MAP[pp.piece as string];
          addMoveIfCheck(new MovePiece(steps, promotedPiece, pp.position, moveTo, true), score + 50);
        }
      });
    });

    // Drop moves
    field.capturedPieces.forEach((count, pieceType) => {
      if (count > 0) {
        for (let r = 0; r < 9; r++) {
          for (let c = 0; c < 9; c++) {
            if (board[r][c] === null) {
              const moveCoord = new Coordinate(r, c);
              addMoveIfCheck(new MovePiece(steps, pieceType, null, moveCoord), PIECE_VALUES[pieceType] || 0);
            }
          }
        }
      }
    });

    return scoredMoves.sort((a, b) => b.score - a.score).map(sm => sm.move);
  };

  const generateOpponentMoves = (field: Field, steps: number): MovePiece[] => {
    const scoredMoves: {move: MovePiece, score: number}[] = [];
    const board = fieldToBoard(field);
    
    const isKingAttacked = (f: Field): boolean => {
      const b = fieldToBoard(f);
      const kingPos = f.opponentking.position;
      for (const sp of f.selfpieces) {
        if (getPieceMoves(b, sp.position, sp.piece, 'self').some(m => m.equals(kingPos))) {
          return true;
        }
      }
      return false;
    };
    
    const addMoveIfLegal = (move: MovePiece, score: number) => {
        if (!isKingAttacked(field.applyMove(move))) {
            scoredMoves.push({ move, score });
        }
    };

    const opponentPieces = [...field.opponentpieces, field.opponentking];

    opponentPieces.forEach(pp => {
      const pieceMoves = getPieceMoves(board, pp.position, pp.piece, 'opponent');
      pieceMoves.forEach(moveTo => {
        let score = 0;
        const captured = field.selfpieces.find(sp => sp.position.equals(moveTo));
        if (captured) {
            score = 100 + (PIECE_VALUES[captured.piece!] || 0) - (PIECE_VALUES[pp.piece!] || 0);
        }
        if (pp.piece === '王' || pp.piece === '玉') {
            score += 200;
        }
        
        // Normal move
        addMoveIfLegal(new MovePiece(steps, pp.piece, pp.position, moveTo, false), score);
        
        // Promotion
        if (pp.piece in PROMOTED_MAP && (pp.position.isEnemyField() || moveTo.isEnemyField())) {
          const promotedPiece = PROMOTED_MAP[pp.piece as string];
          addMoveIfLegal(new MovePiece(steps, promotedPiece, pp.position, moveTo, true), score + 50);
        }
      });
    });
    
    // Todo: Aigoma (block) moves need to be added and scored appropriately

    return scoredMoves.sort((a,b) => b.score - a.score).map(sm => sm.move);
  }

  // 手を文字列化
  const formatMove = (move: MovePiece): string => {
    const prefix = `${move.step + 1}手: `;
    if (move.IsDrop()) {
      return `${prefix}${move.to.toString()}${move.piece}打`;
    }
    const fromStr = `[${move.from!.toString()}]`;
    if (move.change) {
      const originalPiece = UNPROMOTED_MAP[move.piece as string] || move.piece;
      return `${prefix}${move.to.toString()}${originalPiece}成 ${fromStr}`;
    }
    return `${prefix}${move.to.toString()}${move.piece} ${fromStr}`;
  };

  // 表示用の盤面を取得
  const getDisplayBoard = (): (Piece | null)[][] => {
    if (!viewMode || !initialField) {
      return board;
    }
    
    if (currentPath.length === 0) {
      return initialField.toBoard();
    }
    
    // currentPathの最後の手まで適用
    const lastMove = currentPath[currentPath.length - 1];
    const field = Field.advanceBaseField(initialField, lastMove);
    return field.toBoard();
  };

  // 表示用の持ち駒を取得
  const getDisplayCaptured = (): PieceType[] => {
    if (!viewMode || !initialField) {
      return capturedPieces;
    }
    
    if (currentPath.length === 0) {
      const captured: PieceType[] = [];
      initialField.capturedPieces.forEach((count, piece) => {
        for (let i = 0; i < count; i++) {
          captured.push(piece);
        }
      });
      return captured;
    }
    
    // currentPathの最後の手まで適用
    const lastMove = currentPath[currentPath.length - 1];
    const field = Field.advanceBaseField(initialField, lastMove);
    const captured: PieceType[] = [];
    field.capturedPieces.forEach((count, piece) => {
      for (let i = 0; i < count; i++) {
        captured.push(piece);
      }
    });
    return captured;
  };

  // 現在表示すべき候補手を取得
  const getCurrentMoves = (): MovePiece[] => {
    if (!viewMode) return [];
    
    if (currentPath.length === 0) {
      return rootMoves;
    }
    
    const lastMove = currentPath[currentPath.length - 1];
    
    // リダイレクトがある場合、リダイレクト先の手を返す
    if (lastMove.redirectMove) {
      return lastMove.redirectMove.nextMove;
    }
    
    return lastMove.nextMove;
  };

  // 選択した駒に基づいて候補手をフィルタリング
  const getFilteredMoves = (): MovePiece[] => {
    const allMoves = getCurrentMoves();
    
    let filteredMoves: MovePiece[];
    
    if (!selectedPieceInView) {
      filteredMoves = allMoves;
    } else if (typeof selectedPieceInView === 'string') {
      // 持ち駒が選択されている場合（PieceTypeの場合）
      const dropMoves = allMoves.filter(move => 
        move.IsDrop() && move.piece === selectedPieceInView
      );
      
      // 移動先が選択されている場合、さらに絞り込み
      if (selectedDestination) {
        filteredMoves = dropMoves.filter(move =>
          move.to.row === selectedDestination.row &&
          move.to.col === selectedDestination.col
        );
      } else {
        filteredMoves = dropMoves;
      }
    } else {
      // 盤上の駒が選択されている場合（Coordinateの場合）
      const pieceMoves = allMoves.filter(move => 
        move.from && 
        move.from.row === selectedPieceInView.row && 
        move.from.col === selectedPieceInView.col
      );
      
      // 移動先が選択されている場合、さらに絞り込み（成りと不成の両方を表示）
      if (selectedDestination) {
        filteredMoves = pieceMoves.filter(move =>
          move.to.row === selectedDestination.row &&
          move.to.col === selectedDestination.col
        );
      } else {
        filteredMoves = pieceMoves;
      }
    }
    
    // ソート処理：詰み手（solutionPathに含まれる）を最優先、次に成功属性
    return filteredMoves.sort((a, b) => {
      // solutionPathに含まれる手かチェック
      const aInSolution = solutionPath && currentPath.length < solutionPath.length && 
        solutionPath[currentPath.length] === a;
      const bInSolution = solutionPath && currentPath.length < solutionPath.length && 
        solutionPath[currentPath.length] === b;
      
      if (aInSolution && !bInSolution) return -1;
      if (!aInSolution && bInSolution) return 1;
      
      // 成功属性でソート
      if (a.isSuccess() && !b.isSuccess()) return -1;
      if (!a.isSuccess() && b.isSuccess()) return 1;
      
      // それ以外は元の順序を維持
      return 0;
    });
  };

  // サンプル問題を読み込む
  const handleSample = () => {
    const newBoard: (Piece | null)[][] = Array(9).fill(null).map(() => Array(9).fill(null));
    
    // サンプルデータ
    newBoard[0][3] = { type: '銀', side: 'opponent' }; // 4 1 O 銀
    newBoard[0][4] = { type: '玉', side: 'opponent' }; // 5 1 O 玉
    newBoard[0][5] = { type: '銀', side: 'opponent' }; // 6 1 O 銀
    newBoard[2][4] = { type: '銀', side: 'self' };     // 5 3 S 銀
    newBoard[4][7] = { type: '角', side: 'self' };     // 8 5 S 角
    
    setBoard(newBoard);
    setCapturedPieces(['銀']);
    setSelectedCell(null);
    setSelectedCapturedIndex(null);
  };

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center mb-4 gap-2">
        <Link href="/" className="inline-block px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">トップに戻る</Link>
      </div>

      <h2 className="text-2xl font-bold mb-4">詰将棋ソルバー</h2>

      {/* ボタン */}
      <div className="mb-4 flex flex-wrap gap-2 items-center">
        {!viewMode ? (
          <>
            <button
              className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
            >{isAnalyzing ? '解析中...' : '解析'}</button>
            {isAnalyzing && analysisProgress && (
              <span className="text-sm text-gray-600">
                探索中: {analysisProgress.maxDepth}手目 (候補: {analysisProgress.queueSize})
              </span>
            )}
            <button
              className="px-4 py-2 bg-red-200 text-red-700 rounded hover:bg-red-300"
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
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              onClick={handleBackToInput}
            >入力に戻る</button>
            <button
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
              onClick={handleResetToStart}
              disabled={currentPath.length === 0}
            >0手</button>
            <button
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
              onClick={handlePrevStep}
              disabled={currentPath.length === 0}
            >←</button>
            <span className="px-4 py-2 font-semibold w-24 text-center">
              {currentPath.length === 0 ? '初期状態' : `${currentPath.length}手目`}
            </span>
            <button
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
              onClick={handleNextStep}
              disabled={!solutionPath || currentPath.length >= solutionPath.length}
            >→</button>
          </>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* 盤面と持ち駒 */}
        <div>
          <h3 className="font-semibold mb-2">盤面{viewMode ? '' : '（クリックで選択）'}</h3>
          <div className="inline-block">
            {/* 列番号（上） */}
            <div className="flex">
              <div className="w-6"></div> {/* 左上の空白 */}
              {[9, 8, 7, 6, 5, 4, 3, 2, 1].map(col => (
                <div key={col} className="w-8 sm:w-10 lg:w-12 text-center text-xs sm:text-sm font-semibold">{col}</div>
              ))}
            </div>
            {/* 盤面 */}
            <div className="flex">
              {/* 行番号（右） */}
              <div className="w-6"></div> {/* 左側の空白 */}
              <div className="border-4 border-amber-900 bg-amber-100">
            {getDisplayBoard().map((row, rowIndex) => (
              <div key={rowIndex} className="flex">
                {row.map((piece, colIndex) => {
                  const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
                  
                  // ビューモードでの処理
                  let candidateMove: MovePiece | null = null;
                  let isPieceSelectable = false;
                  let isSelectedPiece = false;
                  let isLastMovedPiece = false; // 直前に動かした駒かどうか
                  let isLastMoveDropped = false; // 直前の手が打ったものか
                  
                  if (viewMode) {
                    const filteredMoves = getFilteredMoves();
                    
                    // 直前に動かした駒の位置をチェック
                    if (currentPath.length > 0) {
                      const lastMove = currentPath[currentPath.length - 1];
                      isLastMovedPiece = lastMove.to.row === rowIndex && lastMove.to.col === colIndex;
                      isLastMoveDropped = lastMove.IsDrop();
                    }
                    
                    // 選択中の駒かどうか（盤上の駒のみチェック）
                    isSelectedPiece = selectedPieceInView !== null && 
                      typeof selectedPieceInView !== 'string' &&
                      selectedPieceInView.row === rowIndex && 
                      selectedPieceInView.col === colIndex;
                    
                    if (selectedPieceInView) {
                      // 駒を選択済み：フィルタリングされた移動先を表示
                      candidateMove = filteredMoves.find(m => m.to.row === rowIndex && m.to.col === colIndex) || null;
                    } else {
                      // 駒未選択：移動可能な駒を判定
                      const allMoves = getCurrentMoves();
                      isPieceSelectable = piece !== null && allMoves.some(m => 
                        m.from && m.from.row === rowIndex && m.from.col === colIndex
                      );
                    }
                  }
                  
                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={`w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 border border-amber-900 flex items-center justify-center text-base sm:text-lg lg:text-xl font-bold relative
                        ${!viewMode ? 'cursor-pointer' : (candidateMove || isPieceSelectable) ? 'cursor-pointer' : ''}
                        ${isSelected && !viewMode ? 'bg-yellow-300' : 
                          isLastMovedPiece ? 'bg-red-100' :
                          isSelectedPiece ? 'bg-yellow-300' :
                          candidateMove ? 'bg-green-200' : 
                          isPieceSelectable ? 'bg-blue-100' : 'bg-amber-50'}
                        ${!viewMode && !isSelected ? 'hover:bg-amber-200' : 
                          candidateMove ? 'hover:bg-green-300' : 
                          isPieceSelectable ? 'hover:bg-blue-200' : ''}
                        ${piece?.side === 'self' ? 'text-blue-700' : ''}
                        ${piece?.side === 'opponent' ? 'text-red-700' : ''}
                      `}
                      onClick={() => {
                        if (!viewMode) {
                          handleCellClick(rowIndex, colIndex);
                        } else if (candidateMove) {
                          // 移動先を選択
                          const destination = new Coordinate(rowIndex, colIndex);
                          
                          // この移動先への候補が何個あるかチェック
                          const currentMoves = selectedPieceInView ? 
                            getCurrentMoves().filter(m => {
                              if (typeof selectedPieceInView === 'string') {
                                return m.IsDrop() && m.piece === selectedPieceInView &&
                                  m.to.row === destination.row && m.to.col === destination.col;
                              } else {
                                return m.from && 
                                  m.from.row === selectedPieceInView.row && 
                                  m.from.col === selectedPieceInView.col &&
                                  m.to.row === destination.row && 
                                  m.to.col === destination.col;
                              }
                            }) : [];
                          
                          if (currentMoves.length === 1) {
                            // 候補が1つなら即座に確定
                            handleSelectMove(currentMoves[0]);
                          } else if (currentMoves.length > 1) {
                            // 候補が複数ある場合（成りと不成）、移動先を選択状態にする
                            setSelectedDestination(destination);
                          }
                        } else if (isPieceSelectable) {
                          // 駒を選択
                          setSelectedPieceInView(new Coordinate(rowIndex, colIndex));
                        }
                      }}
                    >
                      {/* 直前に打った駒の場合「打」を表示 */}
                      {isLastMovedPiece && isLastMoveDropped && (
                        <span className="absolute top-0 right-0 text-xs bg-orange-500 text-white px-1 rounded">
                          打
                        </span>
                      )}
                      {renderPiece(piece)}
                      {candidateMove && (() => {
                        // この移動先への候補を取得
                        const destination = new Coordinate(rowIndex, colIndex);
                        const movesToThisSquare = selectedPieceInView ? 
                          getCurrentMoves().filter(m => {
                            if (typeof selectedPieceInView === 'string') {
                              return m.IsDrop() && m.piece === selectedPieceInView &&
                                m.to.row === destination.row && m.to.col === destination.col;
                            } else {
                              return m.from && 
                                m.from.row === selectedPieceInView.row && 
                                m.from.col === selectedPieceInView.col &&
                                m.to.row === destination.row && 
                                m.to.col === destination.col;
                            }
                          }) : [];
                        
                        // 成りのみがあるかチェック
                        const hasPromotedOnly = movesToThisSquare.length === 1 && 
                          movesToThisSquare[0].change;
                        
                        return (
                          <span className="absolute top-0 right-0 text-xs bg-red-500 text-white px-1 rounded flex flex-col items-center leading-tight">
                            <span>{candidateMove.IsDrop() ? '打' : '動'}</span>
                            {hasPromotedOnly && <span>成</span>}
                          </span>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
              {/* 行番号（右側） */}
              <div className="ml-1">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(row => (
                  <div key={row} className="h-8 sm:h-10 lg:h-12 flex items-center text-xs sm:text-sm font-semibold">
                    {KANJI_NUMBERS[row + 1]}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 持ち駒欄 */}
          <div className="mt-6">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">持ち駒:</span>
              {getDisplayCaptured().map((piece, index) => {
                // ビューモードでの処理
                const isSelectedCaptured = viewMode && selectedPieceInView === piece;
                const allMoves = viewMode ? getCurrentMoves() : [];
                const isCapturedSelectable = viewMode && allMoves.some(m => m.IsDrop() && m.piece === piece);
                
                return (
                  <div
                    key={index}
                    className={`w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 border-2 border-blue-700 bg-blue-50 flex items-center justify-center text-base sm:text-lg lg:text-xl font-bold text-blue-700
                      ${viewMode ? (isCapturedSelectable ? 'cursor-pointer' : '') : 'cursor-pointer'}
                      ${!viewMode && selectedCapturedIndex === index ? 'bg-yellow-300 border-yellow-500' : 
                        isSelectedCaptured ? 'bg-yellow-300 border-yellow-500' : ''}
                      ${!viewMode && selectedCapturedIndex !== index ? 'hover:bg-blue-100' : 
                        isCapturedSelectable ? 'hover:bg-blue-100' : ''}
                    `}
                    onClick={() => {
                      if (!viewMode) {
                        handleCapturedClick(index);
                      } else if (isCapturedSelectable) {
                        setSelectedPieceInView(piece);
                      }
                    }}
                  >
                    {piece}
                  </div>
                );
              })}
              {/* 空欄 */}
              {!viewMode && (
                <div
                  className={`w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 border-2 border-dashed border-gray-400 bg-gray-50 cursor-pointer flex items-center justify-center text-base sm:text-lg lg:text-xl
                    ${selectedCapturedIndex === capturedPieces.length ? 'bg-yellow-300 border-yellow-500' : 'hover:bg-gray-100'}
                  `}
                  onClick={() => handleCapturedClick(capturedPieces.length)}
                >
                  <span className="text-gray-400">+</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 駒選択パネル */}
        {!viewMode && (
        <div>
          <h3 className="font-semibold mb-2">駒を選択</h3>
          <div className="space-y-4">
            {/* 相手の駒 */}
            <div>
              <p className="text-sm font-semibold mb-1 text-red-700">相手の駒（上向き）</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {PIECE_TYPES.map(pieceType => (
                  <button
                    key={`opponent-${pieceType}`}
                    className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 font-bold text-lg disabled:opacity-50"
                    onClick={() => handlePlacePiece(pieceType === '王' ? '玉' : pieceType, 'opponent')}
                    disabled={selectedCapturedIndex !== null || !selectedCell}
                  >
                    <span className="inline-block" style={{transform: 'rotate(180deg)'}}>
                      {pieceType === '王' ? '玉' : pieceType}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 自分の駒 */}
            <div>
              <p className="text-sm font-semibold mb-1 text-blue-700">自分の駒（下向き）</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {PIECE_TYPES.map(pieceType => (
                  <button
                    key={`self-${pieceType}`}
                    className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 font-bold text-lg disabled:opacity-50"
                    onClick={() => handlePlacePiece(pieceType === '玉' ? '王' : pieceType, 'self')}
                    disabled={(selectedCapturedIndex !== null && pieceType === '王') || (!selectedCell && selectedCapturedIndex === null)}
                  >
                    {pieceType === '玉' ? '王' : pieceType}
                  </button>
                ))}
              </div>
            </div>

            {/* 削除ボタン */}
            <div>
              <button
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-bold disabled:opacity-50"
                onClick={handleDeletePiece}
                disabled={
                  (!selectedCell && selectedCapturedIndex === null) ||
                  (selectedCapturedIndex === capturedPieces.length) ||
                  (selectedCell !== null && board[selectedCell.row][selectedCell.col] === null)
                }
              >
                削除
              </button>
            </div>
          </div>

          {selectedCell && (
            <div className="mt-4 p-3 bg-blue-50 rounded">
              <p className="text-sm">
                選択中: {9 - selectedCell.col}筋{selectedCell.row + 1}段
              </p>
            </div>
          )}
          
          {selectedCapturedIndex !== null && (
            <div className="mt-4 p-3 bg-blue-50 rounded">
              <p className="text-sm">
                選択中: 持ち駒 {selectedCapturedIndex < capturedPieces.length ? `(${capturedPieces[selectedCapturedIndex]})` : '(空欄)'}
              </p>
            </div>
          )}
        </div>
        )}
        
        {/* ビューモード：候補手リスト */}
        {viewMode && (
        <div>
          <h3 className="font-semibold mb-2">候補手リスト</h3>
          <div className="space-y-2">
            {/* 履歴表示 */}
            {currentPath.length > 0 && (
              <div className="p-3 bg-gray-50 border border-gray-300 rounded text-sm">
                <p className="font-semibold text-gray-700 mb-2">手順履歴</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {currentPath.map((move, index) => (
                    <div key={index}>
                      <div className="text-xs text-gray-600">
                        {index + 1}. {formatMove(move, true)}
                        {move.redirectMove && (
                          <span className="ml-2 text-purple-600 font-semibold">
                            (同一盤面)
                          </span>
                        )}
                      </div>
                      {move.redirectMove && (
                        <div className="ml-4 mt-1 pl-2 border-l-2 border-purple-300">
                          <p className="text-xs text-purple-700 font-semibold mb-1">別ルート:</p>
                          {move.redirectMove.History().map((redirectedMove, ridx) => (
                            <div key={ridx} className="text-xs text-purple-600">
                              {ridx + 1}. {formatMove(redirectedMove, true)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedPieceInView && (
              <button
                className="w-full px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                onClick={() => {
                  setSelectedPieceInView(null);
                  setSelectedDestination(null);
                }}
              >
                駒選択を解除
              </button>
            )}
            {selectedDestination && (
              <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                <p className="font-semibold text-yellow-800">
                  {9 - selectedDestination.col}筋{selectedDestination.row + 1}段への移動
                </p>
                <p className="text-xs text-gray-600">成る・成らないを選択してください</p>
              </div>
            )}
            {getFilteredMoves().length > 0 ? (
              <>
                <p className="text-sm text-gray-600 mb-2">
                  {currentPath.length % 2 === 0 ? '攻め方の手' : '守り方の手'} 
                  ({getFilteredMoves().length}種類{selectedPieceInView ? ' / 絞り込み中' : ''})
                </p>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {getFilteredMoves().map((move, index) => {
                    const isOpponentTurn = currentPath.length % 2 === 1;
                    return (
                      <button
                        key={index}
                        className={`w-full px-3 py-2 rounded text-left text-sm ${
                          isOpponentTurn 
                            ? 'bg-red-50 hover:bg-red-100 border border-red-200' 
                            : 'bg-blue-50 hover:bg-blue-100 border border-blue-200'
                        }`}
                        onClick={() => handleSelectMove(move)}
                      >
                        <div className={`font-semibold ${isOpponentTurn ? 'text-red-700' : 'text-blue-700'}`}>
                          {formatMove(move, true)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">
                {selectedPieceInView ? 
                  (typeof selectedPieceInView === 'string' ? 
                    `選択した持ち駒（${selectedPieceInView}）の打つ先がありません` : 
                    '選択した駒の移動先がありません') : 
                  '候補手がありません'}
              </p>
            )}
          </div>
        </div>
        )}
      </div>

      {/* 解析結果の表示 */}
      {solutionSteps.length > 0 && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded">
          <h3 className="font-semibold mb-2 text-green-800">解析結果</h3>
          <div className="space-y-1">
            {solutionSteps.map((step, index) => (
              <p key={index} className="text-sm">{step}</p>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 text-sm text-gray-600">
        <p>※ 盤面のマスをクリックして選択してから、右側の駒ボタンをクリックして配置してください</p>
        <p>※ 同じ駒を同じ位置に配置すると、成駒になります</p>
        <p>※ 持ち駒は空欄（+）をクリックして追加できます</p>
        <p>※ 大体、7手詰めまでなら解析できます</p>
      </div>

      {/* エクスポートモーダル */}
      {showExport && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded shadow-lg p-4 sm:p-6 max-w-lg w-full relative">
            <button
              className="absolute top-2 right-2 px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => setShowExport(false)}
            >閉じる</button>
            <h3 className="text-xl font-bold mb-4">エクスポート</h3>
            <textarea
              className="w-full h-48 sm:h-64 p-2 border rounded font-mono text-sm"
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
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded shadow-lg p-4 sm:p-6 max-w-lg w-full relative">
            <button
              className="absolute top-2 right-2 px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => setShowImport(false)}
            >閉じる</button>
            <h3 className="text-xl font-bold mb-4">インポート</h3>
            <p className="text-sm text-gray-600 mb-2">形式: x y 側(S/O) 駒種類</p>
            <textarea
              className="w-full h-48 sm:h-64 p-2 border rounded font-mono text-sm"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="例:\n1 1 O 香\n5 9 S 王\nCAPTURED: 歩,銀"
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
    </main>
  );
}

