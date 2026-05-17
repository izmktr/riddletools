# プロジェクトのテスト実行方法

このドキュメントでは、プロジェクトにセットアップされたテスト環境でテストを実行する方法について説明します。

## 1. 必要なパッケージのインストール

テストを実行する前に、プロジェクトの依存関係をインストールする必要があります。プロジェクトのルートディレクトリで以下のコマンドを実行してください。

```bash
npm install
```

これにより、`package.json` に定義されている `dependencies` と `devDependencies` がすべてインストールされます。テストには主に以下の `devDependencies` が使用されます。

-   `jest`: テストフレームワーク
-   `@testing-library/react`: Reactコンポーネントのテスト用ライブラリ
-   `@testing-library/jest-dom`: Jest用に追加のマッチャーを提供
-   `ts-node`: TypeScriptで書かれたJest設定ファイルを読み込むために必要
-   `typescript`: TypeScriptのコンパイル

## 2. テストの実行

`package.json` の `scripts` に、テスト実行用のコマンドが定義されています。

### すべてのテストを実行する

プロジェクト内のすべてのテスト（`.test.tsx` または `.test.ts` という拡張子のファイル）を一度だけ実行します。

```bash
npm test
```

### ウォッチモードでテストを実行する

ファイルの変更を監視し、変更があったファイルに関連するテストを自動的に再実行します。開発中に非常に便利です。

```bash
npm run test:watch
```

### テストカバレッジを計測する

テストがコードのどの部分をカバーしているかを示すカバレッジレポートを生成します。

```bash
npm run test:coverage
```

実行後、`coverage/lcov-report/index.html` が生成されるので、ブラウザで開くと詳細なレポートを確認できます。

## 3. テストファイルの構成

-   **テストファイル**: テスト対象のコンポーネントと同じディレクトリに `*.test.tsx` という命名規則で配置されています。（例: `src/app/cryptarithmetic/page.test.tsx`）
-   **Jest設定ファイル**:
    -   `jest.config.ts`: Jestの全体的な設定（テスト環境、モジュールマッピングなど）を定義しています。
    -   `jest.setup.ts`: 各テストファイルの実行前に読み込まれ、`@testing-library/jest-dom` のようなライブラリをセットアップします。

## 4. トラブルシューティング

-   **`ts-node is required` エラー**: `npm install` を実行して、`ts-node` が正しくインストールされているか確認してください。
-   **`Multiple configurations found` エラー**: プロジェクトルートに `jest.config.js` と `jest.config.ts` の両方が存在している可能性があります。不要な方の設定ファイル（通常は `.js` の方）を削除してください。