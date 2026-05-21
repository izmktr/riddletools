'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';

type CellType = 'empty' | 'blocked' | 'start' | 'goal';
type EdgeType = 'normal' | 'wall';
type ModeType = 'wall' | 'cell' | 'start' | 'goal';
type RuleType = 'shortest' | 'passthrough' | 'nostop' | 'rightonly' | 'leftonly';

const RULE_TO_HEADER_CODE: Record<RuleType, 'N' | 'A' | 'I' | 'R' | 'L'> = {
  shortest: 'N',
  passthrough: 'A',
  nostop: 'I',
  rightonly: 'R',
  leftonly: 'L',
};

const HEADER_CODE_TO_RULE: Record<'N' | 'A' | 'I' | 'R' | 'L', RuleType> = {
  N: 'shortest',
  A: 'passthrough',
  I: 'nostop',
  R: 'rightonly',
  L: 'leftonly',
};

const MAZE_SAMPLES: Array<{ label: string; data: string }> = [
  {
    label: '最短サンプル',
    data: 'S1,1 G5,5 N\n00020\n11102\n02100\n02300\n00010\n',
  },
  {
    label: '全部通過サンプル',
    data: 'S1,1 G5,5 A\n00200\n10010\n01000\n12100\n00000\n',
  },
  {
    label: '停止不可サンプル',
    data: 'S1,1 G1,4 I\n00000\n20100\n01002\n00000\n01000\n',
  },
  {
    label: '右折のみサンプル',
    data: 'S1,1 G5,5 R\n01000\n00100\n03000\n00010\n00010\n',
  },
];

interface Cell {
  type: CellType;
}

interface Edges {
  top: EdgeType;
  right: EdgeType;
  bottom: EdgeType;
  left: EdgeType;
}

interface Coordinate {
  x: number;
  y: number;
}

interface SolveResult {
  path: Coordinate[];
  hasMultipleShortestPath: boolean;
}

interface CellPathSegments {
  leftLeftward: SegmentState;
  leftRightward: SegmentState;
  rightLeftward: SegmentState;
  rightRightward: SegmentState;
  topUpward: SegmentState;
  topDownward: SegmentState;
  bottomUpward: SegmentState;
  bottomDownward: SegmentState;
}

interface SegmentState {
  full: boolean;
  short: boolean;
}

type SegmentKey = keyof CellPathSegments;

export default function MazePage() {
  const [width, setWidth] = useState(5);
  const [height, setHeight] = useState(5);
  const [tempWidth, setTempWidth] = useState(5);
  const [tempHeight, setTempHeight] = useState(5);
  const [mode, setMode] = useState<ModeType>('wall');
  const [rule, setRule] = useState<RuleType>('shortest');
  const [solutionPath, setSolutionPath] = useState<Coordinate[]>([]);
  const [hasMultipleShortestPath, setHasMultipleShortestPath] = useState(false);
  const [showStepNumbers, setShowStepNumbers] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [exportText, setExportText] = useState('');
  const [importText, setImportText] = useState('');
  const importTextareaRef = useRef<HTMLTextAreaElement | null>(null);

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

  // 迷路解析関数
  const solveMaze = useCallback((): SolveResult => {
    // スタートとゴールの位置を見つける
    let start: Coordinate | null = null;
    let goal: Coordinate | null = null;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (cells[y][x].type === 'start') {
          start = { x, y };
        } else if (cells[y][x].type === 'goal') {
          goal = { x, y };
        }
      }
    }

    if (!start || !goal) {
      return { path: [], hasMultipleShortestPath: false }; // スタートまたはゴールが見つからない場合
    }

    const toKey = (coord: Coordinate) => `${coord.x},${coord.y}`;
    const parseKey = (key: string): Coordinate => {
      const [x, y] = key.split(',').map(Number);
      return { x, y };
    };
    const startKey = toKey(start);
    const goalKey = toKey(goal);

    const directions = [
      { dx: 0, dy: -1 }, // 上
      { dx: 1, dy: 0 },  // 右
      { dx: 0, dy: 1 },  // 下
      { dx: -1, dy: 0 }  // 左
    ];

    const canMoveOneStep = (x: number, y: number, dx: number, dy: number): boolean => {
      const nx = x + dx;
      const ny = y + dy;

      if (nx < 0 || nx >= width || ny < 0 || ny >= height) return false;
      if (cells[ny][nx].type === 'blocked') return false;

      const currentEdges = edges[y][x];
      if (dy === -1 && currentEdges.top === 'wall') return false;
      if (dx === 1 && currentEdges.right === 'wall') return false;
      if (dy === 1 && currentEdges.bottom === 'wall') return false;
      if (dx === -1 && currentEdges.left === 'wall') return false;

      return true;
    };

    // 全マス通過ルール専用探索
    if (rule === 'passthrough') {
      const isStartOrGoal = (key: string): boolean => key === startKey || key === goalKey;
      const getNeighbors = (coord: Coordinate, fixedSet: Set<string>): Coordinate[] => {
        const list: Coordinate[] = [];
        for (const { dx, dy } of directions) {
          const nx = coord.x + dx;
          const ny = coord.y + dy;
          if (!canMoveOneStep(coord.x, coord.y, dx, dy)) continue;
          const nKey = `${nx},${ny}`;
          if (fixedSet.has(nKey)) continue;
          list.push({ x: nx, y: ny });
        }
        return list;
      };

      const fixedCells = new Set<string>();
      const pairMate = new Map<string, string>();
      const pairPath = new Map<string, string[]>();

      const removePairByEndpoint = (endpoint: string) => {
        const mate = pairMate.get(endpoint);
        if (!mate) return;
        pairMate.delete(endpoint);
        pairMate.delete(mate);
        pairPath.delete(endpoint);
        pairPath.delete(mate);
      };

      const registerPair = (pathAB: string[]): boolean => {
        if (pathAB.length < 2) return true;
        let path = pathAB.slice();

        while (true) {
          let changed = false;

          const left = path[0];
          const right = path[path.length - 1];

          const leftMate = pairMate.get(left);
          if (leftMate && !isStartOrGoal(left)) {
            const leftPath = pairPath.get(left) ?? [left, leftMate];
            removePairByEndpoint(left);
            fixedCells.add(left);
            path = [...leftPath.slice().reverse().slice(0, -1), ...path];
            changed = true;
          }

          const newRight = path[path.length - 1];
          const rightMate = pairMate.get(newRight);
          if (rightMate && !isStartOrGoal(newRight)) {
            const rightPath = pairPath.get(newRight) ?? [newRight, rightMate];
            removePairByEndpoint(newRight);
            fixedCells.add(newRight);
            path = [...path, ...rightPath.slice(1)];
            changed = true;
          }

          if (!changed) break;
        }

        const a = path[0];
        const b = path[path.length - 1];
        if (a === b) {
          return false;
        }

        pairMate.set(a, b);
        pairMate.set(b, a);
        pairPath.set(a, path);
        pairPath.set(b, path.slice().reverse());
        return true;
      };

      let changed = true;
      while (changed) {
        changed = false;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const key = `${x},${y}`;
            if (fixedCells.has(key)) continue;
            if (isStartOrGoal(key)) continue;
            if (cells[y][x].type === 'blocked') continue;
            if (pairMate.has(key)) continue; // 既にチェーン端点のセルは第一フェーズでスキップ

            const neighbors = getNeighbors({ x, y }, fixedCells);
            if (neighbors.length !== 2) continue;

            fixedCells.add(key);
            const left = toKey(neighbors[0]);
            const right = toKey(neighbors[1]);
            const ok = registerPair([left, key, right]);
            if (!ok) {
              return { path: [], hasMultipleShortestPath: false };
            }
            changed = true;
          }
        }

        const endpoints = Array.from(pairMate.keys());
        for (const endpoint of endpoints) {
          if (fixedCells.has(endpoint)) continue;
          if (isStartOrGoal(endpoint)) continue;

          const coord = parseKey(endpoint);
          const neighbors = getNeighbors(coord, fixedCells);
          if (neighbors.length !== 1) continue;

          const mate = pairMate.get(endpoint);
          if (!mate) continue;

          const oldPath = pairPath.get(endpoint) ?? [endpoint, mate];
          removePairByEndpoint(endpoint);
          fixedCells.add(endpoint);

          const newEnd = toKey(neighbors[0]);
          const ok = registerPair([newEnd, endpoint, ...oldPath.slice(1)]);
          if (!ok) {
            return { path: [], hasMultipleShortestPath: false };
          }
          changed = true;
        }
      }

      const activeKeys = new Set<string>();
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (cells[y][x].type === 'blocked') continue;
          const key = `${x},${y}`;
          if (fixedCells.has(key)) continue;
          activeKeys.add(key);
        }
      }

      if (!activeKeys.has(startKey) || !activeKeys.has(goalKey)) {
        return { path: [], hasMultipleShortestPath: false };
      }

      const startCoord = parseKey(startKey);
      const nextByGrid = (key: string): string[] => {
        const coord = parseKey(key);
        return getNeighbors(coord, fixedCells)
          .map(toKey)
          .filter((k) => activeKeys.has(k));
      };

      const visited = new Set<string>([startKey]);
      const pathKeys: string[] = [startKey];

      const dfs = (currentKey: string): boolean => {
        if (currentKey === goalKey && visited.size === activeKeys.size) {
          return true;
        }

        const mate = pairMate.get(currentKey);
        let candidates: string[];
        if (mate && !visited.has(mate)) {
          candidates = [mate];
        } else {
          candidates = nextByGrid(currentKey);
        }

        for (const nextKey of candidates) {
          if (!activeKeys.has(nextKey)) continue;
          if (visited.has(nextKey)) continue;

          visited.add(nextKey);
          pathKeys.push(nextKey);

          if (dfs(nextKey)) {
            return true;
          }

          pathKeys.pop();
          visited.delete(nextKey);
        }

        return false;
      };

      if (!dfs(startKey)) {
        return { path: [], hasMultipleShortestPath: false };
      }

      const expanded: Coordinate[] = [startCoord];
      for (let i = 0; i < pathKeys.length - 1; i++) {
        const from = pathKeys[i];
        const to = pathKeys[i + 1];

        if (pairMate.get(from) === to) {
          const fullPath = pairPath.get(from) ?? [from, to];
          for (let j = 1; j < fullPath.length; j++) {
            expanded.push(parseKey(fullPath[j]));
          }
        } else {
          expanded.push(parseKey(to));
        }
      }

      return {
        path: expanded,
        hasMultipleShortestPath: false,
      };
    }

    // 停止不可ルール専用探索
    if (rule === 'nostop') {
      const queue: Coordinate[] = [start];
      let queueIndex = 0;
      const visitedStops = new Set<string>([startKey]);
      const parents = new Map<string, string | null>([[startKey, null]]);
      const segmentFromParent = new Map<string, Coordinate[]>();

      const buildPathFromMaps = (finalKey: string): Coordinate[] => {
        const keyChain: string[] = [];
        let key: string | null = finalKey;
        while (key) {
          keyChain.push(key);
          key = parents.get(key) ?? null;
        }
        keyChain.reverse();

        const path: Coordinate[] = [start];
        for (let i = 1; i < keyChain.length; i++) {
          path.push(...(segmentFromParent.get(keyChain[i]) ?? []));
        }
        return path;
      };

      while (queueIndex < queue.length) {
        const current = queue[queueIndex++];
        const currentKey = toKey(current);

        for (const { dx, dy } of directions) {
          if (!canMoveOneStep(current.x, current.y, dx, dy)) continue;

          const segment: Coordinate[] = [];
          let cx = current.x;
          let cy = current.y;
          let reachedGoalMidSlide = false;

          // 進める限り直進
          while (canMoveOneStep(cx, cy, dx, dy)) {
            cx += dx;
            cy += dy;
            segment.push({ x: cx, y: cy });

            if (cx === goal.x && cy === goal.y) {
              reachedGoalMidSlide = true;
              break;
            }
          }

          if (segment.length === 0) continue;

          if (reachedGoalMidSlide) {
            parents.set(goalKey, currentKey);
            segmentFromParent.set(goalKey, segment);
            return {
              path: buildPathFromMaps(goalKey),
              hasMultipleShortestPath: false,
            };
          }

          const stopKey = `${cx},${cy}`;
          if (visitedStops.has(stopKey)) continue;

          visitedStops.add(stopKey);
          parents.set(stopKey, currentKey);
          segmentFromParent.set(stopKey, segment);
          queue.push({ x: cx, y: cy });
        }
      }

      return { path: [], hasMultipleShortestPath: false };
    }

    // 右折のみ/左折のみルール専用探索（直進 + 指定方向のみ）
    if (rule === 'rightonly' || rule === 'leftonly') {
      type DirectionIndex = 0 | 1 | 2 | 3;
      const toStateKey = (x: number, y: number, dir: DirectionIndex) => `${x},${y},${dir}`;
      const parseStateKey = (key: string): { x: number; y: number; dir: DirectionIndex } => {
        const [x, y, dir] = key.split(',').map(Number);
        return { x, y, dir: dir as DirectionIndex };
      };

      const startStateKey = 'START';
      const queue: string[] = [];
      let queueIndex = 0;
      const visited = new Set<string>();
      const parents = new Map<string, string | null>([[startStateKey, null]]);

      const buildPathFromState = (finalStateKey: string): Coordinate[] => {
        const stateChain: string[] = [];
        let key: string | null = finalStateKey;
        while (key && key !== startStateKey) {
          stateChain.push(key);
          key = parents.get(key) ?? null;
        }
        stateChain.reverse();

        const path: Coordinate[] = [start];
        for (const stateKey of stateChain) {
          const { x, y } = parseStateKey(stateKey);
          path.push({ x, y });
        }
        return path;
      };

      const pushInitialState = (dir: DirectionIndex) => {
        const { dx, dy } = directions[dir];
        if (!canMoveOneStep(start.x, start.y, dx, dy)) return;

        const nx = start.x + dx;
        const ny = start.y + dy;
        const key = toStateKey(nx, ny, dir);
        if (visited.has(key)) return;

        visited.add(key);
        parents.set(key, startStateKey);
        queue.push(key);
      };

      pushInitialState(0);
      pushInitialState(1);
      pushInitialState(2);
      pushInitialState(3);

      while (queueIndex < queue.length) {
        const currentKey = queue[queueIndex++];
        const { x, y, dir } = parseStateKey(currentKey);

        if (x === goal.x && y === goal.y) {
          return {
            path: buildPathFromState(currentKey),
            hasMultipleShortestPath: false,
          };
        }

        const straightDir = dir;
        const turnDir = (rule === 'rightonly'
          ? (dir + 1) % 4
          : (dir + 3) % 4) as DirectionIndex;
        const nextDirs: DirectionIndex[] = [straightDir, turnDir];

        for (const nextDir of nextDirs) {
          const { dx, dy } = directions[nextDir];
          if (!canMoveOneStep(x, y, dx, dy)) continue;

          const nx = x + dx;
          const ny = y + dy;
          const nextKey = toStateKey(nx, ny, nextDir);

          if (visited.has(nextKey)) continue;

          visited.add(nextKey);
          parents.set(nextKey, currentKey);
          queue.push(nextKey);
        }
      }

      return { path: [], hasMultipleShortestPath: false };
    }

    // 通常ルール（1マスずつ移動）
    const queue: Coordinate[] = [start];
    let queueIndex = 0;
    const distances = new Map<string, number>();
    const ways = new Map<string, number>();
    const parents = new Map<string, string | null>();

    distances.set(startKey, 0);
    ways.set(startKey, 1);
    parents.set(startKey, null);

    while (queueIndex < queue.length) {
      const coord = queue[queueIndex++];
      const coordKey = toKey(coord);
      const currentDistance = distances.get(coordKey)!;
      const currentWays = ways.get(coordKey)!;

      for (const { dx, dy } of directions) {
        const newX = coord.x + dx;
        const newY = coord.y + dy;
        const nextKey = `${newX},${newY}`;

        if (!canMoveOneStep(coord.x, coord.y, dx, dy)) {
          continue;
        }

        const nextDistance = currentDistance + 1;
        const knownDistance = distances.get(nextKey);

        if (knownDistance === undefined) {
          distances.set(nextKey, nextDistance);
          ways.set(nextKey, currentWays);
          parents.set(nextKey, coordKey);
          queue.push({ x: newX, y: newY });
        } else if (knownDistance === nextDistance) {
          const mergedWays = Math.min(2, (ways.get(nextKey) ?? 0) + currentWays);
          ways.set(nextKey, mergedWays);
        }
      }
    }

    if (!distances.has(goalKey)) {
      return { path: [], hasMultipleShortestPath: false }; // 経路が見つからない場合
    }

    // 代表となる1本の最短経路を復元
    const reversedPath: Coordinate[] = [];
    let currentKey: string | null = goalKey;
    while (currentKey) {
      reversedPath.push(parseKey(currentKey));
      currentKey = parents.get(currentKey) ?? null;
    }

    return {
      path: reversedPath.reverse(),
      hasMultipleShortestPath: (ways.get(goalKey) ?? 0) >= 2,
    };
  }, [cells, edges, rule, width, height]);

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
    setSolutionPath([]); // パスもクリア
    setHasMultipleShortestPath(false);
    setHasAnalyzed(false);
  }, [width, height]);

  // 解析実行処理
  const handleAnalyze = useCallback(async () => {
    setIsAnalyzing(true);
    setHasAnalyzed(false);
    setHasMultipleShortestPath(false);
    try {
      // 少し遅延を入れて解析中の表示を見せる
      await new Promise(resolve => setTimeout(resolve, 200));
      const result = solveMaze();
      setSolutionPath(result.path);
      setHasMultipleShortestPath(result.hasMultipleShortestPath);
      setHasAnalyzed(true);
    } finally {
      setIsAnalyzing(false);
    }
  }, [solveMaze]);

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
    setSolutionPath([]);
    setHasMultipleShortestPath(false);
    setHasAnalyzed(false);
  }, [tempWidth, tempHeight, width, height, cells, edges]);

  // 壁をクリックした時の処理
  const handleWallClick = useCallback((row: number, col: number, edge: 'right' | 'bottom') => {
    if (hasAnalyzed) return;
    setEdges(prev => {
      const newEdges = prev.map(row => row.map(cell => ({ ...cell })));
      
      // 盤面の外側の辺は変化させない
      if (edge === 'bottom' && row === height - 1) return prev;
      if (edge === 'right' && col === width - 1) return prev;
      
      // 現在の辺の状態を切り替え
      const currentEdge = newEdges[row][col][edge];
      newEdges[row][col][edge] = currentEdge === 'wall' ? 'normal' : 'wall';
      
      // 隣接するセルの対応する辺も同期
      if (edge === 'bottom' && row < height - 1) {
        newEdges[row + 1][col].top = newEdges[row][col][edge];
      } else if (edge === 'right' && col < width - 1) {
        newEdges[row][col + 1].left = newEdges[row][col][edge];
      }
      
      return newEdges;
    });
  }, [hasAnalyzed, height, width]);

  const handleCellClick = useCallback((row: number, col: number) => {
    if (hasAnalyzed) return;
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
  }, [hasAnalyzed, mode]);

  const handleBackToInput = useCallback(() => {
    setHasAnalyzed(false);
    setSolutionPath([]);
    setHasMultipleShortestPath(false);
    setShowStepNumbers(false);
  }, []);

  const stepNumbersByCell = useMemo(() => {
    const result = new Map<string, number[]>();

    solutionPath.forEach((coord, index) => {
      const key = `${coord.x},${coord.y}`;
      const nextStep = index + 1;
      const existing = result.get(key);
      if (existing) {
        existing.push(nextStep);
      } else {
        result.set(key, [nextStep]);
      }
    });

    return result;
  }, [solutionPath]);

  const handleExport = useCallback(() => {
    let start: Coordinate | null = null;
    let goal: Coordinate | null = null;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (cells[y][x].type === 'start') start = { x, y };
        if (cells[y][x].type === 'goal') goal = { x, y };
      }
    }

    if (!start || !goal) {
      window.alert('SとGが見つからないためエクスポートできません。');
      return;
    }

    const lines: string[] = [];
    const modeCode = RULE_TO_HEADER_CODE[rule];
    lines.push(`S${start.x + 1},${start.y + 1} G${goal.x + 1},${goal.y + 1} ${modeCode}`);

    for (let y = 0; y < height; y++) {
      let row = '';
      for (let x = 0; x < width; x++) {
        const cell = cells[y][x];
        if (cell.type === 'blocked') {
          row += 'X';
          continue;
        }

        const hasRightWall = edges[y][x].right === 'wall';
        const hasBottomWall = edges[y][x].bottom === 'wall';
        const code = (hasRightWall ? 1 : 0) + (hasBottomWall ? 2 : 0);
        row += String(code);
      }
      lines.push(row);
    }

    setExportText(`${lines.join('\n')}\n`);
    setShowExport(true);
  }, [width, height, cells, edges, rule]);

  const handleCopyExport = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      window.alert('コピーしました。');
    } catch {
      window.alert('コピーに失敗しました。手動でコピーしてください。');
    }
  }, [exportText]);

  const applySerializedMaze = useCallback((text: string) => {
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const allLines = normalized.split('\n');
    if (allLines.length === 0) {
      throw new Error('入力が空です。');
    }

    const header = allLines[0].trim();
    const headerMatch = header.match(/^S\s*(\d+)\s*,\s*(\d+)\s+G\s*(\d+)\s*,\s*(\d+)(?:\s+([NAIRL]))?$/i);
    if (!headerMatch) {
      throw new Error('先頭行は "Sx,y Gx,y" または "Sx,y Gx,y N/A/I/R/L" 形式で指定してください。');
    }

    const sX = Number(headerMatch[1]) - 1;
    const sY = Number(headerMatch[2]) - 1;
    const gX = Number(headerMatch[3]) - 1;
    const gY = Number(headerMatch[4]) - 1;
    const importedModeCode = (headerMatch[5]?.toUpperCase() as 'N' | 'A' | 'I' | 'R' | 'L' | undefined);
    const importedRule = importedModeCode ? HEADER_CODE_TO_RULE[importedModeCode] : undefined;

    const mazeLines = allLines.slice(1).map((line) => line.trimEnd()).filter((line) => line.trim().length > 0);
    if (mazeLines.length === 0) {
      throw new Error('迷路情報がありません。');
    }

    const nextWidth = mazeLines[0].length;
    const nextHeight = mazeLines.length;
    if (nextWidth < 1 || nextWidth > 20 || nextHeight < 1 || nextHeight > 20) {
      throw new Error('迷路サイズは1から20の範囲で指定してください。');
    }

    if (sX < 0 || sX >= nextWidth || sY < 0 || sY >= nextHeight || gX < 0 || gX >= nextWidth || gY < 0 || gY >= nextHeight) {
      throw new Error('SまたはGの座標が迷路範囲外です。');
    }

    const parsedCells: Cell[][] = Array(nextHeight).fill(null).map(() =>
      Array(nextWidth).fill(null).map(() => ({ type: 'empty' as CellType }))
    );
    const parsedEdges: Edges[][] = Array(nextHeight).fill(null).map(() =>
      Array(nextWidth).fill(null).map(() => ({
        top: 'normal' as EdgeType,
        right: 'normal' as EdgeType,
        bottom: 'normal' as EdgeType,
        left: 'normal' as EdgeType,
      }))
    );

    for (let y = 0; y < nextHeight; y++) {
      const row = mazeLines[y];
      for (let x = 0; x < nextWidth; x++) {
        const ch = x < row.length ? row[x] : '0';
        if (ch === 'X' || ch === 'x') {
          parsedCells[y][x].type = 'blocked';
          continue;
        }

        const code = ch === '1' || ch === '2' || ch === '3' ? Number(ch) : 0;
        if ((code & 1) === 1 && x < nextWidth - 1) {
          parsedEdges[y][x].right = 'wall';
          parsedEdges[y][x + 1].left = 'wall';
        }
        if ((code & 2) === 2 && y < nextHeight - 1) {
          parsedEdges[y][x].bottom = 'wall';
          parsedEdges[y + 1][x].top = 'wall';
        }
      }
    }

    parsedCells[sY][sX].type = 'start';
    parsedCells[gY][gX].type = 'goal';

    setWidth(nextWidth);
    setHeight(nextHeight);
    setTempWidth(nextWidth);
    setTempHeight(nextHeight);
    setCells(parsedCells);
    setEdges(parsedEdges);
    setRule(importedRule ?? rule);
    setSolutionPath([]);
    setHasMultipleShortestPath(false);
    setHasAnalyzed(false);
  }, [rule]);

  const handleImport = useCallback(() => {
    setImportText('');
    setShowImport(true);
  }, []);

  const handleApplyImport = useCallback(() => {
    try {
      const nextImportText = importTextareaRef.current?.value ?? importText;
      applySerializedMaze(nextImportText);
      setShowImport(false);
      window.alert('インポートしました。');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'インポートに失敗しました。';
      window.alert(message);
    }
  }, [applySerializedMaze]);

  const handleApplySample = useCallback((sampleData: string) => {
    try {
      applySerializedMaze(sampleData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'サンプルの読み込みに失敗しました。';
      window.alert(message);
    }
  }, [applySerializedMaze]);

  // モード判定関数
  const isWallMode = useCallback((): boolean => {
    return mode === 'wall';
  }, [mode]);

  const isCellMode = useCallback((): boolean => {
    return mode === 'cell';
  }, [mode]);

  const getCellStyle = (cell: Cell) => {
    const baseStyle = "w-12 h-12 flex items-center justify-center font-bold";
    const interactiveStyle = !isWallMode() ? "cursor-pointer" : "cursor-default";
    const hoverStyle = !isWallMode() ? "hover:bg-gray-100" : "";
    
    switch (cell.type) {
      case 'blocked':
        return `${baseStyle} ${interactiveStyle} bg-black text-white text-lg z-3`;
      case 'start':
        return `${baseStyle} ${interactiveStyle} bg-white text-emerald-700 text-3xl leading-none`;
      case 'goal':
        return `${baseStyle} ${interactiveStyle} bg-white text-blue-600 text-3xl leading-none`;
      default:
        return `${baseStyle} ${interactiveStyle} bg-white text-lg ${hoverStyle}`;
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
    const hoverStyle = isWallMode() ? "hover:bg-gray-400" : "";
    
    return `${baseStyle} ${hoverStyle}`;
  };

  const getWallThickness = (edge: EdgeType, isOuter: boolean, direction: 'horizontal' | 'vertical') => {
    if (isOuter) {
      return direction === 'horizontal' ? "h-2" : "w-2"; // 外枠は太い
    }
    
    if (edge === 'wall') {
      return direction === 'horizontal' ? "h-2" : "w-2"; // 壁は太い
    } else {
      if (isWallMode()) {
        return direction === 'horizontal' ? "h-1" : "w-1"; // 壁選択モードではちょっと太く
      }else{
        return direction === 'horizontal' ? "h-0.5" : "w-0.5"; // 通常の辺は細い
      }
    }
  };

  const getPathSegmentsForCell = useCallback((row: number, col: number): CellPathSegments => {
    const segments: CellPathSegments = {
      leftLeftward: { full: false, short: false },
      leftRightward: { full: false, short: false },
      rightLeftward: { full: false, short: false },
      rightRightward: { full: false, short: false },
      topUpward: { full: false, short: false },
      topDownward: { full: false, short: false },
      bottomUpward: { full: false, short: false },
      bottomDownward: { full: false, short: false },
    };

    const markSegment = (key: SegmentKey, isShort: boolean) => {
      if (isShort) {
        segments[key].short = true;
      } else {
        segments[key].full = true;
      }
    };

    const getOutgoingSegmentKey = (dx: number, dy: number): SegmentKey | null => {
      if (dx === 1) return 'rightRightward';
      if (dx === -1) return 'leftLeftward';
      if (dy === -1) return 'topUpward';
      if (dy === 1) return 'bottomDownward';
      return null;
    };

    const getIncomingSegmentKey = (dx: number, dy: number): SegmentKey | null => {
      if (dx === 1) return 'leftRightward';
      if (dx === -1) return 'rightLeftward';
      if (dy === -1) return 'bottomUpward';
      if (dy === 1) return 'topDownward';
      return null;
    };

    for (let i = 0; i < solutionPath.length; i++) {
      const current = solutionPath[i];
      if (current.x !== col || current.y !== row) continue;

      const prev = i > 0 ? solutionPath[i - 1] : null;
      const next = i < solutionPath.length - 1 ? solutionPath[i + 1] : null;

      const inDx = prev ? current.x - prev.x : 0;
      const inDy = prev ? current.y - prev.y : 0;
      const outDx = next ? next.x - current.x : 0;
      const outDy = next ? next.y - current.y : 0;

      const isTurnVisit =
        !!prev &&
        !!next &&
        (inDx !== outDx || inDy !== outDy);

      const shouldShorten =
        (rule === 'rightonly' || rule === 'leftonly') &&
        isTurnVisit;

      if (prev) {
        const incomingKey = getIncomingSegmentKey(inDx, inDy);
        if (incomingKey) {
          markSegment(incomingKey, shouldShorten);
        }
      }

      if (next) {
        const outgoingKey = getOutgoingSegmentKey(outDx, outDy);
        if (outgoingKey) {
          markSegment(outgoingKey, shouldShorten);
        }
      }
    }

    return segments;
  }, [solutionPath, rule]);

  const renderCell = (cell: Cell, rowIndex: number, colIndex: number) => {
    const cellEdges = edges[rowIndex][colIndex];
    const isOuterBottom = rowIndex === height - 1;
    const isOuterRight = colIndex === width - 1;
    const isOuterTop = rowIndex === 0;
    const isOuterLeft = colIndex === 0;
    
    // 壁モードかどうかで辺とセルのクリック可能性を制御
    const wallModeActive = isWallMode();
    
    const pathSegments = getPathSegmentsForCell(rowIndex, colIndex);
    const hasAnyPathSegment =
      pathSegments.leftLeftward.full || pathSegments.leftLeftward.short ||
      pathSegments.leftRightward.full || pathSegments.leftRightward.short ||
      pathSegments.rightLeftward.full || pathSegments.rightLeftward.short ||
      pathSegments.rightRightward.full || pathSegments.rightRightward.short ||
      pathSegments.topUpward.full || pathSegments.topUpward.short ||
      pathSegments.topDownward.full || pathSegments.topDownward.short ||
      pathSegments.bottomUpward.full || pathSegments.bottomUpward.short ||
      pathSegments.bottomDownward.full || pathSegments.bottomDownward.short;

    const getOffsetByDirection = (dx: number, dy: number) => {
      if (rule !== 'rightonly' && rule !== 'leftonly') {
        return { offsetX: 0, offsetY: 0 };
      }

      const isRightSide = rule === 'rightonly';
      // 進行方向に対する法線ベクトル
      const rightNormal = { x: -dy, y: dx };
      const leftNormal = { x: dy, y: -dx };
      const normal = isRightSide ? rightNormal : leftNormal;
      const laneShiftPx = 4;

      return {
        offsetX: normal.x * laneShiftPx,
        offsetY: normal.y * laneShiftPx,
      };
    };

    const upOffset = getOffsetByDirection(0, -1);
    const downOffset = getOffsetByDirection(0, 1);
    const rightOffset = getOffsetByDirection(1, 0);
    const leftOffset = getOffsetByDirection(-1, 0);
    const shortHalfSegmentLength = 'calc(50% - 4px)';
    const getHalfLength = (segment: SegmentState) => {
      if (segment.full) return '50%';
      if (segment.short) return shortHalfSegmentLength;
      return '0';
    };
    const rightOffsetClass = isOuterRight || cellEdges.right === 'wall' ? '-right-1' : 'right-0';
    const bottomOffsetClass = isOuterBottom || cellEdges.bottom === 'wall' ? '-bottom-1' : 'bottom-0';
    const rightEdgeZIndex = isOuterRight || cellEdges.right === 'wall' ? 10 : 5;
    const bottomEdgeZIndex = isOuterBottom || cellEdges.bottom === 'wall' ? 10 : 5;
    const shiftRightGridInWallMode = wallModeActive && !isOuterRight && cellEdges.right === 'normal';
    const shiftBottomGridInWallMode = wallModeActive && !isOuterBottom && cellEdges.bottom === 'normal';
    const cellZIndex = cell.type === 'start' || cell.type === 'goal' ? 20 : 3;
    const stepNumbers = showStepNumbers ? stepNumbersByCell.get(`${colIndex},${rowIndex}`) : undefined;

    return (
      <div key={`${rowIndex}-${colIndex}`} className="relative">
        {/* 上の辺（外壁のみ） */}
        {isOuterTop && (
          <div
            className={`absolute -top-1 left-0 right-0 ${getWallThickness('wall', true, 'horizontal')} ${getWallStyle('wall', true)}`}
            style={{ zIndex: 10 }}
          />
        )}
        
        {/* 左の辺（外壁のみ） */}
        {isOuterLeft && (
          <div
            className={`absolute -left-1 top-0 bottom-0 ${getWallThickness('wall', true, 'vertical')} ${getWallStyle('wall', true)}`}
            style={{ zIndex: 10 }}
          />
        )}
        
        {/* 右の辺 */}
        <div
          className={`absolute ${rightOffsetClass} top-0 bottom-0 ${getWallThickness(cellEdges.right, isOuterRight, 'vertical')} ${
            wallModeActive && !isOuterRight ? 'cursor-pointer' : 'cursor-default'
          } ${getWallStyle(cellEdges.right, isOuterRight)}`}
          onClick={() => wallModeActive && !isOuterRight && handleWallClick(rowIndex, colIndex, 'right')}
          style={{
            zIndex: rightEdgeZIndex,
            transform: shiftRightGridInWallMode ? 'translateX(1px)' : undefined
          }}
        />
        {wallModeActive && !isOuterRight && (
          <div
            className="absolute -right-2 top-0 bottom-0 w-4 cursor-pointer bg-transparent"
            onClick={() => handleWallClick(rowIndex, colIndex, 'right')}
            style={{ zIndex: 20 }}
          />
        )}
        
        {/* 下の辺 */}
        <div
          className={`absolute ${bottomOffsetClass} left-0 right-0 ${getWallThickness(cellEdges.bottom, isOuterBottom, 'horizontal')} ${
            wallModeActive && !isOuterBottom ? 'cursor-pointer' : 'cursor-default'
          } ${getWallStyle(cellEdges.bottom, isOuterBottom)}`}
          onClick={() => wallModeActive && !isOuterBottom && handleWallClick(rowIndex, colIndex, 'bottom')}
          style={{
            zIndex: bottomEdgeZIndex,
            transform: shiftBottomGridInWallMode ? 'translateY(1px)' : undefined
          }}
        />
        {wallModeActive && !isOuterBottom && (
          <div
            className="absolute -bottom-2 left-0 right-0 h-4 cursor-pointer bg-transparent"
            onClick={() => handleWallClick(rowIndex, colIndex, 'bottom')}
            style={{ zIndex: 20 }}
          />
        )}
        
        {/* パスの線を描画（十字交差にも対応） */}
        {hasAnyPathSegment && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 15 }}>
            {(pathSegments.leftLeftward.full || pathSegments.leftLeftward.short) && (
              <div
                className="absolute left-0 h-1 bg-red-500"
                style={{
                  width: getHalfLength(pathSegments.leftLeftward),
                  top: `calc(50% + ${leftOffset.offsetY}px)`,
                  transform: 'translateY(-50%)',
                }}
              />
            )}
            {(pathSegments.leftRightward.full || pathSegments.leftRightward.short) && (
              <div
                className="absolute left-0 h-1 bg-red-500"
                style={{
                  width: getHalfLength(pathSegments.leftRightward),
                  top: `calc(50% + ${rightOffset.offsetY}px)`,
                  transform: 'translateY(-50%)',
                }}
              />
            )}
            {(pathSegments.rightLeftward.full || pathSegments.rightLeftward.short) && (
              <div
                className="absolute right-0 h-1 bg-red-500"
                style={{
                  width: getHalfLength(pathSegments.rightLeftward),
                  top: `calc(50% + ${leftOffset.offsetY}px)`,
                  transform: 'translateY(-50%)',
                }}
              />
            )}
            {(pathSegments.rightRightward.full || pathSegments.rightRightward.short) && (
              <div
                className="absolute right-0 h-1 bg-red-500"
                style={{
                  width: getHalfLength(pathSegments.rightRightward),
                  top: `calc(50% + ${rightOffset.offsetY}px)`,
                  transform: 'translateY(-50%)',
                }}
              />
            )}
            {(pathSegments.topUpward.full || pathSegments.topUpward.short) && (
              <div
                className="absolute top-0 w-1 bg-red-500"
                style={{
                  height: getHalfLength(pathSegments.topUpward),
                  left: `calc(50% + ${upOffset.offsetX}px)`,
                  transform: 'translateX(-50%)',
                }}
              />
            )}
            {(pathSegments.topDownward.full || pathSegments.topDownward.short) && (
              <div
                className="absolute top-0 w-1 bg-red-500"
                style={{
                  height: getHalfLength(pathSegments.topDownward),
                  left: `calc(50% + ${downOffset.offsetX}px)`,
                  transform: 'translateX(-50%)',
                }}
              />
            )}
            {(pathSegments.bottomUpward.full || pathSegments.bottomUpward.short) && (
              <div
                className="absolute bottom-0 w-1 bg-red-500"
                style={{
                  height: getHalfLength(pathSegments.bottomUpward),
                  left: `calc(50% + ${upOffset.offsetX}px)`,
                  transform: 'translateX(-50%)',
                }}
              />
            )}
            {(pathSegments.bottomDownward.full || pathSegments.bottomDownward.short) && (
              <div
                className="absolute bottom-0 w-1 bg-red-500"
                style={{
                  height: getHalfLength(pathSegments.bottomDownward),
                  left: `calc(50% + ${downOffset.offsetX}px)`,
                  transform: 'translateX(-50%)',
                }}
              />
            )}
          </div>
        )}

        {/* STEP数表示（線より上、同一マス複数訪問は縦並び） */}
        {stepNumbers && stepNumbers.length > 0 && (
          <div
            className="absolute top-0 left-1 px-0.5 py-0.5 text-[10px] leading-3 font-bold text-green-700 pointer-events-none"
            style={{ zIndex: 18 }}
          >
            {stepNumbers.map((step) => (
              <div key={step}>{step}</div>
            ))}
          </div>
        )}
        
        {/* セル本体 */}
        <div
          className={getCellStyle(cell)}
          onClick={() => !wallModeActive && handleCellClick(rowIndex, colIndex)}
          style={{ zIndex: cellZIndex }}
        >
          {getCellContent(cell)}
        </div>
      </div>
    );
  };

  return (
    <main className="max-w-5xl mx-auto p-6">
      {showExport && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 max-w-lg w-full relative">
            <button
              className="absolute top-2 right-2 px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => setShowExport(false)}
            >
              ×
            </button>
            <h3 className="text-lg font-semibold mb-2">エクスポート</h3>
            <textarea
              className="w-full h-48 p-2 border rounded text-sm"
              value={exportText}
              readOnly
            />
            <div className="mt-3 flex gap-2">
              <button
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                onClick={handleCopyExport}
              >
                コピー
              </button>
              <button
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                onClick={() => setShowExport(false)}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 max-w-lg w-full relative">
            <button
              className="absolute top-2 right-2 px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => setShowImport(false)}
            >
              ×
            </button>
            <h3 className="text-lg font-semibold mb-2">インポート</h3>
            <textarea
              ref={importTextareaRef}
              className="w-full h-48 p-2 border rounded text-sm"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={'S1,2 G5,5\n12000\n00000\n0X000\n00000'}
            />
            <div className="mt-3 flex gap-2">
              <button
                className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200"
                onClick={handleApplyImport}
              >
                適用
              </button>
              <button
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                onClick={() => setShowImport(false)}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4">
        <Link href="/" className="text-blue-500 hover:text-blue-700 text-sm">
          ← トップに戻る
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-4">迷路ソルバー</h1>

      <div className="flex items-center mb-4 gap-2">
        <button
          className={`px-4 py-2 rounded text-sm transition-colors ${
            showManual
              ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              : 'bg-green-100 text-green-700 hover:bg-green-200'
          }`}
          onClick={() => setShowManual((v) => !v)}
        >
          {showManual ? '閉じる' : '使い方'}
        </button>
        {!hasAnalyzed && MAZE_SAMPLES.map((sample) => (
          <button
            key={sample.label}
            onClick={() => handleApplySample(sample.data)}
            className="px-4 py-2 bg-purple-100 text-purple-700 rounded text-sm hover:bg-purple-200"
          >
            {sample.label}
          </button>
        ))}
      </div>

      {showManual && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded text-sm leading-relaxed">
          <h3 className="font-bold mb-2">使い方</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>壁:</strong> マスの辺（境界線）をクリックして壁を設置/削除。外枠は変更不可</li>
            <li><strong>マス:</strong> マスをクリックして黒く塗りつぶし/元に戻す</li>
            <li><strong>S:</strong> スタート地点を設置/移動</li>
            <li><strong>G:</strong> ゴール地点を設置/移動</li>
            <li>盤面サイズを変更後、解析ボタンで経路を探索します。</li>
            <li><strong>最短:</strong> スタートからゴールまでの最短経路を探索します。</li>
            <li><strong>全部通過:</strong> 通行可能なマスをすべて1回ずつ通ってゴールする経路を探索します。</li>
            <li><strong>停止不可:</strong> 一度動き出すと壁や外枠にぶつかるまで直進するルールで経路を探索します。</li>
            <li><strong>右折のみ:</strong> 進行方向に対して直進または右折のみ許可して経路を探索します。</li>
            <li><strong>左折のみ:</strong> 進行方向に対して直進または左折のみ許可して経路を探索します。</li>
          </ul>
        </div>
      )}

      {!hasAnalyzed && (
        <div className="mb-4">
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'shortest', label: '最短' },
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
      )}

      {/* 実行ボタン */}
      <div className="mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          {hasAnalyzed ? (
            <>
              <button
                onClick={handleBackToInput}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300"
              >
                入力に戻る
              </button>
              <button
                onClick={() => setShowStepNumbers((prev) => !prev)}
                className={`px-4 py-2 rounded text-sm ${
                  showStepNumbers
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                数字表示
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className={`px-4 py-2 rounded text-sm text-white ${
                  isAnalyzing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isAnalyzing ? '解析中...' : '解析'}
              </button>
              <button
                onClick={resetBoard}
                className="px-4 py-2 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
              >
                リセット
              </button>
            </>
          )}
          {!hasAnalyzed && (
            <>
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded text-sm hover:bg-indigo-200"
              >
                エクスポート
              </button>
              <button
                onClick={handleImport}
                className="px-4 py-2 bg-teal-100 text-teal-700 rounded text-sm hover:bg-teal-200"
              >
                インポート
              </button>
            </>
          )}
        </div>
      </div>

      {/* サイズ設定（盤面の真上） */}
      {!hasAnalyzed && (
        <div className="mb-4">
          <div className="flex items-center gap-2 flex-wrap">
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
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              サイズ変更
            </button>
          </div>
        </div>
      )}

      {/* モード選択ボタン */}
      {!hasAnalyzed && (
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
      )}

      {/* 盤面 */}
      <div className="mb-6">
        <div className="inline-block border-2 border-black">
          {cells.map((row, rowIndex) => (
            <div key={rowIndex} className="flex">
              {row.map((cell, colIndex) => renderCell(cell, rowIndex, colIndex))}
            </div>
          ))}
        </div>
      </div>

      {/* 解析結果 */}
      {solutionPath.length > 0 && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded">
          <h3 className="font-bold text-green-800 mb-2">解析結果</h3>
          <p className="text-green-700">
            経路が見つかりました！ 総ステップ数: {solutionPath.length - 1}
          </p>
          {rule === 'shortest' && (
            <p className="mt-1 text-sm text-green-700">
              {hasMultipleShortestPath
                ? 'この最短経路以外にも最短経路があります。'
                : '最短経路はこの1通りです。'}
            </p>
          )}
          <div className="mt-2 text-sm text-green-600">
            経路: {solutionPath.map(coord => `(${coord.x},${coord.y})`).join(' → ')}
          </div>
          <div className="mt-2">
            <button
              onClick={() => {
                setSolutionPath([]);
                setHasMultipleShortestPath(false);
                setHasAnalyzed(false);
                setShowStepNumbers(false);
              }}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
            >
              結果をクリア
            </button>
          </div>
        </div>
      )}

      {/* 解析結果（経路なし） */}
      {hasAnalyzed && solutionPath.length === 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded">
          <h3 className="font-bold text-red-800 mb-2">解析結果</h3>
          <p className="text-red-700">経路が見つかりませんでした。スタートからゴールへの道が塞がれている可能性があります。</p>
        </div>
      )}

    </main>
  );
}
