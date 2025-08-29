import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-8">Riddle Tools</h1>
      
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8">
        {/* ツール */}
        <div>
          <h2 className="text-2xl font-bold mb-4 text-center text-blue-800">ツール</h2>
          <ul className="space-y-4">
            <li>
              <Link href="/count" className="block bg-gradient-to-r from-blue-200 to-blue-300 hover:from-blue-300 hover:to-blue-400 text-blue-800 font-semibold rounded-lg px-6 py-4 shadow-lg transform hover:scale-105 transition-all duration-200">
                文字数カウントツール
              </Link>
            </li>
            <li>
              <Link href="/compare" className="block bg-gradient-to-r from-indigo-200 to-indigo-300 hover:from-indigo-300 hover:to-indigo-400 text-indigo-800 font-semibold rounded-lg px-6 py-4 shadow-lg transform hover:scale-105 transition-all duration-200">
                文字比較ツール
              </Link>
            </li>
            <li>
              <Link href="/pick" className="block bg-gradient-to-r from-purple-200 to-purple-300 hover:from-purple-300 hover:to-purple-400 text-purple-800 font-semibold rounded-lg px-6 py-4 shadow-lg transform hover:scale-105 transition-all duration-200">
                文字拾いツール
              </Link>
            </li>
            <li>
              <Link href="/elements" className="block bg-gradient-to-r from-pink-200 to-pink-300 hover:from-pink-300 hover:to-pink-400 text-pink-800 font-semibold rounded-lg px-6 py-4 shadow-lg transform hover:scale-105 transition-all duration-200">
                元素記号変換ツール
              </Link>
            </li>
            <li>
              <Link href="/braille" className="block bg-gradient-to-r from-cyan-200 to-cyan-300 hover:from-cyan-300 hover:to-cyan-400 text-cyan-800 font-semibold rounded-lg px-6 py-4 shadow-lg transform hover:scale-105 transition-all duration-200">
                点字変換ツール
              </Link>
            </li>
            <li>
              <Link href="/morse" className="block bg-gradient-to-r from-violet-200 to-violet-300 hover:from-violet-300 hover:to-violet-400 text-violet-800 font-semibold rounded-lg px-6 py-4 shadow-lg transform hover:scale-105 transition-all duration-200">
                モールス信号変換ツール
              </Link>
            </li>
          </ul>
        </div>

        {/* ソルバー */}
        <div>
          <h2 className="text-2xl font-bold mb-4 text-center text-green-800">ソルバー</h2>
          <ul className="space-y-4">
            <li>
              <Link href="/shiritori" className="block bg-gradient-to-r from-green-200 to-green-300 hover:from-green-300 hover:to-green-400 text-green-800 font-semibold rounded-lg px-6 py-4 shadow-lg transform hover:scale-105 transition-all duration-200">
                しりとりソルバー
              </Link>
            </li>
            <li>
              <Link href="/skeleton" className="block bg-gradient-to-r from-emerald-200 to-emerald-300 hover:from-emerald-300 hover:to-emerald-400 text-emerald-800 font-semibold rounded-lg px-6 py-4 shadow-lg transform hover:scale-105 transition-all duration-200">
                スケルトンソルバー
              </Link>
            </li>
            <li>
              <Link href="/cryptarithmetic" className="block bg-gradient-to-r from-teal-200 to-teal-300 hover:from-teal-300 hover:to-teal-400 text-teal-800 font-semibold rounded-lg px-6 py-4 shadow-lg transform hover:scale-105 transition-all duration-200">
                覆面算ソルバー
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
