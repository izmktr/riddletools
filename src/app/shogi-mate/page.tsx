"use client";
import { useState } from "react";
import Link from "next/link";

type PieceType = '歩' | '香' | '桂' | '銀' | '金' | '王' | '玉' | '飛' | '角' | 'と' | '成香' | '成桂' | '成銀' | '龍' | '馬' | null;
type Side = 'self' | 'opponent' | null;
type Status = 'none' | 'success' | 'failure';

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

export default function ShogiMatePage() {
  const [board, setBoard] = useState<(Piece | null)[][]>(() => 
    Array(9).fill(null).map(() => Array(9).fill(null))
  );
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

  // 盤面のセルをクリック
  const handleCellClick = (row: number, col: number) => {
    setSelectedCell({row, col});
    setSelectedCapturedIndex(null);
  };

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
    // リダイレクトがある場合、パスを再構築
    if (currentPath.length > 0) {
      const lastMove = currentPath[currentPath.length - 1];
      if (lastMove.redirectMove) {
        // リダイレクト先の履歴を取得
        const redirectedHistory = lastMove.redirectMove.History();
        // 現在のパスの最後を除いた部分 + リダイレクト先の履歴 + 新しい手
        const newPath = [...currentPath.slice(0, -1), ...redirectedHistory, move];
        setCurrentPath(newPath);
        setSelectedPieceInView(null);
        setSelectedDestination(null);
        return;
      }
    }
    
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
    
    const timeoutMs = 15000; // 15秒でタイムアウト
    const abortController = new AbortController();
    
    // タイムアウトタイマーを設定
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, timeoutMs);
    
    try {
      const result = await analyzeMateAsync(board, capturedPieces, abortController.signal);
      clearTimeout(timeoutId);
      
      setSolutionSteps(result.steps);
      setInitialField(result.initialField);
      setRootMoves(result.rootMoves);
      
      // 常にビューモードに移行
      setViewMode(true);
      setCurrentPath([]);
      
      if (result.steps.length > 0) {
        // 詰み筋がある場合
        setSolutionPath(result.moves);
        alert(`詰み発見！ ${result.steps.length}手詰`);
      } else if (result.timedOut) {
        // タイムアウトした場合
        setSolutionPath(null);
        const queueInfo = `タイムアウトしました\n\n` +
          `探索した手数: 最大${result.maxStepReached ?? 0}手目まで\n` +
          `残りキューサイズ: ${result.queueSize ?? 0}\n\n` +
          `※ 現在の解析状態をビューモードで確認できます`;
        alert(queueInfo);
      } else {
        // 答えがない場合
        setSolutionPath(null);
        alert('詰みが見つかりませんでした');
      }
    } catch (error) {
      if (error instanceof Error) {
        alert('エラーが発生しました: ' + error.message);
      }
    } finally {
      setIsAnalyzing(false);
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

    // 敵の陣地か？(自分から見て)
    isEnemyField(): boolean {
        return this.row <= 2;
    }

    hash(): number {
        return this.row * 9 + this.col;
    }

    static fromHash(hash: number): Coordinate {
        return new Coordinate(Math.floor(hash / 9), hash % 9);
    }
    
  }
  
  // 手を保存するクラス
  class MovePiece {
    step: number;
    piece: PieceType
    from: Coordinate | null;
    to: Coordinate;
    change : boolean;
    prevMove : MovePiece | null = null;
    nextMove : MovePiece [] = [];
    status: Status = 'none';
    redirectMove : MovePiece | null = null;
    constructor(step: number, piece: PieceType, from: Coordinate | null, to: Coordinate, prevMove: MovePiece | null, change: boolean = false) {
        this.step = step;
        this.piece = piece;
        this.from = from;
        this.to = to;
        this.change = change;
        this.prevMove = prevMove;
        if (prevMove) {
            prevMove.nextMove.push(this);
        }
    }

    IsDrop(): boolean {
        return this.from === null;
    }

    IsSelfStep(): boolean {
        return this.step % 2 === 0;
    }

    History(): MovePiece[] {
        const moves: MovePiece[] = [];
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let current: MovePiece | null = this;
        while (current) {
            moves.push(current);
            current = current.prevMove;
        }
        return moves.reverse();
    }

    getStatus(): Status {
        if (this.redirectMove){
            return this.redirectMove.status;
        }
        return this.status;
    }

  }

  // 座標と駒タイプのペア
  class PiecePosition {
    position: Coordinate | null;
    piece: PieceType;
    constructor(position: Coordinate, piece: PieceType) {
        this.position = position;
        this.piece = piece;
    }
  }

  // 優先度付きキュー（最小ヒープ）
  class PriorityQueue {
    private heap: Array<{ priority: number; data: MovePiece }> = [];

    // 要素を追加
    push(priority: number, data: MovePiece): void {
      this.heap.push({ priority, data });
      this.bubbleUp(this.heap.length - 1);
    }

    // 配列を一括追加（優先度を指定）
    pushArray(priority: number, moves: MovePiece[]): void {
      moves.forEach(move => {
        this.push(priority, move);
      });
    }

    // 最小優先度の要素を取り出す
    pop(): MovePiece | undefined {
      if (this.heap.length === 0) return undefined;
      if (this.heap.length === 1) return this.heap.pop()!.data;

      const min = this.heap[0].data;
      this.heap[0] = this.heap.pop()!;
      this.bubbleDown(0);
      return min;
    }

    // 最小優先度の要素を見る（取り出さない）
    peek(): MovePiece | undefined {
      return this.heap.length > 0 ? this.heap[0].data : undefined;
    }

    // 先頭の要素の優先度を見る
    peekPriority(): number {
      return this.heap.length > 0 ? this.heap[0].priority : 0;
    }

    // 空かどうか
    isEmpty(): boolean {
      return this.heap.length === 0;
    }

    // サイズ
    size(): number {
      return this.heap.length;
    }

    // 末尾の要素のstep数を取得（最大優先度の要素）
    getLastStep(): number | undefined {
      if (this.heap.length === 0) return undefined;
      // ヒープの末尾要素から最大step数を探す（効率的ではないが、正確）
      let maxStep = this.heap[0].data.step;
      for (let i = 1; i < this.heap.length; i++) {
        if (this.heap[i].data.step > maxStep) {
          maxStep = this.heap[i].data.step;
        }
      }
      return maxStep;
    }

    // ヒープの上方向への調整
    private bubbleUp(index: number): void {
      while (index > 0) {
        const parentIndex = Math.floor((index - 1) / 2);
        if (this.heap[index].priority >= this.heap[parentIndex].priority) break;
        
        [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
        index = parentIndex;
      }
    }

    // ヒープの下方向への調整
    private bubbleDown(index: number): void {
      while (true) {
        const leftChild = 2 * index + 1;
        const rightChild = 2 * index + 2;
        let smallest = index;

        if (leftChild < this.heap.length && this.heap[leftChild].priority < this.heap[smallest].priority) {
          smallest = leftChild;
        }
        if (rightChild < this.heap.length && this.heap[rightChild].priority < this.heap[smallest].priority) {
          smallest = rightChild;
        }
        if (smallest === index) break;

        [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
        index = smallest;
      }
    }
  }

  // フィールドクラス
  class Field{
    opponentking: PiecePosition;
    opponentpieces: PiecePosition[];
    selfpieces: PiecePosition[];

    // 持ち駒 (駒の種類 -> 個数)
    capturedPieces: Map<PieceType, number>;

    constructor(opponentking: PiecePosition, opponentpieces: PiecePosition[], selfpieces: PiecePosition[], capturedPieces: Map<PieceType, number> = new Map()) {
        this.opponentking = opponentking;
        this.opponentpieces = opponentpieces;
        this.selfpieces = selfpieces;
        this.capturedPieces = capturedPieces;
    }

    

    // フィールドのコピーを作成
    clone(): Field {
      const cloneCoordinate = (coord: Coordinate | null): Coordinate | null => {
        if (!coord) return null;
        return new Coordinate(coord.row, coord.col);
      };
      
      const clonePiecePosition = (pp: PiecePosition): PiecePosition => {
        return new PiecePosition(cloneCoordinate(pp.position)!, pp.piece);
      };
      
      const newOpponentKing = clonePiecePosition(this.opponentking);
      const newOpponentPieces = this.opponentpieces.map(pp => clonePiecePosition(pp));
      const newSelfPieces = this.selfpieces.map(pp => clonePiecePosition(pp));
      const newCapturedPieces = new Map(this.capturedPieces);
      
      return new Field(newOpponentKing, newOpponentPieces, newSelfPieces, newCapturedPieces);
    }

    // 手を進める
    static advanceStepField(field: Field, moveArray: MovePiece[]): Field {
        const newField = field.clone();

        // 手順を逆順に適用
        for (let i = 0; i < moveArray.length; i++) {
            const mv = moveArray[i];
            
            if (mv.IsDrop()) {
                // 持ち駒から打つ
                if (mv.IsSelfStep()) {
                    newField.selfpieces.push(new PiecePosition(mv.to, mv.piece));
                    const count = newField.capturedPieces.get(mv.piece) || 0;
                    if (count > 1) {
                        newField.capturedPieces.set(mv.piece, count - 1);
                    } else {
                        newField.capturedPieces.delete(mv.piece);
                    }
                }else{
                    newField.opponentpieces.push(new PiecePosition(mv.to, mv.piece));
                }
            } else {
                // 盤上の駒を移動
                // 移動元の駒を削除

                const current = mv.IsSelfStep() ? newField.selfpieces : newField.opponentpieces;
                const opponent = mv.IsSelfStep() ? newField.opponentpieces : newField.selfpieces;

                const fromIndex = current.findIndex(
                    pp => pp.position?.row === mv.from?.row && pp.position?.col === mv.from?.col
                );
                if (fromIndex !== -1) {
                    current[fromIndex].position = mv.to;
                    if (mv.change){
                        current[fromIndex].piece = mv.piece;
                    }
                }
                
                // 移動先に相手の駒がある場合、取る
                const opponentIndex = opponent.findIndex(
                    pp => pp.position?.row === mv.to.row && pp.position?.col === mv.to.col
                );
                if (opponentIndex !== -1) {
                    const capturedPiece = opponent[opponentIndex].piece;
                    opponent.splice(opponentIndex, 1);
                    
                    // 成り駒を元に戻して持ち駒に追加
                    if (mv.IsSelfStep()) {
                        let actualPiece = capturedPiece;
                        if (capturedPiece && capturedPiece in UNPROMOTED_MAP) {
                            actualPiece = UNPROMOTED_MAP[capturedPiece as string];
                        }
                        const count = newField.capturedPieces.get(actualPiece) || 0;
                        newField.capturedPieces.set(actualPiece, count + 1);
                    }
                }

                // 移動したのが敵の王なら位置を更新
                if (!mv.IsSelfStep() && (mv.piece === '王' || mv.piece === '玉')) {
                    newField.opponentking.position = mv.to;
                }
            }
        }
        return newField;
    }

    // 手を進めたフィールドを作成する
    static advanceBaseField(field: Field, move: MovePiece): Field {
        return this.advanceStepField(field, move.History());
    }

    // boardからFieldオブジェクトを作成
    static fromBoard(board: (Piece | null)[][], capturedArray: PieceType[]): Field {
      let opponentKing: PiecePosition | null = null;
      const opponentPieces: PiecePosition[] = [];
      const selfPieces: PiecePosition[] = [];

      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
          const piece = board[row][col];
          if (piece && piece.type) {
            const position = new Coordinate(row, col);
            const piecePos = new PiecePosition(position, piece.type);

            if (piece.side === 'opponent') {
              if (piece.type === '王' || piece.type === '玉') {
                opponentKing = piecePos;
              }
              opponentPieces.push(piecePos);
            } else if (piece.side === 'self') {
              selfPieces.push(piecePos);
            }
          }
        }
      }

      // 持ち駒を集計
      const capturedMap = new Map<PieceType, number>();
      for (const piece of capturedArray) {
        if (piece) {
          const count = capturedMap.get(piece) || 0;
          capturedMap.set(piece, count + 1);
        }
      }

      if (!opponentKing) {
        throw new Error('相手の玉が見つかりません');
      }

      return new Field(opponentKing, opponentPieces, selfPieces, capturedMap);
    }

    // FieldからBoard配列を作成
    toBoard(): (Piece | null)[][] {
      const board: (Piece | null)[][] = Array(9).fill(null).map(() => Array(9).fill(null));
      
      // 相手の玉を配置
      if (this.opponentking.position) {
        board[this.opponentking.position.row][this.opponentking.position.col] = {
          type: this.opponentking.piece,
          side: 'opponent'
        };
      }
      
      // 相手の駒を配置
      for (const pp of this.opponentpieces) {
        if (pp.position) {
          board[pp.position.row][pp.position.col] = {
            type: pp.piece,
            side: 'opponent'
          };
        }
      }
      
      // 自分の駒を配置
      for (const pp of this.selfpieces) {
        if (pp.position) {
          board[pp.position.row][pp.position.col] = {
            type: pp.piece,
            side: 'self'
          };
        }
      }
      
      return board;
    }
  }

  // FieldからBoard配列を作成する関数
  const fieldToBoard = (field: Field): (Piece | null)[][] => {
    return field.toBoard();
  };

  // Fieldをハッシュ文字列に変換（トランスポジション検出用）
  const hashField = (field: Field, side: string): string => {
    // 自分の駒を位置でソートして文字列化
    const selfPieces = field.selfpieces
      .filter(pp => pp.position)
      .map(pp => `${pp.position!.row}${pp.position!.col}${pp.piece}`)
      .sort()
      .join('|');
    
    // 相手の駒を位置でソートして文字列化
    const opponentPieces = field.opponentpieces
      .filter(pp => pp.position)
      .map(pp => `${pp.position!.row}${pp.position!.col}${pp.piece}`)
      .sort()
      .join('|');
    
    // 持ち駒をソートして文字列化
    const captured = Array.from(field.capturedPieces.entries())
      .sort((a, b) => (a[0] || '').localeCompare(b[0] || ''))
      .map(([piece, count]) => `${piece}:${count}`)
      .join(',');
    
    return `S${selfPieces}O${opponentPieces}C${captured}{${side}}`;
  };

  // 成功判定処理
  function setSuccess(move: MovePiece): boolean {
    // この処理は、自分の手番か確認
    if (!move.IsSelfStep()) {
        throw new Error('setSuccessは自分の手番で呼び出す必要があります');
    }

    move.status = 'success';
    if (move.prevMove){
        if (move.prevMove.prevMove){
            move.prevMove.status = 'success';
            // 直前の手のすべての選択肢が成功かチェック
            const allSiblingsSuccess = move.prevMove.prevMove.nextMove.every(mv => mv.getStatus() === 'success');
        
            if (allSiblingsSuccess) {
                // さらにその前の手がなければ、成功を返す
                if (move.prevMove.prevMove){
                    return setSuccess(move.prevMove.prevMove);
                }else{
                    return true;
                }
            }
        }
        return false;
    }else{
        return true;
    }
  }

  // 詰将棋の解析メイン関数（非同期版）
  const analyzeMateAsync = async (
    initialBoard: (Piece | null)[][], 
    initialCaptured: PieceType[], 
    abortSignal?: AbortSignal
  ): Promise<{ 
    steps: string[], 
    moves: MovePiece[], 
    initialField: Field, 
    rootMoves: MovePiece[],
    timedOut?: boolean,
    queueSize?: number,
    maxStepReached?: number
  }> => {
    const steps: string[] = [];
    const maxDepth = 15; // 最大探索深さ

    const field = Field.fromBoard(initialBoard, initialCaptured);
    
    // 優先度付きキューを作成
    const queue = new PriorityQueue();

    let computedMove: MovePiece | null = null;
    let nodeCount = 0;
    let maxStepReached = 0;
    let hashcount = 0;
    const yieldInterval = 1000; // 1000ノードごとにイベントループに制御を戻す

    const attackerMoves = generateSelfMoves(field, 0, null);
    queue.pushArray(0, attackerMoves);

    // トランスポジション（同一局面）検出用
    const visitedFields = new Map<string, MovePiece>(); // ハッシュ → 最初のMovePiece

    while(!queue.isEmpty()) {
        // タイムアウトチェック
        if (abortSignal?.aborted) {
            console.log('タイムアウトにより探索を中断しました');
            // タイムアウト時も部分結果を返す
            return { 
              steps: [], 
              moves: [], 
              initialField: field, 
              rootMoves: attackerMoves,
              timedOut: true,
              queueSize: queue.size(),
              maxStepReached
            };
        }

        const move = queue.pop();
        if (!move) break;
        if (maxDepth <= move.step) {
            continue;
        }

        nodeCount++;
        maxStepReached = Math.max(maxStepReached, move.step);
        // 定期的にイベントループに制御を戻す
        if (nodeCount % yieldInterval === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        const step = move.step + 1;
        if (step % 2 === 0) {
            // 攻め方の手番
            // 前回の自分の手が失敗していたらスキップ
            if (move.prevMove && move.prevMove.getStatus() === 'failure') continue;

            // 攻め方を列挙する関数
            const nextField = Field.advanceBaseField(field, move);

            // トランスポジション検出（同一盤面をスキップ）
            const fieldHash = hashField(nextField, "s");
            if (visitedFields.has(fieldHash)) {
                // 既に探索済みの盤面 - リダイレクト設定
                const firstMove = visitedFields.get(fieldHash);
                if (firstMove) {
                    move.redirectMove = firstMove;
                }
                hashcount++;
                continue;
            }
            visitedFields.set(fieldHash, move);

            // 駒数チェック：全滅 or 手持ちなし＋駒1枚で負け
            if (nextField.selfpieces.length == 0 || nextField.selfpieces.length + nextField.capturedPieces.size < 2) {
                if (move.prevMove) {
                    move.prevMove.status = 'failure';
                }
                continue;
            }
            const attackerMoves = generateSelfMoves(nextField, step, move);
            if (attackerMoves.length === 0) {
                // 攻め手がないので負け確定
                if (move.prevMove) {
                    move.prevMove.status = 'failure';
                }
                continue;
            }

            queue.pushArray(step, attackerMoves);
        }else{
            // 守り方の手番
            // 前回の相手の手が成功していたらスキップ
            if (move.prevMove && move.prevMove.getStatus() === 'success') continue;

            const nextField = Field.advanceBaseField(field, move);

            // トランスポジション検出（同一盤面をスキップ）
            const fieldHash = hashField(nextField, "o");
            if (visitedFields.has(fieldHash)) {
                // 既に探索済みの盤面 - リダイレクト設定
                const firstMove = visitedFields.get(fieldHash);
                if (firstMove) {
                    move.redirectMove = firstMove;
                }
                hashcount++;
                continue;
            }
            visitedFields.set(fieldHash, move);

            const attackerMoves = generateOpponentMoves(nextField, step, move);
            if (attackerMoves.length === 0) {
                // 直前の手が打ち歩詰めかチェック
                if (move && move.piece === '歩' && move.IsDrop()) {
                    // 打ち歩詰めなので詰みではない
                    move.status = 'failure';
                    continue;
                }

                // 詰みを発見
                const result = setSuccess(move);

                if (result) {
                    computedMove = move;
                    break;
                }
            }
            queue.pushArray(step, attackerMoves);
        }
    }

    if (computedMove) {
        // 手順を記録
        const moveSequence: MovePiece[] = [];
        let movePtr: MovePiece | null = computedMove;
        while (movePtr) {
            moveSequence.push(movePtr);
            movePtr = movePtr.prevMove;
        }
        moveSequence.reverse();
        moveSequence.forEach(mv => {
            steps.push(formatMove(mv));
        });
        return { steps, moves: moveSequence, initialField: field, rootMoves: attackerMoves };
    }

    console.log(`探索終了: ノード数=${nodeCount}, トランスポジションヒット=${hashcount}`);

    return { steps: [], moves: [], initialField: field, rootMoves: attackerMoves };
  };

  // 駒の移動先を取得
  const getPieceMoves = (board: (Piece | null)[][], pos : Coordinate, pieceType : PieceType, side : Side = 'self', trample :boolean = false): Coordinate[] => {
    const moves: Coordinate[] = [];
    const directions = getPieceDirections(pieceType, side);
    
    for (const [dr, dc, range] of directions) {
      for (let i = 1; i <= range; i++) {
        const newRow = pos.row + dr * i;
        const newCol = pos.col + dc * i;
        
        if (newRow < 0 || newRow >= 9 || newCol < 0 || newCol >= 9) break;
        
        const target = board[newRow][newCol];
        // trampleがtrueの場合、自分の駒にも移動できる
        if (target && target.side === side && !trample && (side !== 'self' || target.type !== '玉')) break;
        
        moves.push(new Coordinate(newRow, newCol));
        
        // 自分の場合、玉を貫通する
        if (target && (side !== 'self' || target.type !== '玉')) break; // 相手の駒で止まる
      }
    }
    
    return moves;
  };

  // 駒の移動方向を取得（簡略版）
  const getPieceDirections = (pieceType: PieceType, side: Side): [number, number, number][] => {
    const isOpponent = side === 'opponent';
    const forward = isOpponent ? 1 : -1;
    
    switch (pieceType) {
      case '歩':
        return [[forward, 0, 1]];
      case '香':
        return [[forward, 0, 9]];
      case '桂':
        return [[forward * 2, -1, 1], [forward * 2, 1, 1]];
      case '銀':
        return [[forward, -1, 1], [forward, 0, 1], [forward, 1, 1], [-forward, -1, 1], [-forward, 1, 1]];
      case '金':
      case 'と':
      case '成香':
      case '成桂':
      case '成銀':
        return [[forward, -1, 1], [forward, 0, 1], [forward, 1, 1], [0, -1, 1], [0, 1, 1], [-forward, 0, 1]];
      case '王':
      case '玉':
        return [[-1, -1, 1], [-1, 0, 1], [-1, 1, 1], [0, -1, 1], [0, 1, 1], [1, -1, 1], [1, 0, 1], [1, 1, 1]];
      case '飛':
        return [[-1, 0, 9], [1, 0, 9], [0, -1, 9], [0, 1, 9]];
      case '龍':
        return [[-1, 0, 9], [1, 0, 9], [0, -1, 9], [0, 1, 9], [-1, -1, 1], [-1, 1, 1], [1, -1, 1], [1, 1, 1]];
      case '角':
        return [[-1, -1, 9], [-1, 1, 9], [1, -1, 9], [1, 1, 9]];
      case '馬':
        return [[-1, -1, 9], [-1, 1, 9], [1, -1, 9], [1, 1, 9], [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1]];
      default:
        return [];
    }
  };

  // 王が詰んでいないかチェック（守り方の手の有効性確認）
  // 駒の移動可能な位置を生成
  const generateSelfMoves = (field: Field, steps : number, prevMove: MovePiece | null): MovePiece[] => {
    const moves: MovePiece[] = [];
    
    const board = fieldToBoard(field);
    const kingpos = field.opponentking.position ?? new Coordinate(0, 0);
    // 盤上の駒の移動
    field.selfpieces.forEach(pp => {
        // 自分の駒の移動範囲を取得
        const pos = pp.position;
        if (pos && pp.piece) {
            // 自分の駒の移動範囲を取得
            const pieceMoves = getPieceMoves(board, pos, pp.piece, 'self');
            // 王手の範囲を取得
            const kingMoveList = getPieceMoves(board, kingpos, pp.piece, 'opponent', true);
            // この2つが重なった場所が王手の範囲
            pieceMoves.forEach(move => {
                if (kingMoveList.some(km => km.row === move.row && km.col === move.col)) {
                    moves.push(new MovePiece(steps, pp.piece, pos, move, prevMove));
                }
            });
            // 成れるコマか
            if (pp.piece in PROMOTED_MAP) {
                const promotedType = PROMOTED_MAP[pp.piece];

                // 王手の範囲を取得
                const kingMovePromotedList = getPieceMoves(board, kingpos, promotedType, 'opponent', true);
                if (pos.isEnemyField()) {
                    // この2つが重なった場所が王手の範囲
                    pieceMoves.forEach(move => {
                        if (kingMovePromotedList.some(km => km.row === move.row && km.col === move.col)) {
                            moves.push(new MovePiece(steps, promotedType, pos, move, prevMove, true));
                        }
                    }); 
                }else{
                    // 移動後の位置が敵陣の場合も成れる
                    pieceMoves.forEach(move => {
                        if (move.isEnemyField() && kingMovePromotedList.some(km => km.row === move.row && km.col === move.col)) {
                            moves.push(new MovePiece(steps, promotedType, pos, move, prevMove, true));
                        }
                    }); 
                }

            }
        }
    });

    // 持ち駒の打ち場所
    field.capturedPieces.forEach((count, pieceType) => {
        if (count > 0) {
            // 王手の範囲を取得
            const kingMoveList = getPieceMoves(board, kingpos, pieceType, 'opponent');
            // 王手の範囲
            kingMoveList.forEach(move => {
                if (board[move.row][move.col] === null){
                    moves.push(new MovePiece(steps, pieceType, null, move, prevMove));
                }
            });
        }
    });

    return moves;
  };

  // 相手の駒の移動可能な位置を生成（守り方）
  const generateOpponentMoves = (field: Field, steps: number, prevMove: MovePiece | null): MovePiece[] => {
    const moves: MovePiece[] = [];
    const attackedPieces : PiecePosition[] = [];
    const longrangePieces: PiecePosition[] = [];
    const kingpos = field.opponentking.position ?? new Coordinate(0, 0);
    
    // 利きマスの一覧
    const board = fieldToBoard(field);
    const attackSquares = new Set<number>();
    field.selfpieces.forEach(pp => {
        if (pp.position) {
            const pieceMoves = getPieceMoves(board, pp.position, pp.piece, 'self', true);
            pieceMoves.forEach(move => {
                attackSquares.add(move.hash());
            });

            // 王を攻撃している駒を記録
            if (pieceMoves.some(mv => mv.row === kingpos.row && mv.col === kingpos.col)) {
                attackedPieces.push(pp);
                // 遠距離ユニットの場合は別に記録
                if (pp.piece && LONG_RANGE_PIECES.includes(pp.piece)) {
                    // 王に隣接していない
                    if (Math.abs(pp.position.row - kingpos.row) > 1 || Math.abs(pp.position.col - kingpos.col) > 1){
                        longrangePieces.push(pp);
                    }
                }
            }
        }
    });

    // 王が逃げる手を考える
    const kingMoves = getPieceMoves(board, kingpos, '玉', 'opponent' );
    kingMoves.forEach(move => {
        // 自分の駒の利きがないマスにのみ逃げられる
        if (!attackSquares.has(move.hash())) {
            moves.push(new MovePiece(steps, '玉', kingpos, move, prevMove));
        }
    });

    // 攻撃している駒を取る
    if (attackedPieces.length == 1) {
        const targetPos = attackedPieces[0].position ?? new Coordinate(0, 0);
        field.opponentpieces.forEach(pp => {
            //王は逃げる手で考慮済みなので除外
            if (pp.piece === '玉') return;

            // 自分の駒で攻撃している駒を取れるか？
            const pieceMove = getPieceMoves(board, pp.position!, pp.piece, 'opponent' );
            if (pieceMove.some(mv => mv.row === targetPos.row && mv.col === targetPos.col)) {
                moves.push(new MovePiece(steps, pp.piece, pp.position, targetPos, prevMove));
            }
        });
    }

    // 合駒を打つ
    if (attackedPieces.length == 1 && longrangePieces.length == 1) {
        const attackedPos = longrangePieces[0].position;
        // 王と攻撃されている駒の間のマスに歩を打つ
        const xstep = Math.sign(attackedPos!.col - kingpos.col);
        const ystep = Math.sign(attackedPos!.row - kingpos.row);

        for(let i = 1; i < 9; i++) {
            const betweenRow = kingpos.row + ystep * i;
            const betweenCol = kingpos.col + xstep * i;
            if (betweenRow === attackedPos!.row && betweenCol === attackedPos!.col) {
                break;
            }
            if (betweenRow < 0 || betweenRow >= 9 || betweenCol < 0 || betweenCol >= 9) {
                break;
            }
            moves.push(new MovePiece(steps, '歩', null, new Coordinate(betweenRow, betweenCol), prevMove));
        }
    }

    return moves;
  }

  const StatusFormat = (status : Status) : string => {
    switch(status){
        case 'success':
            return '【成功】';
        case 'failure':
            return '【失敗】';
        default:
            return '';
    }
  };

  // 手を文字列化
  const formatMove = (move: MovePiece, success: boolean = false): string => {
    const str = success ? StatusFormat(move.getStatus()) : '';

    if (move.from === null) {
      return `${move.step + 1}手: 持ち駒の${move.piece}を${9 - move.to.col}${KANJI_NUMBERS[move.to.row + 1]}に打つ` + str;
    } else if (move.from) {
        if (move.change) {
            return `${move.step + 1}手: ${9 - move.from.col}${KANJI_NUMBERS[move.from.row + 1]}の${UNPROMOTED_MAP[move.piece as string]}を${9 - move.to.col}${KANJI_NUMBERS[move.to.row + 1]}へ成る` + str;
        }
        return `${move.step + 1}手: ${9 - move.from.col}${KANJI_NUMBERS[move.from.row + 1]}の${move.piece}を${9 - move.to.col}${KANJI_NUMBERS[move.to.row + 1]}へ` + str;
    }
    return '';
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
      if (a.status === 'success' && b.status !== 'success') return -1;
      if (a.status !== 'success' && b.status === 'success') return 1;
      
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
    <main className="max-w-6xl mx-auto p-6">
      <div className="flex items-center mb-4 gap-2">
        <Link href="/" className="inline-block px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">トップに戻る</Link>
      </div>

      <h2 className="text-2xl font-bold mb-4">詰将棋ソルバー</h2>

      {/* ボタン */}
      <div className="mb-4 flex gap-2 items-center">
        {!viewMode ? (
          <>
            <button
              className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
            >{isAnalyzing ? '解析中...' : '解析'}</button>
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
              onClick={handlePrevStep}
              disabled={currentPath.length === 0}
            >←</button>
            <span className="px-4 py-2 font-semibold">
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

      <div className="flex gap-8">
        {/* 盤面と持ち駒 */}
        <div>
          <h3 className="font-semibold mb-2">盤面{viewMode ? '' : '（クリックで選択）'}</h3>
          <div className="inline-block">
            {/* 列番号（上） */}
            <div className="flex">
              <div className="w-6"></div> {/* 左上の空白 */}
              {[9, 8, 7, 6, 5, 4, 3, 2, 1].map(col => (
                <div key={col} className="w-12 text-center text-sm font-semibold">{col}</div>
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
                      className={`w-12 h-12 border border-amber-900 flex items-center justify-center text-xl font-bold relative
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
                  <div key={row} className="h-12 flex items-center text-sm font-semibold">
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
                    className={`w-12 h-12 border-2 border-blue-700 bg-blue-50 flex items-center justify-center text-xl font-bold text-blue-700
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
                  className={`w-12 h-12 border-2 border-dashed border-gray-400 bg-gray-50 cursor-pointer flex items-center justify-center text-xl
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
              <div className="grid grid-cols-4 gap-2">
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
              <div className="grid grid-cols-4 gap-2">
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
                  {getFilteredMoves().map((move, index) => (
                    <button
                      key={index}
                      className="w-full px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded text-left text-sm"
                      onClick={() => handleSelectMove(move)}
                    >
                      <div className="font-semibold text-blue-700">
                        {formatMove(move, true)}
                      </div>
                    </button>
                  ))}
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
            <p className="text-sm text-gray-600 mb-2">形式: x y 側(S/O) 駒種類</p>
            <textarea
              className="w-full h-64 p-2 border rounded font-mono text-sm"
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

