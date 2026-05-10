export interface Category {
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
    };

type OrderCondition = {
  type: "order";
  left: ArithmeticExpression;
  right: ArithmeticExpression;
  operator: "<" | ">" | "<=" | ">=";
};

type Condition = MembershipEqualityCondition | ComparableEqualityCondition | OrderCondition;

export interface ParsedPuzzle {
  categories: Category[];
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

const IDENTIFIER_FORBIDDEN_PATTERN = /[.,\[\]\s]/;

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
  valueHits: Map<string, number[]>
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

    let token = "";
    while (index < text.length) {
      const current = peek();
      if (current === "+" || current === "-" || current === "*" || current === "/") {
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
  const rawConditions: RawConditionLine[] = [];

  lines.forEach((rawLine, index) => {
    const line = index + 1;
    const text = normalizeLine(rawLine);
    if (!text) {
      return;
    }

    const categoryMatch = text.match(/^([^\[\],.]+)\[(.*)\]$/);
    if (categoryMatch) {
      const categoryName = categoryMatch[1];
      const valuesText = categoryMatch[2];

      assertIdentifier("カテゴリ名", categoryName, line);

      const values = valuesText === "" ? [] : valuesText.split(",");
      values.forEach((value) => assertIdentifier("値名", value, line));

      rawCategories.push({ line, name: categoryName, values });
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
  });

  const valueIndexByCategory = categories.map((category) => {
    const map = new Map<string, number>();
    category.values.forEach((value, i) => map.set(value, i));
    return map;
  });

  const valueHits = buildValueHitMap(categories);

  const conditions: Condition[] = rawConditions.map(({ line, text }) => {
    const orderOperator = ["<=", ">=", "<", ">"].find((op) => text.includes(op));
    if (orderOperator) {
      const parts = text.split(orderOperator);
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new Error(`L${line}: 不等号条件の形式が不正です: ${text}`);
      }

      return {
        type: "order",
        left: parseArithmeticExpression(parts[0], line, categories, categoryIndexByName, valueIndexByCategory, valueHits),
        right: parseArithmeticExpression(parts[1], line, categories, categoryIndexByName, valueIndexByCategory, valueHits),
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

    const hasArithmeticSyntax = /[+\-*/]/.test(parts[0]) || rightTokens.some((token) => /[+\-*/]/.test(token));

    if (!hasArithmeticSyntax) {
      const leftOperand = parseEqualityOperand(parts[0], line, categories, categoryIndexByName, valueIndexByCategory, valueHits);
      const rightOperands = rightTokens.map((token) =>
        parseEqualityOperand(token, line, categories, categoryIndexByName, valueIndexByCategory, valueHits)
      );
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
      left: parseArithmeticExpression(parts[0], line, categories, categoryIndexByName, valueIndexByCategory, valueHits),
      right: rightTokens.map((token) =>
        parseArithmeticExpression(token, line, categories, categoryIndexByName, valueIndexByCategory, valueHits)
      ),
      operator: equalityOperator,
    } as ComparableEqualityCondition;
  });

  return { categories, conditions, warnings };
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

const materializeSolution = (categories: Category[], permutationByCategory: number[][]): string[][] => {
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
  const { categories, conditions, warnings } = parsed;

  const categoryCount = categories.length;
  const entityCount = categories[0].values.length;

  const permutationByCategory: number[][] = Array.from({ length: categoryCount }, () => []);
  const inverseByCategory: number[][] = Array.from({ length: categoryCount }, () => []);
  const assigned = new Array<boolean>(categoryCount).fill(false);

  permutationByCategory[0] = Array.from({ length: entityCount }, (_, i) => i);
  inverseByCategory[0] = Array.from({ length: entityCount }, (_, i) => i);
  assigned[0] = true;

  const solutions: string[][][] = [];
  let hasMore = false;

  const assignCategory = (categoryIndex: number) => {
    if (hasMore) {
      return;
    }

    if (categoryIndex >= categoryCount) {
      if (isPartialConsistent(conditions, assigned, permutationByCategory, inverseByCategory, categories)) {
        solutions.push(materializeSolution(categories, permutationByCategory));
        if (solutions.length >= maxSolutions) {
          hasMore = true;
        }
      }
      return;
    }

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
