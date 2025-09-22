import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  // Next.jsアプリへのパスを指定して、テスト環境でnext.config.jsと.envファイルを読み込みます
  dir: './',
});

// Jestに渡すカスタム設定を追加します
const config: Config = {
  // テスト環境としてjsdom（ブラウザ環境をシミュレート）を使用します
  testEnvironment: 'jsdom',
  // 各テストの実行前に、追加のセットアップオプションを設定します
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // モジュールエイリアスの設定（tsconfig.jsonと合わせる）
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};

// createJestConfigをこのようにエクスポートすることで、next/jestが非同期でNext.jsの設定を読み込めるようになります
export default createJestConfig(config);

