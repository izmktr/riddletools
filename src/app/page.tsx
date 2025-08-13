import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-8">Riddle Tools</h1>
      <ul className="space-y-6 w-full max-w-md">
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
          <Link href="/shiritori" className="block bg-gradient-to-r from-rose-200 to-rose-300 hover:from-rose-300 hover:to-rose-400 text-rose-800 font-semibold rounded-lg px-6 py-4 shadow-lg transform hover:scale-105 transition-all duration-200">
            しりとりソルバー
          </Link>
        </li>
        <li>
          <Link href="/skeleton" className="block bg-gradient-to-r from-orange-200 to-orange-300 hover:from-orange-300 hover:to-orange-400 text-orange-800 font-semibold rounded-lg px-6 py-4 shadow-lg transform hover:scale-105 transition-all duration-200">
            スケルトンソルバー
          </Link>
        </li>
        <li>
          <Link href="/cryptarithmetic" className="block bg-gradient-to-r from-amber-200 to-amber-300 hover:from-amber-300 hover:to-amber-400 text-amber-800 font-semibold rounded-lg px-6 py-4 shadow-lg transform hover:scale-105 transition-all duration-200">
            覆面算ソルバー
          </Link>
        </li>
        <li>
          <Link href="/braille" className="block bg-indigo-100 hover:bg-indigo-200 text-indigo-900 font-semibold rounded px-6 py-4 shadow">
            点字変換ツール
          </Link>
        </li>
      </ul>
    </main>
  );
}
