<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# GitHub Pages Next.js プロジェクト

このプロジェクトはGitHub Pagesでホストされる静的Next.jsサイトです。

## プロジェクト設定
- TypeScript使用
- Tailwind CSS使用
- App Router使用
- 静的エクスポート（GitHub Pages対応）

## 開発時の注意点
- GitHub Pagesは静的サイトのみサポートするため、`next.config.js`で静的エクスポートを有効化
- サーバーサイド機能（API routes、SSR）は使用不可
- 画像の最適化はGitHub Pagesでは無効化が必要
