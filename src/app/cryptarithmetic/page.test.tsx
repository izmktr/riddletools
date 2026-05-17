import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CryptarithmeticPage from './page';

// next/linkコンポーネントをモック化します。テスト環境では実際のページ遷移は不要なためです。
jest.mock('next/link', () => {
  return ({ children }: { children: React.ReactNode }) => {
    return children;
  };
});

describe('CryptarithmeticPage', () => {
  // 各テストの後にモックをクリアします
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('ページが正しくレンダリングされる', () => {
    render(<CryptarithmeticPage />);
    expect(screen.getByText('覆面算ソルバー')).toBeInTheDocument();
    expect(screen.getByLabelText('覆面算の式（改行で複数の式を入力可能）')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '解く' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'クリア' })).toBeInTheDocument();
  });

  test('例題ボタンをクリックするとテキストエリアに式が入力される', () => {
    render(<CryptarithmeticPage />);
    const exampleButton = screen.getByRole('button', { name: 'SEND + MORE = MONEY' });
    const textarea = screen.getByLabelText('覆面算の式（改行で複数の式を入力可能）');

    fireEvent.click(exampleButton);
    expect(textarea).toHaveValue('SEND + MORE = MONEY');
  });

  test('クリアボタンをクリックすると入力と結果がクリアされる', async () => {
    render(<CryptarithmeticPage />);
    const textarea = screen.getByLabelText('覆面算の式（改行で複数の式を入力可能）');
    const solveButton = screen.getByRole('button', { name: '解く' });
    const clearButton = screen.getByRole('button', { name: 'クリア' });

    // データを入力して解析
    fireEvent.change(textarea, { target: { value: 'A+B=C' } });
    fireEvent.click(solveButton);

    // 結果が表示されるのを待つ
    await waitFor(() => {
      expect(screen.getByText('解析結果:')).toBeInTheDocument();
    });

    // クリアボタンをクリック
    fireEvent.click(clearButton);

    // 入力と結果がクリアされていることを確認
    expect(textarea).toHaveValue('');
    expect(screen.queryByText('解析結果:')).not.toBeInTheDocument();
  });

  describe('ソルバーロジックのテスト', () => {
    test('有名な問題「SEND + MORE = MONEY」が正しく解ける', async () => {
      render(<CryptarithmeticPage />);
      const textarea = screen.getByLabelText('覆面算の式（改行で複数の式を入力可能）');
      const solveButton = screen.getByRole('button', { name: '解く' });

      fireEvent.change(textarea, { target: { value: 'SEND + MORE = MONEY' } });
      fireEvent.click(solveButton);

      await waitFor(() => {
        // 正しい解が表示されているか
        expect(screen.getByText(/解 1:/)).toBeInTheDocument();
        // マッピングの主要な文字を確認（順序は問わない）
        expect(screen.getByText(/M=1/)).toBeInTheDocument();
        expect(screen.getByText(/O=0/)).toBeInTheDocument();
        expect(screen.getByText(/S=9/)).toBeInTheDocument();
        // 式の結果を確認
        expect(screen.getByText(/9567 \+ 1085 = 10652/)).toBeInTheDocument();
      });
    });

    test('解が存在しない場合にメッセージを表示する', async () => {
      render(<CryptarithmeticPage />);
      const textarea = screen.getByLabelText('覆面算の式（改行で複数の式を入力可能）');
      const solveButton = screen.getByRole('button', { name: '解く' });

      // この式には整数解がない
      fireEvent.change(textarea, { target: { value: 'THIS = IS + IMPOSSIBLE' } });
      fireEvent.click(solveButton);

      await waitFor(() => {
        expect(screen.getByText('解が見つかりませんでした')).toBeInTheDocument();
      });
    });

    test('文字数が10を超える場合にエラーメッセージを表示する', async () => {
      render(<CryptarithmeticPage />);
      const textarea = screen.getByLabelText('覆面算の式（改行で複数の式を入力可能）');
      const solveButton = screen.getByRole('button', { name: '解く' });

      fireEvent.change(textarea, { target: { value: 'ABCDEFGHIJK = 1' } });
      fireEvent.click(solveButton);

      await waitFor(() => {
        expect(screen.getByText('エラー: 文字数が10を超えています（0-9の数字が足りません）')).toBeInTheDocument();
      });
    });

    test('複数の解がある場合に制限個数まで表示する', async () => {
      render(<CryptarithmeticPage />);
      const textarea = screen.getByLabelText('覆面算の式（改行で複数の式を入力可能）');
      const solveButton = screen.getByRole('button', { name: '解く' });

      // この式には多数の解が存在する
      fireEvent.change(textarea, { target: { value: 'A + B = C' } });
      fireEvent.click(solveButton);

      await waitFor(() => {
        // 10個の解が表示される
        expect(screen.getByText('解 10:')).toBeInTheDocument();
        // 11個目の解は表示されない
        expect(screen.queryByText('解 11:')).not.toBeInTheDocument();
        // 制限に達した旨のメッセージが表示される
        expect(screen.getByText(/注意: 10個以上の解があります。/)).toBeInTheDocument();
      });
    });
  });
});