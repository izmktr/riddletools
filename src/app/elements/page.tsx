'use client';

import { useState } from 'react';
import Link from 'next/link';

// 元素データ（原子番号1-118）
const elements = [
  { number: 1, symbol: 'H', name: '水素' },
  { number: 2, symbol: 'He', name: 'ヘリウム' },
  { number: 3, symbol: 'Li', name: 'リチウム' },
  { number: 4, symbol: 'Be', name: 'ベリリウム' },
  { number: 5, symbol: 'B', name: 'ホウ素' },
  { number: 6, symbol: 'C', name: '炭素' },
  { number: 7, symbol: 'N', name: '窒素' },
  { number: 8, symbol: 'O', name: '酸素' },
  { number: 9, symbol: 'F', name: 'フッ素' },
  { number: 10, symbol: 'Ne', name: 'ネオン' },
  { number: 11, symbol: 'Na', name: 'ナトリウム' },
  { number: 12, symbol: 'Mg', name: 'マグネシウム' },
  { number: 13, symbol: 'Al', name: 'アルミニウム' },
  { number: 14, symbol: 'Si', name: 'ケイ素' },
  { number: 15, symbol: 'P', name: 'リン' },
  { number: 16, symbol: 'S', name: '硫黄' },
  { number: 17, symbol: 'Cl', name: '塩素' },
  { number: 18, symbol: 'Ar', name: 'アルゴン' },
  { number: 19, symbol: 'K', name: 'カリウム' },
  { number: 20, symbol: 'Ca', name: 'カルシウム' },
  { number: 21, symbol: 'Sc', name: 'スカンジウム' },
  { number: 22, symbol: 'Ti', name: 'チタン' },
  { number: 23, symbol: 'V', name: 'バナジウム' },
  { number: 24, symbol: 'Cr', name: 'クロム' },
  { number: 25, symbol: 'Mn', name: 'マンガン' },
  { number: 26, symbol: 'Fe', name: '鉄' },
  { number: 27, symbol: 'Co', name: 'コバルト' },
  { number: 28, symbol: 'Ni', name: 'ニッケル' },
  { number: 29, symbol: 'Cu', name: '銅' },
  { number: 30, symbol: 'Zn', name: '亜鉛' },
  { number: 31, symbol: 'Ga', name: 'ガリウム' },
  { number: 32, symbol: 'Ge', name: 'ゲルマニウム' },
  { number: 33, symbol: 'As', name: 'ヒ素' },
  { number: 34, symbol: 'Se', name: 'セレン' },
  { number: 35, symbol: 'Br', name: '臭素' },
  { number: 36, symbol: 'Kr', name: 'クリプトン' },
  { number: 37, symbol: 'Rb', name: 'ルビジウム' },
  { number: 38, symbol: 'Sr', name: 'ストロンチウム' },
  { number: 39, symbol: 'Y', name: 'イットリウム' },
  { number: 40, symbol: 'Zr', name: 'ジルコニウム' },
  { number: 41, symbol: 'Nb', name: 'ニオブ' },
  { number: 42, symbol: 'Mo', name: 'モリブデン' },
  { number: 43, symbol: 'Tc', name: 'テクネチウム' },
  { number: 44, symbol: 'Ru', name: 'ルテニウム' },
  { number: 45, symbol: 'Rh', name: 'ロジウム' },
  { number: 46, symbol: 'Pd', name: 'パラジウム' },
  { number: 47, symbol: 'Ag', name: '銀' },
  { number: 48, symbol: 'Cd', name: 'カドミウム' },
  { number: 49, symbol: 'In', name: 'インジウム' },
  { number: 50, symbol: 'Sn', name: 'スズ' },
  { number: 51, symbol: 'Sb', name: 'アンチモン' },
  { number: 52, symbol: 'Te', name: 'テルル' },
  { number: 53, symbol: 'I', name: 'ヨウ素' },
  { number: 54, symbol: 'Xe', name: 'キセノン' },
  { number: 55, symbol: 'Cs', name: 'セシウム' },
  { number: 56, symbol: 'Ba', name: 'バリウム' },
  { number: 57, symbol: 'La', name: 'ランタン' },
  { number: 58, symbol: 'Ce', name: 'セリウム' },
  { number: 59, symbol: 'Pr', name: 'プラセオジム' },
  { number: 60, symbol: 'Nd', name: 'ネオジム' },
  { number: 61, symbol: 'Pm', name: 'プロメチウム' },
  { number: 62, symbol: 'Sm', name: 'サマリウム' },
  { number: 63, symbol: 'Eu', name: 'ユウロピウム' },
  { number: 64, symbol: 'Gd', name: 'ガドリニウム' },
  { number: 65, symbol: 'Tb', name: 'テルビウム' },
  { number: 66, symbol: 'Dy', name: 'ジスプロシウム' },
  { number: 67, symbol: 'Ho', name: 'ホルミウム' },
  { number: 68, symbol: 'Er', name: 'エルビウム' },
  { number: 69, symbol: 'Tm', name: 'ツリウム' },
  { number: 70, symbol: 'Yb', name: 'イッテルビウム' },
  { number: 71, symbol: 'Lu', name: 'ルテチウム' },
  { number: 72, symbol: 'Hf', name: 'ハフニウム' },
  { number: 73, symbol: 'Ta', name: 'タンタル' },
  { number: 74, symbol: 'W', name: 'タングステン' },
  { number: 75, symbol: 'Re', name: 'レニウム' },
  { number: 76, symbol: 'Os', name: 'オスミウム' },
  { number: 77, symbol: 'Ir', name: 'イリジウム' },
  { number: 78, symbol: 'Pt', name: 'プラチナ' },
  { number: 79, symbol: 'Au', name: '金' },
  { number: 80, symbol: 'Hg', name: '水銀' },
  { number: 81, symbol: 'Tl', name: 'タリウム' },
  { number: 82, symbol: 'Pb', name: '鉛' },
  { number: 83, symbol: 'Bi', name: 'ビスマス' },
  { number: 84, symbol: 'Po', name: 'ポロニウム' },
  { number: 85, symbol: 'At', name: 'アスタチン' },
  { number: 86, symbol: 'Rn', name: 'ラドン' },
  { number: 87, symbol: 'Fr', name: 'フランシウム' },
  { number: 88, symbol: 'Ra', name: 'ラジウム' },
  { number: 89, symbol: 'Ac', name: 'アクチニウム' },
  { number: 90, symbol: 'Th', name: 'トリウム' },
  { number: 91, symbol: 'Pa', name: 'プロトアクチニウム' },
  { number: 92, symbol: 'U', name: 'ウラン' },
  { number: 93, symbol: 'Np', name: 'ネプツニウム' },
  { number: 94, symbol: 'Pu', name: 'プルトニウム' },
  { number: 95, symbol: 'Am', name: 'アメリシウム' },
  { number: 96, symbol: 'Cm', name: 'キュリウム' },
  { number: 97, symbol: 'Bk', name: 'バークリウム' },
  { number: 98, symbol: 'Cf', name: 'カリホルニウム' },
  { number: 99, symbol: 'Es', name: 'アインスタイニウム' },
  { number: 100, symbol: 'Fm', name: 'フェルミウム' },
  { number: 101, symbol: 'Md', name: 'メンデレビウム' },
  { number: 102, symbol: 'No', name: 'ノーベリウム' },
  { number: 103, symbol: 'Lr', name: 'ローレンシウム' },
  { number: 104, symbol: 'Rf', name: 'ラザホージウム' },
  { number: 105, symbol: 'Db', name: 'ドブニウム' },
  { number: 106, symbol: 'Sg', name: 'シーボーギウム' },
  { number: 107, symbol: 'Bh', name: 'ボーリウム' },
  { number: 108, symbol: 'Hs', name: 'ハッシウム' },
  { number: 109, symbol: 'Mt', name: 'マイトネリウム' },
  { number: 110, symbol: 'Ds', name: 'ダームスタチウム' },
  { number: 111, symbol: 'Rg', name: 'レントゲニウム' },
  { number: 112, symbol: 'Cn', name: 'コペルニシウム' },
  { number: 113, symbol: 'Nh', name: 'ニホニウム' },
  { number: 114, symbol: 'Fl', name: 'フレロビウム' },
  { number: 115, symbol: 'Mc', name: 'モスコビウム' },
  { number: 116, symbol: 'Lv', name: 'リバモリウム' },
  { number: 117, symbol: 'Ts', name: 'テネシン' },
  { number: 118, symbol: 'Og', name: 'オガネソン' },
];

export default function ElementsPage() {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<string[]>([]);

  // 数字から元素記号への変換
  const convertNumbersToElements = (input: string): string[] => {
    const numbers = input.trim().split(/\s+/).filter(n => n !== '');
    const results = [];
    
    for (const numStr of numbers) {
      const num = parseInt(numStr);
      if (isNaN(num) || num < 1 || num > 118) {
        results.push(`${numStr}: 無効な原子番号`);
      } else {
        const element = elements.find(e => e.number === num);
        if (element) {
          results.push(`${num}: ${element.symbol} (${element.name})`);
        }
      }
    }
    
    return results;
  };

  // アルファベットから元素記号への変換（すべての可能な組み合わせを検索）
  const convertLettersToElements = (input: string): string[] => {
    const cleanInput = input.replace(/\s/g, '').toUpperCase();
    if (!cleanInput) return [];

    // 元素記号のマップを作成（大文字でキー、元の記号と情報を保持）
    const symbolMap = new Map<string, { symbol: string; number: number; name: string }>();
    elements.forEach(element => {
      symbolMap.set(element.symbol.toUpperCase(), { 
        symbol: element.symbol, // 元の大文字小文字を保持
        number: element.number, 
        name: element.name 
      });
    });

    // 動的プログラミングを使用してすべての可能な分割を見つける
    const findAllSplits = (str: string, start: number = 0): string[][] => {
      if (start >= str.length) {
        return [[]];
      }

      const results: string[][] = [];
      
      // 1文字の元素記号を試す
      if (start < str.length) {
        const oneChar = str.substring(start, start + 1);
        if (symbolMap.has(oneChar)) {
          const restSplits = findAllSplits(str, start + 1);
          restSplits.forEach(split => {
            results.push([oneChar, ...split]);
          });
        }
      }

      // 2文字の元素記号を試す
      if (start + 1 < str.length) {
        const twoChar = str.substring(start, start + 2);
        if (symbolMap.has(twoChar)) {
          const restSplits = findAllSplits(str, start + 2);
          restSplits.forEach(split => {
            results.push([twoChar, ...split]);
          });
        }
      }

      return results;
    };

    const allSplits = findAllSplits(cleanInput);
    
    if (allSplits.length === 0) {
      return ['変換できませんでした'];
    }

    return allSplits.map((split, index) => {
      const elementInfo = split.map(symbol => {
        const info = symbolMap.get(symbol);
        return `${info?.symbol}(${info?.number})`; // 元の記号を使用
      }).join(' ');
      
      const elementNames = split.map(symbol => {
        const info = symbolMap.get(symbol);
        return info?.name || symbol;
      }).join('-');
      
      return `パターン${index + 1}: ${elementInfo} → ${elementNames}`;
    });
  };

  const handleConvert = () => {
    if (!input.trim()) {
      setResults([]);
      return;
    }

    // 数字が含まれているかチェック
    if (/^\d+(\s+\d+)*$/.test(input.trim())) {
      // 数字のみの場合
      setResults(convertNumbersToElements(input));
    } else if (/^[A-Za-z\s]*$/.test(input)) {
      // アルファベットのみの場合
      setResults(convertLettersToElements(input));
    } else {
      setResults(['数字のみ、またはアルファベットのみを入力してください']);
    }
  };

  const handleClear = () => {
    setInput('');
    setResults([]);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-4">
        <Link href="/" className="text-blue-500 hover:text-blue-700 text-sm">
          ← トップに戻る
        </Link>
      </div>
      <h1 className="text-3xl font-bold mb-6">元素記号変換ツール</h1>
      
      <div className="mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
          <h2 className="font-bold text-blue-800 mb-2">使い方:</h2>
          <ul className="text-blue-700 space-y-1">
            <li><strong>数字入力:</strong> スペースで区切った原子番号を元素記号に変換</li>
            <li className="ml-4">例: "1 6 8" → "H(水素) C(炭素) O(酸素)"</li>
            <li><strong>アルファベット入力:</strong> 文字列を元素記号の組み合わせに分割</li>
            <li className="ml-4">例: "CARBON" → "C(6) Ar(18) B(5) O(8) N(7)" など</li>
          </ul>
        </div>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="input" className="block text-sm font-medium text-gray-700 mb-2">
              入力 (数字またはアルファベット)
            </label>
            <textarea
              id="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="例: 1 6 8 または CARBON"
              className="w-full p-3 border border-gray-300 rounded resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleConvert}
              className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              変換
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
          <h2 className="text-xl font-bold mb-4">変換結果:</h2>
          <div className="bg-gray-50 border border-gray-200 rounded p-4">
            <ul className="space-y-2">
              {results.map((result, index) => (
                <li key={index} className="font-mono text-sm bg-white p-2 rounded border">
                  {result}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="mt-8 text-sm text-gray-600">
        <h3 className="font-bold mb-2">注意事項:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>原子番号は1-118の範囲で入力してください</li>
          <li>アルファベット入力では、可能なすべての元素記号の組み合わせを表示します</li>
          <li>大文字小文字は区別されません</li>
          <li>複数の分割パターンがある場合はすべて表示されます</li>
        </ul>
      </div>
    </div>
  );
}
