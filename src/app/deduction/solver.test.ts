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
      "一郎.順位<次郎.順位",
      "次郎.順位<花子.順位",
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
      "一郎.順位<カレー.順位",
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
      "A.項目>B.項目",
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

  test("不等号条件で左右のカテゴリが異なる場合はエラー", () => {
    const input = [
      "名前[一郎,次郎,花子]",
      "順位[]",
      "一郎.順位<次郎",
    ].join("\n");

    expect(() => solvePuzzle(input)).toThrow("不等号条件の左右は同一カテゴリ（または同一タグ）である必要があります");
  });

  test("不等号条件で四則演算が含まれる場合はカテゴリ不一致でもエラーにしない", () => {
    const input = [
      "名前[一郎,次郎,花子]",
      "順位[]",
      "一郎.順位<次郎+0",
    ].join("\n");

    expect(() => solvePuzzle(input)).not.toThrow();
  });

  test("論理演算子 AND/OR/XOR/NXOR を解釈できる", () => {
    const input = [
      "名前[A,B]",
      "色[赤,青]",
      "A=赤|B=赤&A=青",
    ].join("\n");

    const result = solvePuzzle(input);
    expect(result.solutions).toHaveLength(2);
    expect(result.solutions).toContainEqual([
      ["A", "赤"],
      ["B", "青"],
    ]);
    expect(result.solutions).toContainEqual([
      ["A", "青"],
      ["B", "赤"],
    ]);
  });

  test("XOR と NXOR の意味が異なる", () => {
    const xorInput = [
      "名前[A,B]",
      "色[赤,青]",
      "A=赤^A=赤",
    ].join("\n");

    const xorResult = solvePuzzle(xorInput);
    expect(xorResult.solutions).toHaveLength(0);

    const nxorInput = [
      "名前[A,B]",
      "色[赤,青]",
      "A=赤:A=赤",
    ].join("\n");

    const nxorResult = solvePuzzle(nxorInput);
    expect(nxorResult.solutions).toHaveLength(2);
  });

  test("条件式で括弧を使って優先順位を上げられる", () => {
    const input = [
      "名前[A,B]",
      "色[赤,青]",
      "(A=赤|B=赤)&A=青",
    ].join("\n");

    const result = solvePuzzle(input);
    expect(result.solutions).toHaveLength(1);
    expect(result.solutions[0]).toEqual([
      ["A", "青"],
      ["B", "赤"],
    ]);
  });

  test("算術式で括弧を使って優先順位を上げられる", () => {
    const input = [
      "名前[A,B]",
      "値[2,3]",
      "A=2",
      "B=3",
      "A.値=(B.値+1)/2",
    ].join("\n");

    const result = solvePuzzle(input);
    expect(result.solutions).toHaveLength(1);
  });

  test("タグの値を省略すると{true,false}として補完される", () => {
    const input = [
      "人物[A,B,C]",
      "真{}",
      "A=真",
      "B=真",
      "C!=真",
    ].join("\n");

    const result = solvePuzzle(input);
    // タグは複数セットで同じ値を持てるため、複数の解が存在する
    expect(result.solutions.length).toBeGreaterThan(0);

    for (const solution of result.solutions) {
      // A と B は真=true、C は真=false
      const aTrueValue = solution[0][1]; // A のタグ値
      const bTrueValue = solution[1][1]; // B のタグ値
      const cTrueValue = solution[2][1]; // C のタグ値

      // A=真 and B=真 => A と B は真.true
      expect(aTrueValue).toBe("true");
      expect(bTrueValue).toBe("true");
      // C!=真 => C は真.false
      expect(cTrueValue).toBe("false");
    }
  });

  test("タグの長さ制約により値を制限できる（test1）", () => {
    const input = [
      "人物[A,B,C]",
      "真{}",
      "真.len=2",
      "A=真",
      "B!=真",
    ].join("\n");

    const result = solvePuzzle(input);
    expect(result.solutions.length).toBeGreaterThan(0);

    for (const solution of result.solutions) {
      const aTrueValue = solution[0][1]; // A のタグ値
      const bTrueValue = solution[1][1]; // B のタグ値
      const cTrueValue = solution[2][1]; // C のタグ値

      // A=真, B!=真 の制約と、真.len=2（true が2つ）
      expect(aTrueValue).toBe("true");
      expect(bTrueValue).toBe("false");
      expect(cTrueValue).toBe("true");
    }
  });

  test("タグの長さ制約と NXOR 演算子（test2）", () => {
    const input = [
      "人物[A,B,C]",
      "真{}",
      "真.len=2",
      "A=真:C!=真",
      "B=真:A=真",
      "C=真:B!=真",
    ].join("\n");

    const result = solvePuzzle(input);
    expect(result.solutions.length).toBeGreaterThan(0);

    for (const solution of result.solutions) {
      const aTrueValue = solution[0][1]; // A のタグ値
      const bTrueValue = solution[1][1]; // B のタグ値
      const cTrueValue = solution[2][1]; // C のタグ値

      // 真.len=2（true が2つ）で、NXOR 条件を満たす
      expect(aTrueValue).toBe("true");
      expect(bTrueValue).toBe("true");
      expect(cTrueValue).toBe("false");
    }
  });

  test("全称構文と推論演算子（IMP）を解釈できる", () => {
    const input = [
      "人物[A,B,C]",
      "真{}",
      "犯人{}",
      "真.len>=1",
      "犯人.len=1",
      "犯人->!真",
      "A=真:B=犯人",
      "B=真:A!=犯人",
      "C=真:B=犯人",
    ].join("\n");

    const result = solvePuzzle(input);

    expect(result.solutions.length).toBeGreaterThan(0);
    for (const solution of result.solutions) {
      // solution[i] = [エンティティ名, 真の値, 犯人の値]
      const byEntity = Object.fromEntries(solution.map((row) => [row[0], row]));
      expect(byEntity["A"][1]).toBe("false");  // 真
      expect(byEntity["A"][2]).toBe("false");  // 犯人
      expect(byEntity["B"][1]).toBe("true");   // 真
      expect(byEntity["B"][2]).toBe("false");  // 犯人
      expect(byEntity["C"][1]).toBe("false");  // 真
      expect(byEntity["C"][2]).toBe("true");   // 犯人
    }
  });
});
