"use client";
import { useState } from "react";
import Link from "next/link";

export default function MorsePage() {
  const [inputText, setInputText] = useState("");
  const [shortSymbol, setShortSymbol] = useState(".");
  const [longSymbol, setLongSymbol] = useState("-");
  const [showManual, setShowManual] = useState(false);

  // モールス信号対応表
  const morseTable: Record<string, string> = {
    // ひらがな
    "あ": "・ー", "か": "・ー・・", "さ": "ー・ー・ー", "た": "ー・", "な": "・ー・", 
    "は": "ー・・・", "ま": "ー・ー", "や": "・ーー", "ら": "・・・", "わ": "ー・ー",
    "い": "・・", "き": "ー・ー・ー", "し": "ーー・ー・", "ち": "・・ー・", "に": "ー・ー・", 
    "ひ": "ーー・・", "み": "・・ー・ー", "り": "ーー・", "う": "・・ー", "く": "・・・ー",
    "す": "ーーー・ー", "つ": "・ーー・", "ぬ": "・・・・", "ふ": "ーー・・", "む": "ー",
    "ゆ": "ー・・ー", "る": "ー・ーー・", "え": "ー・ーーー", "け": "ー・ーー", "せ": "・ーーー・", 
    "て": "・ー・ーー", "ね": "ーー・ー", "へ": "・", "め": "ー・・ー・", "れ": "ーーー",
    "お": "・ー・・・", "こ": "ーーーー", "そ": "ーーー・", "と": "・・ー・・", "の": "・・ーー", 
    "ほ": "ー・・", "も": "ー・・ー・", "よ": "ーー", "ろ": "・ー・ー", "を": "・ーーー", "ん": "・ー・ー・",

    // カタカナ
    "ア": "・ー", "カ": "・ー・・", "サ": "ー・ー・ー", "タ": "ー・", "ナ": "・ー・", 
    "ハ": "ー・・・", "マ": "ー・ー", "ヤ": "・ーー", "ラ": "・・・", "ワ": "ー・ー",
    "イ": "・・", "キ": "ー・ー・ー", "シ": "ーー・ー・", "チ": "・・ー・", "ニ": "ー・ー・", 
    "ヒ": "ーー・・", "ミ": "・・ー・ー", "リ": "ーー・", "ウ": "・・ー", "ク": "・・・ー",
    "ス": "ーーー・ー", "ツ": "・ーー・", "ヌ": "・・・・", "フ": "ーー・・", "ム": "ー",
    "ユ": "ー・・ー", "ル": "ー・ーー・", "エ": "ー・ーーー", "ケ": "ー・ーー", "セ": "・ーーー・", 
    "テ": "・ー・ーー", "ネ": "ーー・ー", "ヘ": "・", "メ": "ー・・ー・", "レ": "ーーー",
    "オ": "・ー・・・", "コ": "ーーーー", "ソ": "ーーー・", "ト": "・・ー・・", "ノ": "・・ーー", 
    "ホ": "ー・・", "モ": "ー・・ー・", "ヨ": "ーー", "ロ": "・ー・ー", "ヲ": "・ーーー", "ン": "・ー・ー・",

    // 濁点・半濁点記号
    "゛": "・・", // 濁点
    "゜": "・・ーー・", // 半濁点

    // アルファベット
    "A": "・ー", "B": "ー・・・", "C": "ー・ー・", "D": "ー・・", "E": "・", "F": "・・ー・",
    "G": "ーー・", "H": "・・・・", "I": "・・", "J": "・ーーー", "K": "ー・ー", "L": "・ー・・",
    "M": "ーー", "N": "ー・", "O": "ーーー", "P": "・ーー・", "Q": "ーー・ー", "R": "・ー・",
    "S": "・・・", "T": "ー", "U": "・・ー", "V": "・・・ー", "W": "・ーー", "X": "ー・・ー",
    "Y": "ー・ーー", "Z": "ーー・・",

    // 数字
    "0": "ーーーーー", "1": "・ーーーー", "2": "・・ーーー", "3": "・・・ーー", "4": "・・・・ー",
    "5": "・・・・・", "6": "ー・・・・", "7": "ーー・・・", "8": "ーーー・・", "9": "ーーーー・",

    // 記号
    "!": "ー・ー・ーー", "\"": "・ー・・ー・", "$": "・・・ー・・ー", "&": "・ー・・・",
    "'": "・ーーーー・", "(": "ー・ーー・", ")": "ー・ーー・ー", "+": "・ー・ー・", ",": "ーー・・ーー",
    "-": "ー・・・・ー", ".": "・ー・ー・ー", "/": "ー・・ー・", ":": "ーーー・・・", ";": "ー・ー・ー・",
    "=": "ー・・・ー", "?": "・・ーー・・", "@": "・ーー・ー・"
  };

  // 逆引き用の辞書を作成
  const reverseMorseTable: Record<string, string> = {};
  Object.entries(morseTable).forEach(([char, morse]) => {
    reverseMorseTable[morse] = char;
  });

  // モールス信号記号を設定記号に変換
  const convertMorseSymbols = (morse: string) => {
    return morse.replace(/・/g, shortSymbol).replace(/ー/g, longSymbol);
  };

  // 設定記号をモールス信号記号に変換
  const convertToStandardMorse = (text: string) => {
    return text.replace(new RegExp(escapeRegExp(shortSymbol), 'g'), '・')
               .replace(new RegExp(escapeRegExp(longSymbol), 'g'), 'ー');
  };

  // 正規表現のエスケープ処理
  const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  // 文字をモールス信号に変換
  const textToMorse = (text: string): string => {
    return text.split('').map(char => {
      const upperChar = char.toUpperCase();
      
      // 濁点・半濁点文字の処理
      if (/[がぎぐげござじずぜぞだぢづでどばびぶべぼガギグゲゴザジズゼゾダヂヅデドバビブベボ]/.test(char)) {
        // 濁点文字から基本文字を取得
        const baseChar = char.replace(/[がぎぐげござじずぜぞだぢづでどばびぶべぼ]/g, (match) => {
          const dakutenMap: Record<string, string> = {
            'が': 'か', 'ぎ': 'き', 'ぐ': 'く', 'げ': 'け', 'ご': 'こ',
            'ざ': 'さ', 'じ': 'し', 'ず': 'す', 'ぜ': 'せ', 'ぞ': 'そ',
            'だ': 'た', 'ぢ': 'ち', 'づ': 'つ', 'で': 'て', 'ど': 'と',
            'ば': 'は', 'び': 'ひ', 'ぶ': 'ふ', 'べ': 'へ', 'ぼ': 'ほ'
          };
          return dakutenMap[match] || match;
        }).replace(/[ガギグゲゴザジズゼゾダヂヅデドバビブベボ]/g, (match) => {
          const dakutenMap: Record<string, string> = {
            'ガ': 'カ', 'ギ': 'キ', 'グ': 'ク', 'ゲ': 'ケ', 'ゴ': 'コ',
            'ザ': 'サ', 'ジ': 'シ', 'ズ': 'ス', 'ゼ': 'セ', 'ゾ': 'ソ',
            'ダ': 'タ', 'ヂ': 'チ', 'ヅ': 'ツ', 'デ': 'テ', 'ド': 'ト',
            'バ': 'ハ', 'ビ': 'ヒ', 'ブ': 'フ', 'ベ': 'ヘ', 'ボ': 'ホ'
          };
          return dakutenMap[match] || match;
        });
        
        const baseMorse = morseTable[baseChar];
        const dakutenMorse = morseTable["゛"];
        return baseMorse && dakutenMorse ? convertMorseSymbols(baseMorse + ' ' + dakutenMorse) : char;
      }
      
      if (/[ぱぴぷぺぽパピプペポ]/.test(char)) {
        // 半濁点文字から基本文字を取得
        const baseChar = char.replace(/[ぱぴぷぺぽ]/g, (match) => {
          const handakutenMap: Record<string, string> = {
            'ぱ': 'は', 'ぴ': 'ひ', 'ぷ': 'ふ', 'ぺ': 'へ', 'ぽ': 'ほ'
          };
          return handakutenMap[match] || match;
        }).replace(/[パピプペポ]/g, (match) => {
          const handakutenMap: Record<string, string> = {
            'パ': 'ハ', 'ピ': 'ヒ', 'プ': 'フ', 'ペ': 'ヘ', 'ポ': 'ホ'
          };
          return handakutenMap[match] || match;
        });
        
        const baseMorse = morseTable[baseChar];
        const handakutenMorse = morseTable["゜"];
        return baseMorse && handakutenMorse ? convertMorseSymbols(baseMorse + ' ' + handakutenMorse) : char;
      }
      
      // 通常の文字
      const morse = morseTable[char] || morseTable[upperChar];
      return morse ? convertMorseSymbols(morse) : char;
    }).join(' ');
  };

  // モールス信号を文字に変換
  const morseToText = (text: string): { hiragana: string; alphabet: string; other: string } => {
    // 複数のスペースまたはタブを区切り文字として使用
    const morseChars = text.split(/\s+/).filter(part => part.length > 0);
    
    const hiraganaResult: string[] = [];
    const alphabetResult: string[] = [];
    const otherResult: string[] = [];
    
    morseChars.forEach(morseChar => {
      const standardMorse = convertToStandardMorse(morseChar);
      
      // ひらがなを検索
      const hiragana = Object.keys(morseTable).find(char => 
        morseTable[char] === standardMorse && /[\u3042-\u3093]/.test(char)
      );
      
      // アルファベットを検索
      const alphabet = Object.keys(morseTable).find(char => 
        morseTable[char] === standardMorse && /[A-Z]/.test(char)
      );
      
      // カタカナを検索
      const katakana = Object.keys(morseTable).find(char => 
        morseTable[char] === standardMorse && /[\u30A1-\u30FC]/.test(char)
      );
      
      // 数字・記号を検索
      const numberOrSymbol = Object.keys(morseTable).find(char => 
        morseTable[char] === standardMorse && /[0-9!-/:-@\[-`{-~゛゜]/.test(char)
      );
      
      // ひらがなまたはカタカナがある場合
      if (hiragana || katakana) {
        hiraganaResult.push(hiragana || katakana || '？');
      }
      
      // アルファベットまたは数字・記号がある場合
      if (alphabet || numberOrSymbol) {
        alphabetResult.push(alphabet || numberOrSymbol || '？');
      }
      
      // どれにも該当しない場合
      if (!hiragana && !katakana && !alphabet && !numberOrSymbol) {
        // ひらがなセクションに？を追加
        hiraganaResult.push('？');
      }
    });
    
    return {
      hiragana: hiraganaResult.join(''),
      alphabet: alphabetResult.join(''),
      other: otherResult.join('')
    };
  };

  // 入力がモールス信号かどうかを判定
  const isMorseCode = (text: string): boolean => {
    const trimmedText = text.trim();
    if (!trimmedText) return false;
    
    // 短い音、長い音、スペース、タブのみで構成されているかチェック
    const morsePattern = new RegExp(`^[${escapeRegExp(shortSymbol)}${escapeRegExp(longSymbol)}\\s]+$`);
    return morsePattern.test(trimmedText);
  };

  // 変換実行
  const convertText = (): string | { hiragana: string; alphabet: string; other: string } => {
    if (!inputText.trim()) return "";
    
    if (isMorseCode(inputText)) {
      return morseToText(inputText);
    } else {
      return textToMorse(inputText);
    }
  };

  const result = convertText();

  return (
    <main className="max-w-4xl mx-auto p-6">
      <div className="flex items-center mb-4 gap-2">
        <button
          className="px-4 py-2 bg-violet-100 text-violet-700 rounded hover:bg-violet-200"
          onClick={() => setShowManual(true)}
        >使い方</button>
        <Link href="/" className="inline-block px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">トップに戻る</Link>
      </div>

      {showManual && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 max-w-lg w-full relative max-h-96 overflow-y-auto">
            <button
              className="absolute top-2 right-2 px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => setShowManual(false)}
            >閉じる</button>
            <h3 className="text-xl font-bold mb-2">モールス信号変換ツールの使い方</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm mb-4">
              <li>テキストボックスに文字またはモールス信号を入力します。</li>
              <li>ひらがな、カタカナ、アルファベット、数字はモールス信号に変換されます。</li>
              <li>モールス信号は自動的に文字に変換されます。</li>
              <li>短い音と長い音の記号は自由に変更できます（デフォルト: .と-）。</li>
              <li>モールス信号を入力する際は、文字間をスペースで区切ってください。</li>
              <li>対応していない文字はそのまま表示されます。</li>
            </ul>
            <h4 className="font-bold mb-2">例:</h4>
            <ul className="text-sm text-gray-600">
              <li>「こんにちは」→ モールス信号</li>
              <li>「・・・・ --- -. -. .. -.-. .... .-」→ 文字</li>
            </ul>
          </div>
        </div>
      )}

      <h2 className="text-2xl font-bold mb-4">モールス信号変換ツール</h2>

      {/* 記号設定 */}
      <div className="mb-4 flex gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="font-medium">短い音:</label>
          <input
            type="text"
            value={shortSymbol}
            onChange={e => setShortSymbol(e.target.value || '.')}
            className="w-16 p-2 border rounded"
            maxLength={3}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="font-medium">長い音:</label>
          <input
            type="text"
            value={longSymbol}
            onChange={e => setLongSymbol(e.target.value || '-')}
            className="w-16 p-2 border rounded"
            maxLength={3}
          />
        </div>
      </div>

      {/* 入力エリア */}
      <div className="mb-4">
        <h3 className="font-semibold mb-2">入力テキスト</h3>
        <textarea
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          className="w-full h-32 p-3 border rounded resize-none"
          placeholder="文字またはモールス信号を入力してください..."
        />
      </div>

      {/* 結果表示 */}
      <div className="mb-4">
        <h3 className="font-semibold mb-2">変換結果</h3>
        {typeof result === 'string' ? (
          <div className="w-full h-32 p-3 border rounded bg-gray-50 overflow-auto whitespace-pre-wrap font-mono">
            {result}
          </div>
        ) : (
          <div className="space-y-3">
            {result.hiragana && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">ひらがな・カタカナ:</h4>
                <div className="w-full p-3 border rounded bg-blue-50 overflow-auto whitespace-pre-wrap font-mono">
                  {result.hiragana}
                </div>
              </div>
            )}
            {result.alphabet && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">アルファベット・数字・記号:</h4>
                <div className="w-full p-3 border rounded bg-green-50 overflow-auto whitespace-pre-wrap font-mono">
                  {result.alphabet}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 変換方向の表示 */}
      <div className="text-sm text-gray-600">
        {inputText.trim() && (
          <p>
            {isMorseCode(inputText) 
              ? `モールス信号 → 文字に変換` 
              : `文字 → モールス信号に変換`}
          </p>
        )}
      </div>
    </main>
  );
}
