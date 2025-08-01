'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface Position {
  x: number;
  y: number;
}

interface Block {
  id: string;
  colors: [string, string]; // 2つの円の色
  position: Position;
  rotation: 0 | 90; // 0度または90度回転
  isOnField: boolean;
  isError: boolean;
  originalPosition: Position;
}

interface FieldCell {
  colors: string[];
  finalColor: string;
}

export default function PuzzlePage() {
  const [gameStarted, setGameStarted] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);
  
  // 初期ブロック配置
  const initialBlocks: Block[] = [
    { id: 'rr', colors: ['red', 'red'], position: { x: 50, y: 450 }, rotation: 0, isOnField: false, isError: false, originalPosition: { x: 50, y: 450 } },
    { id: 'rb', colors: ['red', 'blue'], position: { x: 200, y: 450 }, rotation: 0, isOnField: false, isError: false, originalPosition: { x: 200, y: 450 } },
    { id: 'rg', colors: ['red', 'green'], position: { x: 350, y: 450 }, rotation: 0, isOnField: false, isError: false, originalPosition: { x: 350, y: 450 } },
    { id: 'bb', colors: ['blue', 'blue'], position: { x: 50, y: 600 }, rotation: 0, isOnField: false, isError: false, originalPosition: { x: 50, y: 600 } },
    { id: 'bg', colors: ['blue', 'green'], position: { x: 200, y: 600 }, rotation: 0, isOnField: false, isError: false, originalPosition: { x: 200, y: 600 } },
    { id: 'gg', colors: ['green', 'green'], position: { x: 350, y: 600 }, rotation: 0, isOnField: false, isError: false, originalPosition: { x: 350, y: 600 } }
  ];

  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    dragId: string | null;
    offset: Position;
  }>({
    isDragging: false,
    dragId: null,
    offset: { x: 0, y: 0 }
  });

  const [playerField, setPlayerField] = useState<FieldCell[][]>(
    Array(3).fill(null).map(() => Array(3).fill(null).map(() => ({ colors: [], finalColor: 'transparent' })))
  );
  
  const [targetField, setTargetField] = useState<FieldCell[][]>(
    Array(3).fill(null).map(() => Array(3).fill(null).map(() => ({ colors: [], finalColor: 'transparent' })))
  );

  const containerRef = useRef<HTMLDivElement>(null);

  // タイマー機能
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      interval = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  // 色の混合計算
  const mixColors = (colors: string[]): string => {
    if (colors.length === 0) return 'transparent';
    if (colors.length === 1) return colors[0];

    const colorMap: Record<string, { r: number; g: number; b: number }> = {
      red: { r: 255, g: 0, b: 0 },
      green: { r: 0, g: 255, b: 0 },
      blue: { r: 0, g: 0, b: 255 }
    };

    let r = 0, g = 0, b = 0;
    colors.forEach(color => {
      if (colorMap[color]) {
        r = Math.min(255, r + colorMap[color].r);
        g = Math.min(255, g + colorMap[color].g);
        b = Math.min(255, b + colorMap[color].b);
      }
    });

    return `rgb(${r}, ${g}, ${b})`;
  };

  // フィールドの座標からグリッド位置を計算
  const getGridPosition = (x: number, y: number): { row: number; col: number } | null => {
    const fieldStartX = 50; // 左フィールドの開始X座標
    const fieldStartY = 100; // フィールドの開始Y座標
    const cellSize = 100;

    if (x < fieldStartX || x >= fieldStartX + cellSize * 3 || 
        y < fieldStartY || y >= fieldStartY + cellSize * 3) {
      return null;
    }

    const col = Math.floor((x - fieldStartX) / cellSize);
    const row = Math.floor((y - fieldStartY) / cellSize);
    
    return { row, col };
  };

  // ブロックの衝突検知
  const checkCollision = (block: Block, excludeId: string): boolean => {
    const blockPositions = getBlockCellPositions(block);
    
    for (const otherBlock of blocks) {
      if (otherBlock.id === excludeId || !otherBlock.isOnField) continue;
      
      const otherPositions = getBlockCellPositions(otherBlock);
      
      // 2つのセルが両方とも重なっている場合
      let overlapCount = 0;
      for (const pos1 of blockPositions) {
        for (const pos2 of otherPositions) {
          if (pos1.row === pos2.row && pos1.col === pos2.col) {
            overlapCount++;
          }
        }
      }
      
      if (overlapCount === 2) {
        return true; // エラー: 両方のセルが重なっている
      }
    }
    
    return false;
  };

  // ブロックが占有するセル位置を取得
  const getBlockCellPositions = (block: Block): Array<{ row: number; col: number }> => {
    const gridPos = getGridPosition(block.position.x, block.position.y);
    if (!gridPos) return [];

    const positions = [gridPos];
    
    if (block.rotation === 0) {
      // 横向き: 右隣のセル
      if (gridPos.col < 2) {
        positions.push({ row: gridPos.row, col: gridPos.col + 1 });
      }
    } else {
      // 縦向き: 下隣のセル
      if (gridPos.row < 2) {
        positions.push({ row: gridPos.row + 1, col: gridPos.col });
      }
    }

    return positions;
  };

  // フィールドを更新
  const updatePlayerField = useCallback(() => {
    const newField: FieldCell[][] = Array(3).fill(null).map(() => 
      Array(3).fill(null).map(() => ({ colors: [], finalColor: 'transparent' }))
    );

    // 各ブロックからフィールドに色を追加
    blocks.forEach(block => {
      if (!block.isOnField || block.isError) return;
      
      const positions = getBlockCellPositions(block);
      positions.forEach((pos, index) => {
        if (pos.row >= 0 && pos.row < 3 && pos.col >= 0 && pos.col < 3) {
          newField[pos.row][pos.col].colors.push(block.colors[index]);
        }
      });
    });

    // 色を混合
    newField.forEach(row => {
      row.forEach(cell => {
        cell.finalColor = mixColors(cell.colors);
      });
    });

    setPlayerField(newField);
  }, [blocks]);

  // 例題を生成
  const generateTarget = useCallback(() => {
    const targetBlocks = [...initialBlocks];
    const usedPositions = new Set<string>();
    
    // ランダムな配置を生成
    targetBlocks.forEach(block => {
      let placed = false;
      let attempts = 0;
      
      while (!placed && attempts < 100) {
        const row = Math.floor(Math.random() * 3);
        const col = Math.floor(Math.random() * 3);
        const rotation = Math.random() < 0.5 ? 0 : 90;
        
        // 配置可能かチェック
        const positions = [];
        positions.push({ row, col });
        
        if (rotation === 0 && col < 2) {
          positions.push({ row, col: col + 1 });
        } else if (rotation === 90 && row < 2) {
          positions.push({ row: row + 1, col });
        }
        
        // 範囲外チェック
        if (positions.some(pos => pos.row >= 3 || pos.col >= 3)) {
          attempts++;
          continue;
        }
        
        // 重複チェック（1つのセルは重複可能、2つは不可）
        const posKeys = positions.map(pos => `${pos.row}-${pos.col}`);
        const conflicts = posKeys.filter(key => usedPositions.has(key));
        
        if (conflicts.length < 2) {
          // 配置可能
          posKeys.forEach(key => usedPositions.add(key));
          
          block.position = { 
            x: 50 + col * 100, 
            y: 100 + row * 100 
          };
          block.rotation = rotation as 0 | 90;
          block.isOnField = true;
          placed = true;
        }
        
        attempts++;
      }
    });

    // 目標フィールドを計算
    const newTargetField: FieldCell[][] = Array(3).fill(null).map(() => 
      Array(3).fill(null).map(() => ({ colors: [], finalColor: 'transparent' }))
    );

    targetBlocks.forEach(block => {
      if (!block.isOnField) return;
      
      const positions = getBlockCellPositions(block);
      positions.forEach((pos, index) => {
        if (pos.row >= 0 && pos.row < 3 && pos.col >= 0 && pos.col < 3) {
          newTargetField[pos.row][pos.col].colors.push(block.colors[index]);
        }
      });
    });

    // 色を混合
    newTargetField.forEach(row => {
      row.forEach(cell => {
        cell.finalColor = mixColors(cell.colors);
      });
    });

    setTargetField(newTargetField);
  }, []);

  // ゲーム開始
  const handleStart = () => {
    setGameStarted(true);
    setIsRunning(true);
    setTimer(0);
    setGameCompleted(false);
    
    // ブロックを初期位置にリセット
    setBlocks(initialBlocks.map(block => ({ ...block })));
    
    // 例題生成
    generateTarget();
    
    // プレイヤーフィールドをクリア
    setPlayerField(Array(3).fill(null).map(() => 
      Array(3).fill(null).map(() => ({ colors: [], finalColor: 'transparent' }))
    ));
  };

  // マウスダウン
  const handleMouseDown = useCallback((e: React.MouseEvent, blockId: string) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setDragState({
      isDragging: true,
      dragId: blockId,
      offset: {
        x: mouseX - block.position.x,
        y: mouseY - block.position.y
      }
    });
  }, [blocks]);

  // マウス移動
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.isDragging || !dragState.dragId) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newX = mouseX - dragState.offset.x;
    const newY = mouseY - dragState.offset.y;

    setBlocks(prev => prev.map(block => 
      block.id === dragState.dragId 
        ? { ...block, position: { x: newX, y: newY } }
        : block
    ));
  }, [dragState]);

  // マウスアップ
  const handleMouseUp = useCallback(() => {
    if (!dragState.isDragging || !dragState.dragId) return;

    const block = blocks.find(b => b.id === dragState.dragId);
    if (!block) return;

    const gridPos = getGridPosition(block.position.x, block.position.y);
    
    if (gridPos && gridPos.row >= 0 && gridPos.row < 3 && gridPos.col >= 0 && gridPos.col < 3) {
      // フィールド内に配置
      const newX = 50 + gridPos.col * 100;
      const newY = 100 + gridPos.row * 100;
      
      const updatedBlock = { 
        ...block, 
        position: { x: newX, y: newY }, 
        isOnField: true 
      };
      
      // 衝突チェック
      const hasCollision = checkCollision(updatedBlock, block.id);
      
      setBlocks(prev => prev.map(b => 
        b.id === dragState.dragId 
          ? { ...updatedBlock, isError: hasCollision }
          : b
      ));
    } else {
      // フィールド外：元の位置に戻す
      setBlocks(prev => prev.map(b => 
        b.id === dragState.dragId 
          ? { ...b, position: b.originalPosition, isOnField: false, isError: false }
          : b
      ));
    }

    setDragState({
      isDragging: false,
      dragId: null,
      offset: { x: 0, y: 0 }
    });
  }, [dragState, blocks]);

  // ブロック回転
  const handleRotate = useCallback((blockId: string) => {
    setBlocks(prev => prev.map(block => {
      if (block.id === blockId) {
        const newRotation = block.rotation === 0 ? 90 : 0;
        const updatedBlock = { ...block, rotation: newRotation as 0 | 90 };
        
        if (block.isOnField) {
          // フィールド上なら衝突チェック
          const hasCollision = checkCollision(updatedBlock, block.id);
          return { ...updatedBlock, isError: hasCollision };
        }
        
        return updatedBlock;
      }
      return block;
    }));
  }, [blocks]);

  // フィールド更新
  useEffect(() => {
    updatePlayerField();
  }, [updatePlayerField]);

  // 正解チェック
  useEffect(() => {
    if (!gameStarted || gameCompleted) return;

    const hasErrors = blocks.some(block => block.isError);
    if (hasErrors) return;

    // フィールドの色が一致するかチェック
    let isMatch = true;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        if (playerField[row][col].finalColor !== targetField[row][col].finalColor) {
          isMatch = false;
          break;
        }
      }
      if (!isMatch) break;
    }

    if (isMatch) {
      setIsRunning(false);
      setGameCompleted(true);
    }
  }, [playerField, targetField, gameStarted, gameCompleted, blocks]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      ref={containerRef}
      className="container mx-auto p-6 select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <h1 className="text-3xl font-bold mb-6">パズルゲーム</h1>
      
      {/* スタートボタンとタイマー */}
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={handleStart}
          className="px-6 py-3 bg-green-500 text-white rounded hover:bg-green-600 text-lg font-bold"
        >
          スタート
        </button>
        {gameStarted && (
          <div className="text-2xl font-mono">
            時間: {formatTime(timer)}
          </div>
        )}
        {gameCompleted && (
          <div className="text-2xl font-bold text-green-600">
            正解！
          </div>
        )}
      </div>

      <div className="flex gap-8 mb-8">
        {/* 左側：プレイヤーフィールド */}
        <div>
          <h3 className="text-lg font-bold mb-2">プレイヤーフィールド</h3>
          <div className="grid grid-cols-3 gap-1 border-2 border-gray-400" style={{ width: '300px', height: '300px' }}>
            {playerField.map((row, rowIndex) =>
              row.map((cell, colIndex) => (
                <div
                  key={`player-${rowIndex}-${colIndex}`}
                  className="border border-gray-300"
                  style={{
                    width: '100px',
                    height: '100px',
                    backgroundColor: cell.finalColor,
                  }}
                />
              ))
            )}
          </div>
        </div>

        {/* 右側：例題フィールド */}
        <div>
          <h3 className="text-lg font-bold mb-2">目標</h3>
          <div className="grid grid-cols-3 gap-1 border-2 border-gray-400" style={{ width: '300px', height: '300px' }}>
            {targetField.map((row, rowIndex) =>
              row.map((cell, colIndex) => (
                <div
                  key={`target-${rowIndex}-${colIndex}`}
                  className="border border-gray-300"
                  style={{
                    width: '100px',
                    height: '100px',
                    backgroundColor: cell.finalColor,
                  }}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ブロック */}
      <div className="relative" style={{ height: '300px' }}>
        {blocks.map((block) => (
          <div
            key={block.id}
            className={`absolute cursor-move border-2 ${
              block.isError ? 'border-red-500 bg-red-100' : 'border-gray-400 bg-white'
            }`}
            style={{
              left: `${block.position.x}px`,
              top: `${block.position.y}px`,
              width: block.rotation === 0 ? '200px' : '100px',
              height: block.rotation === 0 ? '100px' : '200px',
              zIndex: dragState.dragId === block.id ? 1000 : 1,
            }}
            onMouseDown={(e) => handleMouseDown(e, block.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              handleRotate(block.id);
            }}
            onDoubleClick={() => handleRotate(block.id)}
          >
            {/* 円形の模様 */}
            <div
              className="absolute w-8 h-8 rounded-full border-2 border-gray-600"
              style={{
                backgroundColor: block.colors[0],
                left: block.rotation === 0 ? '25px' : '36px',
                top: block.rotation === 0 ? '36px' : '25px',
              }}
            />
            <div
              className="absolute w-8 h-8 rounded-full border-2 border-gray-600"
              style={{
                backgroundColor: block.colors[1],
                left: block.rotation === 0 ? '125px' : '36px',
                top: block.rotation === 0 ? '36px' : '125px',
              }}
            />
          </div>
        ))}
      </div>

      {/* 説明 */}
      <div className="mt-8 text-sm text-gray-600 max-w-2xl">
        <h3 className="font-bold mb-2">操作方法:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>ブロックをドラッグして左のフィールドに配置します</li>
          <li>右クリックまたはダブルクリックでブロックを回転します</li>
          <li>ブロックが重なりすぎるとエラー（赤色）になります</li>
          <li>目標と同じ色パターンを作成してください</li>
        </ul>
      </div>
    </div>
  );
}
