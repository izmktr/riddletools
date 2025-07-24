# RiddleTools

GitHub PagesでホストされるNext.jsサイトです。

## 特徴

- **Next.js 15** - App Routerを使用
- **TypeScript** - 型安全性を確保
- **Tailwind CSS** - モダンなスタイリング
- **静的エクスポート** - GitHub Pages対応
- **自動デプロイ** - GitHub Actionsで自動化

## 開発環境

開発サーバーを起動：

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

[http://localhost:3000](http://localhost:3000) でサイトを確認できます。

`src/app/page.tsx`を編集してページを変更できます。

## ビルド

静的ファイルを生成：

```bash
npm run build
```

ビルドされたファイルは`out`ディレクトリに出力されます。

## デプロイ

このプロジェクトはGitHub Actionsを使用してGitHub Pagesに自動デプロイされます。

### セットアップ手順

1. GitHubリポジトリを作成
2. コードをプッシュ
3. リポジトリの Settings > Pages で Source を "GitHub Actions" に設定
4. mainブランチにプッシュすると自動的にデプロイされます

## 技術スタック

- [Next.js](https://nextjs.org/) - Reactフレームワーク
- [TypeScript](https://www.typescriptlang.org/) - 型安全性
- [Tailwind CSS](https://tailwindcss.com/) - CSSフレームワーク
- [GitHub Pages](https://pages.github.com/) - ホスティング

## 参考リンク

- [Next.js Documentation](https://nextjs.org/docs)
- [GitHub Pages Documentation](https://docs.github.com/pages)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
