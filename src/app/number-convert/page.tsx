'use client';

import { useState } from 'react';
import Link from 'next/link';

type ConversionType = 'alphabet' | 'aiueo' | 'iroha';

export default function NumberConversionPage() {
  const [input, setInput] = useState('');
  const [conversionType, setConversionType] = useState<ConversionType>('alphabet');
  const [loopMode, setLoopMode] = useState(false);
  const [showManual, setShowManual] = useState(false);

  // 文字配列の定義
  const alphabets = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const aiueo = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';
  const iroha = 'いろはにほへとちりぬるをわかよたれそつねならむうゐのおくやまけふこえてあさきゆめみしゑひもせすん';
  const dakuten = 'がぎぐげござじずぜぞだちづでどばびぶべぼぱぴぷぺぽ';

  // 文字から数字への逆引きマップ
  const createReverseMap = (chars: string) => {
    const map: Record<string, number> = {};
    for (let i = 0; i < chars.length; i++) {
      map[chars[i]] = i + 1;
    }
    return map;
  };

  const alphabetReverseMap = createReverseMap(alphabets);
  const aiueoReverseMap = createReverseMap(aiueo);
  const irohaReverseMap = createReverseMap(iroha);
  const dakutenReverseMap = createReverseMap(dakuten);

  // 数字を文字に変換
  const convertNumberToChar = (num: number, type: ConversionType): string => {
    let chars: string;
    let maxNum: number;

    switch (type) {
      case 'alphabet':
        chars = alphabets;
        maxNum = 26;
        break;
      case 'aiueo':
        chars = aiueo;
        maxNum = 46;
        break;
      case 'iroha':
        chars = iroha;
        maxNum = 47;
        break;
    }

    if (loopMode) {
      // ループモード：1-based indexing with modulo
      const index = ((num - 1) % maxNum + maxNum) % maxNum;
      return chars[index];
    } else {
      // 通常モード
      if (num >= 1 && num <= maxNum) {
        return chars[num - 1];
      } else {
        return `?(${num})`;
      }
    }
  };

  // 濁音・半濁音を処理
  const processDakuten = (char: string): { char: string; isDakuten: boolean } => {
    if (dakutenReverseMap[char]) {
      return { char, isDakuten: true };
    }
    return { char, isDakuten: false };
  };

  // 単一の数値式を評価
  const evaluateExpression = (expr: string): number | null => {
    // 計算式の正規表現（英字、ひらがな、いろは文字に対応）
    const match = expr.match(/^([A-Za-zあ-んが-ぽい-ゑ])([+\-])(\d+)$/);
    if (match) {
      const [, charPart, operator, numPart] = match;
      let baseValue: number | undefined;
      let isDakutenCalc = false;
      
      // 文字の種類に応じて基準値を取得
      if (conversionType === 'alphabet') {
        baseValue = alphabetReverseMap[charPart.toUpperCase()];
      } else if (conversionType === 'aiueo') {
        const { char, isDakuten } = processDakuten(charPart);
        if (isDakuten) {
          // 濁音は独立した1-25の数列として扱う
          baseValue = dakutenReverseMap[char];
          isDakutenCalc = true;
        } else {
          baseValue = aiueoReverseMap[char];
        }
      } else if (conversionType === 'iroha') {
        baseValue = irohaReverseMap[charPart];
      }
      
      if (baseValue === undefined) {
        return null;
      }

      const num = parseInt(numPart);
      const result = operator === '+' ? baseValue + num : baseValue - num;
      
      // 濁音の計算結果は特別な処理が必要
      if (isDakutenCalc) {
        // 濁音軸での計算結果を返す（負の値で濁音軸の計算結果を示す）
        return -(result + 1000); // -1001以下で濁音軸の計算結果を表現
      }
      
      return result;
    }

    // 通常の数字
    const num = parseInt(expr);
    return isNaN(num) ? null : num;
  };

  // 入力テキストを処理
  const convertInput = (): string => {
    if (!input.trim()) return '';

    const parts = input.trim().split(/\s+/);
    const results: string[] = [];

    for (const part of parts) {
      const num = evaluateExpression(part);
      if (num !== null) {
        // 濁音軸の計算結果かどうか確認
        if (num <= -1001) {
          const dakutenResult = -(num + 1000);
          if (dakutenResult <= 0) {
            results.push(loopMode ? dakuten[((dakutenResult - 1) % 25 + 25) % 25] : 'エラー');
          } else if (dakutenResult > 25) {
            results.push(loopMode ? dakuten[(dakutenResult - 1) % 25] : 'エラー');
          } else {
            results.push(dakuten[dakutenResult - 1] || 'エラー');
          }
        } else if (conversionType === 'aiueo') {
          // あいうモードでは濁音も考慮
          if (num >= 1 && num <= 46) {
            results.push(convertNumberToChar(num, conversionType));
          } else if (num >= 47 && num <= 71) {
            // 濁音範囲
            const dakutenIndex = num - 47;
            if (dakutenIndex < dakuten.length) {
              results.push(dakuten[dakutenIndex]);
            } else {
              results.push(loopMode ? dakuten[dakutenIndex % dakuten.length] : `?(${num})`);
            }
          } else {
            if (loopMode) {
              // ループモードでは全体（あいう + 濁音）でループ
              const totalChars = aiueo + dakuten;
              const index = ((num - 1) % totalChars.length + totalChars.length) % totalChars.length;
              results.push(totalChars[index]);
            } else {
              results.push(`?(${num})`);
            }
          }
        } else {
          results.push(convertNumberToChar(num, conversionType));
        }
      } else {
        results.push(`?(${part})`);
      }
    }

    return results.join('');
  };

  const handleSample = () => {
    setInput('A+7 1 26 27');
    setConversionType('alphabet');
    setLoopMode(false);
  };

  const handleSampleAiueo = () => {
    setInput('あ+4 1 46');
    setConversionType('aiueo');
    setLoopMode(false);
  };

  const handleSampleIroha = () => {
    setInput('い+3 1 47');
    setConversionType('iroha');
    setLoopMode(false);
  };

  const handleReset = () => {
    setInput('');
  };

  return (
    <main className="max-w-2xl mx-auto p-6">
      <div className="flex items-center mb-4 gap-2">
        <button
          className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200"
          onClick={() => setShowManual(true)}
        >
          使い方
        </button>
        <Link href="/" className="inline-block px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">
          トップに戻る
        </Link>
      </div>

      {showManual && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 max-w-lg w-full relative max-h-96 overflow-y-auto">
            <button
              className="absolute top-2 right-2 px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => setShowManual(false)}
            >
              閉じる
            </button>
            <h3 className="text-xl font-bold mb-2">数字文字変換の使い方</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm mb-4">
              <li>数字を文字に変換します。複数の数字は空白で区切ってください。</li>
              <li><strong>英字</strong>: 1→A, 2→B, ..., 26→Z</li>
              <li><strong>あいう</strong>: 1→あ, 2→い, ..., 46→ん</li>
              <li><strong>いろは</strong>: 1→い, 2→ろ, ..., 47→ん</li>
              <li><strong>ループする</strong>: ONの場合、最大値を超えても循環します</li>
              <li><strong>計算式</strong>: 全モードで「A+7」「あ+4」「い+3」のような計算が可能</li>
              <li><strong>濁音</strong>: あいうモードでは47-71が濁音・半濁音に対応</li>
              <li><strong>濁音軸計算</strong>: 濁音文字（が、ぎ等）は1-25の独立した軸で計算される（「が」=1）</li>
            </ul>
            <div className="flex gap-2">
              <button
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                onClick={handleSample}
              >
                英字サンプル
              </button>
              <button
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                onClick={handleSampleAiueo}
              >
                あいうサンプル
              </button>
              <button
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                onClick={handleSampleIroha}
              >
                いろはサンプル
              </button>
            </div>
          </div>
        </div>
      )}

      <h2 className="text-2xl font-bold mb-6">数字文字変換</h2>

      {/* 変換タイプ選択 */}
      <div className="mb-4">
        <label className="block text-sm font-semibold mb-2">変換タイプ</label>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              value="alphabet"
              checked={conversionType === 'alphabet'}
              onChange={e => setConversionType(e.target.value as ConversionType)}
              className="mr-2"
            />
            英字
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="aiueo"
              checked={conversionType === 'aiueo'}
              onChange={e => setConversionType(e.target.value as ConversionType)}
              className="mr-2"
            />
            あいう
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="iroha"
              checked={conversionType === 'iroha'}
              onChange={e => setConversionType(e.target.value as ConversionType)}
              className="mr-2"
            />
            いろは
          </label>
        </div>
      </div>

      {/* ループモード */}
      <div className="mb-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={loopMode}
            onChange={e => setLoopMode(e.target.checked)}
            className="mr-2"
          />
          ループする
        </label>
      </div>

      {/* 入力欄 */}
      <div className="mb-4">
        <label className="block text-sm font-semibold mb-2">数字入力（空白区切り）</label>
        <input
          type="text"
          className="w-full p-3 border rounded-lg text-lg"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="例: 1 2 3 または A+7 あ+4 い-1"
        />
      </div>

      {/* ボタン */}
      <div className="mb-6 flex gap-2 flex-wrap">
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={handleSample}
        >
          英字サンプル
        </button>
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={handleSampleAiueo}
        >
          あいうサンプル
        </button>
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={handleSampleIroha}
        >
          いろはサンプル
        </button>
        <button
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          onClick={handleReset}
        >
          リセット
        </button>
      </div>

      {/* 変換結果 */}
      <div className="mb-6">
        <label className="block text-sm font-semibold mb-2">変換結果</label>
        <div className="w-full p-3 border rounded-lg bg-gray-50 text-lg min-h-12 overflow-auto">
          {convertInput() || '変換結果がここに表示されます'}
        </div>
      </div>

      {/* 文字対応表 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-bold text-blue-800 mb-2">変換表</h3>
        <div className="text-sm">
          {conversionType === 'alphabet' && (
            <div>
              <h4 className="font-semibold mb-1">英字（最大26）</h4>
              <div className="grid grid-cols-13 gap-1 text-xs">
                {alphabets.split('').map((char, index) => (
                  <div key={index} className="text-center">
                    <div className="text-blue-600">{index + 1}</div>
                    <div>↓</div>
                    <div className="font-bold">{char}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {conversionType === 'aiueo' && (
            <div>
              <h4 className="font-semibold mb-1">あいう（最大46） + 濁音・半濁音（47-71）</h4>
              <div className="grid grid-cols-10 gap-1 text-xs mb-2">
                {aiueo.split('').slice(0, 20).map((char, index) => (
                  <div key={index} className="text-center">
                    <div className="text-blue-600">{index + 1}</div>
                    <div>↓</div>
                    <div className="font-bold">{char}</div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-600 mb-2">...（46文字）</div>
              <div className="grid grid-cols-10 gap-1 text-xs">
                {dakuten.split('').slice(0, 10).map((char, index) => (
                  <div key={index} className="text-center">
                    <div className="text-red-600">{47 + index}</div>
                    <div>↓</div>
                    <div className="font-bold">{char}</div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-600 mt-1">濁音・半濁音（47-71）</div>
            </div>
          )}
          
          {conversionType === 'iroha' && (
            <div>
              <h4 className="font-semibold mb-1">いろは（最大47）</h4>
              <div className="grid grid-cols-10 gap-1 text-xs">
                {iroha.split('').slice(0, 20).map((char, index) => (
                  <div key={index} className="text-center">
                    <div className="text-blue-600">{index + 1}</div>
                    <div>↓</div>
                    <div className="font-bold">{char}</div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-600 mt-1">...（47文字）</div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <h3 className="font-bold mb-2">使用例：</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>英字: <span className="font-mono bg-gray-100 px-1 rounded">1 8 5 12 12 15</span> → <span className="bg-yellow-100 px-1 rounded">HELLO</span></li>
          <li>英字計算: <span className="font-mono bg-gray-100 px-1 rounded">A+7</span> → <span className="bg-yellow-100 px-1 rounded">H</span></li>
          <li>あいう: <span className="font-mono bg-gray-100 px-1 rounded">あ+4</span> → <span className="bg-yellow-100 px-1 rounded">お</span></li>
          <li>あいう計算: <span className="font-mono bg-gray-100 px-1 rounded">か-1</span> → <span className="bg-yellow-100 px-1 rounded">お</span>（か=6, -1=5, 5番目=お）</li>
          <li>濁音計算: <span className="font-mono bg-gray-100 px-1 rounded">が-1</span> → <span className="bg-yellow-100 px-1 rounded">ぽ</span>（ループ時）、エラー（非ループ時）</li>
          <li>いろは: <span className="font-mono bg-gray-100 px-1 rounded">い+3</span> → <span className="bg-yellow-100 px-1 rounded">に</span></li>
          <li>濁音: <span className="font-mono bg-gray-100 px-1 rounded">47 48 49</span> → <span className="bg-yellow-100 px-1 rounded">がぎぐ</span></li>
        </ul>
      </div>
    </main>
  );
}