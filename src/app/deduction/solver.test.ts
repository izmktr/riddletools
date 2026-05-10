import { parsePuzzle, solvePuzzle } from "@/app/deduction/solver";

describe("deduction solver", () => {
  test("一意解の問題を解ける", () => {
    const input = [
      "名前[一郎,次郎,花子]",
      "食べ物[カツ丼,ハンバーグ,カレー]",
      "値段[800,900,1000]",
      "順位[]",
      "一郎=カツ丼",
      "次郎=ハンバーグ",
      "花子=1000",
      "カツ丼=800",
      "一郎.順位<次郎",
      "次郎.順位<花子",
    ].join("\n");

    const result = solvePuzzle(input);

    expect(result.solutions).toHaveLength(1);
    expect(result.solutions[0]).toEqual([
      ["一郎", "カツ丼", "800", "1"],
      ["次郎", "ハンバーグ", "900", "2"],
      ["花子", "カレー", "1000", "3"],
    ]);
  });

  test("射影等号構文 次郎.順位=2 を解釈できる", () => {
    const input = [
      "名前[一郎,次郎,花子]",
      "食べ物[カツ丼,ハンバーグ,カレー]",
      "値段[800,900,1000]",
      "順位[]",
      "一郎=カツ丼",
      "次郎=ハンバーグ",
      "花子=1000",
      "カツ丼=800",
      "一郎.順位<カレー",
      "次郎.順位=2",
    ].join("\n");

    const result = solvePuzzle(input);
    expect(result.solutions).toHaveLength(1);
    expect(result.solutions[0]).toEqual([
      ["一郎", "カツ丼", "800", "1"],
      ["次郎", "ハンバーグ", "900", "2"],
      ["花子", "カレー", "1000", "3"],
    ]);
  });

  test("等号条件の右辺リストはOR条件として解釈される", () => {
    const input = [
      "名前[一郎,次郎,花子]",
      "食べ物[カツ丼,ハンバーグ,カレー]",
      "値段[800,900,1000]",
      "順位[]",
      "一郎=カレー,ハンバーグ",
      "次郎!=カレー,ハンバーグ",
    ].join("\n");

    const result = solvePuzzle(input);
    expect(result.solutions.length).toBeGreaterThan(0);

    for (const solution of result.solutions) {
      expect(["カレー", "ハンバーグ"]).toContain(solution[0][1]);
      expect(["カレー", "ハンバーグ"]).not.toContain(solution[1][1]);
    }
  });

  test("等号条件の右辺リストでカテゴリが混在するとエラー", () => {
    const input = [
      "名前[一郎,次郎,花子]",
      "食べ物[カツ丼,ハンバーグ,カレー]",
      "値段[800,900,1000]",
      "一郎=カツ丼,900",
    ].join("\n");

    expect(() => solvePuzzle(input)).toThrow("右辺リストの値は同一カテゴリで指定してください");
  });

  test("#以降はコメントとして無視する", () => {
    const input = [
      "名前[一郎,次郎] # 名前カテゴリ",
      "食べ物[カツ丼,カレー]",
      "一郎=カツ丼 # 対応づけ",
      "次郎=カレー",
    ].join("\n");

    const result = solvePuzzle(input);
    expect(result.solutions).toHaveLength(1);
    expect(result.solutions[0]).toEqual([
      ["一郎", "カツ丼"],
      ["次郎", "カレー"],
    ]);
  });
  test("カテゴリ省略が曖昧なときはエラー", () => {
    const input = [
      "A[a,b]",
      "B[a,c]",
      "a=c",
    ].join("\n");

    expect(() => solvePuzzle(input)).toThrow("曖昧");
  });

  test("矛盾条件なら解なしになる", () => {
    const input = [
      "名前[A,B]",
      "色[赤,青]",
      "順位[]",
      "A=赤",
      "A=青",
    ].join("\n");

    const result = solvePuzzle(input);
    expect(result.solutions).toHaveLength(0);
  });

  test("数値カテゴリが昇順でない場合は警告を返す", () => {
    const input = [
      "名前[A,B,C]",
      "点数[10,5,30]",
    ].join("\n");

    const parsed = parsePuzzle(input);
    expect(parsed.warnings).toHaveLength(1);
    expect(parsed.warnings[0].message).toContain("比較値は昇順ではありません");
  });

  test("数値に変換できない値は1起源の位置として比較する", () => {
    const input = [
      "名前[A,B,C]",
      "項目[800,900,未定]",
      "A=800",
      "B=未定",
      "A.項目>B",
    ].join("\n");

    const result = solvePuzzle(input);
    expect(result.solutions).toHaveLength(1);
  });

  test("比較条件で四則演算を使える", () => {
    const input = [
      "名前[一郎,次郎]",
      "価格[100,300]",
      "順位[]",
      "一郎.順位=次郎.順位+1",
      "一郎.価格<次郎.価格*2",
    ].join("\n");

    const result = solvePuzzle(input);
    expect(result.solutions).toHaveLength(1);
    expect(result.solutions[0]).toEqual([
      ["一郎", "100", "2"],
      ["次郎", "300", "1"],
    ]);
  });

  test("比較条件の左辺でも四則演算を使える", () => {
    const input = [
      "名前[A,B]",
      "単価[100,200]",
      "個数[2,3]",
      "A=100",
      "B=200",
      "A.個数=2",
      "B.個数=3",
      "A.単価*A.個数<=B.単価*B.個数",
    ].join("\n");

    const result = solvePuzzle(input);
    expect(result.solutions).toHaveLength(1);
    expect(result.solutions[0]).toEqual([
      ["A", "100", "2"],
      ["B", "200", "3"],
    ]);
  });
});
