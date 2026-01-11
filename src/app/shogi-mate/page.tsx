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
    alert("解析機能は実装中です");
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
