'use client';

import { useState } from 'react';
import Link from 'next/link';

interface CongruenceEquation {
  remainder: number;
  modulus: number;
}

interface ChineseRemainderResult {
  solution: number;
  period: number;
  equations: CongruenceEquation[];
  examples: number[];
}

export default function ChineseRemainderTheorem() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<ChineseRemainderResult | null>(null);
  const [error, setError] = useState('');

  // 拡張ユークリッド互除法
  const extendedGcd = (a: number, b: number): { gcd: number; x: number; y: number } => {
    if (b === 0) {
      return { gcd: a, x: 1, y: 0 };
    }
    
    const { gcd, x: x1, y: y1 } = extendedGcd(b, a % b);
    const x = y1;
    const y = x1 - Math.floor(a / b) * y1;
    
    return { gcd, x, y };
  };

  // 最大公約数を求める
  const gcd = (a: number, b: number): number => {
    while (b !== 0) {
      const temp = b;
      b = a % b;
      a = temp;
    }
    return a;
  };

  // 最小公倍数を求める
  const lcm = (a: number, b: number): number => {
    return Math.abs(a * b) / gcd(a, b);
  };

  // 拡張中国剰余定理の実装（法が互いに素でない場合にも対応）
  const chineseRemainderTheorem = (equations: CongruenceEquation[]): ChineseRemainderResult | null => {
    if (equations.length === 0) return null;
    if (equations.length === 1) {
      const eq = equations[0];
      return {
        solution: eq.remainder,
        period: eq.modulus,
        equations,
        examples: Array.from({ length: 10 }, (_, i) => eq.remainder + eq.modulus * i)
      };
    }

    // 最初の方程式から開始
    let x = equations[0].remainder;
    let m = equations[0].modulus;

    for (let i = 1; i < equations.length; i++) {
      const a = equations[i].remainder;
      const n = equations[i].modulus;

      // 現在の解と新しい方程式の互換性をチェック
      const g = gcd(m, n);
      
      // 互換性チェック: (x - a) が gcd(m, n) で割り切れるか
      if ((x - a) % g !== 0) {
        const conflictMsg = `x ≡ ${x} (mod ${m}) と x ≡ ${a} (mod ${n}) は互換性がありません`;
        throw new Error(`競合する式が見つかりました:\n ${conflictMsg}\n` +
                       `理由: (${x} - ${a}) = ${x - a} が gcd(${m}, ${n}) = ${g} で割り切れません\n`);
      }

      // 拡張ユークリッド互除法で係数を求める
      const { x: u } = extendedGcd(m, n);
      
      // 新しい解を計算
      const newX = x + m * u * ((a - x) / g);
      const newM = lcm(m, n);

      // 解を正の値に調整
      x = ((newX % newM) + newM) % newM;
      m = newM;
    }

    const examples = Array.from({ length: 10 }, (_, i) => x + m * i);

    return {
      solution: x,
      period: m,
      equations,
      examples
    };
  };

  // 入力を解析
  const parseInput = (input: string): CongruenceEquation[] => {
    const lines = input.trim().split('\n').filter(line => line.trim());
    const equations: CongruenceEquation[] = [];

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length !== 2) {
        throw new Error(`行 "${line}" の形式が正しくありません。2つの数字を空白で区切って入力してください。`);
      }

      const remainder = parseInt(parts[0]);
      const modulus = parseInt(parts[1]);

      if (isNaN(remainder) || isNaN(modulus)) {
        throw new Error(`行 "${line}" に無効な数字が含まれています。`);
      }

      if (modulus <= 0) {
        throw new Error(`法は正の数である必要があります: ${modulus}`);
      }

      if (remainder < 0) {
        throw new Error(`剰余は非負の数である必要があります: ${remainder}`);
      }

      if (remainder >= modulus) {
        throw new Error(`剰余は法より小さい必要があります: ${remainder} >= ${modulus}`);
      }

      equations.push({ remainder, modulus });
    }

    return equations;
  };

  // 計算実行
  const handleCalculate = () => {
    setError('');
    setResult(null);

    try {
      const equations = parseInput(input);
      
      if (equations.length === 0) {
        setError('少なくとも1つの合同式を入力してください。');
        return;
      }

      const solution = chineseRemainderTheorem(equations);
      if (solution) {
        setResult(solution);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '計算中にエラーが発生しました。');
    }
  };

  // サンプルデータ設定
  const handleSample = () => {
    setInput('3 5\n2 7');
    setError('');
    setResult(null);
  };

  // 互いに素でないサンプル
  const handleSample2 = () => {
    setInput('2 6\n4 8');
    setError('');
    setResult(null);
  };

  // 競合するサンプル
  const handleSample3 = () => {
    setInput('1 6\n3 8');
    setError('');
    setResult(null);
  };

  // リセット
  const handleReset = () => {
    setInput('');
    setResult(null);
    setError('');
  };

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">中国剰余定理</h1>
      
      <div className="flex items-center mb-6 gap-2">
        <Link href="/" className="inline-block px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">
          トップに戻る
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* 入力エリア */}
        <div>
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-3">合同式の入力</h2>
            <div className="mb-3 p-3 bg-blue-50 rounded">
              <p className="text-sm text-blue-800">
                <strong>入力形式:</strong> 各行に「剰余 法」を空白区切りで入力
              </p>
              <p className="text-sm text-blue-800">
                例: 「3 5」は x ≡ 3 (mod 5) を意味します
              </p>
              <p className="text-sm text-blue-800 mt-1">
                <strong>サンプル:</strong> サンプル1（互いに素）、サンプル2（互いに素でない）、競合例（解なし）
              </p>
            </div>
            <textarea
              className="w-full h-32 p-3 border rounded-lg font-mono"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="3 5&#10;2 7"
            />
          </div>

          <div className="flex gap-2 mb-4">
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={handleCalculate}
            >
              計算実行
            </button>
            <button
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              onClick={handleSample}
            >
              サンプル1
            </button>
            <button
              className="px-3 py-2 bg-green-400 text-white rounded hover:bg-green-500 text-sm"
              onClick={handleSample2}
            >
              サンプル2
            </button>
            <button
              className="px-3 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
              onClick={handleSample3}
            >
              競合例
            </button>
            <button
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              onClick={handleReset}
            >
              リセット
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-100 border border-red-300 rounded text-red-700">
              <strong>エラー:</strong> 
              <span 
                dangerouslySetInnerHTML={{ 
                  __html: error.replace(/\n/g, '<br>') 
                }} 
              />
            </div>
          )}
        </div>

        {/* 結果エリア */}
        <div>
          <h2 className="text-xl font-semibold mb-3">計算結果</h2>
          
          {result ? (
            <div className="space-y-4">
              {/* 入力された合同式 */}
              <div className="p-4 bg-gray-50 rounded">
                <h3 className="font-medium mb-2">入力された合同式:</h3>
                {result.equations.map((eq, index) => (
                  <div key={index} className="font-mono text-sm">
                    x ≡ {eq.remainder} (mod {eq.modulus})
                  </div>
                ))}
              </div>

              {/* 解 */}
              <div className="p-4 bg-green-50 rounded">
                <h3 className="font-medium mb-2">解:</h3>
                <div className="font-mono text-lg font-semibold text-green-800">
                  x = {result.solution} + {result.period}n
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  (n は任意の整数)
                </div>
              </div>

              {/* 具体例 */}
              <div className="p-4 bg-blue-50 rounded">
                <h3 className="font-medium mb-2">具体例 (最初の10個):</h3>
                <div className="font-mono text-sm">
                  ({result.examples.join(', ')})
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-gray-100 rounded text-gray-600">
              合同式を入力して「計算実行」ボタンを押してください。
            </div>
          )}
        </div>
      </div>

      {/* 使い方説明 */}
      <div className="mt-8 p-4 bg-yellow-50 rounded">
        <h3 className="font-medium mb-3">拡張中国剰余定理について</h3>
        <div className="text-sm text-gray-700 space-y-2">
          <p>
            <strong>中国剰余定理</strong>は、複数の合同式を同時に満たす解を求める定理です。
          </p>
          <p>
            <strong>拡張版の特徴:</strong> 法が互いに素でない場合にも対応できます。最小公倍数を使って計算します。
          </p>
          <p>
            <strong>互換性チェック:</strong> 解が存在しない場合は、競合する式を特定してエラー表示します。
          </p>
          <p>
            <strong>例1:</strong> x ≡ 3 (mod 5) かつ x ≡ 2 (mod 7) → x = 23 + 35n
          </p>
          <p>
            <strong>例2:</strong> x ≡ 2 (mod 6) かつ x ≡ 4 (mod 8) → x = 8 + 24n（法が互いに素でない場合）
          </p>
        </div>
      </div>
    </main>
  );
}