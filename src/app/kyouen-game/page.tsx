"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";

// ==========================================
// 共円計算ロジック（整数演算による厳密な判定）
// ==========================================

/**
 * 3点 (x1,y1), (x2,y2), (x3,y3) の外接円上に (px,py) があるか判定する。
 * 整数演算のみを用いるため浮動小数点誤差がない。
 */
function isOnCircumcircle(
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  px: number, py: number
): boolean {
  const a = x2 - x1;
  const b = y2 - y1;
  const c = x3 - x2;
  const d = y3 - y2;
  const det = a * d - b * c;
  if (det === 0) return false; // 3点が一直線上 → 外接円なし

  // 外接円中心を 2*det 倍した整数座標で表す
  const s1 = x2 * x2 - x1 * x1 + y2 * y2 - y1 * y1;
  const s2 = x3 * x3 - x2 * x2 + y3 * y3 - y2 * y2;
  const twoDetCx = s1 * d - b * s2;
  const twoDetCy = a * s2 - s1 * c;
  const twoDet = 2 * det;

  // r² を (2*det)² 倍した値で比較
  const dx1 = twoDet * x1 - twoDetCx;
  const dy1 = twoDet * y1 - twoDetCy;
  const r2 = dx1 * dx1 + dy1 * dy1;

  const dxp = twoDet * px - twoDetCx;
  const dyp = twoDet * py - twoDetCy;
  return dxp * dxp + dyp * dyp === r2;
}

// 黒マスの組み合わせから共円マスを計算する
// 戻り値: Map<"x,y", [黒丸座標の三つ組[]]>
type Triplet = [number, number, number, number, number, number];

function computeConcyclic(
  blacks: Set<string>,
  width: number,
  height: number
): Map<string, Triplet[]> {
  const result = new Map<string, Triplet[]>();
  const list: [number, number][] = Array.from(blacks).map((k) => {
    const [x, y] = k.split(",").map(Number);
    return [x, y];
  });

  const n = list.length;
  if (n < 3) return result;

  for (let i = 0; i < n - 2; i++) {
    for (let j = i + 1; j < n - 1; j++) {
      for (let k = j + 1; k < n; k++) {
        const [x1, y1] = list[i];
        const [x2, y2] = list[j];
        const [x3, y3] = list[k];
        const triplet: Triplet = [x1, y1, x2, y2, x3, y3];

        for (let cy = 0; cy < height; cy++) {
          for (let cx = 0; cx < width; cx++) {
            // 3点自身はスキップ
            if (
              (cx === x1 && cy === y1) ||
              (cx === x2 && cy === y2) ||
              (cx === x3 && cy === y3)
            )
              continue;

            if (isOnCircumcircle(x1, y1, x2, y2, x3, y3, cx, cy)) {
              const key = `${cx},${cy}`;
              const arr = result.get(key);
              if (arr) arr.push(triplet);
              else result.set(key, [triplet]);
            }
          }
        }
      }
    }
  }

  return result;
}

function computeLineNg(
  blacks: Set<string>,
  width: number,
  height: number
): Map<string, Triplet[]> {
  const result = new Map<string, Triplet[]>();
  const list: [number, number][] = Array.from(blacks).map((k) => {
    const [x, y] = k.split(",").map(Number);
    return [x, y];
  });

  if (list.length < 2) return result;

  for (let cy = 0; cy < height; cy++) {
    for (let cx = 0; cx < width; cx++) {
      const key = `${cx},${cy}`;
      if (blacks.has(key)) continue;

      const groups = new Map<string, [number, number][]>();
      for (const [bx, by] of list) {
        let dx = bx - cx;
        let dy = by - cy;
        const g = gcd(Math.abs(dx), Math.abs(dy));
        if (g === 0) continue;
        dx /= g;
        dy /= g;

        // 反対向きは同一直線として同じキーにまとめる
        if (dx < 0 || (dx === 0 && dy < 0)) {
          dx = -dx;
          dy = -dy;
        }

        const dirKey = `${dx},${dy}`;
        const arr = groups.get(dirKey) ?? [];
        arr.push([bx, by]);
        groups.set(dirKey, arr);
      }

      const reasons: Triplet[] = [];
      for (const dots of groups.values()) {
        // 候補マス + 既存3点 で4点一直線になるときのみNG
        if (dots.length >= 3) {
          const [a, b, c] = dots;
          reasons.push([a[0], a[1], b[0], b[1], c[0], c[1]]);
        }
      }

      if (reasons.length > 0) {
        result.set(key, reasons);
      }
    }
  }

  return result;
}

function gcd(a: number, b: number): number {
  let x = a;
  let y = b;
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

function mergeTripletMaps(
  a: Map<string, Triplet[]>,
  b: Map<string, Triplet[]>
): Map<string, Triplet[]> {
  const merged = new Map<string, Triplet[]>();

  for (const [k, v] of a) {
    merged.set(k, [...v]);
  }
  for (const [k, v] of b) {
    const base = merged.get(k) ?? [];
    merged.set(k, [...base, ...v]);
  }

  return merged;
}

function getNgCellsForTriplet(
  triplet: Triplet,
  size: number
): Set<string> {
  const [x1, y1, x2, y2, x3, y3] = triplet;
  const result = new Set<string>();

  // 共円判定：この3点の外接円上のマスを見つける
  for (let cy = 0; cy < size; cy++) {
    for (let cx = 0; cx < size; cx++) {
      if ((cx === x1 && cy === y1) || (cx === x2 && cy === y2) || (cx === x3 && cy === y3)) continue;
      if (isOnCircumcircle(x1, y1, x2, y2, x3, y3, cx, cy)) {
        result.add(`${cx},${cy}`);
      }
    }
  }

  // 直線NG判定：3点が一直線上にあるか確認
  const cross = (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1);
  if (cross === 0) {
    // 3点が一直線上にある場合、その直線上のすべてのマスを見つける
    for (let cy = 0; cy < size; cy++) {
      for (let cx = 0; cx < size; cx++) {
        if ((cx === x1 && cy === y1) || (cx === x2 && cy === y2) || (cx === x3 && cy === y3)) continue;
        const cross2 = (x2 - x1) * (cy - y1) - (y2 - y1) * (cx - x1);
        if (cross2 === 0) {
          result.add(`${cx},${cy}`);
        }
      }
    }
  }

  return result;
}

function computeGreatSuccessCells(
  blacks: Set<string>,
  currentNgMap: Map<string, Triplet[]>,
  size: number
): Set<string> {
  const allCells: string[] = [];
  const nonNgCells: string[] = [];
  const uncoveredCells: string[] = [];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const key = `${x},${y}`;
      allCells.push(key);
      if (!currentNgMap.has(key)) {
        nonNgCells.push(key);
      }
      if (!blacks.has(key) && !currentNgMap.has(key)) {
        uncoveredCells.push(key);
      }
    }
  }

  if (uncoveredCells.length === 0) {
    return new Set(nonNgCells);
  }

  const result = new Set<string>();

  for (const candidate of nonNgCells) {
    const nextBlacks = new Set(blacks);
    nextBlacks.add(candidate);

    const nextNgMap = mergeTripletMaps(
      computeConcyclic(nextBlacks, size, size),
      computeLineNg(nextBlacks, size, size)
    );

    let covered = true;
    for (const uncovered of uncoveredCells) {
      if (uncovered === candidate) {
        continue;
      }
      if (!nextNgMap.has(uncovered)) {
        covered = false;
        break;
      }
    }

    if (covered) {
      result.add(candidate);
    }
  }

  return result;
}

// ==========================================
// コンポーネント
// ==========================================

const CELL_SIZE = 48;
const DEFAULT_SIZE = 8;

type Mode = "free" | "game" | "point";
type GamePhase = "idle" | "playing" | "answered";
type GameResult = "success" | "failure" | "bigSuccess";
type PointingResult = "success" | "failure";
type Quadruple = [number, number, number, number, number, number, number, number];

const shuffle = <T,>(arr: T[]): T[] => {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const createGameBoard = (width: number, height: number): Set<string> => {
  const blacks = new Set<string>();
  const allCells: string[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      allCells.push(`${x},${y}`);
    }
  }

  let guard = 0;
  while (guard < width * height * 4) {
    guard += 1;
    const concyclic = computeConcyclic(blacks, width, height);
    const lineNg = computeLineNg(blacks, width, height);
    const ng = mergeTripletMaps(concyclic, lineNg);
    const available = allCells.filter((k) => !blacks.has(k) && !ng.has(k));
    if (available.length === 0) {
      break;
    }

    const picked = available[Math.floor(Math.random() * available.length)];
    blacks.add(picked);

    const circleAfterAdd = computeConcyclic(blacks, width, height);
  const lineAfterAdd = computeLineNg(blacks, width, height);
    const ngAfterAdd = mergeTripletMaps(circleAfterAdd, lineAfterAdd);
    const covered = allCells.every((k) => blacks.has(k) || ngAfterAdd.has(k));
    if (covered) {
      break;
    }
  }

  if (blacks.size > 0) {
    const keys = shuffle(Array.from(blacks));
    blacks.delete(keys[0]);
  }

  return blacks;
};

function isCollinear(
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number
): boolean {
  return (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1) === 0;
}

function areFourConcyclic(points: [number, number][]): boolean {
  if (points.length !== 4) return false;
  const [p1, p2, p3, p4] = points;

  // 指摘共円では「一直線上の4点」も共円をもつ扱いにする
  if (
    isCollinear(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]) &&
    isCollinear(p1[0], p1[1], p2[0], p2[1], p4[0], p4[1])
  ) {
    return true;
  }

  const idxPatterns: [number, number, number, number][] = [
    [0, 1, 2, 3],
    [0, 1, 3, 2],
    [0, 2, 3, 1],
    [1, 2, 3, 0],
  ];

  for (const [a, b, c, d] of idxPatterns) {
    const [x1, y1] = points[a];
    const [x2, y2] = points[b];
    const [x3, y3] = points[c];
    const [x4, y4] = points[d];
    if (isCollinear(x1, y1, x2, y2, x3, y3)) continue;
    if (isOnCircumcircle(x1, y1, x2, y2, x3, y3, x4, y4)) {
      return true;
    }
  }

  return false;
}

function quadrupleToKey(quad: Quadruple): string {
  const points: string[] = [
    `${quad[0]},${quad[1]}`,
    `${quad[2]},${quad[3]}`,
    `${quad[4]},${quad[5]}`,
    `${quad[6]},${quad[7]}`,
  ].sort();
  return points.join("|");
}

function findConcyclicQuadruples(blacks: Set<string>): Quadruple[] {
  const list: [number, number][] = Array.from(blacks).map((k) => {
    const [x, y] = k.split(",").map(Number);
    return [x, y];
  });

  const result: Quadruple[] = [];
  const seen = new Set<string>();
  const n = list.length;
  if (n < 4) return result;

  for (let i = 0; i < n - 3; i++) {
    for (let j = i + 1; j < n - 2; j++) {
      for (let k = j + 1; k < n - 1; k++) {
        for (let l = k + 1; l < n; l++) {
          const points: [number, number][] = [list[i], list[j], list[k], list[l]];
          if (!areFourConcyclic(points)) continue;
          const quad: Quadruple = [
            points[0][0], points[0][1],
            points[1][0], points[1][1],
            points[2][0], points[2][1],
            points[3][0], points[3][1],
          ];
          const key = quadrupleToKey(quad);
          if (seen.has(key)) continue;
          seen.add(key);
          result.push(quad);
        }
      }
    }
  }

  return result;
}

function createPointingGameBoard(size: number): { blacks: Set<string>; answer: Set<string> } {
  const allCells: string[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      allCells.push(`${x},${y}`);
    }
  }

  for (let attempt = 0; attempt < 60; attempt++) {
    const blacks = new Set<string>();
    let guard = 0;

    while (guard < size * size * 4) {
      guard += 1;
      const ng = mergeTripletMaps(
        computeConcyclic(blacks, size, size),
        computeLineNg(blacks, size, size)
      );
      const available = allCells.filter((k) => !blacks.has(k) && !ng.has(k));
      if (available.length === 0) break;
      const picked = available[Math.floor(Math.random() * available.length)];
      blacks.add(picked);
    }

    const rest = allCells.filter((k) => !blacks.has(k));
    if (rest.length === 0) continue;
    blacks.add(rest[Math.floor(Math.random() * rest.length)]);

    guard = 0;
    let quads = findConcyclicQuadruples(blacks);

    while (quads.length === 0 && guard < size * size * 3) {
      guard += 1;
      const candidates = allCells.filter((k) => !blacks.has(k));
      if (candidates.length === 0) break;
      blacks.add(candidates[Math.floor(Math.random() * candidates.length)]);
      quads = findConcyclicQuadruples(blacks);
    }

    guard = 0;
    while (quads.length > 1 && guard < size * size * 4) {
      guard += 1;
      const pickedQuad = quads[Math.floor(Math.random() * quads.length)];
      const quadCells = [
        `${pickedQuad[0]},${pickedQuad[1]}`,
        `${pickedQuad[2]},${pickedQuad[3]}`,
        `${pickedQuad[4]},${pickedQuad[5]}`,
        `${pickedQuad[6]},${pickedQuad[7]}`,
      ];
      const toDelete = quadCells[Math.floor(Math.random() * quadCells.length)];
      blacks.delete(toDelete);
      quads = findConcyclicQuadruples(blacks);
      if (quads.length === 0) {
        const candidates = allCells.filter((k) => !blacks.has(k));
        if (candidates.length > 0) {
          blacks.add(candidates[Math.floor(Math.random() * candidates.length)]);
          quads = findConcyclicQuadruples(blacks);
        }
      }
    }

    if (quads.length === 1) {
      const q = quads[0];
      const answer = new Set<string>([
        `${q[0]},${q[1]}`,
        `${q[2]},${q[3]}`,
        `${q[4]},${q[5]}`,
        `${q[6]},${q[7]}`,
      ]);
      return { blacks, answer };
    }
  }

  return { blacks: createGameBoard(size, size), answer: new Set() };
}

export default function KyouenGamePage() {
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [inputSize, setInputSize] = useState(String(DEFAULT_SIZE));
  const [blacks, setBlacks] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>("free");
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showAboutKyouen, setShowAboutKyouen] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>("idle");
  const [blueCell, setBlueCell] = useState<string | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [pointingResult, setPointingResult] = useState<PointingResult | null>(null);
  const [pointingSelection, setPointingSelection] = useState<Set<string>>(new Set());
  const [pointingAnswer, setPointingAnswer] = useState<Set<string>>(new Set());
  const [failureTriplet, setFailureTriplet] = useState<Triplet | null>(null);
  const [activeReasonIndex, setActiveReasonIndex] = useState(0);

  // 共円マスの計算（メモ化）
  const concyclicMap = useMemo(
    () => computeConcyclic(blacks, size, size),
    [blacks, size]
  );

  const lineNgMap = useMemo(
    () => computeLineNg(blacks, size, size),
    [blacks, size]
  );

  const ngMap = useMemo(
    () => mergeTripletMaps(concyclicMap, lineNgMap),
    [concyclicMap, lineNgMap]
  );

  const selectedReasons = useMemo<Triplet[]>(() => {
    if (!selectedCell) return [];
    return ngMap.get(selectedCell) ?? [];
  }, [selectedCell, ngMap]);

  const selectedNgCells = useMemo<Set<string>>(() => {
    if (selectedReasons.length === 0) return new Set();
    const t = selectedReasons[activeReasonIndex % selectedReasons.length];
    return getNgCellsForTriplet(t, size);
  }, [activeReasonIndex, selectedReasons, size]);

  // 選択中の共円マスに関係する黒丸のセット
  const highlightedDots = useMemo<Set<string>>(() => {
    if (selectedReasons.length === 0) return new Set();
    const dots = new Set<string>();
    const t = selectedReasons[activeReasonIndex % selectedReasons.length];
    const [x1, y1, x2, y2, x3, y3] = t;
    dots.add(`${x1},${y1}`);
    dots.add(`${x2},${y2}`);
    dots.add(`${x3},${y3}`);
    return dots;
  }, [activeReasonIndex, selectedReasons]);

  useEffect(() => {
    setActiveReasonIndex(0);
  }, [selectedCell, mode]);

  useEffect(() => {
    if (mode !== "free") return;
    if (selectedReasons.length <= 1) return;

    const timer = setInterval(() => {
      setActiveReasonIndex((prev) => (prev + 1) % selectedReasons.length);
    }, 3000);

    return () => clearInterval(timer);
  }, [mode, selectedReasons.length]);

  const failureDots = useMemo<Set<string>>(() => {
    if (!failureTriplet) return new Set();
    const [x1, y1, x2, y2, x3, y3] = failureTriplet;
    return new Set([`${x1},${y1}`, `${x2},${y2}`, `${x3},${y3}`]);
  }, [failureTriplet]);

  const failureNgCells = useMemo<Set<string>>(() => {
    if (!failureTriplet) return new Set();
    return getNgCellsForTriplet(failureTriplet, size);
  }, [failureTriplet, size]);

  const greatSuccessCells = useMemo<Set<string>>(() => {
    if (mode !== "game") return new Set();
    return computeGreatSuccessCells(blacks, ngMap, size);
  }, [blacks, mode, ngMap, size]);

  const pointAnswerNgCells = useMemo<Set<string>>(() => {
    if (mode !== "point") return new Set();
    if (pointingAnswer.size !== 4) return new Set();

    const answerPoints: [number, number][] = Array.from(pointingAnswer).map((k) => {
      const [x, y] = k.split(",").map(Number);
      return [x, y];
    });

    const result = new Set<string>();
    for (let i = 0; i < answerPoints.length - 2; i++) {
      for (let j = i + 1; j < answerPoints.length - 1; j++) {
        for (let k = j + 1; k < answerPoints.length; k++) {
          const [x1, y1] = answerPoints[i];
          const [x2, y2] = answerPoints[j];
          const [x3, y3] = answerPoints[k];
          const triplet: Triplet = [x1, y1, x2, y2, x3, y3];
          const ngCells = getNgCellsForTriplet(triplet, size);
          for (const cell of ngCells) {
            if (!pointingAnswer.has(cell)) {
              result.add(cell);
            }
          }
        }
      }
    }

    return result;
  }, [mode, pointingAnswer, size]);

  // 盤面サイズ変更
  const handleApplySize = useCallback(() => {
    const s = parseInt(inputSize, 10);
    if (Number.isNaN(s)) return;
    if (s <= 3) {
      setSizeError("サイズは4以上を入力してください。");
      return;
    }

    const cs = Math.max(4, Math.min(20, s));
    setSizeError(null);
    setSize(cs);
    setBlacks((prev) => {
      const next = new Set<string>();
      for (const k of prev) {
        const [x, y] = k.split(",").map(Number);
        if (x < cs && y < cs) next.add(k);
      }
      return next;
    });
    setSelectedCell(null);
    setActiveReasonIndex(0);
    setBlueCell(null);
    setGameResult(null);
    setPointingResult(null);
    setPointingSelection(new Set());
    setPointingAnswer(new Set());
    setFailureTriplet(null);
    setGamePhase("idle");
  }, [inputSize]);

  const handleStartGame = useCallback(() => {
    const generated = createGameBoard(size, size);
    setBlacks(generated);
    setSelectedCell(null);
    setActiveReasonIndex(0);
    setBlueCell(null);
    setGameResult(null);
    setPointingResult(null);
    setPointingSelection(new Set());
    setPointingAnswer(new Set());
    setFailureTriplet(null);
    setGamePhase("playing");
  }, [size]);

  const handleStartPointing = useCallback(() => {
    const generated = createPointingGameBoard(size);
    setBlacks(generated.blacks);
    setPointingAnswer(generated.answer);
    setPointingSelection(new Set());
    setPointingResult(null);
    setSelectedCell(null);
    setActiveReasonIndex(0);
    setBlueCell(null);
    setGameResult(null);
    setFailureTriplet(null);
    setGamePhase("playing");
  }, [size]);

  useEffect(() => {
    if (mode !== "point") return;
    if (gamePhase !== "playing") return;
    if (pointingSelection.size !== 4) return;

    const list: [number, number][] = Array.from(pointingSelection).map((k) => {
      const [x, y] = k.split(",").map(Number);
      return [x, y];
    });

    const success = areFourConcyclic(list);
    setPointingResult(success ? "success" : "failure");
    setGamePhase("answered");
  }, [gamePhase, mode, pointingSelection]);

  const resetAll = useCallback(() => {
    setBlacks(new Set());
    setSelectedCell(null);
    setActiveReasonIndex(0);
    setBlueCell(null);
    setGameResult(null);
    setPointingResult(null);
    setPointingSelection(new Set());
    setPointingAnswer(new Set());
    setFailureTriplet(null);
    setGamePhase("idle");
  }, []);

  // セルクリック処理
  const handleCellClick = useCallback(
    (x: number, y: number, e: React.MouseEvent) => {
      e.stopPropagation();
      const key = `${x},${y}`;

      if (mode === "game") {
        if (gamePhase !== "playing") {
          return;
        }

        setBlueCell(key);
        setSelectedCell(null);
        setActiveReasonIndex(0);

        if (greatSuccessCells.has(key)) {
          setGameResult("bigSuccess");
          setFailureTriplet(null);
          setGamePhase("answered");
          return;
        }

        const triplets = ngMap.get(key);
        if (!triplets || triplets.length === 0) {
          setGameResult("success");
          setFailureTriplet(null);
        } else {
          setGameResult("failure");
          setFailureTriplet(triplets[0]);
        }
        setGamePhase("answered");
        return;
      }

      if (mode === "point") {
        if (gamePhase !== "playing") return;
        if (!blacks.has(key)) return;

        setPointingSelection((prev) => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        });
        return;
      }

      if (blacks.has(key)) {
        // 黒丸を消す
        setSelectedCell(null);
        setActiveReasonIndex(0);
        setBlacks((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      } else if (ngMap.has(key)) {
        // NGマスをクリック → 選択/解除
        setSelectedCell((prev) => (prev === key ? null : key));
        setActiveReasonIndex(0);
      } else {
        // 空マスに黒丸を置く
        setSelectedCell(null);
        setActiveReasonIndex(0);
        setBlacks((prev) => new Set([...prev, key]));
      }
    },
    [blacks, gamePhase, greatSuccessCells, mode, ngMap]
  );

  // 盤面外クリックで選択解除
  const handleOutsideClick = useCallback(() => {
    if (mode === "free") {
      setSelectedCell(null);
      setActiveReasonIndex(0);
    }
  }, [mode]);

  const selectedTripletCount = selectedCell
    ? (ngMap.get(selectedCell)?.length ?? 0)
    : 0;

  return (
    <main
      className="max-w-4xl mx-auto p-6"
      onClick={handleOutsideClick}
    >
      {/* ナビゲーション */}
      <div className="mb-4">
        <Link
          href="/"
          className="text-blue-500 hover:text-blue-700 text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          ← トップに戻る
        </Link>
      </div>

      {/* タイトル */}
      <h1 className="text-2xl font-bold mb-4">共円ゲーム</h1>

      {/* 補助操作：使い方 */}
      <div className="flex items-center mb-4 gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          className={`px-4 py-2 rounded text-sm transition-colors ${
            showHelp
              ? "bg-gray-200 text-gray-800 hover:bg-gray-300"
              : "bg-green-100 text-green-700 hover:bg-green-200"
          }`}
          onClick={() => setShowHelp((v) => !v)}
        >
          {showHelp ? "閉じる" : "使い方"}
        </button>
        <button
          className={`px-4 py-2 rounded text-sm transition-colors ${
            showAboutKyouen
              ? "bg-gray-200 text-gray-800 hover:bg-gray-300"
              : "bg-amber-100 text-amber-700 hover:bg-amber-200"
          }`}
          onClick={() => setShowAboutKyouen((v) => !v)}
        >
          {showAboutKyouen ? "閉じる" : "共円とは"}
        </button>
      </div>

      {showHelp && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded text-sm leading-relaxed space-y-2" onClick={(e) => e.stopPropagation()}>
          {mode === "free" ? (
            <>
              <p>フリーでは、盤面をクリックして黒丸を置きます。もう一度クリックすると削除できます。</p>
              <p>
                黒丸が3個以上あると、その3つを通る円の円周上にあるマスが
                <span className="bg-red-100 text-red-700 px-1 rounded mx-1">薄赤</span>
                で表示されます。さらに、置くと黒丸4つが一直線になるマスもNGマスとして同じく表示されます。
              </p>
              <p>赤いNGマスをクリックすると、その判定に関係する黒丸が赤くなります。もう一度クリックするか、盤面外をクリックすると元に戻ります。</p>
            </>
          ) : mode === "game" ? (
            <>
              <p>詰共円では、開始で黒丸がランダムに配置されます。共円マスとNGマスを避ける形で作られます。</p>
              <p>答えとして1マスをクリックすると、青丸が置かれて判定されます。共円でも4点一直線でもなければ成功です。</p>
              <p>盤面すべてをNGマスにする場所は大成功マスです。大成功マスを選べば「大成功」と表示され、それ以外を選んだあとには大成功マスに黄色の星が表示されます。</p>
            </>
          ) : (
            <>
              <p>指摘共円では、開始すると黒丸がランダムに配置されます。</p>
              <p>黒丸を4つ選んだ時点で判定されます。4つ未満では判定されません。</p>
              <p>選んだ4つが共円（一直線上の4点を含む）なら成功、そうでなければ失敗です。判定後は正解の4つの黒丸が赤く表示されます。</p>
            </>
          )}
        </div>
      )}

      {showAboutKyouen && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded text-sm leading-relaxed space-y-2" onClick={(e) => e.stopPropagation()}>
          <p className="font-semibold">【ゲームの概要】</p>
          <p>「共円（きょうえん）」は、盤面のマスに点を置いていく、幾何学パズルゲームです。</p>
          <p>格子状の点の中から「円」や「直線」のパターンを見つけ出す直感力と、先を読む戦略性が試されます。</p>
          <p className="font-semibold pt-1">【基本ルール】</p>
          <p>以下の2つのパターンを作らないように、慎重に点を選んでいきます。</p>
          <p>1. 共円を避ける： 4つの点が「同じ円周上」に並んではいけません。</p>
          <p>2. 一直線を避ける： 4つの点が「一直線上」に並んではいけません。</p>
          <p>※「詰共円」では、ランダムに置かれた黒丸を見て、ルールに抵触しない「安全な最後の一手」を探し出します。</p>
        </div>
      )}

      <div className="flex items-center mb-4 gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          className={`px-4 py-2 rounded text-sm ${
            mode === "free"
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-200 text-gray-800 hover:bg-gray-300"
          }`}
          onClick={() => {
            setMode("free");
            setSelectedCell(null);
            setActiveReasonIndex(0);
            setBlueCell(null);
            setGameResult(null);
            setPointingResult(null);
            setPointingSelection(new Set());
            setPointingAnswer(new Set());
            setFailureTriplet(null);
            setGamePhase("idle");
          }}
        >
          フリー
        </button>
        <button
          className={`px-4 py-2 rounded text-sm ${
            mode === "game"
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-200 text-gray-800 hover:bg-gray-300"
          }`}
          onClick={() => {
            setMode("game");
            setSelectedCell(null);
            setActiveReasonIndex(0);
            setBlueCell(null);
            setGameResult(null);
            setPointingResult(null);
            setPointingSelection(new Set());
            setPointingAnswer(new Set());
            setFailureTriplet(null);
            setGamePhase("idle");
          }}
        >
          詰共円
        </button>
        <button
          className={`px-4 py-2 rounded text-sm ${
            mode === "point"
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-200 text-gray-800 hover:bg-gray-300"
          }`}
          onClick={() => {
            setMode("point");
            setSelectedCell(null);
            setActiveReasonIndex(0);
            setBlueCell(null);
            setGameResult(null);
            setPointingResult(null);
            setPointingSelection(new Set());
            setPointingAnswer(new Set());
            setFailureTriplet(null);
            setGamePhase("idle");
          }}
        >
          指摘共円
        </button>
      </div>

      <div className="flex items-center mb-4 gap-2" onClick={(e) => e.stopPropagation()}>
        {mode === "game" && (
          <button
            className="px-4 py-2 rounded text-sm bg-blue-600 text-white hover:bg-blue-700"
            onClick={handleStartGame}
          >
            開始
          </button>
        )}
        {mode === "point" && gamePhase !== "playing" && (
          <button
            className="px-4 py-2 rounded text-sm bg-blue-600 text-white hover:bg-blue-700"
            onClick={handleStartPointing}
          >
            開始
          </button>
        )}
        <button
          className="px-4 py-2 rounded text-sm bg-red-100 text-red-700 hover:bg-red-200"
          onClick={resetAll}
        >
          リセット
        </button>
      </div>

      {/* 盤面サイズ変更（盤面直上） */}
      <div
        className="mb-2 flex gap-2 items-center flex-wrap"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1">
          <label className="text-sm">サイズ:</label>
          <input
            type="number"
            min="4"
            max="20"
            value={inputSize}
            onChange={(e) => {
              const nextValue = e.target.value;
              setInputSize(nextValue);
              const parsed = parseInt(nextValue, 10);
              if (!Number.isNaN(parsed) && parsed >= 4) {
                setSizeError(null);
              }
            }}
            className="w-16 p-1 border rounded text-sm"
          />
        </div>
        <button
          className="h-[30px] px-3 rounded text-sm bg-blue-600 text-white hover:bg-blue-700"
          onClick={handleApplySize}
        >
          適用
        </button>
        {sizeError && <span className="text-sm text-red-600">{sizeError}</span>}
      </div>

      {/* 盤面 */}
      <div
        className="inline-block"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="inline-grid border-2 border-gray-800"
          style={{
            gridTemplateColumns: `repeat(${size}, ${CELL_SIZE}px)`,
          }}
        >
          {Array.from({ length: size }, (_, y) =>
            Array.from({ length: size }, (_, x) => {
              const key = `${x},${y}`;
              const isBlack = blacks.has(key);
              const isNgCell = !isBlack && ngMap.has(key);
              const isSelected = selectedCell === key;
              const isHighlighted = highlightedDots.has(key);
              const isBlue = blueCell === key;
              const isPointSelected = pointingSelection.has(key);
              const isSelectedNgCell = selectedNgCells.has(key);
              const isFailureNgCell = failureNgCells.has(key);
              const isGreatSuccessCell = greatSuccessCells.has(key);
              const isPointAnswer = pointingAnswer.has(key);
              const isPointAnswerNgCell = pointAnswerNgCells.has(key);
              const showGreenRing =
                ((isSelectedNgCell || isFailureNgCell) && !isBlue) ||
                (mode === "point" && gamePhase === "answered" && isPointAnswerNgCell);

              const showConcyclicBg =
                mode === "free"
                  ? isNgCell
                  : mode === "game" && gamePhase === "answered" && isNgCell;

              let bgClass = "bg-white hover:bg-gray-100";
              if (showConcyclicBg) {
                if (isSelected) {
                  bgClass = "bg-red-300 hover:bg-red-400";
                } else {
                  bgClass = "bg-red-100 hover:bg-red-200";
                }
              }
              if (mode === "point" && isPointSelected) {
                bgClass = "bg-blue-100 hover:bg-blue-200";
              }

              const blackFill =
                mode === "free"
                  ? (isHighlighted ? "#dc2626" : "#1a1a1a")
                  : mode === "game"
                    ? (gameResult === "failure" && failureDots.has(key) ? "#dc2626" : "#1a1a1a")
                    : (gamePhase === "answered" && isPointAnswer ? "#dc2626" : "#1a1a1a");

              return (
                <div
                  key={key}
                  className={`${bgClass} relative border border-gray-300 flex items-center justify-center cursor-pointer transition-colors duration-100`}
                  style={{ width: CELL_SIZE, height: CELL_SIZE }}
                  onClick={(e) => handleCellClick(x, y, e)}
                >
                  {isBlack && (
                    <svg width="36" height="36" viewBox="0 0 36 36">
                      <circle
                        cx="18"
                        cy="18"
                        r="14"
                        fill={blackFill}
                      />
                    </svg>
                  )}
                  {isBlue && (
                    <svg width="36" height="36" viewBox="0 0 36 36" className="absolute pointer-events-none">
                      <circle
                        cx="18"
                        cy="18"
                        r="11"
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="4"
                      />
                    </svg>
                  )}
                  {showGreenRing && (
                    <svg width="36" height="36" viewBox="0 0 36 36" className="absolute pointer-events-none">
                      <circle
                        cx="18"
                        cy="18"
                        r="10"
                        fill="none"
                        stroke="#16a34a"
                        strokeWidth="2"
                      />
                    </svg>
                  )}
                  {mode === "game" && gamePhase === "answered" && isGreatSuccessCell && !isBlue && (
                    <svg width="24" height="24" viewBox="0 0 24 24" className="absolute pointer-events-none text-yellow-400">
                      <path
                        fill="currentColor"
                        d="M12 2.5l2.82 5.72 6.31.92-4.57 4.45 1.08 6.29L12 16.96 6.36 19.88l1.08-6.29L2.87 9.14l6.31-.92L12 2.5z"
                      />
                    </svg>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 選択中の情報パネル */}
      {selectedCell && (
        <div className="mt-4 p-3 bg-red-50 border border-red-300 rounded text-sm">
          <span className="font-semibold text-red-700">NGマスを選択中 — </span>
          <span className="text-gray-700">
            このマスには {selectedTripletCount} 通りのNG理由があります。関係する黒丸が赤く表示されています。
          </span>
        </div>
      )}

      {mode === "game" && gameResult && (
        <div
          className={`mt-4 p-3 rounded text-sm border ${
            gameResult === "failure"
              ? "bg-red-50 border-red-300 text-red-700"
              : "bg-green-50 border-green-300 text-green-700"
          }`}
        >
          {gameResult === "bigSuccess"
            ? "大成功: このマスを置くと、盤面のすべてが円かNGマスになります。"
            : gameResult === "success"
            ? "成功: 青丸のマスは共円でも4点一直線でもありません。"
            : "失敗: 青丸のマスは共円、または4点一直線NGです。青丸が絡むNGを1つだけ赤で表示しています。"}
        </div>
      )}

      {mode === "point" && gamePhase === "playing" && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-300 rounded text-sm text-blue-700">
          選択中: {pointingSelection.size} / 4（黒丸を4つ選ぶと自動で判定されます）
        </div>
      )}

      {mode === "point" && pointingResult && (
        <div
          className={`mt-4 p-3 rounded text-sm border ${
            pointingResult === "success"
              ? "bg-green-50 border-green-300 text-green-700"
              : "bg-red-50 border-red-300 text-red-700"
          }`}
        >
          {pointingResult === "success"
            ? "成功: 選んだ4つの黒丸は共円（一直線を含む）です。正解の4つを赤で表示しています。"
            : "失敗: 選んだ4つの黒丸は共円（一直線を含む）ではありません。正解の4つを赤で表示しています。"}
        </div>
      )}

      {/* 統計 */}
      {mode === "free" && (
        <div className="mt-3 text-sm text-gray-500">
          黒丸: {blacks.size} 個 ／ NGマス: {ngMap.size} 個
        </div>
      )}
    </main>
  );
}
