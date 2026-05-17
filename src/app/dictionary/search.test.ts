import { buildNankuroRegex, matchAnagram, matchNankuro } from "./search";

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

    test("不正なパターンでもクラッシュしない", () => {
      expect(buildNankuroRegex("[")).not.toBeNull();
      expect(matchNankuro("[", "[")) .toBe(true);
    });
  });

  describe("matchAnagram", () => {
    test("既存のアナグラム検索も維持する", () => {
      expect(matchAnagram("あ.", "あい")).toBe(true);
      expect(matchAnagram("あ.", "いあ")).toBe(true);
      expect(matchAnagram("あ.", "あいう")).toBe(false);
    });
  });
});