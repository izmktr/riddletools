import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-8">Riddle Tools</h1>
      <ul className="space-y-6 w-full max-w-md">
        <li>
          <Link href="/count" className="block bg-blue-100 hover:bg-blue-200 text-blue-900 font-semibold rounded px-6 py-4 shadow">
            文字数カウントツール
          </Link>
        </li>
        <li>
          <Link href="/compare" className="block bg-green-100 hover:bg-green-200 text-green-900 font-semibold rounded px-6 py-4 shadow">
            文字比較ツール
          </Link>
        </li>
        <li>
          <Link href="/shiritori" className="block bg-yellow-100 hover:bg-yellow-200 text-yellow-900 font-semibold rounded px-6 py-4 shadow">
            しりとりソルバー
          </Link>
        </li>
      </ul>
    </main>
  );
}
