export interface Category {
  name: string;
  values: string[];
}

export interface Tag {
  name: string;
  values: string[];
}

export interface ResolvedRef {
  categoryIndex: number;
  valueIndex: number;
}

export interface ParseWarning {
  line: number;
  message: string;
}

type MembershipEqualityCondition = {
  type: "eq-membership";
  left: ResolvedRef;
  right: ResolvedRef[];
  operator: "=" | "!=";
};

type ComparableEqualityCondition = {
  type: "eq-compare";
  left: ArithmeticExpression;
  right: ArithmeticExpression[];
  operator: "=" | "!=";
};

type EqualityOperand =
  | {
      kind: "ref";
      ref: ResolvedRef;
    }
  | {
      kind: "projected";
      base: ResolvedRef;
      compareCategoryIndex: number;
    };

type ArithmeticExpression =
  | {
      type: "number";
      value: number;
    }
  | {
      type: "operand";
      operand: EqualityOperand;
    }
  | {
      type: "unary";
      operator: "+" | "-";
      operand: ArithmeticExpression;
    }
  | {
      type: "binary";
      operator: "+" | "-" | "*" | "/";
      left: ArithmeticExpression;
      right: ArithmeticExpression;
    }
  | {
      type: "tag-len";
      tagIndex: number;
      valueIndex: number; // カウント対象の値インデックス
    };

type OrderCondition = {
  type: "order";
  left: ArithmeticExpression;
  right: ArithmeticExpression;
  operator: "<" | ">" | "<=" | ">=";
};

type AtomicCondition = MembershipEqualityCondition | ComparableEqualityCondition | OrderCondition;

type LogicCondition = {
  type: "logic";
  operator: "&" | "|" | "^" | ":" | "->";
  left: Condition;
  right: Condition;
};

type Condition = AtomicCondition | LogicCondition;

export interface ParsedPuzzle {
  categories: Category[];
  realCategoryCount: number;
  tags: Tag[];
  conditions: Condition[];
  warnings: ParseWarning[];
}

export interface SolveResult {
  categories: Category[];
  warnings: ParseWarning[];
  solutions: string[][][];
  hasMore: boolean;
}

interface RawRef {
  categoryName?: string;
  valueName: string;
}

interface RawConditionLine {
  line: number;
  text: string;
}

type ConditionToken =
  | {
      kind: "atom";
      text: string;
    }
  | {
      kind: "operator";
      text: "&" | "|" | "^" | ":" | "->";
    };

const IDENTIFIER_FORBIDDEN_PATTERN = /[.,\[\]()\s]/;

const normalizeLine = (line: string): string => line.replace(/#.*$/, "").replace(/[ \t]/g, "").trim();

const toComparableNumber = (value: string, index: number): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : index + 1;
};

const assertIdentifier = (label: string, value: string, line: number) => {
  if (!value) {
    throw new Error(`L${line}: ${label}が空です`);
  }
  if (IDENTIFIER_FORBIDDEN_PATTERN.test(value)) {
    throw new Error(`L${line}: ${label}に使用できない文字が含まれています: ${value}`);
  }
};

const parseRefToken = (token: string, line: number): RawRef => {
  const parts = token.split(".");
  if (parts.length === 1) {
    assertIdentifier("値名", parts[0], line);
    return { valueName: parts[0] };
  }
  if (parts.length === 2) {
    assertIdentifier("カテゴリ名", parts[0], line);
    assertIdentifier("値名", parts[1], line);
    return { categoryName: parts[0], valueName: parts[1] };
  }
  throw new Error(`L${line}: 参照の形式が不正です: ${token}`);
};

const buildValueHitMap = (categories: Category[]): Map<string, number[]> => {
  const hits = new Map<string, number[]>();
  categories.forEach((category, categoryIndex) => {
    category.values.forEach((value) => {
      const list = hits.get(value) ?? [];
      list.push(categoryIndex);
      hits.set(value, list);
    });
  });
  return hits;
};

const resolveRef = (
  raw: RawRef,
  line: number,
  categoryIndexByName: Map<string, number>,
  valueIndexByCategory: Array<Map<string, number>>,
  valueHits: Map<string, number[]>
): ResolvedRef => {
  if (raw.categoryName) {
    const categoryIndex = categoryIndexByName.get(raw.categoryName);
    if (categoryIndex === undefined) {
      throw new Error(`L${line}: 未定義カテゴリです: ${raw.categoryName}`);
    }
    const valueIndex = valueIndexByCategory[categoryIndex].get(raw.valueName);
    if (valueIndex === undefined) {
      throw new Error(`L${line}: カテゴリ${raw.categoryName}に値${raw.valueName}は存在しません`);
    }
    return { categoryIndex, valueIndex };
  }

  const hitCategories = valueHits.get(raw.valueName) ?? [];
  if (hitCategories.length === 0) {
    throw new Error(`L${line}: 値${raw.valueName}を解決できません`);
  }
  if (hitCategories.length >= 2) {
    throw new Error(`L${line}: 値${raw.valueName}は複数カテゴリに存在するため曖昧です`);
  }

  const categoryIndex = hitCategories[0];
  const valueIndex = valueIndexByCategory[categoryIndex].get(raw.valueName);
  if (valueIndex === undefined) {
    throw new Error(`L${line}: 値${raw.valueName}の解決に失敗しました`);
  }
  return { categoryIndex, valueIndex };
};

const tryResolveExplicitRefToken = (
  token: string,
  categoryIndexByName: Map<string, number>,
  valueIndexByCategory: Array<Map<string, number>>
): ResolvedRef | null => {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const categoryIndex = categoryIndexByName.get(parts[0]);
  if (categoryIndex === undefined) {
    return null;
  }

  const valueIndex = valueIndexByCategory[categoryIndex].get(parts[1]);
  if (valueIndex === undefined) {
    return null;
  }

  return { categoryIndex, valueIndex };
};

const tokenizeConditionExpression = (text: string, line: number): ConditionToken[] => {
  const tokens: ConditionToken[] = [];
  let current = "";
  let depth = 0;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];

    if (char === "(") {
      depth++;
      current += char;
      continue;
    }

    if (char === ")") {
      depth--;
      if (depth < 0) {
        throw new Error(`L${line}: 括弧の対応が不正です: ${text}`);
      }
      current += char;
      continue;
    }

    if (depth === 0 && char === "-" && text[index + 1] === ">") {
      if (!current) {
        throw new Error(`L${line}: 条件式の形式が不正です: ${text}`);
      }
      tokens.push({ kind: "atom", text: current });
      tokens.push({ kind: "operator", text: "->" });
      current = "";
      index++; // '>' をスキップ
      continue;
    }

    if (depth === 0 && char === ":") {
      if (!current) {
        throw new Error(`L${line}: 条件式の形式が不正です: ${text}`);
      }
      tokens.push({ kind: "atom", text: current });
      tokens.push({ kind: "operator", text: ":" });
      current = "";
      continue;
    }

    if (depth === 0 && (char === "&" || char === "|" || char === "^")) {
      if (!current) {
        throw new Error(`L${line}: 条件式の形式が不正です: ${text}`);
      }
      tokens.push({ kind: "atom", text: current });
      tokens.push({ kind: "operator", text: char });
      current = "";
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push({ kind: "atom", text: current });
  }

  if (depth !== 0) {
    throw new Error(`L${line}: 括弧の対応が不正です: ${text}`);
  }

  if (tokens.length === 0) {
    throw new Error(`L${line}: 条件式が空です`);
  }

  if (tokens[0].kind === "operator" || tokens[tokens.length - 1].kind === "operator") {
    throw new Error(`L${line}: 条件式の形式が不正です: ${text}`);
  }

  for (let index = 1; index < tokens.length; index += 2) {
    const operator = tokens[index];
    const right = tokens[index + 1];
    if (!operator || operator.kind !== "operator" || !right || right.kind !== "atom") {
      throw new Error(`L${line}: 条件式の形式が不正です: ${text}`);
    }
  }

  return tokens;
};

const unwrapGroupedCondition = (text: string, line: number): string | null => {
  if (text.length < 2 || text[0] !== "(" || text[text.length - 1] !== ")") {
    return null;
  }

  let depth = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === "(") {
      depth++;
    } else if (char === ")") {
      depth--;
      if (depth < 0) {
        throw new Error(`L${line}: 括弧の対応が不正です: ${text}`);
      }
      if (depth === 0 && index !== text.length - 1) {
        return null;
      }
    }
  }

  if (depth !== 0) {
    throw new Error(`L${line}: 括弧の対応が不正です: ${text}`);
  }

  return text.slice(1, -1);
};

const inferComparableCategoryIndex = (expression: ArithmeticExpression): number | null => {
  if (expression.type === "operand") {
    if (expression.operand.kind === "projected") {
      return expression.operand.compareCategoryIndex;
    }
    return expression.operand.ref.categoryIndex;
  }

  // 四則演算や数値リテラル等は any 扱い（カテゴリ整合チェック対象外）
  return null;
};

const parseAtomicCondition = (
  text: string,
  line: number,
  categories: Category[],
  categoryIndexByName: Map<string, number>,
  valueIndexByCategory: Array<Map<string, number>>,
  valueHits: Map<string, number[]>,
  tagIndexByName: Map<string, number> = new Map()
): AtomicCondition => {
  const orderOperator = ["<=", ">=", "<", ">"].find((op) => text.includes(op));
  if (orderOperator) {
    const parts = text.split(orderOperator);
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error(`L${line}: 不等号条件の形式が不正です: ${text}`);
    }

    const leftExpression = parseArithmeticExpression(
      parts[0],
      line,
      categories,
      categoryIndexByName,
      valueIndexByCategory,
      valueHits,
      tagIndexByName
    );
    const rightExpression = parseArithmeticExpression(
      parts[1],
      line,
      categories,
      categoryIndexByName,
      valueIndexByCategory,
      valueHits,
      tagIndexByName
    );

    const leftCategoryIndex = inferComparableCategoryIndex(leftExpression);
    const rightCategoryIndex = inferComparableCategoryIndex(rightExpression);
    if (
      leftCategoryIndex !== null &&
      rightCategoryIndex !== null &&
      leftCategoryIndex !== rightCategoryIndex
    ) {
      throw new Error(`L${line}: 不等号条件の左右は同一カテゴリ（または同一タグ）である必要があります`);
    }

    return {
      type: "order",
      left: leftExpression,
      right: rightExpression,
      operator: orderOperator,
    } as OrderCondition;
  }

  const equalityOperator = text.includes("!=") ? "!=" : text.includes("=") ? "=" : null;
  if (!equalityOperator) {
    throw new Error(`L${line}: 条件式の演算子が不正です: ${text}`);
  }

  const parts = text.split(equalityOperator);
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`L${line}: 等号条件の形式が不正です: ${text}`);
  }

  const rightTokens = parts[1].split(",");
  if (rightTokens.some((token) => token.length === 0)) {
    throw new Error(`L${line}: 右辺リストの形式が不正です: ${parts[1]}`);
  }

  const hasArithmeticSyntax =
    /[()+\-*/]/.test(parts[0]) ||
    rightTokens.some((token) => /[()+\-*/]/.test(token)) ||
    parts[0].endsWith(".len") ||
    rightTokens.some((token) => token.endsWith(".len"));

  if (!hasArithmeticSyntax) {
    const leftOperand = parseEqualityOperand(parts[0], line, categories, categoryIndexByName, valueIndexByCategory, valueHits);
    const rightOperands = rightTokens.map((token) =>
      parseEqualityOperand(token, line, categories, categoryIndexByName, valueIndexByCategory, valueHits)
    );

    if (rightOperands.length >= 2 && rightOperands.every((operand) => operand.kind === "ref")) {
      const rightCategory = rightOperands[0].ref.categoryIndex;
      const mixedCategory = rightOperands.some((operand) => operand.ref.categoryIndex !== rightCategory);
      if (mixedCategory) {
        throw new Error(`L${line}: 右辺リストの値は同一カテゴリで指定してください`);
      }
    }

    const hasProjectedOperand = leftOperand.kind === "projected" || rightOperands.some((operand) => operand.kind === "projected");

    if (!hasProjectedOperand) {
      if (leftOperand.kind !== "ref") {
        throw new Error(`L${line}: 等号条件の左辺の形式が不正です`);
      }

      return {
        type: "eq-membership",
        left: leftOperand.ref,
        right: rightOperands.map((operand) => {
          if (operand.kind !== "ref") {
            throw new Error(`L${line}: 同一セット比較では射影構文を使用できません`);
          }
          return operand.ref;
        }),
        operator: equalityOperator,
      } as MembershipEqualityCondition;
    }
  }

  return {
    type: "eq-compare",
    left: parseArithmeticExpression(parts[0], line, categories, categoryIndexByName, valueIndexByCategory, valueHits, tagIndexByName),
    right: rightTokens.map((token) =>
      parseArithmeticExpression(token, line, categories, categoryIndexByName, valueIndexByCategory, valueHits, tagIndexByName)
    ),
    operator: equalityOperator,
  } as ComparableEqualityCondition;
};

const parseConditionExpression = (
  text: string,
  line: number,
  categories: Category[],
  categoryIndexByName: Map<string, number>,
  valueIndexByCategory: Array<Map<string, number>>,
  valueHits: Map<string, number[]>,
  tagIndexByName: Map<string, number> = new Map()
): Condition => {
  const tokens = tokenizeConditionExpression(text, line);
  let position = 0;

  const peek = () => tokens[position];
  const consume = () => tokens[position++];

  const parseAtom = (): Condition => {
    const token = consume();
    if (!token || token.kind !== "atom") {
      throw new Error(`L${line}: 条件式の形式が不正です: ${text}`);
    }

    const groupedText = unwrapGroupedCondition(token.text, line);
    if (groupedText !== null) {
      if (!groupedText) {
        throw new Error(`L${line}: 条件式の形式が不正です: ${text}`);
      }
      return parseConditionExpression(groupedText, line, categories, categoryIndexByName, valueIndexByCategory, valueHits, tagIndexByName);
    }

    return parseAtomicCondition(token.text, line, categories, categoryIndexByName, valueIndexByCategory, valueHits, tagIndexByName);
  };

  const parseAnd = (): Condition => {
    let expr = parseAtom();
    while (peek()?.kind === "operator" && peek().text === "&") {
      consume();
      expr = { type: "logic", operator: "&", left: expr, right: parseAtom() };
    }
    return expr;
  };

  const parseXor = (): Condition => {
    let expr = parseAnd();
    while (peek()?.kind === "operator" && (peek().text === "^" || peek().text === ":" || peek().text === "->")) {
      const operator = consume().text as "^" | ":" | "->";
      expr = { type: "logic", operator, left: expr, right: parseAnd() };
    }
    return expr;
  };

  const parseOr = (): Condition => {
    let expr = parseXor();
    while (peek()?.kind === "operator" && peek().text === "|") {
      consume();
      expr = { type: "logic", operator: "|", left: expr, right: parseXor() };
    }
    return expr;
  };

  const condition = parseOr();
  if (position !== tokens.length) {
    throw new Error(`L${line}: 条件式の形式が不正です: ${text}`);
  }
  return condition;
};

const parseEqualityOperand = (
  token: string,
  line: number,
  categories: Category[],
  categoryIndexByName: Map<string, number>,
  valueIndexByCategory: Array<Map<string, number>>,
  valueHits: Map<string, number[]>
): EqualityOperand => {
  const parts = token.split(".");

  if (parts.length === 1) {
    return {
      kind: "ref",
      ref: resolveRef(parseRefToken(token, line), line, categoryIndexByName, valueIndexByCategory, valueHits),
    };
  }

  if (parts.length === 2) {
    const explicitRef = tryResolveExplicitRefToken(token, categoryIndexByName, valueIndexByCategory);
    if (explicitRef) {
      return { kind: "ref", ref: explicitRef };
    }

    const compareCategoryIndex = categoryIndexByName.get(parts[1]);
    if (compareCategoryIndex === undefined) {
      throw new Error(`L${line}: 未定義カテゴリです: ${parts[1]}`);
    }

    return {
      kind: "projected",
      base: resolveRef(parseRefToken(parts[0], line), line, categoryIndexByName, valueIndexByCategory, valueHits),
      compareCategoryIndex,
    };
  }

  if (parts.length === 3) {
    const compareCategoryIndex = categoryIndexByName.get(parts[2]);
    if (compareCategoryIndex === undefined) {
      throw new Error(`L${line}: 比較カテゴリが未定義です: ${parts[2]}`);
    }

    return {
      kind: "projected",
      base: resolveRef(parseRefToken(`${parts[0]}.${parts[1]}`, line), line, categoryIndexByName, valueIndexByCategory, valueHits),
      compareCategoryIndex,
    };
  }

  throw new Error(`L${line}: 参照の形式が不正です: ${token}`);
};

const parseArithmeticExpression = (
  text: string,
  line: number,
  categories: Category[],
  categoryIndexByName: Map<string, number>,
  valueIndexByCategory: Array<Map<string, number>>,
  valueHits: Map<string, number[]>,
  tagIndexByName: Map<string, number> = new Map()
): ArithmeticExpression => {
  let index = 0;

  const peek = () => text[index];
  const consume = () => text[index++];

  const parsePrimary = (): ArithmeticExpression => {
    if (index >= text.length) {
      throw new Error(`L${line}: 算術式が不完全です: ${text}`);
    }

    const char = peek();
    if (char === "+" || char === "-") {
      consume();
      return { type: "unary", operator: char, operand: parsePrimary() };
    }

    if (char === "(") {
      consume();
      const expr = parseAdditive();
      if (peek() !== ")") {
        throw new Error(`L${line}: 算術式の括弧の対応が不正です: ${text}`);
      }
      consume();
      return expr;
    }

    let token = "";
    while (index < text.length) {
      const current = peek();
      if (current === "+" || current === "-" || current === "*" || current === "/" || current === ")") {
        break;
      }
      token += consume();
    }

    if (!token) {
      throw new Error(`L${line}: 算術式の項が不正です: ${text}`);
    }

    const numeric = Number(token);
    if (Number.isFinite(numeric)) {
      return { type: "number", value: numeric };
    }

    // タグの長さ制約 "タグ名.len" または "タグ名.値名.len" をチェック
    if (token.endsWith(".len")) {
      const withoutLen = token.slice(0, -4); // ".len" を除去
      // "タグ名.値名" の形式かチェック
      const dotIdx = withoutLen.lastIndexOf(".");
      if (dotIdx > 0) {
        const possibleTag = withoutLen.slice(0, dotIdx);
        const possibleValue = withoutLen.slice(dotIdx + 1);
        const tagIdx = tagIndexByName.get(possibleTag);
        if (tagIdx !== undefined) {
          const valIdx = valueIndexByCategory[tagIdx]?.get(possibleValue);
          if (valIdx !== undefined) {
            return { type: "tag-len", tagIndex: tagIdx, valueIndex: valIdx };
          }
        }
      }
      // "タグ名" のみの形式（値1=インデックス0を対象）
      const tagIndex = tagIndexByName.get(withoutLen);
      if (tagIndex !== undefined) {
        return { type: "tag-len", tagIndex, valueIndex: 0 };
      }
    }

    return {
      type: "operand",
      operand: parseEqualityOperand(token, line, categories, categoryIndexByName, valueIndexByCategory, valueHits),
    };
  };

  const parseMultiplicative = (): ArithmeticExpression => {
    let expr = parsePrimary();
    while (peek() === "*" || peek() === "/") {
      const operator = consume() as "*" | "/";
      expr = { type: "binary", operator, left: expr, right: parsePrimary() };
    }
    return expr;
  };

  const parseAdditive = (): ArithmeticExpression => {
    let expr = parseMultiplicative();
    while (peek() === "+" || peek() === "-") {
      const operator = consume() as "+" | "-";
      expr = { type: "binary", operator, left: expr, right: parseMultiplicative() };
    }
    return expr;
  };

  const expression = parseAdditive();
  if (index !== text.length) {
    throw new Error(`L${line}: 算術式を解釈できません: ${text}`);
  }
  return expression;
};

export const parsePuzzle = (input: string): ParsedPuzzle => {
  const lines = input.split(/\r?\n/);
  const rawCategories: Array<{ line: number; name: string; values: string[] }> = [];
  const rawTags: Array<{ line: number; name: string; values: string[] }> = [];
  const rawConditions: RawConditionLine[] = [];

  lines.forEach((rawLine, index) => {
    const line = index + 1;
    const text = normalizeLine(rawLine);
    if (!text) {
      return;
    }

    const categoryMatch = text.match(/^([^\[\]{},.]+)\[(.*)\]$/);
    if (categoryMatch) {
      const categoryName = categoryMatch[1];
      const valuesText = categoryMatch[2];

      assertIdentifier("カテゴリ名", categoryName, line);

      const values = valuesText === "" ? [] : valuesText.split(",");
      values.forEach((value) => assertIdentifier("値名", value, line));

      rawCategories.push({ line, name: categoryName, values });
      return;
    }

    const tagMatch = text.match(/^([^\[\]{},.]+)\{(.*)\}$/);
    if (tagMatch) {
      const tagName = tagMatch[1];
      const valuesText = tagMatch[2];

      assertIdentifier("タグ名", tagName, line);

      const values = valuesText === "" ? [] : valuesText.split(",");
      values.forEach((value) => assertIdentifier("値名", value, line));

      rawTags.push({ line, name: tagName, values });
      return;
    }

    rawConditions.push({ line, text });
  });

  if (rawCategories.length === 0) {
    throw new Error("カテゴリ定義が1つもありません");
  }

  const firstCount = rawCategories[0].values.length;
  if (firstCount === 0) {
    throw new Error(`L${rawCategories[0].line}: 最初のカテゴリの値数は1以上である必要があります`);
  }

  const categoryIndexByName = new Map<string, number>();
  const categories: Category[] = [];
  const valueIndexByCategory = categories.map((category) => {
    const map = new Map<string, number>();
    category.values.forEach((value, i) => map.set(value, i));
    return map;
  });
  const warnings: ParseWarning[] = [];

  rawCategories.forEach((rawCategory, idx) => {
    if (categoryIndexByName.has(rawCategory.name)) {
      throw new Error(`L${rawCategory.line}: カテゴリ名が重複しています: ${rawCategory.name}`);
    }

    let values = [...rawCategory.values];
    if (values.length === 0) {
      values = Array.from({ length: firstCount }, (_, i) => String(i + 1));
    }

    if (values.length !== firstCount) {
      throw new Error(`L${rawCategory.line}: 値数は${firstCount}個または0個である必要があります`);
    }

    const uniqueCheck = new Set(values);
    if (uniqueCheck.size !== values.length) {
      throw new Error(`L${rawCategory.line}: カテゴリ${rawCategory.name}内で値名が重複しています`);
    }

    const comparableNumbers = values.map((value, i) => toComparableNumber(value, i));
    const isAscending = comparableNumbers.every((value, i) => i === 0 || comparableNumbers[i - 1] <= value);
    if (!isAscending) {
      warnings.push({
        line: rawCategory.line,
        message: `カテゴリ${rawCategory.name}の比較値は昇順ではありません`,
      });
    }

    categoryIndexByName.set(rawCategory.name, idx);
    categories.push({ name: rawCategory.name, values });

    const map = new Map<string, number>();
    values.forEach((value, i) => map.set(value, i));
    valueIndexByCategory.push(map);
  });

  const tagIndexByName = new Map<string, number>();
  const tags: Tag[] = [];

  rawTags.forEach((rawTag, idx) => {
    if (tagIndexByName.has(rawTag.name)) {
      throw new Error(`L${rawTag.line}: タグ名が重複しています: ${rawTag.name}`);
    }

    let values = [...rawTag.values];
    if (values.length === 0) {
      values = ["true", "false"];
    }

    if (values.length < 2) {
      throw new Error(`L${rawTag.line}: タグ${rawTag.name}の値数は2個以上である必要があります`);
    }

    const uniqueCheck = new Set(values);
    if (uniqueCheck.size !== values.length) {
      throw new Error(`L${rawTag.line}: タグ${rawTag.name}内で値名が重複しています`);
    }

    tags.push({ name: rawTag.name, values });
  });

  // タグをカテゴリとして統合（参照解決用のみ、セット割り当ては除外）
  const realCategoryCount = categories.length;
  rawTags.forEach((rawTag, idx) => {
    if (!categoryIndexByName.has(rawTag.name)) {
      categoryIndexByName.set(rawTag.name, categories.length);
      categories.push({ name: rawTag.name, values: tags[idx].values });

      const map = new Map<string, number>();
      tags[idx].values.forEach((value, i) => map.set(value, i));
      valueIndexByCategory.push(map);
    }

    const tagCategoryIndex = categoryIndexByName.get(rawTag.name);
    if (tagCategoryIndex !== undefined) {
      tagIndexByName.set(rawTag.name, tagCategoryIndex);
    }
  });

  const valueHits = buildValueHitMap(categories);

  // 全称構文の展開: タグ名のみ（または !タグ名 を含む）の行を全エンティティ分に展開
  // 例: "犯人 -> !真" → ["A=犯人 -> A!=真", "B=犯人 -> B!=真", ...]
  const tagNameSet = new Set(tags.map((t) => t.name));
  const firstCategoryEntities = rawCategories[0].values;

  const expandedRawConditions: RawConditionLine[] = [];
  for (const rawCond of rawConditions) {
    // 全称構文の判定: 条件テキストにエンティティ名が含まれず、タグ名のみで構成されている
    // タグ名だけを使った式かどうかを確認するため、トークンを抽出
    // "タグ名" または "!タグ名" のみで構成されていれば全称展開対象
    const textNoSpace = rawCond.text.replace(/\s/g, "");

    // 全エンティティ名を取得して、それが含まれていないかチェック
    const entityNames = firstCategoryEntities;
    const hasEntity = entityNames.some((e) => {
      // エンティティ名が演算子や.でない文脈に現れるか
      const re = new RegExp(`(?<![\\w.])${e}(?![\\w.])`);
      return re.test(textNoSpace);
    });

    if (!hasEntity) {
      // 全称構文の可能性を検証: タグ名および !タグ名 のみで構成されているか
      // タグ名を正規表現で構築
      const tagNamesPattern = Array.from(tagNameSet)
        .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");
      const universalPattern = new RegExp(
        `^(!?(${tagNamesPattern}))([->&|^:()]|!?(${tagNamesPattern}))*$`
      );

      if (tagNamesPattern && universalPattern.test(textNoSpace)) {
        // 全エンティティに展開
        for (const entity of entityNames) {
          // タグ名 → entity=タグ名、!タグ名 → entity!=タグ名 に置換
          let expanded = rawCond.text;
          // まず !タグ名 を entity!=タグ名 に変換（!より先に処理）
          for (const tag of tags) {
            const escaped = tag.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            expanded = expanded.replace(
              new RegExp(`!${escaped}(?=[->&|^:()\\s]|$)`, "g"),
              `${entity}!=${tag.name}`
            );
          }
          // タグ名のみ → entity=タグ名 に変換
          for (const tag of tags) {
            const escaped = tag.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            expanded = expanded.replace(
              new RegExp(`(?<![!=])${escaped}(?=[->&|^:()\\s]|$)`, "g"),
              `${entity}=${tag.name}`
            );
          }
          expandedRawConditions.push({ line: rawCond.line, text: expanded });
        }
        continue;
      }
    }

    expandedRawConditions.push(rawCond);
  }

  const conditions: Condition[] = expandedRawConditions.map(({ line, text }) => {
    // 糖衣構文: 右辺がタグ名のみの場合、射影構文に展開
    let expandedText = text;
    for (const tag of tags) {
      // パターン: セット名(=|!=)タグ名 の形式を検出して、セット名.タグ名(=|!=)タグ名.値1に置換
      const pattern = new RegExp(`(\\w+)(=|!=)${tag.name}(?=[-:&,)|\\s]|$)`, "g");
      expandedText = expandedText.replace(pattern, `$1.${tag.name}$2${tag.name}.${tag.values[0]}`);
    }

    return parseConditionExpression(
      expandedText,
      line,
      categories,
      categoryIndexByName,
      valueIndexByCategory,
      valueHits,
      tagIndexByName
    );
  });

  return { categories, realCategoryCount, tags, conditions, warnings };
};

const compareByOperator = (left: number, right: number, op: "<" | ">" | "<=" | ">="): boolean => {
  if (op === "<") return left < right;
  if (op === ">") return left > right;
  if (op === "<=") return left <= right;
  return left >= right;
};

const evaluateCondition = (
  condition: Condition,
  assigned: boolean[],
  permutationByCategory: number[][],
  inverseByCategory: number[][],
  categories: Category[]
): boolean | null => {
  const getEntityOfRef = (ref: ResolvedRef): number | null => {
    if (!assigned[ref.categoryIndex]) {
      return null;
    }
    return inverseByCategory[ref.categoryIndex][ref.valueIndex] ?? null;
  };

  const getValueAt = (entityIndex: number, categoryIndex: number): number | null => {
    if (!assigned[categoryIndex]) {
      return null;
    }
    return permutationByCategory[categoryIndex][entityIndex] ?? null;
  };

  const getComparableValueAt = (entityIndex: number, categoryIndex: number): number | null => {
    const valueIndex = getValueAt(entityIndex, categoryIndex);
    if (valueIndex === null) {
      return null;
    }
    return toComparableNumber(categories[categoryIndex].values[valueIndex], valueIndex);
  };

  const getComparableValueFromRef = (ref: ResolvedRef): number => {
    return toComparableNumber(categories[ref.categoryIndex].values[ref.valueIndex], ref.valueIndex);
  };

  const getProjectedValue = (operand: EqualityOperand): number | null => {
    if (operand.kind === "projected") {
      const baseEntity = getEntityOfRef(operand.base);
      if (baseEntity === null) {
        return null;
      }
      return getComparableValueAt(baseEntity, operand.compareCategoryIndex);
    }

    return getComparableValueFromRef(operand.ref);
  };

  const evaluateArithmeticExpression = (expression: ArithmeticExpression): number | null => {
    if (expression.type === "number") {
      return expression.value;
    }

    if (expression.type === "operand") {
      return getProjectedValue(expression.operand);
    }

    if (expression.type === "tag-len") {
      if (!assigned[expression.tagIndex]) {
        return null;
      }
      let count = 0;
      for (let entity = 0; entity < permutationByCategory[expression.tagIndex].length; entity++) {
        if (permutationByCategory[expression.tagIndex][entity] === expression.valueIndex) {
          count++;
        }
      }
      return count;
    }

    if (expression.type === "unary") {
      const value = evaluateArithmeticExpression(expression.operand);
      if (value === null) {
        return null;
      }
      return expression.operator === "+" ? value : -value;
    }

    const leftValue = evaluateArithmeticExpression(expression.left);
    const rightValue = evaluateArithmeticExpression(expression.right);
    if (leftValue === null || rightValue === null) {
      return null;
    }

    if (expression.operator === "+") return leftValue + rightValue;
    if (expression.operator === "-") return leftValue - rightValue;
    if (expression.operator === "*") return leftValue * rightValue;
    return leftValue / rightValue;
  };

  if (condition.type === "logic") {
    const leftValue = evaluateCondition(condition.left, assigned, permutationByCategory, inverseByCategory, categories);

    if (condition.operator === "&") {
      if (leftValue === false) {
        return false;
      }

      const rightValue = evaluateCondition(condition.right, assigned, permutationByCategory, inverseByCategory, categories);
      if (leftValue === true) {
        return rightValue;
      }
      if (rightValue === false) {
        return false;
      }
      return null;
    }

    if (condition.operator === "|") {
      if (leftValue === true) {
        return true;
      }

      const rightValue = evaluateCondition(condition.right, assigned, permutationByCategory, inverseByCategory, categories);
      if (leftValue === false) {
        return rightValue;
      }
      if (rightValue === true) {
        return true;
      }
      return null;
    }

    const rightValue = evaluateCondition(condition.right, assigned, permutationByCategory, inverseByCategory, categories);
    if (leftValue === null || rightValue === null) {
      return null;
    }

    if (condition.operator === "->") {
      // A -> B は (!A) | B
      return leftValue === false ? true : rightValue;
    }
    const isEqual = leftValue === rightValue;
    return condition.operator === "^" ? !isEqual : isEqual;
  }

  if (condition.type === "eq-membership") {
    const leftEntity = getEntityOfRef(condition.left);
    if (leftEntity === null) {
      return null;
    }

    const matches: boolean[] = [];
    for (const rightOperand of condition.right) {
      const rightEntity = getEntityOfRef(rightOperand);
      if (rightEntity === null) {
        return null;
      }
      matches.push(leftEntity === rightEntity);
    }

    return condition.operator === "=" ? matches.some(Boolean) : matches.every((value) => !value);
  }

  if (condition.type === "eq-compare") {
    const leftValue = evaluateArithmeticExpression(condition.left);
    if (leftValue === null) {
      return null;
    }

    const matches: boolean[] = [];
    for (const rightOperand of condition.right) {
      const rightValue = evaluateArithmeticExpression(rightOperand);
      if (rightValue === null) {
        return null;
      }
      matches.push(leftValue === rightValue);
    }

    return condition.operator === "=" ? matches.some(Boolean) : matches.every((value) => !value);
  }

  const leftValue = evaluateArithmeticExpression(condition.left);
  if (leftValue === null) {
    return null;
  }

  const rightValue = evaluateArithmeticExpression(condition.right);
  if (rightValue === null) {
    return null;
  }

  return compareByOperator(leftValue, rightValue, condition.operator);
};

const isPartialConsistent = (
  conditions: Condition[],
  assigned: boolean[],
  permutationByCategory: number[][],
  inverseByCategory: number[][],
  categories: Category[]
): boolean => {
  for (const condition of conditions) {
    const state = evaluateCondition(condition, assigned, permutationByCategory, inverseByCategory, categories);
    if (state === false) {
      return false;
    }
  }
  return true;
};

const buildInversePermutation = (permutation: number[]): number[] => {
  const inverse = new Array<number>(permutation.length);
  permutation.forEach((valueIndex, entityIndex) => {
    inverse[valueIndex] = entityIndex;
  });
  return inverse;
};

const createPermutationGenerator = (size: number, callback: (permutation: number[]) => void) => {
  const used = new Array<boolean>(size).fill(false);
  const current = new Array<number>(size);

  const dfs = (depth: number) => {
    if (depth === size) {
      callback([...current]);
      return;
    }

    for (let value = 0; value < size; value++) {
      if (used[value]) {
        continue;
      }
      used[value] = true;
      current[depth] = value;
      dfs(depth + 1);
      used[value] = false;
    }
  };

  dfs(0);
};

const materializeSolution = (categories: Category[], permutationByCategory: number[][], realCategoryCount: number): string[][] => {
  const entityCount = categories[0].values.length;
  const rows: string[][] = [];

  for (let entity = 0; entity < entityCount; entity++) {
    const row: string[] = [];
    for (let category = 0; category < categories.length; category++) {
      const valueIndex = permutationByCategory[category][entity];
      row.push(categories[category].values[valueIndex]);
    }
    rows.push(row);
  }

  return rows;
};

export const solvePuzzle = (input: string, maxSolutions = 200): SolveResult => {
  const parsed = parsePuzzle(input);
  const { categories, realCategoryCount, conditions, warnings } = parsed;

  const allCategoryCount = categories.length;
  const realOnlyCategoryCount = realCategoryCount;
  const entityCount = categories[0].values.length;

  const permutationByCategory: number[][] = Array.from({ length: allCategoryCount }, () => []);
  const inverseByCategory: number[][] = Array.from({ length: allCategoryCount }, () => []);
  const assigned = new Array<boolean>(allCategoryCount).fill(false);

  permutationByCategory[0] = Array.from({ length: entityCount }, (_, i) => i);
  inverseByCategory[0] = Array.from({ length: entityCount }, (_, i) => i);
  assigned[0] = true;

  // タグに対しても inverseByCategory を初期化
  // ただし、複数 entity で同じタグ値を共有するため、その値を持つ最初のentityを記録
  for (let tagIdx = realOnlyCategoryCount; tagIdx < allCategoryCount; tagIdx++) {
    const valueCount = categories[tagIdx].values.length;
    inverseByCategory[tagIdx] = new Array(valueCount).fill(-1);
  }

  const solutions: string[][][] = [];
  let hasMore = false;

  const assignCategory = (categoryIndex: number) => {
    if (hasMore) {
      return;
    }

    if (categoryIndex >= allCategoryCount) {
      // 全カテゴリが割り当てられた：条件評価を行う
      if (isPartialConsistent(conditions, assigned, permutationByCategory, inverseByCategory, categories)) {
        solutions.push(materializeSolution(categories, permutationByCategory, realOnlyCategoryCount));
        if (solutions.length >= maxSolutions) {
          hasMore = true;
        }
      }
      return;
    }

    if (categoryIndex >= realOnlyCategoryCount) {
      // タグ部分：複数の値を試す（各 entity ごとに独立して）
      const valueCount = categories[categoryIndex].values.length;

      // タグの全 entity での値の組み合わせを試す
      const tagPermutations = Array.from({ length: Math.pow(valueCount, entityCount) }, (_, idx) => {
        const perm: number[] = [];
        let remaining = idx;
        for (let e = 0; e < entityCount; e++) {
          perm.push(remaining % valueCount);
          remaining = Math.floor(remaining / valueCount);
        }
        return perm;
      });

      for (const perm of tagPermutations) {
        if (hasMore) {
          break;
        }

        permutationByCategory[categoryIndex] = perm;
        assigned[categoryIndex] = true;

        // タグ値の逆転換を更新
        // 複数 entity で同じタグ値を共有するため、その値を持つ最初のentityを記録
        for (let valueIdx = 0; valueIdx < valueCount; valueIdx++) {
          inverseByCategory[categoryIndex][valueIdx] = -1;
        }
        for (let entity = 0; entity < entityCount; entity++) {
          const valueIndex = perm[entity];
          if (inverseByCategory[categoryIndex][valueIndex] === -1) {
            inverseByCategory[categoryIndex][valueIndex] = entity;
          }
        }

        if (isPartialConsistent(conditions, assigned, permutationByCategory, inverseByCategory, categories)) {
          assignCategory(categoryIndex + 1);
        }

        assigned[categoryIndex] = false;
        permutationByCategory[categoryIndex] = [];
      }
      return;
    }

    // 実カテゴリ部分
    createPermutationGenerator(entityCount, (permutation) => {
      if (hasMore) {
        return;
      }

      permutationByCategory[categoryIndex] = permutation;
      inverseByCategory[categoryIndex] = buildInversePermutation(permutation);
      assigned[categoryIndex] = true;

      if (isPartialConsistent(conditions, assigned, permutationByCategory, inverseByCategory, categories)) {
        assignCategory(categoryIndex + 1);
      }

      assigned[categoryIndex] = false;
      permutationByCategory[categoryIndex] = [];
      inverseByCategory[categoryIndex] = [];
    });
  };

  assignCategory(1);

  return {
    categories,
    warnings,
    solutions,
    hasMore,
  };
};
