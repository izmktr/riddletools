'use client';

import { useState, useCallback } from 'react';

type CellType = 'empty' | 'blocked' | 'start' | 'goal';
type EdgeType = 'normal' | 'wall';
type ModeType = 'wall' | 'cell' | 'start' | 'goal';
type RuleType = 'passthrough' | 'nostop' | 'rightonly' | 'leftonly';

interface Cell {
  type: CellType;
}

interface Edges {
  top: EdgeType;
  right: EdgeType;
  bottom: EdgeType;
  left: EdgeType;
}

export default function MazePage() {
  const [width, setWidth] = useState(5);
  const [height, setHeight] = useState(5);
  const [tempWidth, setTempWidth] = useState(5);
  const [tempHeight, setTempHeight] = useState(5);
  const [mode, setMode] = useState<ModeType>('wall');
  const [rule, setRule] = useState<RuleType>('passthrough');
  
  // 盤面の状態を管理
  const [cells, setCells] = useState<Cell[][]>(() => {
    const initialCells = Array(5).fill(null).map(() => 
      Array(5).fill(null).map(() => ({ type: 'empty' as CellType }))
    );
    // 初期位置：左上にS、右下にG
    initialCells[0][0].type = 'start';
    initialCells[4][4].type = 'goal';
    return initialCells;
  });
  
  // 辺の状態を管理（各セルの4辺）
  const [edges, setEdges] = useState<Edges[][]>(() => 
    Array(5).fill(null).map(() => 
      Array(5).fill(null).map(() => ({
        top: 'normal' as EdgeType,
        right: 'normal' as EdgeType,
        bottom: 'normal' as EdgeType,
        left: 'normal' as EdgeType
      }))
    )
  );

  const resetBoard = useCallback(() => {
    const newCells = Array(height).fill(null).map(() => 
      Array(width).fill(null).map(() => ({ type: 'empty' as CellType }))
    );
    const newEdges = Array(height).fill(null).map(() => 
      Array(width).fill(null).map(() => ({
        top: 'normal' as EdgeType,
        right: 'normal' as EdgeType,
        bottom: 'normal' as EdgeType,
        left: 'normal' as EdgeType
      }))
    );
    
    // 初期位置設定
    if (height > 0 && width > 0) {
      newCells[0][0].type = 'start';
      if (height > 1 || width > 1) {
        newCells[height - 1][width - 1].type = 'goal';
      }
    }
    
    setCells(newCells);
    setEdges(newEdges);
  }, [width, height]);

  const resizeBoard = useCallback(() => {
    const newWidth = tempWidth;
    const newHeight = tempHeight;
    
    // 新しいサイズの盤面を作成
    const newCells = Array(newHeight).fill(null).map((_, i) => 
      Array(newWidth).fill(null).map((_, j) => {
        if (i < height && j < width) {
          return cells[i][j]; // 既存のセルをコピー
        }
        return { type: 'empty' as CellType };
      })
    );
    
    const newEdges = Array(newHeight).fill(null).map((_, i) => 
      Array(newWidth).fill(null).map((_, j) => {
        if (i < height && j < width) {
          return edges[i][j]; // 既存の辺をコピー
        }
        return {
          top: 'normal' as EdgeType,
          right: 'normal' as EdgeType,
          bottom: 'normal' as EdgeType,
          left: 'normal' as EdgeType
        };
      })
    );
    
    setWidth(newWidth);
    setHeight(newHeight);
    setCells(newCells);
    setEdges(newEdges);
  }, [tempWidth, tempHeight, width, height, cells, edges]);

  // 壁をクリックした時の処理
  const handleWallClick = useCallback((row: number, col: number, edge: 'top' | 'right' | 'bottom' | 'left') => {
    setEdges(prev => {
      const newEdges = prev.map(row => row.map(cell => ({ ...cell })));
      
      // 盤面の外側の辺は変化させない
      if (edge === 'top' && row === 0) return prev;
      if (edge === 'left' && col === 0) return prev;
      if (edge === 'bottom' && row === height - 1) return prev;
      if (edge === 'right' && col === width - 1) return prev;
      
      // 現在の辺の状態を切り替え
      const currentEdge = newEdges[row][col][edge];
      newEdges[row][col][edge] = currentEdge === 'wall' ? 'normal' : 'wall';
      
      // 隣接するセルの対応する辺も同期
      if (edge === 'top' && row > 0) {
        newEdges[row - 1][col].bottom = newEdges[row][col][edge];
      } else if (edge === 'bottom' && row < height - 1) {
        newEdges[row + 1][col].top = newEdges[row][col][edge];
      } else if (edge === 'left' && col > 0) {
        newEdges[row][col - 1].right = newEdges[row][col][edge];
      } else if (edge === 'right' && col < width - 1) {
        newEdges[row][col + 1].left = newEdges[row][col][edge];
      }
      
      return newEdges;
    });
  }, [height, width]);

  const handleCellClick = useCallback((row: number, col: number) => {
    if (mode === 'wall') {
      // 壁モードではセルクリックは無効
      return;
    } else if (mode === 'cell') {
      // マスモード：セルの塗りつぶし
      setCells(prev => {
        const newCells = prev.map(row => row.map(cell => ({ ...cell })));
        const currentCell = newCells[row][col];
        
        if (currentCell.type === 'start' || currentCell.type === 'goal') {
          // S,Gがある場合は消去して塗りつぶし
          currentCell.type = 'blocked';
        } else if (currentCell.type === 'blocked') {
          // 既に塗りつぶされている場合は元に戻す
          currentCell.type = 'empty';
        } else {
          // 空の場合は塗りつぶし
          currentCell.type = 'blocked';
        }
        
        return newCells;
      });
    } else if (mode === 'start') {
      // Sモード
      setCells(prev => {
        const newCells = prev.map(row => row.map(cell => ({ ...cell })));
        const currentCell = newCells[row][col];
        
        if (currentCell.type === 'blocked') {
          // 黒く塗られたマスの場合は何もしない
          return prev;
        }
        
        // 既存のSを削除
        for (let i = 0; i < newCells.length; i++) {
          for (let j = 0; j < newCells[i].length; j++) {
            if (newCells[i][j].type === 'start') {
              newCells[i][j].type = 'empty';
            }
          }
        }
        
        if (currentCell.type === 'start') {
          // 既にSがある場合は削除
          currentCell.type = 'empty';
        } else {
          // Sを配置
          currentCell.type = 'start';
        }
        
        return newCells;
      });
    } else if (mode === 'goal') {
      // Gモード
      setCells(prev => {
        const newCells = prev.map(row => row.map(cell => ({ ...cell })));
        const currentCell = newCells[row][col];
        
        if (currentCell.type === 'blocked') {
          // 黒く塗られたマスの場合は何もしない
          return prev;
        }
        
        // 既存のGを削除
        for (let i = 0; i < newCells.length; i++) {
          for (let j = 0; j < newCells[i].length; j++) {
            if (newCells[i][j].type === 'goal') {
              newCells[i][j].type = 'empty';
            }
          }
        }
        
        if (currentCell.type === 'goal') {
          // 既にGがある場合は削除
          currentCell.type = 'empty';
        } else {
          // Gを配置
          currentCell.type = 'goal';
        }
        
        return newCells;
      });
    }
  }, [mode]);

  const getCellStyle = (cell: Cell) => {
    const baseStyle = "w-12 h-12 border border-gray-400 flex items-center justify-center text-lg font-bold";
    const interactiveStyle = mode !== 'wall' ? "cursor-pointer" : "cursor-default";
    const hoverStyle = mode !== 'wall' ? "hover:bg-gray-100" : "";
    
    switch (cell.type) {
      case 'blocked':
        return `${baseStyle} ${interactiveStyle} bg-black text-white`;
      case 'start':
        return `${baseStyle} ${interactiveStyle} bg-white text-red-600`;
      case 'goal':
        return `${baseStyle} ${interactiveStyle} bg-white text-blue-600`;
      default:
        return `${baseStyle} ${interactiveStyle} bg-white ${hoverStyle}`;
    }
  };

  const getCellContent = (cell: Cell) => {
    switch (cell.type) {
      case 'start':
        return 'S';
      case 'goal':
        return 'G';
      default:
        return '';
    }
  };

  const getWallStyle = (edge: EdgeType, isOuter: boolean) => {
    if (isOuter) {
      return "bg-black"; // 外枠は常に黒
    }
    
    const baseStyle = edge === 'wall' ? "bg-black" : "bg-gray-300";
    const hoverStyle = mode === 'wall' ? "hover:bg-gray-400" : "";
    
    return `${baseStyle} ${hoverStyle}`;
  };

  const renderCell = (cell: Cell, rowIndex: number, colIndex: number) => {
    const cellEdges = edges[rowIndex][colIndex];
    const isOuterTop = rowIndex === 0;
    const isOuterLeft = colIndex === 0;
    const isOuterBottom = rowIndex === height - 1;
    const isOuterRight = colIndex === width - 1;
    
    // 壁モードかどうかで辺とセルのクリック可能性を制御
    const isWallMode = mode === 'wall';

    return (
      <div key={`${rowIndex}-${colIndex}`} className="relative">
        {/* 上の辺 */}
        <div
          className={`absolute -top-1 left-0 right-0 h-2 ${
            isWallMode && !isOuterTop ? 'cursor-pointer' : 'cursor-default'
          } ${getWallStyle(cellEdges.top, isOuterTop)}`}
          onClick={() => isWallMode && !isOuterTop && handleWallClick(rowIndex, colIndex, 'top')}
          style={{ zIndex: 10 }}
        />
        
        {/* 左の辺 */}
        <div
          className={`absolute -left-1 top-0 bottom-0 w-2 ${
            isWallMode && !isOuterLeft ? 'cursor-pointer' : 'cursor-default'
          } ${getWallStyle(cellEdges.left, isOuterLeft)}`}
          onClick={() => isWallMode && !isOuterLeft && handleWallClick(rowIndex, colIndex, 'left')}
          style={{ zIndex: 10 }}
        />
        
        {/* 右の辺 */}
        <div
          className={`absolute -right-1 top-0 bottom-0 w-2 ${
            isWallMode && !isOuterRight ? 'cursor-pointer' : 'cursor-default'
          } ${getWallStyle(cellEdges.right, isOuterRight)}`}
          onClick={() => isWallMode && !isOuterRight && handleWallClick(rowIndex, colIndex, 'right')}
          style={{ zIndex: 10 }}
        />
        
        {/* 下の辺 */}
        <div
          className={`absolute -bottom-1 left-0 right-0 h-2 ${
            isWallMode && !isOuterBottom ? 'cursor-pointer' : 'cursor-default'
          } ${getWallStyle(cellEdges.bottom, isOuterBottom)}`}
          onClick={() => isWallMode && !isOuterBottom && handleWallClick(rowIndex, colIndex, 'bottom')}
          style={{ zIndex: 10 }}
        />
        
        {/* セル本体 */}
        <div
          className={getCellStyle(cell)}
          onClick={() => !isWallMode && handleCellClick(rowIndex, colIndex)}
          style={{ zIndex: 5 }}
        >
          {getCellContent(cell)}
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">迷路ソルバー</h1>
      
      {/* ルール選択ボタン */}
      <div className="mb-4">
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'passthrough', label: '全部通過' },
            { key: 'nostop', label: '停止不可' },
            { key: 'rightonly', label: '右折のみ' },
            { key: 'leftonly', label: '左折のみ' }
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setRule(key as RuleType)}
              className={`px-4 py-2 border rounded ${
                rule === key 
                  ? 'bg-yellow-400 text-black' 
                  : 'bg-white text-black border-gray-300 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* サイズ設定とコントロールボタン */}
      <div className="mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={tempWidth}
              onChange={(e) => setTempWidth(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 px-2 py-1 border border-gray-300 rounded"
              min="1"
              max="20"
            />
            <span>×</span>
            <input
              type="number"
              value={tempHeight}
              onChange={(e) => setTempHeight(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 px-2 py-1 border border-gray-300 rounded"
              min="1"
              max="20"
            />
          </div>
          <button
            onClick={resizeBoard}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            サイズ変更
          </button>
          <button
            onClick={resetBoard}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            リセット
          </button>
          <button
            onClick={() => alert('解析機能は未実装です')}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            解析
          </button>
        </div>
      </div>

      {/* モード選択ボタン */}
      <div className="mb-6">
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'wall', label: '壁' },
            { key: 'cell', label: 'マス' },
            { key: 'start', label: 'S' },
            { key: 'goal', label: 'G' }
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setMode(key as ModeType)}
              className={`px-4 py-2 border rounded ${
                mode === key 
                  ? 'bg-yellow-400 text-black' 
                  : 'bg-white text-black border-gray-300 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 盤面 */}
      <div className="mb-6">
        <div className="inline-block border-2 border-black p-1">
          {cells.map((row, rowIndex) => (
            <div key={rowIndex} className="flex">
              {row.map((cell, colIndex) => renderCell(cell, rowIndex, colIndex))}
            </div>
          ))}
        </div>
      </div>

      {/* 説明 */}
      <div className="text-sm text-gray-600 max-w-2xl">
        <h3 className="font-bold mb-2">操作方法:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>壁:</strong> マスの辺（境界線）をクリックして壁を設置/削除。外枠は変更不可</li>
          <li><strong>マス:</strong> マスをクリックして黒く塗りつぶし/元に戻す</li>
          <li><strong>S:</strong> スタート地点を設置/移動</li>
          <li><strong>G:</strong> ゴール地点を設置/移動</li>
        </ul>
      </div>
    </div>
  );
}
