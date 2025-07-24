export default function Home() {
  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <div className="text-center sm:text-left">
          <h1 className="text-4xl font-bold mb-4">RiddleTools</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
            GitHub PagesでホストされるNext.jsサイト
          </p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950 p-6 rounded-lg max-w-2xl">
          <h2 className="text-xl font-semibold mb-4">🚀 このサイトについて</h2>
          <ul className="space-y-2 text-sm">
            <li>✅ Next.js 15 with App Router</li>
            <li>✅ TypeScript サポート</li>
            <li>✅ Tailwind CSS スタイリング</li>
            <li>✅ GitHub Pages 静的デプロイ</li>
            <li>✅ GitHub Actions 自動ビルド</li>
          </ul>
        </div>

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <a
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-blue-600 text-white hover:bg-blue-700 font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            📚 GitHub で見る
          </a>
          <a
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
            href="https://nextjs.org/docs"
            target="_blank"
            rel="noopener noreferrer"
          >
            📖 Next.js ドキュメント
          </a>
        </div>
      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
        <p className="text-sm text-gray-500">
          Powered by Next.js ⚡ Deployed with GitHub Pages
        </p>
      </footer>
    </div>
  );
}
