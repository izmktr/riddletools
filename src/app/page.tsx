'use client';

import Link from "next/link";

export default function Home() {
  const Tool = [
    ["文字数カウントツール", "/count"],
    ["文字比較ツール", "/compare"],
    ["文字拾いツール", "/pick"],
    ["QWERTY⇔かな変換ツール", "/qwerty"],
    ["元素記号変換ツール", "/elements"],
    ["点字変換ツール", "/braille"],
    ["モールス信号変換ツール", "/morse"],
  ];
  const Solver = [
    ["しりとりソルバー", "/shiritori"],
    ["スケルトンソルバー", "/skeleton"],
    ["覆面算ソルバー", "/cryptarithmetic"],
  ];

  // 色のグラデーション生成関数
  const generateGradientColors = (startHue: number, endHue: number, count: number, saturation: number = 50, lightness: number = 90) => {
    const colors = [];
    for (let i = 0; i < count; i++) {
      const hue = count === 1 ? startHue : startHue + (endHue - startHue) * (i / (count - 1));
      colors.push({
        background: `linear-gradient(to right, hsl(${hue}, ${saturation}%, ${lightness}%), hsl(${hue}, ${saturation}%, ${lightness - 15}%))`,
        backgroundHover: `linear-gradient(to right, hsl(${hue}, ${saturation + 10}%, ${lightness - 20}%), hsl(${hue}, ${saturation + 10}%, ${lightness - 25}%))`,
        textColor: `hsl(${hue}, ${saturation + 30}%, ${lightness - 60}%)`
      });
    }
    return colors;
  };

  // ツール用の色（青からピンクのグラデーション）
  const toolColors = generateGradientColors(220, 300, Tool.length);

  // ソルバー用の色（緑から青緑のグラデーション）
  const solverColors = generateGradientColors(120, 180, Solver.length);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-8">Riddle Tools</h1>
      
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8">
        {/* ツール */}
        <div>
          <h2 className="text-2xl font-bold mb-4 text-center text-blue-800">ツール</h2>
          <ul className="space-y-4">
            {Tool.map(([name, path], index) => {
              const color = toolColors[index];
              return (
                <li key={path}>
                  <Link 
                    href={path} 
                    className="block font-semibold rounded-lg px-6 py-4 shadow-lg transform hover:scale-105 transition-all duration-200"
                    style={{
                      background: color.background,
                      color: color.textColor
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = color.backgroundHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = color.background;
                    }}
                  >
                    {name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ソルバー */}
        <div>
          <h2 className="text-2xl font-bold mb-4 text-center text-green-800">ソルバー</h2>
          <ul className="space-y-4">
            {Solver.map(([name, path], index) => {
              const color = solverColors[index];
              return (
                <li key={path}>
                  <Link 
                    href={path} 
                    className="block font-semibold rounded-lg px-6 py-4 shadow-lg transform hover:scale-105 transition-all duration-200"
                    style={{
                      background: color.background,
                      color: color.textColor
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = color.backgroundHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = color.background;
                    }}
                  >
                    {name}
                  </Link>
                </li>
              );
            })}
        <li>
          <Link href="/colorpuzzle" className="block bg-indigo-100 hover:bg-indigo-200 text-indigo-900 font-semibold rounded px-6 py-4 shadow">
            パズルゲーム
          </Link>
        </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
