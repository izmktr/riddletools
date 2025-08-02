'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function CryptarithmeticPage() {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 安全な式の評価（eval の代替）
  const safeEvaluate = (expression: string): number | null => {
    try {
      // 許可された文字のみをチェック（数字、+、-、*、/、^、括弧、スペース）
      if (!/^[\d+\-*/^\s()]+$/.test(expression)) {
        return null;
      }
      
      // 累乗演算子（^）をMath.powに変換
      let processedExpression = expression;
      
      // ^を**に置換（JavaScriptの累乗演算子）
      processedExpression = processedExpression.replace(/\^/g, '**');
      
      // Function コンストラクタを使用して安全に評価
      const result = Function(`"use strict"; return (${processedExpression})`)();
      
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        // 結果が整数でない場合は無効とする
        if (!Number.isInteger(result)) {
          return null;
        }
        return result;
      }
      return null;
    } catch {
      return null;
    }
  };

  // 順列を生成する関数
  const generatePermutations = (arr: number[]): number[][] => {
    if (arr.length <= 1) return [arr];
    
    const result: number[][] = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      const perms = generatePermutations(rest);
      for (const perm of perms) {
        result.push([arr[i], ...perm]);
      }
    }
    return result;
  };

  // 覆面算を解く関数
  const solveCryptarithmetic = (equations: string[]): string[] => {
    const results: string[] = [];
    
    // すべての文字を抽出
    const allChars = new Set<string>();
    const processedEquations: Array<{left: string, right: string}> = [];
    
    for (const equation of equations) {
      const parts = equation.split('=');
      if (parts.length !== 2) {
        results.push(`エラー: "${equation}" は有効な等式ではありません`);
        continue;
      }
      
      const left = parts[0].trim();
      const right = parts[1].trim();
      
      // 文字を抽出（A-Z、a-z）
      const chars = (left + right).match(/[A-Za-z]/g) || [];
      chars.forEach(char => allChars.add(char.toUpperCase()));
      
      processedEquations.push({ left, right });
    }

    if (processedEquations.length === 0) {
      return ['有効な等式が見つかりませんでした'];
    }

    const uniqueChars = Array.from(allChars);
    
    if (uniqueChars.length > 10) {
      results.push('エラー: 文字数が10を超えています（0-9の数字が足りません）');
      return results;
    }

    if (uniqueChars.length === 0) {
      results.push('エラー: アルファベット文字が見つかりませんでした');
      return results;
    }

    // 先頭文字を特定（0になってはいけない文字）
    const leadingChars = new Set<string>();
    for (const eq of processedEquations) {
      // 単語の先頭文字を抽出（2文字以上の単語のみ）
      const leftWords = eq.left.match(/[A-Za-z]+/g) || [];
      const rightWords = eq.right.match(/[A-Za-z]+/g) || [];
      
      [...leftWords, ...rightWords].forEach(word => {
        if (word.length > 1) {  // 2文字以上の単語の先頭文字のみ制約
          leadingChars.add(word[0].toUpperCase());
        }
      });
    }

    // 組み合わせを生成する関数
    const getCombinations = (arr: number[], size: number): number[][] => {
      if (size === 0) return [[]];
      if (arr.length === 0 || size > arr.length) return [];
      
      const result: number[][] = [];
      const [first, ...rest] = arr;
      
      // 最初の要素を含む組み合わせ
      getCombinations(rest, size - 1).forEach(combo => {
        result.push([first, ...combo]);
      });
      
      // 最初の要素を含まない組み合わせ
      getCombinations(rest, size).forEach(combo => {
        result.push(combo);
      });
      
      return result;
    };

    // 利用可能な数字の組み合わせを生成
    const availableDigits = Array.from({ length: 10 }, (_, i) => i);
    const combinations = getCombinations(availableDigits, uniqueChars.length);
    
    let solutionCount = 0;
    const maxSolutions = 10; // 解の数を制限

    for (const combination of combinations) {
      if (solutionCount >= maxSolutions) break;
      
      const permutations = generatePermutations(combination);
      
      for (const perm of permutations) {
        if (solutionCount >= maxSolutions) break;
        
        // 文字と数字のマッピングを作成
        const mapping = new Map<string, number>();
        for (let i = 0; i < uniqueChars.length; i++) {
          mapping.set(uniqueChars[i], perm[i]);
        }

        // 先頭文字が0でないかチェック
        let validLeading = true;
        for (const char of leadingChars) {
          if (mapping.get(char) === 0) {
            validLeading = false;
            break;
          }
        }

        if (!validLeading) continue;

        // すべての等式をチェック
        let allEquationsValid = true;
        const equationResults: string[] = [];

        for (const eq of processedEquations) {
          // 文字を数字に置換
          let leftExpr = eq.left;
          let rightExpr = eq.right;

          for (const [char, digit] of mapping) {
            const regex = new RegExp(char, 'gi'); // 大文字小文字を区別しない
            leftExpr = leftExpr.replace(regex, digit.toString());
            rightExpr = rightExpr.replace(regex, digit.toString());
          }

          // 式を評価
          const leftValue = safeEvaluate(leftExpr);
          const rightValue = safeEvaluate(rightExpr);

          if (leftValue === null || rightValue === null) {
            allEquationsValid = false;
            break;
          }

          if (leftValue !== rightValue) {
            allEquationsValid = false;
            break;
          }

          equationResults.push(`${leftExpr} = ${rightExpr} (${leftValue})`);
        }

        if (allEquationsValid) {
          solutionCount++;
          
          // マッピングを文字列として表示
          const mappingStr = uniqueChars
            .map(char => `${char}=${mapping.get(char)}`)
            .join(', ');
          
          results.push(`解 ${solutionCount}:`);
          results.push(`  ${mappingStr}`);
          equationResults.forEach(eq => results.push(`  ${eq}`));
          results.push('');
        }
      }
    }

    if (solutionCount === 0) {
      results.push('解が見つかりませんでした');
    } else if (solutionCount >= maxSolutions) {
      results.push(`注意: ${maxSolutions}個以上の解があります。最初の${maxSolutions}個のみ表示しています。`);
    }

    return results;
  };

  const handleSolve = () => {
    if (!input.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    
    // 少し遅延を入れてUIの応答性を保つ
    setTimeout(() => {
      const equations = input
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && line.includes('='));
      
      if (equations.length === 0) {
        setResults(['エラー: 有効な等式が見つかりませんでした。= を含む式を入力してください。']);
      } else {
        const solutions = solveCryptarithmetic(equations);
        setResults(solutions);
      }
      
      setIsLoading(false);
    }, 100);
  };

  const handleClear = () => {
    setInput('');
    setResults([]);
  };

  const handleExample = (example: string) => {
    setInput(example);
    setResults([]);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-4">
        <Link href="/" className="text-blue-500 hover:text-blue-700 text-sm">
          ← トップに戻る
        </Link>
      </div>
      <h1 className="text-3xl font-bold mb-6">覆面算ソルバー</h1>
      
      <div className="mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
          <h2 className="font-bold text-blue-800 mb-2">使い方:</h2>
          <ul className="text-blue-700 space-y-1">
            <li>• アルファベット（A-Z、a-z）を使った算数式を入力してください</li>
            <li>• 各文字は0-9の数字に対応します（同じ文字は同じ数字）</li>
            <li>• 大文字と小文字は同じ文字として扱われます</li>
            <li>• 複数の式を改行で区切って入力できます</li>
            <li>• 複数桁の数の先頭は0になりません</li>
            <li>• 対応演算子: +、-、*、/、^（累乗）</li>
          </ul>
        </div>

        <div className="mb-4">
          <h3 className="font-bold text-gray-700 mb-2">例題:</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleExample('SEND + MORE = MONEY')}
              className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200"
            >
              SEND + MORE = MONEY
            </button>
            <button
              onClick={() => handleExample('ABC + ABC + ABC = CCC')}
              className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200"
            >
              ABC + ABC + ABC = CCC
            </button>
            <button
              onClick={() => handleExample('cat + dog = pets')}
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
            >
              cat + dog = pets（小文字）
            </button>
            <button
              onClick={() => handleExample('A^B = C')}
              className="px-3 py-1 bg-purple-100 text-purple-700 rounded text-sm hover:bg-purple-200"
            >
              A^B = C（累乗）
            </button>
            <button
              onClick={() => handleExample('A + B = C\nD + E = F\nG + H = I')}
              className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200"
            >
              複数式の例
            </button>
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="input" className="block text-sm font-medium text-gray-700 mb-2">
              覆面算の式（改行で複数の式を入力可能）
            </label>
            <textarea
              id="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="例: SEND + MORE = MONEY"
              className="w-full p-3 border border-gray-300 rounded resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={4}
            />
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleSolve}
              disabled={isLoading}
              className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '解析中...' : '解く'}
            </button>
            <button
              onClick={handleClear}
              className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              クリア
            </button>
          </div>
        </div>
      </div>

      {results.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-bold mb-4">解析結果:</h2>
          <div className="bg-gray-50 border border-gray-200 rounded p-4">
            <div className="space-y-1">
              {results.map((result, index) => (
                <div key={index} className="font-mono text-sm">
                  {result.startsWith('解 ') ? (
                    <div className="font-bold text-green-600 mt-2">{result}</div>
                  ) : result.startsWith('エラー:') ? (
                    <div className="text-red-600">{result}</div>
                  ) : result.startsWith('注意:') ? (
                    <div className="text-orange-600">{result}</div>
                  ) : result.trim() === '' ? (
                    <div className="h-2"></div>
                  ) : (
                    <div className="text-gray-700">{result}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 text-sm text-gray-600">
        <h3 className="font-bold mb-2">注意事項:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>文字数は最大10個まで（0-9の数字に対応）</li>
          <li>複数桁の数の先頭桁は0になりません</li>
          <li>解の数が多い場合は最初の10個まで表示されます</li>
          <li>複雑な式や文字数が多い場合は計算に時間がかかることがあります</li>
        </ul>
      </div>
    </div>
  );
}
