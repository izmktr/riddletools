import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import MashuPage from './page';

jest.mock('next/link', () => {
  return ({ children }: { children: React.ReactNode }) => {
    return children;
  };
});

const solveBoard = async (boardText: string) => {
  render(<MashuPage />);

  fireEvent.click(screen.getByRole('button', { name: 'インポート' }));

  const textarea = screen.getByPlaceholderText('◯・● の盤面を貼り付けてください');
  fireEvent.change(textarea, { target: { value: boardText } });

  fireEvent.click(screen.getByRole('button', { name: '適用' }));
  expect(await screen.findByText('インポートしました！')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '解析' }));
};

const expectCompletedOrNotBroken = () => {
  const hasBroken = screen.queryByText(/破綻しました/) !== null;

  expect(hasBroken).toBe(false);
};

describe('MashuPage', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('ページが正しくレンダリングされる', () => {
    render(<MashuPage />);
    expect(screen.getByText('ましゅソルバー')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '解析' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'リセット' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'インポート' })).toBeInTheDocument();
  });

  test('四隅が黒丸の3x3盤面を解析して完成する', async () => {
    await solveBoard('●・●\n・・・\n●・●');
    expect(await screen.findByText('完成しました！')).toBeInTheDocument();
  });

  test('四辺中央が白丸の3x3盤面を解析して完成する', async () => {
    await solveBoard('・◯・\n◯・◯\n・◯・');
    expect(await screen.findByText('完成しました！')).toBeInTheDocument();
  });

  test('黒丸・白丸混在の6x6盤面を解析して完成または途中終了する', async () => {
    await solveBoard('●・◯・・・\n・・・・・・\n・◯◯◯・◯\n・・・・・・\n・●・・・◯\n・・・・・・');
    expectCompletedOrNotBroken();
  });

  test('途中盤面では再解析ボタンに切り替わり、失敗時はエラーになる', async () => {
    render(<MashuPage />);

    fireEvent.click(screen.getByRole('button', { name: 'インポート' }));
    const textarea = screen.getByPlaceholderText('◯・● の盤面を貼り付けてください');
    fireEvent.change(textarea, { target: { value: '・・・\n・・・\n・・・' } });
    fireEvent.click(screen.getByRole('button', { name: '適用' }));

    fireEvent.click(screen.getByRole('button', { name: '解析' }));
    expect(await screen.findByRole('button', { name: '再解析' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '再解析' }));
    expect(await screen.findByText('再解析できませんでした')).toBeInTheDocument();
  });

  test('再解析することで解ける大きめの盤面を完成できる', async () => {
    await solveBoard(`・・・◯・◯・・・●・◯・●・◯・●・・・
・・・・・・・◯・・・・・・・・・・・・●
◯・●・・●・・・・●・・・・◯・・・・・
・・・・・・・・◯・・・・◯・・・●・◯・
・・◯・◯・●・・・◯・・・・●・・・・◯
●・・・・・・◯・●・・●・・・・・◯・・
・・・・◯・・・・・・・・・◯・・・・・●
・・●・・・●・・・・・・・・・・・◯・・
◯・・・◯・・◯・・◯・◯・・●・・・・◯
・・・◯・・・・●・・●・・・・・・●・・
・●・・・・・・・◯・・・・●・◯・・・・
・・◯・・●・・・・・・・・・・・・・◯・
●・・・・・・◯・・◯・●・・・●・・・●
・・◯・●・・・◯・・・・・◯・・・●・・
・◯・・・・●・・・●・◯・・・◯・・・◯
・・・◯・・・・◯・・・・・●・・・・・・
・◯・・●・◯・・◯・・●・・・・・◯・・`);

    expect(await screen.findByRole('button', { name: '再解析' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '再解析' }));
    expect(await screen.findByText('完成しました！', {}, { timeout: 20000 })).toBeInTheDocument();
  }, 30000);
});
