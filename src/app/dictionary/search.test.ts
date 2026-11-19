import { buildNankuroRegex, matchAnagram, matchNankuro, matchNankuroPatterns } from "./search";

describe("dictionary search helpers", () => {
  describe("matchNankuro", () => {
    test("完全一致で判定する", () => {
      expect(matchNankuro("あ.", "あい")).toBe(true);
      expect(matchNankuro("あ.", "あいう")).toBe(false);
      expect(matchNankuro("あ.", "かい")).toBe(false);
    });

    test("同じ数字は同じ文字に一致する", () => {
      expect(matchNankuro("121", "あいあ")).toBe(true);
      expect(matchNankuro("121", "あいう")).toBe(false);
    });

    test("文字クラスを扱える", () => {
      expect(matchNankuro("[あいう]1", "いえ")).toBe(true);
      expect(matchNankuro("[あいう]1", "えい")).toBe(false);
    });

    test("アスタリスクで0文字以上に一致する", () => {
      expect(matchNankuro("あ*う", "あいう")).toBe(true);
      expect(matchNankuro("あ*う", "あう")).toBe(true);
      expect(matchNankuro("あ*う", "あいえお")).toBe(false);
    });

    test("最初の数字に+を付けると、数字が1文字以上の文字列に一致する", () => {
      for (const word of ["ざわざわ", "しんしん", "きょろきょろ"]) {
        expect(matchNankuro("1+1+", word)).toBe(true);
        expect(matchNankuro("1+1", word)).toBe(true);
      }
      expect(matchNankuro("1+1", "ざわわ")).toBe(false);
    });

    test("可変長パターンの最初の数字に+がない場合は無効", () => {
      expect(buildNankuroRegex("11+")).toBeNull();
      expect(matchNankuro("11+", "ざわざわ")).toBe(false);
    });

    test("不正なパターンでもクラッシュしない", () => {
      expect(buildNankuroRegex("[")).not.toBeNull();
      expect(matchNankuro("[", "[")) .toBe(true);
    });
  });

  describe("matchNankuroPatterns", () => {
    test("複数パターンで数字の対応を共有し、別々の単語を返す", () => {
      const words = ["あいド", "あいダー", "あうド", "ういダー"];
      expect([...matchNankuroPatterns(["12ド", "12ダー"], words)!]).toEqual([0, 1]);
    });

    test("逆順のパターンに合う単語を両方返し、同じ単語だけの一致は除外する", () => {
      const words = ["abcd", "dcba", "wxyz", "zyxw", "abba"];
      expect([...matchNankuroPatterns(["1234", "4321"], words)!]).toEqual([0, 1, 2, 3]);
    });

    test("パターン間で数字の対応が矛盾する場合は一致しない", () => {
      expect([...matchNankuroPatterns(["12ド", "12ダー"], ["あいド", "ういダー"])!]).toEqual([]);
    });

    test("ワイルドカードと文字クラスを複数パターンでも扱う", () => {
      const words = ["あいうド", "あいダー", "かきくド", "かきダー"];
      expect([...matchNankuroPatterns(["1*ド", "1[いき]ダー"], words)!]).toEqual([0, 1, 2, 3]);
    });

    test("可変長数字と+の省略を複数パターンでも共有する", () => {
      const words = ["ざわざわ", "ざわ", "しんしん", "しん"];
      expect([...(matchNankuroPatterns(["1+1+", "1"], words) ?? [])]).toEqual([0, 1, 2, 3]);
    });

    test("複数パターンでも最初の数字より前に+を省略できない", () => {
      expect(matchNankuroPatterns(["11+", "1+1"], ["ざわざわ"])).toBeNull();
    });
  });

  describe("matchAnagram", () => {
    test("既存のアナグラム検索も維持する", () => {
      expect(matchAnagram("あ.", "あい")).toBe(true);
      expect(matchAnagram("あ.", "いあ")).toBe(true);
      expect(matchAnagram("あ.", "あいう")).toBe(false);
    });

    test("文字クラスの数量を指定でき、同じ文字は重複して選ばない", () => {
      expect(matchAnagram("[あいうえお]{3}", "うあい")).toBe(true);
      expect(matchAnagram("[あいうえお]{3}", "ああい")).toBe(false);
      expect(matchAnagram("[あいうえお]{3}", "あいうえ")).toBe(false);
    });

    test("数量の範囲、上限のみ、下限のみを指定できる", () => {
      expect(matchAnagram("[あいうえお]{2,4}", "あい")).toBe(true);
      expect(matchAnagram("[あいうえお]{2,4}", "あいうえ")).toBe(true);
      expect(matchAnagram("[あいうえお]{2,4}", "あ")).toBe(false);
      expect(matchAnagram("[あいうえお]{,4}", "")).toBe(true);
      expect(matchAnagram("[あいうえお]{,4}", "あいうえお")).toBe(false);
      expect(matchAnagram("[あいうえお]{2,}", "あいうえお")).toBe(true);
      expect(matchAnagram("[あいうえお]{2,}", "あ")).toBe(false);
    });
  });
});