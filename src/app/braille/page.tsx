'use client';

import { useState } from 'react';
import Link from 'next/link';

// 点字データ（6点式）
// 日本点字表記法 2018年版 に基づく
// https://www.nittento.or.jp/braille/new-braille.html
const brailleData: { [key: string]: string } = {
  // --- 清音 (Seion) ---
  'あ': '100000', 'い': '110000', 'う': '100100', 'え': '110100', 'お': '010100',
  'か': '100001', 'き': '110001', 'く': '100101', 'け': '110101', 'こ': '010101',
  'さ': '100011', 'し': '110011', 'す': '100111', 'せ': '110111', 'そ': '010111',
  'た': '101010', 'ち': '111010', 'つ': '101110', 'て': '111110', 'と': '011110',
  'な': '101000', 'に': '111000', 'ぬ': '101100', 'ね': '111100', 'の': '011100',
  'は': '101001', 'ひ': '111001', 'ふ': '101101', 'へ': '111101', 'ほ': '011101',
  'ま': '101011', 'み': '111011', 'む': '101111', 'め': '111111', 'も': '011111',
  'や': '000100', 'ゆ': '100110', 'よ': '010110',
  'ら': '010010', 'り': '011010', 'る': '010110', 'れ': '011110', 'ろ': '010111',
  'わ': '001000', 'ゐ': '001100', 'ゑ': '001110', 'を': '001010', 'ん': '001011',

  // --- 濁音 (Dakuon) ---
  'が': '000010100001', 'ぎ': '000010110001', 'ぐ': '000010100101', 'げ': '000010110101', 'ご': '000010010101',
  'ざ': '000010100011', 'じ': '000010110011', 'ず': '000010100111', 'ぜ': '000010110111', 'ぞ': '000010010111',
  'だ': '000010101010', 'ぢ': '000010111010', 'づ': '000010101110', 'で': '000010111110', 'ど': '000010011110',
  'ば': '000010101001', 'び': '000010111001', 'ぶ': '000010101101', 'べ': '000010111101', 'ぼ': '000010011101',
  'ゔ': '000010110000',

  // --- 半濁音 (Handakuon) ---
  'ぱ': '000001101001', 'ぴ': '000001111001', 'ぷ': '000001101101', 'ぺ': '000001111101', 'ぽ': '000001011101',

  // --- 拗音 (Yōon) ---
  'きゃ': '110001000100', 'きゅ': '110001000110', 'きょ': '110001010110',
  'しゃ': '110011000100', 'しゅ': '110011000110', 'しょ': '110011010110',
  'ちゃ': '111010000100', 'ちゅ': '111010000110', 'ちょ': '111010010110',
  'にゃ': '111000000100', 'にゅ': '111000000110', 'にょ': '111000010110',
  'ひゃ': '111001000100', 'ひゅ': '111001000110', 'ひょ': '111001010110',
  'みゃ': '111011000100', 'みゅ': '111011000110', 'みょ': '111011010110',
  'りゃ': '011010000100', 'りゅ': '011010000110', 'りょ': '011010010110',

  // --- 濁拗音 (Daku-yōon) ---
  'ぎゃ': '000010110001000100', 'ぎゅ': '000010110001000110', 'ぎょ': '000010110001010110',
  'じゃ': '000010110011000100', 'じゅ': '000010110011000110', 'じょ': '000010110011010110',
  'ぢゃ': '000010111010000100', 'ぢゅ': '000010111010000110', 'ぢょ': '000010111010010110',
  'びゃ': '000010111001000100', 'びゅ': '000010111001000110', 'びょ': '000010111001010110',

  // --- 半濁拗音 (Handaku-yōon) ---
  'ぴゃ': '000001111001000100', 'ぴゅ': '000001111001000110', 'ぴょ': '000001111001010110',

  // --- 特殊音 (Special sounds) ---
  'うぃ': '100100000100', 'うぇ': '100100010100', 'うぉ': '100100010110',
  'ゔぁ': '000010110000100000', 'ゔぃ': '000010110000110000', 'ゔぇ': '000010110000110100', 'ゔぉ': '000010110000010100',
  'ふぁ': '101101000100', 'ふぃ': '101101000110', 'ふぇ': '101101010110', 'ふぉ': '101101010100',
  'ちぇ': '111010010100', 'しぇ': '110011010100', 'じぇ': '000010110011010100',

  // --- 記号 (Symbols) ---
  'っ': '010000', // 促音
  'ー': '010010', // 長音符
  '、': '011000', // 読点
  '。': '010001', // 句点
  '？': '010011',
  '！': '011010',
  '・': '011000',
  '（': '011001', '）': '100110',
  '「': '011001', '」': '100110',
  ' ': '000000',

  // --- 符 (Prefixes) ---
  // アプリケーションのロジックでは直接使用しない参照用データ
  '濁点符': '000010',
  '半濁点符': '000001',
  '拗音符': '000100',
  '外字符': '001011',
  '数符': '001111',

  // --- Alphabet & Numbers (require prefixes in real use) ---
  'a': '100000', 'b': '110000', 'c': '100100', 'd': '100110', 'e': '100010',
  'f': '110100', 'g': '110110', 'h': '110010', 'i': '010100', 'j': '010110',
  'k': '101000', 'l': '111000', 'm': '101100', 'n': '101110', 'o': '101010',
  'p': '111100', 'q': '111110', 'r': '111010', 's': '011100', 't': '011110',
  'u': '101001', 'v': '111001', 'w': '010111', 'x': '101101', 'y': '101111', 'z': '101011',
  '1': '100000', '2': '110000', '3': '100100', '4': '100110', '5': '100010',
  '6': '110100', '7': '110110', '8': '110010', '9': '010100', '0': '010110',
};

// カタカナをひらがなに変換するマップ
const katakanaToHiragana: { [key: string]: string } = {
  'ア': 'あ', 'イ': 'い', 'ウ': 'う', 'エ': 'え', 'オ': 'お',
  'カ': 'か', 'キ': 'き', 'ク': 'く', 'ケ': 'け', 'コ': 'こ',
  'サ': 'さ', 'シ': 'し', 'ス': 'す', 'セ': 'せ', 'ソ': 'そ',
  'タ': 'た', 'チ': 'ち', 'ツ': 'つ', 'テ': 'て', 'ト': 'と',
  'ナ': 'な', 'ニ': 'に', 'ヌ': 'ぬ', 'ネ': 'ね', 'ノ': 'の',
  'ハ': 'は', 'ヒ': 'ひ', 'フ': 'ふ', 'ヘ': 'へ', 'ホ': 'ほ',
  'マ': 'ま', 'ミ': 'み', 'ム': 'む', 'メ': 'め', 'モ': 'も',
  'ヤ': 'や', 'ユ': 'ゆ', 'ヨ': 'よ',
  'ラ': 'ら', 'リ': 'り', 'ル': 'る', 'レ': 'れ', 'ロ': 'ろ',
  'ワ': 'わ', 'ン': 'ん',
  
  // 濁音
  'ガ': 'が', 'ギ': 'ぎ', 'グ': 'ぐ', 'ゲ': 'げ', 'ゴ': 'ご',
  'ザ': 'ざ', 'ジ': 'じ', 'ズ': 'ず', 'ゼ': 'ぜ', 'ゾ': 'ぞ',
  'ダ': 'だ', 'ヂ': 'ぢ', 'ヅ': 'づ', 'デ': 'で', 'ド': 'ど',
  'バ': 'ば', 'ビ': 'び', 'ブ': 'ぶ', 'ベ': 'べ', 'ボ': 'ぼ',
  
  // 半濁音
  'パ': 'ぱ', 'ピ': 'ぴ', 'プ': 'ぷ', 'ペ': 'ぺ', 'ポ': 'ぽ',
  
  // 小さい文字
  'ャ': 'ゃ', 'ュ': 'ゅ', 'ョ': 'ょ', 'ッ': 'っ',
  
  // 拗音
  'キャ': 'きゃ', 'キュ': 'きゅ', 'キョ': 'きょ',
  'シャ': 'しゃ', 'シュ': 'しゅ', 'ショ': 'しょ',
  'チャ': 'ちゃ', 'チュ': 'ちゅ', 'チョ': 'ちょ',
  'ニャ': 'にゃ', 'ニュ': 'にゅ', 'ニョ': 'にょ',
  'ヒャ': 'ひゃ', 'ヒュ': 'ひゅ', 'ヒョ': 'ひょ',
  'ミャ': 'みゃ', 'ミュ': 'みゅ', 'ミョ': 'みょ',
  'リャ': 'りゃ', 'リュ': 'りゅ', 'リョ': 'りょ',
  
  // 濁音拗音
  'ギャ': 'ぎゃ', 'ギュ': 'ぎゅ', 'ギョ': 'ぎょ',
  'ジャ': 'じゃ', 'ジュ': 'じゅ', 'ジョ': 'じょ',
  'ビャ': 'びゃ', 'ビュ': 'びゅ', 'ビョ': 'びょ',
  
  // 半濁音拗音
  'ピャ': 'ぴゃ', 'ピュ': 'ぴゅ', 'ピョ': 'ぴょ',
};

export default function BraillePage() {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<{ type: string; content: string }[]>([]);

  // 6点を2桁の数字に変換（複数セルに対応）
  const brailleToTwoDigits = (brailleCode: string): string => {
    if (brailleCode.length === 6) {
      // 単一セル
      const left = brailleCode.slice(0, 3);
      const right = brailleCode.slice(3, 6);
      const leftValue = parseInt(left, 2);
      const rightValue = parseInt(right, 2);
      return `${leftValue}${rightValue}`;
    } else if (brailleCode.length === 12) {
      // 2セル（濁音・半濁音）
      const first = brailleCode.slice(0, 6);
      const second = brailleCode.slice(6, 12);
      const firstDigits = brailleToTwoDigits(first);
      const secondDigits = brailleToTwoDigits(second);
      return `${firstDigits} ${secondDigits}`;
    } else if (brailleCode.length === 18) {
      // 3セル（濁音拗音・半濁音拗音）
      const first = brailleCode.slice(0, 6);
      const second = brailleCode.slice(6, 12);
      const third = brailleCode.slice(12, 18);
      const firstDigits = brailleToTwoDigits(first);
      const secondDigits = brailleToTwoDigits(second);
      const thirdDigits = brailleToTwoDigits(third);
      return `${firstDigits} ${secondDigits} ${thirdDigits}`;
    }
    return '00';
  };

  // 2桁の数字を6点の点字に変換
  const twoDigitsToBraille = (digits: string): string => {
    if (digits.length !== 2) return '000000';
    
    const leftDigit = parseInt(digits[0]);
    const rightDigit = parseInt(digits[1]);
    
    const left = leftDigit.toString(2).padStart(3, '0');
    const right = rightDigit.toString(2).padStart(3, '0');
    
    return left + right;
  };

  // 点字コードを視覚的な点字に変換（複数セルに対応）
  const brailleToVisual = (brailleCode: string): string => {
    let result = '';
    for (let i = 0; i < brailleCode.length; i += 6) {
      const cellCode = brailleCode.slice(i, i + 6);
      if (cellCode.length === 6) {
        // 点字のUnicodeベース値（U+2800）
        let unicodeValue = 0x2800;
        
        // 各位置の点をチェックして対応するビットを設定
        if (cellCode[0] === '1') unicodeValue += 0x01; // 点1
        if (cellCode[1] === '1') unicodeValue += 0x02; // 点2
        if (cellCode[2] === '1') unicodeValue += 0x04; // 点3
        if (cellCode[3] === '1') unicodeValue += 0x08; // 点4
        if (cellCode[4] === '1') unicodeValue += 0x10; // 点5
        if (cellCode[5] === '1') unicodeValue += 0x20; // 点6
        
        result += String.fromCharCode(unicodeValue);
      }
    }
    return result || '⠀';
  };

  // 逆引き用のマップを作成
  const createReverseBrailleMap = () => {
    const reverseMap: { [key: string]: string[] } = {};
    
    Object.entries(brailleData).forEach(([char, braille]) => {
      if (!reverseMap[braille]) {
        reverseMap[braille] = [];
      }
      reverseMap[braille].push(char);
    });
    
    return reverseMap;
  };

  const handleConvert = () => {
    if (!input.trim()) {
      setResults([]);
      return;
    }

    const newResults: { type: string; content: string }[] = [];

    // 数字のパターンをチェック（2桁ずつの数字）
    if (/^(\d{2}\s*)+$/.test(input.trim())) {
      // 2桁数字から文字への変換
      const digits = input.trim().split(/\s+/);
      const reverseMap = createReverseBrailleMap();
      
      const convertedChars = digits.map(digitPair => {
        const brailleCode = twoDigitsToBraille(digitPair);
        const chars = reverseMap[brailleCode] || [];
        const visual = brailleToVisual(brailleCode);
        return {
          digits: digitPair,
          braille: brailleCode,
          visual: visual,
          chars: chars.length > 0 ? chars.join('/') : '該当なし'
        };
      });

      // 点字表示を追加
      newResults.push({
        type: '点字表示',
        content: convertedChars.map(item => item.visual).join('')
      });

      newResults.push({
        type: '数字から文字への変換',
        content: convertedChars.map(item => 
          `${item.digits} → ${item.visual} (${item.braille}) → ${item.chars}`
        ).join('\n')
      });
    }
    // 文字からの変換
    else {
      // カタカナをひらがなに変換
      let processedText = '';
      let i = 0;
      while (i < input.length) {
        let found = false;
        
        // 3文字の拗音を確認
        if (i <= input.length - 3) {
          const threeChar = input.substring(i, i + 3);
          if (katakanaToHiragana[threeChar]) {
            processedText += katakanaToHiragana[threeChar];
            i += 3;
            found = true;
          }
        }
        
        // 2文字の拗音を確認
        if (!found && i <= input.length - 2) {
          const twoChar = input.substring(i, i + 2);
          if (katakanaToHiragana[twoChar]) {
            processedText += katakanaToHiragana[twoChar];
            i += 2;
            found = true;
          }
        }
        
        // 1文字を確認
        if (!found) {
          const oneChar = input[i];
          if (katakanaToHiragana[oneChar]) {
            processedText += katakanaToHiragana[oneChar];
          } else {
            processedText += oneChar;
          }
          i++;
        }
      }
      
      // 変換後のテキストを処理
      let j = 0;
      const convertedBraille = [];
      
      while (j < processedText.length) {
        let matched = false;
        
        // 3文字の拗音を確認
        if (j <= processedText.length - 3) {
          const threeChar = processedText.substring(j, j + 3);
          if (brailleData[threeChar]) {
            const brailleCode = brailleData[threeChar];
            const visual = brailleToVisual(brailleCode);
            const twoDigits = brailleToTwoDigits(brailleCode);
            convertedBraille.push({
              char: threeChar,
              braille: brailleCode,
              visual: visual,
              digits: twoDigits
            });
            j += 3;
            matched = true;
          }
        }
        
        // 2文字の拗音を確認
        if (!matched && j <= processedText.length - 2) {
          const twoChar = processedText.substring(j, j + 2);
          if (brailleData[twoChar]) {
            const brailleCode = brailleData[twoChar];
            const visual = brailleToVisual(brailleCode);
            const twoDigits = brailleToTwoDigits(brailleCode);
            convertedBraille.push({
              char: twoChar,
              braille: brailleCode,
              visual: visual,
              digits: twoDigits
            });
            j += 2;
            matched = true;
          }
        }
        
        // 1文字を確認
        if (!matched) {
          const oneChar = processedText[j];
          const brailleCode = brailleData[oneChar];
          
          if (brailleCode) {
            const visual = brailleToVisual(brailleCode);
            const twoDigits = brailleToTwoDigits(brailleCode);
            convertedBraille.push({
              char: oneChar,
              braille: brailleCode,
              visual: visual,
              digits: twoDigits
            });
          } else {
            convertedBraille.push({
              char: oneChar,
              braille: '000000',
              visual: '⠀',
              digits: '00'
            });
          }
          j++;
        }
      }

      // 点字表示
      newResults.push({
        type: '点字表示',
        content: convertedBraille.map(item => item.visual).join('')
      });

      // 2桁数字表示
      newResults.push({
        type: '2桁数字表示',
        content: convertedBraille.map(item => item.digits).join(' ')
      });

      // 詳細表示
      newResults.push({
        type: '詳細変換',
        content: convertedBraille.map(item => 
          `${item.char} → ${item.visual} (${item.braille}) → ${item.digits}`
        ).join('\n')
      });
    }

    setResults(newResults);
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
      <h1 className="text-3xl font-bold mb-6">点字変換ツール</h1>
      
      <div className="mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
          <h2 className="font-bold text-blue-800 mb-2">使い方:</h2>
          <ul className="text-blue-700 space-y-1">
            <li><strong>文字→点字:</strong> ひらがな、カタカナ、英文字を入力</li>
            <li className="ml-4">例: "あいう" → 点字と2桁数字で表示</li>
            <li><strong>数字→文字:</strong> 2桁の数字をスペースで区切って入力</li>
            <li className="ml-4">例: "10 51 61" → 対応する文字を表示</li>
          </ul>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
          <h3 className="font-bold text-yellow-800 mb-2">点字の数字表現について:</h3>
          <p className="text-yellow-700 text-sm">
            点字は縦3点×横2列の6点で構成されます。左列を上から1,2,3、右列を上から4,5,6として、
            各列を3ビットの2進数として扱い、10進数に変換して2桁の数字で表現します。
          </p>
          <div className="mt-2 text-yellow-700 text-sm">
            例: ⠁ (あ) = 左列:100(4) 右列:000(0) → "40"
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="input" className="block text-sm font-medium text-gray-700 mb-2">
              入力 (文字または2桁数字)
            </label>
            <textarea
              id="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="例: あいう または 10 51 61"
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
          <div className="space-y-4">
            {results.map((result, index) => (
              <div key={index} className="bg-gray-50 border border-gray-200 rounded p-4">
                <h3 className="font-bold text-gray-800 mb-2">{result.type}:</h3>
                <div className={`font-mono bg-white p-3 rounded border whitespace-pre-wrap ${
                  result.type === '点字表示' ? 'text-6xl leading-relaxed' : 'text-sm'
                }`}>
                  {result.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 text-sm text-gray-600">
        <h3 className="font-bold mb-2">対応文字:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>ひらがな（あ〜ん）</li>
          <li>カタカナ（ア〜ン）</li>
          <li>英文字（a〜z）</li>
          <li>数字（0〜9）</li>
          <li>一部の記号（、。スペース）</li>
        </ul>
      </div>
    </div>
  );
}
