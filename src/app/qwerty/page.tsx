'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function QwertyPage() {
  const [input, setInput] = useState('');
  const [showManual, setShowManual] = useState(false);

  // QWERTY配列のキーマッピング（数字キー）
  const numberToKana: Record<string, string> = {
    '1': 'ぬ', '2': 'ふ', '3': 'あ', '4': 'う', '5': 'え',
    '6': 'お', '7': 'や', '8': 'ゆ', '9': 'よ', '0': 'わ'
  };

  // QWERTY配列のキーマッピング（文字キー）
  const qwertyToKana: Record<string, string> = {
    'q': 'た', 'w': 'て', 'e': 'い', 'r': 'す', 't': 'か', 'y': 'ん', 'u': 'な', 'i': 'に', 'o': 'ら', 'p': 'せ',
    'a': 'ち', 's': 'と', 'd': 'し', 'f': 'は', 'g': 'き', 'h': 'く', 'j': 'ま', 'k': 'の', 'l': 'り',
    'z': 'つ', 'x': 'さ', 'c': 'そ', 'v': 'ひ', 'b': 'こ', 'n': 'み', 'm': 'も'
  };

  // かな文字をQWERTYに変換
  const kanaToQwerty: Record<string, string> = {};
  Object.entries(qwertyToKana).forEach(([qwerty, kana]) => {
    kanaToQwerty[kana] = qwerty.toUpperCase();
  });
  Object.entries(numberToKana).forEach(([number, kana]) => {
    kanaToQwerty[kana] = number;
  });

  // 入力文字を変換
  const convertInput = (text: string): string => {
    return text.split('').map(char => {
      const lowerChar = char.toLowerCase();
      
      // 数字キーの変換
      if (numberToKana[char]) {
        return numberToKana[char];
      }
      
      // QWERTYキーの変換
      if (qwertyToKana[lowerChar]) {
        return qwertyToKana[lowerChar];
      }
      
      // かな文字をQWERTYに変換
      if (kanaToQwerty[char]) {
        return kanaToQwerty[char];
      }
      
      // 変換できない文字はそのまま
      return char;
    }).join('');
  };

  const handleSample1 = () => {
    setInput('みかか');
  };

  const handleSample2 = () => {
    setInput('345');
  };

  const handleReset = () => {
    setInput('');
  };

  const convertedText = convertInput(input);

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
          <div className="bg-white rounded shadow-lg p-6 max-w-lg w-full relative">
            <button
              className="absolute top-2 right-2 px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => setShowManual(false)}
            >
              閉じる
            </button>
            <h3 className="text-xl font-bold mb-2">QWERTY⇔かな変換の使い方</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm mb-4">
              <li>QWERTY配列のキーに対応するかな文字に変換します。</li>
              <li>例：「qwerty」→「たていすかん」</li>
              <li>逆に、かな文字をQWERTY配列のキーに変換することもできます。</li>
              <li>例：「みかか」→「NTT」</li>
              <li>数字キーにも対応しています。</li>
              <li>例：「345」→「あうえ」</li>
            </ul>
            <div className="flex gap-2">
              <button
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                onClick={handleSample1}
              >
                サンプル1（みかか）
              </button>
              <button
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                onClick={handleSample2}
              >
                サンプル2（345）
              </button>
            </div>
          </div>
        </div>
      )}

      <h2 className="text-2xl font-bold mb-6">QWERTY⇔かな変換</h2>

      <div className="mb-6">
        <label className="block text-sm font-semibold mb-2">入力テキスト</label>
        <textarea
          className="w-full h-32 p-3 border rounded-lg text-lg"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="QWERTYキーまたはかな文字を入力してください"
        />
      </div>

      <div className="mb-6 flex gap-2">
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={handleSample1}
        >
          サンプル1（みかか）
        </button>
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={handleSample2}
        >
          サンプル2（345）
        </button>
        <button
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          onClick={handleReset}
        >
          リセット
        </button>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-semibold mb-2">変換結果</label>
        <div className="w-full h-32 p-3 border rounded-lg bg-gray-50 text-lg overflow-auto whitespace-pre-wrap">
          {convertedText || '変換結果がここに表示されます'}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-bold text-blue-800 mb-2">変換対応表</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-semibold mb-2">数字キー</h4>
            <div className="grid grid-cols-5 gap-1">
              {Object.entries(numberToKana).map(([key, kana]) => (
                <div key={key} className="text-center">
                  <div className="font-mono text-blue-600">{key}</div>
                  <div className="text-gray-600">↓</div>
                  <div>{kana}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-2">QWERTY配列（一部）</h4>
            <div className="text-xs space-y-1">
              <div className="flex gap-1">
                {['q', 'w', 'e', 'r', 't'].map(key => (
                  <div key={key} className="text-center w-8">
                    <div className="font-mono text-blue-600">{key.toUpperCase()}</div>
                    <div className="text-gray-600">↓</div>
                    <div>{qwertyToKana[key]}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-1">
                {['a', 's', 'd', 'f', 'g'].map(key => (
                  <div key={key} className="text-center w-8">
                    <div className="font-mono text-blue-600">{key.toUpperCase()}</div>
                    <div className="text-gray-600">↓</div>
                    <div>{qwertyToKana[key]}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-1">
                {['z', 'x', 'c', 'v', 'b'].map(key => (
                  <div key={key} className="text-center w-8">
                    <div className="font-mono text-blue-600">{key.toUpperCase()}</div>
                    <div className="text-gray-600">↓</div>
                    <div>{qwertyToKana[key]}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 text-sm text-gray-600">
        <h3 className="font-bold mb-2">使用例：</h3>
        <ul className="list-disc list-inside space-y-1">
          <li><span className="font-mono bg-gray-100 px-1 rounded">qwerty</span> → <span className="bg-yellow-100 px-1 rounded">たていすかん</span></li>
          <li><span className="font-mono bg-gray-100 px-1 rounded">みかか</span> → <span className="bg-yellow-100 px-1 rounded">NTT</span></li>
          <li><span className="font-mono bg-gray-100 px-1 rounded">345</span> → <span className="bg-yellow-100 px-1 rounded">あうえ</span></li>
          <li><span className="font-mono bg-gray-100 px-1 rounded">hello</span> → <span className="bg-yellow-100 px-1 rounded">くえらら</span></li>
        </ul>
      </div>
    </main>
  );
}