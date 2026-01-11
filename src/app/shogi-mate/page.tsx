"use client";
import { useState } from "react";
import Link from "next/link";

type PieceType = '歩' | '香' | '桂' | '銀' | '金' | '王' | '玉' | '飛' | '角' | 'と' | '成香' | '成桂' | '成銀' | '龍' | '馬' | null;
type Side = 'self' | 'opponent' | null;

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
    
    // 相手の駒は180度回転
    if (piece.side === 'opponent') {
      return (
        <span className="inline-block" style={{transform: 'rotate(180deg)'}}>
          {piece.type}
        </span>
      );
    }
    
    return piece.type;
  };

  // リセット
  const handleReset = () => {
    setBoard(Array(9).fill(null).map(() => Array(9).fill(null)));
    setSelectedCell(null);
    setCapturedPieces([]);
    setSelectedCapturedIndex(null);
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
    } catch (error) {
      alert("インポートに失敗しました。形式を確認してください。");
    }
  };

  // 解析処理（仮実装）
  const handleAnalyze = () => {
    setIsAnalyzing(true);
    setSolutionSteps([]);
    
    const timeoutMs = 10000; // 10秒でタイムアウト
    
    // 非同期で解析を実行
    setTimeout(() => {
      const timeoutPromise = new Promise<string[]>((_, reject) => {
        setTimeout(() => reject(new Error('タイムアウトしました')), timeoutMs);
      });
      
      const analyzePromise = new Promise<string[]>((resolve) => {
        const steps = analyzeMate(board, capturedPieces);
        resolve(steps);
      });
      
      Promise.race([analyzePromise, timeoutPromise])
        .then((steps) => {
          console.log("解析結果:", steps);
          setSolutionSteps(steps);
        })
        .catch((error) => {
          if (error instanceof Error) {
            alert(error.message);
          }
        })
        .finally(() => {
          setIsAnalyzing(false);
        });
    }, 100);
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
    constructor(step: number, piece: PieceType, from: Coordinate | null, to: Coordinate, prevMove: MovePiece | null, change: boolean = false) {
        this.step = step;
        this.piece = piece;
        this.from = from;
        this.to = to;
        this.change = change;
        this.prevMove = prevMove;
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
    position: Coordinate | null;
    piece: PieceType;
    constructor(position: Coordinate, piece: PieceType) {
        this.position = position;
        this.piece = piece;
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

    // 手を進めたフィールドを作成する
    static advanceField(field: Field, move: MovePiece): Field {
        const newField = field.clone();
        // MovePieceから履歴をたどる
        const moveHistory: MovePiece[] = [];
        let currentMove: MovePiece | null = move;
        while (currentMove) {
            moveHistory.push(currentMove);
            currentMove = currentMove.prevMove;
        } 
        // 手順を逆順に適用
        for (let i = moveHistory.length - 1; i >= 0; i--) {
            const mv = moveHistory[i];
            
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
                if (!mv.IsSelfStep() && mv.piece === '王') {
                    newField.opponentking.position = mv.to;
                }
            }
        }

        return newField;
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

  // 詰将棋の解析メイン関数
  const analyzeMate = (initialBoard: (Piece | null)[][], initialCaptured: PieceType[]): string[] => {
    const steps: string[] = [];
    let currentBoard = initialBoard.map(row => [...row]);
    let currentCaptured = [...initialCaptured];
    let depth = 0;
    const maxDepth = 3; // 最大探索深さ

    const field = Field.fromBoard(currentBoard, currentCaptured);

    const moveHistory = new Map<number, MovePiece[]>();

    for(let step = 0; step < maxDepth; step++) {
        // 詰み探索開始
        if (step % 2 === 0) {
            // 攻め方を列挙する関数
            if (step == 0){
                const attackerMoves = generateSelfMoves(field, step, null);
                moveHistory.set(step, attackerMoves);
            }else{
                const prevMoves = moveHistory.get(step - 1) || [];
                prevMoves.forEach(prevMove => {
                    const nextField = Field.advanceField(field, prevMove);
                    const attackerMoves = generateSelfMoves(field, step, prevMoves[prevMoves.length - 1]);
                    if(!moveHistory.has(step)){
                        moveHistory.set(step, attackerMoves);
                    }else{
                        const existingMoves = moveHistory.get(step) || [];
                        existingMoves.push(...attackerMoves);
                        moveHistory.set(step, existingMoves);
                    }
                });
                if (moveHistory.get(step)?.length === 0){
                    break;
                }
            }
        }else{
            // 守り方を列挙する関数
            const prevMoves = moveHistory.get(step - 1) || [];
            let computedMove: MovePiece | null = null;
            prevMoves.forEach(prevMove => {
                const nextField = Field.advanceField(field, prevMove);
                const attackerMoves = generateOpponentMoves(nextField, step, prevMove);

                if (attackerMoves.length === 0) {
                    // 詰みを発見
                    computedMove = prevMove;
                    return;
                }
                moveHistory.set(step, attackerMoves);
            });

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
                break;
            }
        }
    }

    return steps;
  };

  // 駒の移動先を取得
  const getPieceMoves = (board: (Piece | null)[][], pos : Coordinate, pieceType : PieceType, side : Side = 'self'): Coordinate[] => {
    const moves: Coordinate[] = [];
    const directions = getPieceDirections(pieceType, side);
    
    for (const [dr, dc, range] of directions) {
      for (let i = 1; i <= range; i++) {
        const newRow = pos.row + dr * i;
        const newCol = pos.col + dc * i;
        
        if (newRow < 0 || newRow >= 9 || newCol < 0 || newCol >= 9) break;
        
        const target = board[newRow][newCol];
        if (target && target.side === side) break;
        
        moves.push(new Coordinate(newRow, newCol));
        
        if (target) break; // 相手の駒で止まる
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

  // 駒の移動可能な位置を生成
  const generateSelfMoves = (field: Field, steps : number, prevMove: MovePiece | null): MovePiece[] => {
    const moves: MovePiece[] = [];
    
    const board = fieldToBoard(field);
    const kingpos = field.opponentking.position ?? new Coordinate(0, 0);
    // 盤上の駒の移動
    field.selfpieces.forEach(pp => {
        // 自分の駒の移動範囲を取得
        const pos = pp.position;
        if (pos) {
            // 自分の駒の移動範囲を取得
            const pieceMoves = getPieceMoves(board, pos, pp.piece, 'self');
            // 王手の範囲を取得
            const kingMoveList = getPieceMoves(board, kingpos, pp.piece, 'opponent');
            // この2つが重なった場所が王手の範囲
            pieceMoves.forEach(move => {
                if (kingMoveList.some(km => km.row === move.row && km.col === move.col)) {
                    moves.push(new MovePiece(steps, pp.piece, pos, move, prevMove));
                }
            });
            // 成れるコマか
            if (pp.piece && pp.piece in PROMOTED_MAP) {
                const promotedType = PROMOTED_MAP[pp.piece];
                // 成り駒の移動範囲を取得
                const promotedMoves = getPieceMoves(board, pos, promotedType, 'self' );
                // 王手の範囲を取得
                const kingMovePromotedList = getPieceMoves(board, kingpos, promotedType, 'opponent' );
                if (pos.isEnemyField()) {
                    // この2つが重なった場所が王手の範囲
                    promotedMoves.forEach(move => {
                        if (kingMovePromotedList.some(km => km.row === move.row && km.col === move.col)) {
                            moves.push(new MovePiece(steps, promotedType, pos, move, prevMove, true));
                        }
                    }); 
                }else{
                    // 移動後の位置が敵陣の場合も成れる
                    promotedMoves.forEach(move => {
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
                moves.push(new MovePiece(steps, pieceType, null, move, prevMove));
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
            const pieceMoves = getPieceMoves(board, pp.position, pp.piece, 'self');
            pieceMoves.forEach(move => {
                attackSquares.add(move.hash());
            });

            // 王を攻撃している駒を記録
            if (pieceMoves.some(mv => mv.row === kingpos.row && mv.col === kingpos.col)) {
                attackedPieces.push(pp);
                // 遠距離ユニットの場合は別に記録
                if (pp.piece && pp.piece in LONG_RANGE_PIECES) {
                // 王に隣接していない
                    if (Math.abs(pp.position.row - kingpos.row) > 1 || Math.abs(pp.position.col - kingpos.col) > 1){
                        longrangePieces.push(pp);
                    }
                }
            }
        }
    });

    // 王が逃げる手を考える
    const kingMoves = getPieceMoves(board, kingpos, '王', 'opponent' );
    kingMoves.forEach(move => {
        // 自分の駒の利きがないマスにのみ逃げられる
        if (!attackSquares.has(move.hash())) {
            moves.push(new MovePiece(steps, '王', kingpos, move, prevMove));
        }
    });

    // 攻撃している駒を取る
    console.log("攻撃している駒:", attackedPieces.map(ap => `${ap.piece} at (${ap.position?.row},${ap.position?.col})`));
    if (attackedPieces.length == 1) {
        const targetPos = attackedPieces[0].position ?? new Coordinate(0, 0);
        field.opponentpieces.forEach(pp => {
            const pieceMove = getPieceMoves(board, pp.position!, pp.piece, 'opponent' );
            if (pieceMove.some(mv => mv.row === targetPos.row && mv.col === targetPos.col)) {
                moves.push(new MovePiece(steps, pp.piece, pp.position, targetPos, prevMove));
            }
        });
    }

    // 合駒を打つ
    if (attackedPieces.length == 1) {
        const attackedPos = attackedPieces[0].position;
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

    console.log("自分の手:", formatMove(prevMove!));
    console.log("相手の手候補:", moves.map(mv => formatMove(mv)));

    // それぞれの行動が、詰んでないかを確認(ToDo)

    return moves;
  }

  // 手を文字列化
  const formatMove = (move: MovePiece): string => {
    if (move.from === null) {
      return `${move.step + 1}手: 持ち駒を${move.piece}を${9 - move.to.col}${move.to.row + 1}に打つ`;
    } else if (move.from) {
        if (move.change) {
            return `${move.step + 1}手: ${9 - move.from.col}${move.from.row + 1}の${UNPROMOTED_MAP[move.piece as string]}を${9 - move.to.col}${move.to.row + 1}へ成る`;
        }
        return `${move.step + 1}手: ${9 - move.from.col}${move.from.row + 1}の${move.piece}を${9 - move.to.col}${move.to.row + 1}へ`;
    }
    return '';
  };

  // サンプル問題を読み込む
  const handleSample = () => {
    const newBoard: (Piece | null)[][] = Array(9).fill(null).map(() => Array(9).fill(null));
    
    // サンプルデータ
    newBoard[0][3] = { type: '金', side: 'opponent' }; // 4 1 O 金
    newBoard[0][4] = { type: '玉', side: 'opponent' }; // 5 1 O 玉
    newBoard[0][5] = { type: '金', side: 'opponent' }; // 6 1 O 金
    newBoard[2][4] = { type: '銀', side: 'self' };     // 5 3 S 銀
    newBoard[4][7] = { type: '角', side: 'self' };     // 8 5 S 角
    
    setBoard(newBoard);
    setCapturedPieces(['金']);
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
      <div className="mb-4 flex gap-2">
        <button
          className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200"
          onClick={handleAnalyze}
        >解析</button>
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
      </div>

      <div className="flex gap-8">
        {/* 盤面と持ち駒 */}
        <div>
          <h3 className="font-semibold mb-2">盤面（クリックで選択）</h3>
          <div className="inline-block border-4 border-amber-900 bg-amber-100">
            {board.map((row, rowIndex) => (
              <div key={rowIndex} className="flex">
                {row.map((piece, colIndex) => {
                  const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={`w-12 h-12 border border-amber-900 cursor-pointer flex items-center justify-center text-xl font-bold
                        ${isSelected ? 'bg-yellow-300' : 'bg-amber-50 hover:bg-amber-200'}
                        ${piece?.side === 'self' ? 'text-blue-700' : ''}
                        ${piece?.side === 'opponent' ? 'text-red-700' : ''}
                      `}
                      onClick={() => handleCellClick(rowIndex, colIndex)}
                    >
                      {renderPiece(piece)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* 持ち駒欄 */}
          <div className="mt-6">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">持ち駒:</span>
              {capturedPieces.map((piece, index) => (
                <div
                  key={index}
                  className={`w-12 h-12 border-2 border-blue-700 bg-blue-50 cursor-pointer flex items-center justify-center text-xl font-bold text-blue-700
                    ${selectedCapturedIndex === index ? 'bg-yellow-300 border-yellow-500' : 'hover:bg-blue-100'}
                  `}
                  onClick={() => handleCapturedClick(index)}
                >
                  {piece}
                </div>
              ))}
              {/* 空欄 */}
              <div
                className={`w-12 h-12 border-2 border-dashed border-gray-400 bg-gray-50 cursor-pointer flex items-center justify-center text-xl
                  ${selectedCapturedIndex === capturedPieces.length ? 'bg-yellow-300 border-yellow-500' : 'hover:bg-gray-100'}
                `}
                onClick={() => handleCapturedClick(capturedPieces.length)}
              >
                <span className="text-gray-400">+</span>
              </div>
            </div>
          </div>
        </div>

        {/* 駒選択パネル */}
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

            {/* リセットボタン */}
            <div>
              <button
                className="w-full px-4 py-2 bg-red-200 text-red-700 rounded hover:bg-red-300 font-bold"
                onClick={handleReset}
              >
                盤面リセット
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
        <p>※ 相手の駒は赤色（上向き）、自分の駒は青色（下向き）で表示されます</p>
        <p>※ 持ち駒は自分の駒のみ配置できます。空欄（+）をクリックして駒を追加できます</p>
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
