'use client';

import { useState } from 'react';
import Link from 'next/link';

// 点字データ（6点式）
// 左列上から1,2,3、右列上から4,5,6の順
const brailleData: { [key: string]: string } = {
  // ひらがな（正しい日本点字表記）
  'あ': '100000',  // 10
  'い': '010000',  // 20
  'う': '110000',  // 30
  'え': '101000',  // 50
  'お': '011000',  // 60
  'か': '100100',  // 14
  'き': '010100',  // 24
  'く': '110100',  // 34
  'け': '101100',  // 54
  'こ': '011100',  // 64
  'さ': '100010',  // 12
  'し': '010010',  // 22
  'す': '110010',  // 32
  'せ': '101010',  // 52
  'そ': '011010',  // 62
  'た': '100110',  // 16
  'ち': '010110',  // 26
  'つ': '110110',  // 36
  'て': '101110',  // 56
  'と': '011110',  // 66
  'な': '100001',  // 11
  'に': '010001',  // 21
  'ぬ': '110001',  // 31
  'ね': '101001',  // 51
  'の': '011001',  // 61
  'は': '100101',  // 15
  'ひ': '010101',  // 25
  'ふ': '110101',  // 35
  'へ': '101101',  // 55
  'ほ': '011101',  // 65
  'ま': '100011',  // 13
  'み': '010011',  // 23
  'む': '110011',  // 33
  'め': '101011',  // 53
  'も': '011011',  // 63
  'や': '100111',  // 17
  'ゆ': '010111',  // 27
  'よ': '110111',  // 37
  'ら': '101111',  // 57
  'り': '011111',  // 67
  'る': '111001',  // 71
  'れ': '111010',  // 72
  'ろ': '111100',  // 74
  'わ': '111000',  // 70
  'ん': '111011',  // 73
  
  // 濁点記号
  '゛': '000011',  // 濁点記号（正しくは 00 03）
  '゜': '000101',  // 半濁点記号（正しくは 00 05）
  
  // 濁音（濁点記号 + 基本文字の2文字構成）
  'が': '000011100100',  // 濁点 + か
  'ぎ': '000011010100',  // 濁点 + き
  'ぐ': '000011110100',  // 濁点 + く
  'げ': '000011101100',  // 濁点 + け
  'ご': '000011011100',  // 濁点 + こ
  'ざ': '000011100010',  // 濁点 + さ
  'じ': '000011010010',  // 濁点 + し
  'ず': '000011110010',  // 濁点 + す
  'ぜ': '000011101010',  // 濁点 + せ
  'ぞ': '000011011010',  // 濁点 + そ
  'だ': '000011100110',  // 濁点 + た
  'ぢ': '000011010110',  // 濁点 + ち
  'づ': '000011110110',  // 濁点 + つ
  'で': '000011101110',  // 濁点 + て
  'ど': '000011011110',  // 濁点 + と
  'ば': '000011100101',  // 濁点 + は
  'び': '000011010101',  // 濁点 + ひ
  'ぶ': '000011110101',  // 濁点 + ふ
  'べ': '000011101101',  // 濁点 + へ
  'ぼ': '000011011101',  // 濁点 + ほ
  
  // 半濁音（半濁点記号 + 基本文字の2文字構成）
  'ぱ': '000101100101',  // 半濁点 + は
  'ぴ': '000101010101',  // 半濁点 + ひ
  'ぷ': '000101110101',  // 半濁点 + ふ
  'ぺ': '000101101101',  // 半濁点 + へ
  'ぽ': '000101011101',  // 半濁点 + ほ
  
  // 拗音（小さいや行）
  'ゃ': '100111',
  'ゅ': '010111',
  'ょ': '110111',
  
  // 拗音組み合わせ
  'きゃ': '010100100111',  // き + ゃ
  'きゅ': '010100010111',  // き + ゅ
  'きょ': '010100110111',  // き + ょ
  'しゃ': '010010100111',  // し + ゃ
  'しゅ': '010010010111',  // し + ゅ
  'しょ': '010010110111',  // し + ょ
  'ちゃ': '010110100111',  // ち + ゃ
  'ちゅ': '010110010111',  // ち + ゅ
  'ちょ': '010110110111',  // ち + ょ
  'にゃ': '010001100111',  // に + ゃ
  'にゅ': '010001010111',  // に + ゅ
  'にょ': '010001110111',  // に + ょ
  'ひゃ': '010101100111',  // ひ + ゃ
  'ひゅ': '010101010111',  // ひ + ゅ
  'ひょ': '010101110111',  // ひ + ょ
  'みゃ': '010011100111',  // み + ゃ
  'みゅ': '010011010111',  // み + ゅ
  'みょ': '010011110111',  // み + ょ
  'りゃ': '011111100111',  // り + ゃ
  'りゅ': '011111010111',  // り + ゅ
  'りょ': '011111110111',  // り + ょ
  
  // 濁音拗音（濁点記号 + 基本文字 + 拗音文字の3文字構成）
  'ぎゃ': '000011010100100111',  // 濁点 + き + ゃ
  'ぎゅ': '000011010100010111',  // 濁点 + き + ゅ
  'ぎょ': '000011010100110111',  // 濁点 + き + ょ
  'じゃ': '000011010010100111',  // 濁点 + し + ゃ
  'じゅ': '000011010010010111',  // 濁点 + し + ゅ
  'じょ': '000011010010110111',  // 濁点 + し + ょ
  'びゃ': '000011010101100111',  // 濁点 + ひ + ゃ
  'びゅ': '000011010101010111',  // 濁点 + ひ + ゅ
  'びょ': '000011010101110111',  // 濁点 + ひ + ょ
  
  // 半濁音拗音（半濁点記号 + 基本文字 + 拗音文字の3文字構成）
  'ぴゃ': '000101010101100111',  // 半濁点 + ひ + ゃ
  'ぴゅ': '000101010101010111',  // 半濁点 + ひ + ゅ
  'ぴょ': '000101010101110111',  // 半濁点 + ひ + ょ
  
  // 小さいつ（促音）
  'っ': '001000',

  // 長音
  'ー': '010010',

  // 英語（アルファベット）
  'a': '100000',
  'b': '110000',
  'c': '100100',
  'd': '100110',
  'e': '100010',
  'f': '110100',
  'g': '110110',
  'h': '110010',
  'i': '010100',
  'j': '010110',
  'k': '101000',
  'l': '111000',
  'm': '101100',
  'n': '101110',
  'o': '101010',
  'p': '111100',
  'q': '111110',
  'r': '111010',
  's': '011100',
  't': '011110',
  'u': '101001',
  'v': '111001',
  'w': '010111',
  'x': '101101',
  'y': '101111',
  'z': '101011',
  
  // 数字
  '1': '100000',
  '2': '110000',
  '3': '100100',
  '4': '100110',
  '5': '100010',
  '6': '110100',
  '7': '110110',
  '8': '110010',
  '9': '010100',
  '0': '010110',
  
  // 記号
  '、': '010000',
  '。': '010001',
  ' ': '000000',
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
