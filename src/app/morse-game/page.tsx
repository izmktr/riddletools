"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Screen = "setup" | "game" | "result";
type WordMode = "single" | "word" | "ikki";
type AnswerMode = "text" | "choice";
type Wpm = 5 | 12 | 20 | 30;
type IkkiQuestionType = "add" | "review";
type AnswerFeedback = "correct" | "wrong" | null;

type DisplaySetting = {
  symbol: boolean;
  sound: boolean;
  light: boolean;
};

type Step = {
  type: "on" | "off";
  durationMs: number;
  letterIndex: number;
  symbolIndex: number;
};

type AnswerRecord = {
  questionNo: number;
  question: string;
  answer: string;
  correct: boolean;
};

type IkkiQuestion = {
  correct: string;
  choices: string[];
  type: IkkiQuestionType;
};

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const TOTAL_QUESTIONS = 10;

const MORSE_MAP: Record<string, string> = {
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
};

const ALPHABET = Object.keys(MORSE_MAP);

function toDisplayMorse(code: string): string {
  return code.replace(/\./g, "・").replace(/-/g, "ー");
}

function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase();
}

function parseEnglishWords(csvText: string): string[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");

  return lines
    .slice(1)
    .map((line) => line.replace(/^"|"$/g, ""))
    .filter((word) => /^[A-Za-z]{3,}$/.test(word));
}

function randomFactor(enableJitter: boolean): number {
  if (!enableJitter) {
    return 1;
  }
  return 0.85 + Math.random() * 0.3;
}

function shuffleArray<T>(values: T[]): T[] {
  const next = [...values];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) {
    return Number.POSITIVE_INFINITY;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      diff += 1;
    }
  }
  return diff;
}

function pickClosestWord(base: string, candidates: string[], used: Set<string>): string | null {
  const available = candidates.filter((word) => !used.has(word));
  if (!available.length) {
    return null;
  }

  let minDistance = Number.POSITIVE_INFINITY;
  const nearest: string[] = [];

  available.forEach((candidate) => {
    const distance = hammingDistance(base, candidate);
    if (distance < minDistance) {
      minDistance = distance;
      nearest.length = 0;
      nearest.push(candidate);
      return;
    }
    if (distance === minDistance) {
      nearest.push(candidate);
    }
  });

  if (!nearest.length) {
    return null;
  }
  return nearest[Math.floor(Math.random() * nearest.length)];
}

function createSingleChoices(answer: string): string[] {
  const wrongChoices = shuffleArray(ALPHABET.filter((letter) => letter !== answer)).slice(0, 3);
  return shuffleArray([answer, ...wrongChoices]);
}

function createWordChoices(answer: string, dictionary: string[]): string[] {
  const normalizedAnswer = answer.toUpperCase();
  const sameLengthWords = dictionary
    .map((word) => word.toUpperCase())
    .filter((word) => word.length === normalizedAnswer.length && word !== normalizedAnswer);

  const used = new Set<string>([normalizedAnswer]);
  const wrongChoices: string[] = [];

  const firstPattern = Math.random() < 0.5;
  if (firstPattern) {
    const wrong1 = pickClosestWord(normalizedAnswer, sameLengthWords, used);
    if (wrong1) {
      wrongChoices.push(wrong1);
      used.add(wrong1);
    }

    const wrong2 = wrong1 ? pickClosestWord(wrong1, sameLengthWords, used) : null;
    if (wrong2) {
      wrongChoices.push(wrong2);
      used.add(wrong2);
    }

    const wrong3 = wrong2 ? pickClosestWord(wrong2, sameLengthWords, used) : null;
    if (wrong3) {
      wrongChoices.push(wrong3);
      used.add(wrong3);
    }
  } else {
    const wrong1 = pickClosestWord(normalizedAnswer, sameLengthWords, used);
    if (wrong1) {
      wrongChoices.push(wrong1);
      used.add(wrong1);
    }

    const wrong2 = pickClosestWord(normalizedAnswer, sameLengthWords, used);
    if (wrong2) {
      wrongChoices.push(wrong2);
      used.add(wrong2);
    }

    const wrong3Source = wrong1 ?? wrong2 ?? normalizedAnswer;
    const wrong3 = pickClosestWord(wrong3Source, sameLengthWords, used);
    if (wrong3) {
      wrongChoices.push(wrong3);
      used.add(wrong3);
    }
  }

  if (wrongChoices.length < 3) {
    const fillChoices = shuffleArray(sameLengthWords.filter((word) => !used.has(word))).slice(0, 3 - wrongChoices.length);
    fillChoices.forEach((word) => {
      wrongChoices.push(word);
      used.add(word);
    });
  }

  return shuffleArray([normalizedAnswer, ...wrongChoices]).slice(0, 4);
}

function pickRandom<T>(values: T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}

function createIkkiQuestion(
  learnedList: string[],
  unlearnedList: string[],
  lastType: IkkiQuestionType | null,
): { question: IkkiQuestion; learnedList: string[]; unlearnedList: string[] } | null {
  let nextLearned = [...learnedList];
  let nextUnlearned = [...unlearnedList];

  let questionType: IkkiQuestionType;
  if (nextLearned.length <= 4) {
    questionType = "add";
  } else if (nextLearned.length <= 25) {
    questionType = lastType === "add" ? "review" : "add";
  } else {
    questionType = "review";
  }

  if (questionType === "add") {
    if (!nextUnlearned.length) {
      return null;
    }

    const correct = pickRandom(nextUnlearned);
    nextUnlearned = nextUnlearned.filter((letter) => letter !== correct);
    nextLearned = [...nextLearned, correct];

    const wrongChoices = shuffleArray(nextLearned.filter((letter) => letter !== correct)).slice(0, 3);
    const realChoices = shuffleArray([correct, ...wrongChoices]);
    const blankChoices = Array.from({ length: Math.max(0, 4 - realChoices.length) }, () => "");

    return {
      question: {
        correct,
        choices: [...realChoices, ...blankChoices],
        type: questionType,
      },
      learnedList: nextLearned,
      unlearnedList: nextUnlearned,
    };
  }

  if (!nextLearned.length) {
    return null;
  }

  const correct = pickRandom(nextLearned);
  const wrongChoices = shuffleArray(nextLearned.filter((letter) => letter !== correct)).slice(0, 3);
  const realChoices = shuffleArray([correct, ...wrongChoices]);
  const blankChoices = Array.from({ length: Math.max(0, 4 - realChoices.length) }, () => "");

  return {
    question: {
      correct,
      choices: [...realChoices, ...blankChoices],
      type: questionType,
    },
    learnedList: nextLearned,
    unlearnedList: nextUnlearned,
  };
}

export default function MorsePage() {
  const [screen, setScreen] = useState<Screen>("setup");

  const [displaySetting, setDisplaySetting] = useState<DisplaySetting>({
    symbol: true,
    sound: true,
    light: false,
  });
  const [wordMode, setWordMode] = useState<WordMode>("single");
  const [answerMode, setAnswerMode] = useState<AnswerMode>("choice");
  const [wpm, setWpm] = useState<Wpm>(12);
  const [jitter, setJitter] = useState(false);

  const [englishWords, setEnglishWords] = useState<string[]>([]);
  const [wordLoadError, setWordLoadError] = useState<string | null>(null);

  const [questions, setQuestions] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerText, setAnswerText] = useState("");
  const [records, setRecords] = useState<AnswerRecord[]>([]);

  const [ikkiLearned, setIkkiLearned] = useState<string[]>([]);
  const [ikkiUnlearned, setIkkiUnlearned] = useState<string[]>([]);
  const [ikkiCurrentQuestion, setIkkiCurrentQuestion] = useState<IkkiQuestion | null>(null);
  const [ikkiConsecutiveCorrect, setIkkiConsecutiveCorrect] = useState(0);
  const [ikkiWrongCounts, setIkkiWrongCounts] = useState<Record<string, number>>({});
  const [ikkiWrongTotal, setIkkiWrongTotal] = useState(0);

  const [answerFeedback, setAnswerFeedback] = useState<AnswerFeedback>(null);
  const [answerLocked, setAnswerLocked] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSymbolKey, setActiveSymbolKey] = useState<string | null>(null);
  const [lightOn, setLightOn] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackTimeoutRef = useRef<number[]>([]);
  const answerTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let aborted = false;

    fetch(`${BASE_PATH}/dic/chugaku_english.csv`)
      .then(async (res) => {
        const text = await res.text();
        if (!res.ok) {
          throw new Error(`${res.status} ${res.statusText}`);
        }
        if (aborted) {
          return;
        }
        const words = parseEnglishWords(text);
        setEnglishWords(words);
        setWordLoadError(words.length === 0 ? "英単語辞書が空です" : null);
      })
      .catch((e) => {
        if (aborted) {
          return;
        }
        setWordLoadError(`英単語辞書の読み込みに失敗しました: ${e instanceof Error ? e.message : String(e)}`);
      });

    return () => {
      aborted = true;
    };
  }, []);

  const clearPlayback = useCallback(() => {
    playbackTimeoutRef.current.forEach((id) => window.clearTimeout(id));
    playbackTimeoutRef.current = [];
    setIsPlaying(false);
    setActiveSymbolKey(null);
    setLightOn(false);
  }, []);

  const clearAnswerTimeout = useCallback(() => {
    if (answerTimeoutRef.current !== null) {
      window.clearTimeout(answerTimeoutRef.current);
      answerTimeoutRef.current = null;
    }
    setAnswerFeedback(null);
    setAnswerLocked(false);
  }, []);

  useEffect(() => {
    return () => {
      clearPlayback();
      clearAnswerTimeout();
    };
  }, [clearAnswerTimeout, clearPlayback]);

  const currentQuestion = wordMode === "ikki" ? (ikkiCurrentQuestion?.correct ?? "") : (questions[currentIndex] ?? "");
  const effectiveAnswerMode: AnswerMode = wordMode === "ikki" ? "choice" : answerMode;

  const validWordList = useMemo(() => {
    return englishWords.filter((word) => {
      const len = word.length;
      return len >= 4 && len <= 8;
    });
  }, [englishWords]);

  const playableWordList = useMemo(() => {
    const countByLength = validWordList.reduce<Record<number, number>>((acc, word) => {
      const len = word.length;
      acc[len] = (acc[len] ?? 0) + 1;
      return acc;
    }, {});

    return validWordList.filter((word) => (countByLength[word.length] ?? 0) >= 4);
  }, [validWordList]);

  const currentMorseCodes = useMemo(() => {
    return currentQuestion
      .toUpperCase()
      .split("")
      .map((ch) => MORSE_MAP[ch])
      .filter((code): code is string => Boolean(code));
  }, [currentQuestion]);

  const morseExamples = useMemo(() => {
    return ALPHABET
      .map((letter) => ({
        letter,
        code: MORSE_MAP[letter],
        display: toDisplayMorse(MORSE_MAP[letter]),
      }))
      .sort((a, b) => {
        const aKey = a.code.replace(/\./g, "0").replace(/-/g, "1");
        const bKey = b.code.replace(/\./g, "0").replace(/-/g, "1");
        return aKey.localeCompare(bKey);
      });
  }, []);

  const hasQuestionPanel = displaySetting.symbol || displaySetting.light;

  const currentChoices = useMemo(() => {
    if (!currentQuestion) {
      return [];
    }
    if (wordMode === "ikki") {
      return ikkiCurrentQuestion?.choices ?? [];
    }
    if (wordMode === "single") {
      return createSingleChoices(currentQuestion.toUpperCase());
    }
    return createWordChoices(currentQuestion.toUpperCase(), playableWordList);
  }, [currentQuestion, ikkiCurrentQuestion, playableWordList, wordMode]);

  const playBeep = useCallback((durationMs: number) => {
    if (!displaySetting.sound) {
      return;
    }

    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) {
      return;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new Ctx();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 650;
    gain.gain.value = 0.12;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  }, [displaySetting.sound]);

  const playCurrentQuestion = useCallback(() => {
    if (!currentMorseCodes.length) {
      return;
    }

    clearPlayback();
    const unitMs = 1200 / wpm;
    const steps: Step[] = [];

    currentMorseCodes.forEach((code, letterIndex) => {
      code.split("").forEach((symbol, symbolIndex, symbols) => {
        steps.push({
          type: "on",
          durationMs: Math.round((symbol === "." ? unitMs : unitMs * 3) * randomFactor(jitter)),
          letterIndex,
          symbolIndex,
        });

        if (symbolIndex < symbols.length - 1) {
          steps.push({
            type: "off",
            durationMs: Math.round(unitMs * randomFactor(jitter)),
            letterIndex,
            symbolIndex,
          });
        }
      });

      if (letterIndex < currentMorseCodes.length - 1) {
        steps.push({
          type: "off",
          durationMs: Math.round(unitMs * 3 * randomFactor(jitter)),
          letterIndex,
          symbolIndex: -1,
        });
      }
    });

    setIsPlaying(true);
    let stepIndex = 0;

    const runNext = () => {
      if (stepIndex >= steps.length) {
        setIsPlaying(false);
        setActiveSymbolKey(null);
        setLightOn(false);
        return;
      }

      const step = steps[stepIndex];
      stepIndex += 1;

      if (step.type === "on") {
        setActiveSymbolKey(`${step.letterIndex}-${step.symbolIndex}`);
        if (displaySetting.light) {
          setLightOn(true);
        }
        playBeep(step.durationMs);
      } else {
        setActiveSymbolKey(null);
        if (displaySetting.light) {
          setLightOn(false);
        }
      }

      const timerId = window.setTimeout(runNext, step.durationMs);
      playbackTimeoutRef.current.push(timerId);
    };

    runNext();
  }, [clearPlayback, currentMorseCodes, displaySetting.light, jitter, playBeep, wpm]);

  useEffect(() => {
    if (screen !== "game") {
      return;
    }
    playCurrentQuestion();
  }, [screen, currentQuestion, playCurrentQuestion]);

  const startDisabled = !displaySetting.symbol && !displaySetting.sound && !displaySetting.light;
  const dictionaryUnavailable = wordMode === "word" && (wordLoadError !== null || playableWordList.length < TOTAL_QUESTIONS);

  const createQuestions = useCallback((): string[] => {
    if (wordMode === "single") {
      return shuffleArray(ALPHABET).slice(0, TOTAL_QUESTIONS);
    }
    if (wordMode === "ikki") {
      return [];
    }
    return shuffleArray(playableWordList.map((word) => word.toUpperCase())).slice(0, TOTAL_QUESTIONS);
  }, [playableWordList, wordMode]);

  const handleStart = () => {
    if (startDisabled || dictionaryUnavailable) {
      return;
    }

    clearAnswerTimeout();

    if (wordMode === "ikki") {
      const firstQuestion = createIkkiQuestion([], ALPHABET, null);
      if (!firstQuestion) {
        return;
      }

      setQuestions([]);
      setRecords([]);
      setCurrentIndex(0);
      setAnswerText("");
      setIkkiLearned(firstQuestion.learnedList);
      setIkkiUnlearned(firstQuestion.unlearnedList);
      setIkkiCurrentQuestion(firstQuestion.question);
      setIkkiConsecutiveCorrect(0);
      setIkkiWrongCounts({});
      setIkkiWrongTotal(0);
      setScreen("game");
      return;
    }

    const nextQuestions = createQuestions();
    if (nextQuestions.length < TOTAL_QUESTIONS) {
      return;
    }

    setQuestions(nextQuestions);
    setRecords([]);
    setCurrentIndex(0);
    setAnswerText("");
    setIkkiLearned([]);
    setIkkiUnlearned([]);
    setIkkiCurrentQuestion(null);
    setIkkiConsecutiveCorrect(0);
    setIkkiWrongCounts({});
    setIkkiWrongTotal(0);
    setScreen("game");
  };

  const handleAbortGame = () => {
    clearAnswerTimeout();
    clearPlayback();
    setScreen("result");
  };

  const submitAnswer = useCallback((rawAnswer: string) => {
    if (answerLocked || !currentQuestion) {
      return;
    }

    const answered = wordMode === "ikki" ? rawAnswer : rawAnswer.trim();
    if (wordMode !== "ikki" && !answered) {
      return;
    }

    clearPlayback();

    if (wordMode === "ikki") {
      if (!ikkiCurrentQuestion) {
        return;
      }

      const correct = normalizeAnswer(answered) === normalizeAnswer(ikkiCurrentQuestion.correct);
      let nextLearnedState = [...ikkiLearned];
      let nextUnlearnedState = [...ikkiUnlearned];
      let shouldFinish = false;

      if (!correct) {
        setIkkiWrongTotal((prev) => prev + 1);
        setIkkiWrongCounts((prev) => ({
          ...prev,
          [ikkiCurrentQuestion.correct]: (prev[ikkiCurrentQuestion.correct] ?? 0) + 1,
        }));
        setIkkiConsecutiveCorrect(0);

        nextLearnedState = nextLearnedState.filter((letter) => letter !== ikkiCurrentQuestion.correct);
        if (!nextUnlearnedState.includes(ikkiCurrentQuestion.correct)) {
          nextUnlearnedState = [...nextUnlearnedState, ikkiCurrentQuestion.correct];
        }
      } else if (ikkiLearned.length >= ALPHABET.length) {
        const nextConsecutive = ikkiConsecutiveCorrect + 1;
        setIkkiConsecutiveCorrect(nextConsecutive);
        if (nextConsecutive >= 3) {
          shouldFinish = true;
        }
      } else {
        setIkkiConsecutiveCorrect(0);
      }

      setAnswerFeedback(correct ? "correct" : "wrong");
      setAnswerLocked(true);
      answerTimeoutRef.current = window.setTimeout(() => {
        setAnswerFeedback(null);
        setAnswerLocked(false);

        if (shouldFinish) {
          setAnswerText("");
          setScreen("result");
          return;
        }

        const next = createIkkiQuestion(nextLearnedState, nextUnlearnedState, ikkiCurrentQuestion.type);
        if (!next) {
          setAnswerText("");
          setScreen("result");
          return;
        }

        setIkkiLearned(next.learnedList);
        setIkkiUnlearned(next.unlearnedList);
        setIkkiCurrentQuestion(next.question);
        setAnswerText("");
      }, 1000);
      return;
    }

    const correct = normalizeAnswer(answered) === normalizeAnswer(currentQuestion);
    const nextRecord: AnswerRecord = {
      questionNo: currentIndex + 1,
      question: currentQuestion,
      answer: answered,
      correct,
    };

    const nextRecords = [...records, nextRecord];
    setRecords(nextRecords);
    setAnswerText("");
    setAnswerFeedback(correct ? "correct" : "wrong");
    setAnswerLocked(true);

    if (nextRecords.length >= TOTAL_QUESTIONS) {
      answerTimeoutRef.current = window.setTimeout(() => {
        setAnswerFeedback(null);
        setAnswerLocked(false);
        setScreen("result");
      }, 1000);
      return;
    }

    answerTimeoutRef.current = window.setTimeout(() => {
      setAnswerFeedback(null);
      setAnswerLocked(false);
      setCurrentIndex((prev) => prev + 1);
    }, 1000);
  }, [answerLocked, clearPlayback, currentQuestion, currentIndex, records, wordMode, ikkiCurrentQuestion, ikkiConsecutiveCorrect, ikkiLearned, ikkiUnlearned]);

  const handleSubmitAnswer = (e: FormEvent) => {
    e.preventDefault();
    submitAnswer(answerText);
  };

  const handleBackToSetup = () => {
    clearAnswerTimeout();
    clearPlayback();
    setScreen("setup");
    setQuestions([]);
    setRecords([]);
    setCurrentIndex(0);
    setAnswerText("");
    setIkkiLearned([]);
    setIkkiUnlearned([]);
    setIkkiCurrentQuestion(null);
    setIkkiConsecutiveCorrect(0);
    setIkkiWrongCounts({});
    setIkkiWrongTotal(0);
  };

  const ikkiWrongEntries = useMemo(() => {
    return Object.entries(ikkiWrongCounts).sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      return a[0].localeCompare(b[0]);
    });
  }, [ikkiWrongCounts]);

  return (
    <main className="max-w-5xl mx-auto p-6">
      <div className="mb-4">
        <Link href="/" className="text-blue-500 hover:text-blue-700 text-sm">
          ← トップに戻る
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-6">モールス信号ゲーム</h1>

      {screen === "setup" && (
        <section className="space-y-6">
          <div className="rounded border p-4 bg-gray-50">
            <h2 className="font-bold text-lg mb-3">ゲーム準備</h2>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <p className="font-semibold mb-2">表示</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDisplaySetting((prev) => ({ ...prev, symbol: !prev.symbol }))}
                    className={`px-4 py-2 rounded border ${displaySetting.symbol ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"}`}
                  >
                    記号
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisplaySetting((prev) => ({ ...prev, sound: !prev.sound }))}
                    className={`px-4 py-2 rounded border ${displaySetting.sound ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"}`}
                  >
                    音
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisplaySetting((prev) => ({ ...prev, light: !prev.light }))}
                    className={`px-4 py-2 rounded border ${displaySetting.light ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"}`}
                  >
                    光
                  </button>
                </div>
              </div>

              <div>
                <p className="font-semibold mb-2">問題</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setWordMode("single")}
                    className={`px-4 py-2 rounded border ${wordMode === "single" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-700 border-gray-300"}`}
                  >
                    1文字
                  </button>
                  <button
                    type="button"
                    onClick={() => setWordMode("word")}
                    className={`px-4 py-2 rounded border ${wordMode === "word" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-700 border-gray-300"}`}
                  >
                    英単語
                  </button>
                  <button
                    type="button"
                    onClick={() => setWordMode("ikki")}
                    className={`px-4 py-2 rounded border ${wordMode === "ikki" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-700 border-gray-300"}`}
                  >
                    一気覚え
                  </button>
                </div>
              </div>

              <div>
                <p className="font-semibold mb-2">解答方式</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAnswerMode("choice")}
                    disabled={wordMode === "ikki"}
                    className={`px-4 py-2 rounded border ${answerMode === "choice" ? "bg-cyan-700 text-white border-cyan-700" : "bg-white text-gray-700 border-gray-300"}`}
                  >
                    4択
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnswerMode("text")}
                    disabled={wordMode === "ikki"}
                    className={`px-4 py-2 rounded border ${answerMode === "text" ? "bg-cyan-700 text-white border-cyan-700" : "bg-white text-gray-700 border-gray-300"}`}
                  >
                    テキスト
                  </button>
                </div>
                {wordMode === "ikki" && (
                  <p className="mt-2 text-sm text-gray-700">一気覚えでは4択固定です。</p>
                )}
              </div>

              <div>
                <p className="font-semibold mb-2">速度</p>
                <div className="flex flex-wrap gap-2">
                  {[5, 12, 20, 30].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setWpm(value as Wpm)}
                      className={`px-4 py-2 rounded border ${wpm === value ? "bg-amber-600 text-white border-amber-600" : "bg-white text-gray-700 border-gray-300"}`}
                    >
                      {value}WPM
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="font-semibold mb-2">ゆらぎ</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setJitter(false)}
                    className={`px-4 py-2 rounded border ${!jitter ? "bg-fuchsia-700 text-white border-fuchsia-700" : "bg-white text-gray-700 border-gray-300"}`}
                  >
                    なし
                  </button>
                  <button
                    type="button"
                    onClick={() => setJitter(true)}
                    className={`px-4 py-2 rounded border ${jitter ? "bg-fuchsia-700 text-white border-fuchsia-700" : "bg-white text-gray-700 border-gray-300"}`}
                  >
                    あり
                  </button>
                </div>
              </div>
            </div>

            {wordMode === "word" && (
              <p className="mt-4 text-sm text-gray-700">利用可能英単語数（4-8文字）: {validWordList.length} 件</p>
            )}
            {wordMode === "word" && (
              <p className="mt-1 text-sm text-gray-700">4択出題可能語数: {playableWordList.length} 件</p>
            )}
            {wordMode === "word" && playableWordList.length < TOTAL_QUESTIONS && (
              <p className="mt-2 text-sm text-red-600">10問を重複なしで出題するための語数が不足しています。</p>
            )}
            {wordLoadError && (
              <p className="mt-2 text-sm text-red-600 whitespace-pre-wrap">{wordLoadError}</p>
            )}

            {startDisabled && (
              <p className="mt-4 text-sm text-red-600">表示を1つ以上ONにしてください。</p>
            )}

            <button
              type="button"
              onClick={handleStart}
              disabled={startDisabled || dictionaryUnavailable}
              className="mt-6 px-6 py-3 rounded bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              開始
            </button>
          </div>
        </section>
      )}

      {screen === "game" && (
        <section className="space-y-5">
          <div className="flex items-center justify-between rounded border p-3 bg-gray-50">
            <p className="font-semibold">
              {wordMode === "ikki"
                ? `一気覚え 覚えた: ${ikkiLearned.length} / 26  連続正解: ${ikkiConsecutiveCorrect} / 3  (${ikkiCurrentQuestion?.type === "add" ? "追加問題" : "既存問題"})`
                : `${currentIndex + 1} / ${TOTAL_QUESTIONS} 問目`}
            </p>
            <button
              type="button"
              onClick={handleAbortGame}
              className="px-4 py-2 rounded bg-gray-700 text-white hover:bg-gray-800"
            >
              中断
            </button>
          </div>

          {hasQuestionPanel && (
            <div className="rounded border p-4 bg-white space-y-4">
              <h2 className="font-bold">問題</h2>

              {displaySetting.light && (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-gray-700">光</p>
                  <div className="relative flex items-center justify-center w-12 h-12">
                    <div
                      className={`absolute inset-0 rounded-full transition-all duration-300 ${lightOn ? "opacity-100 animate-pulse" : "opacity-0"}`}
                      style={{
                        backgroundColor: "rgba(239, 68, 68, 0.35)",
                        boxShadow: lightOn
                          ? "0 0 18px 8px rgba(239, 68, 68, 0.45), 0 0 42px 18px rgba(239, 68, 68, 0.25)"
                          : "none",
                        filter: "blur(4px)",
                      }}
                    />
                    <div
                      className="relative w-10 h-10 rounded-full border border-red-900 transition-all duration-300"
                      style={{
                        backgroundColor: lightOn ? "#ef4444" : "#7f1d1d",
                        boxShadow: lightOn
                          ? "0 0 10px rgba(239, 68, 68, 0.9), inset 0 0 8px rgba(255, 255, 255, 0.18)"
                          : "none",
                      }}
                    />
                  </div>
                </div>
              )}

              {displaySetting.symbol && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-700">記号</p>
                  <div className="flex flex-wrap gap-x-5 gap-y-3 text-2xl font-mono">
                    {currentMorseCodes.map((code, letterIndex) => (
                      <span key={`${letterIndex}-${code}`} className="whitespace-nowrap tracking-wide">
                        {code.split("").map((symbol, symbolIndex) => {
                          const key = `${letterIndex}-${symbolIndex}`;
                          const highlighted = key === activeSymbolKey;
                          return (
                            <span key={key} className={highlighted ? "text-red-600" : "text-gray-800"}>
                              {toDisplayMorse(symbol)}
                            </span>
                          );
                        })}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {displaySetting.sound && !hasQuestionPanel && (
            <p className="text-sm text-gray-700">音声のみで出題中です。</p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={playCurrentQuestion}
              disabled={answerLocked}
              className="px-4 py-2 rounded bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              再生
            </button>
            <span className="text-sm text-gray-600">{isPlaying ? "再生中" : "停止中"}</span>
          </div>

          <form onSubmit={handleSubmitAnswer} className="rounded border p-4 bg-gray-50 space-y-3">
            <h2 className="font-bold">解答</h2>
            {answerFeedback && (
              <p className={`font-semibold ${answerFeedback === "correct" ? "text-green-700" : "text-red-700"}`}>
                {answerFeedback === "correct" ? "正解" : "不正解"}
              </p>
            )}

            {effectiveAnswerMode === "text" ? (
              <input
                type="text"
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                className="w-full p-3 border rounded"
                placeholder="答えを入力"
                disabled={answerLocked}
                autoFocus
              />
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-700">4択</p>
                <div className="grid grid-cols-2 gap-2">
                  {currentChoices.map((choice, index) => (
                    <button
                      key={`${choice}-${index}`}
                      type="button"
                      disabled={answerLocked}
                      onClick={() => {
                        setAnswerText(choice);
                        submitAnswer(choice);
                      }}
                      className={`px-3 py-2 rounded border text-left ${answerText !== "" && answerText.toUpperCase() === choice ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-800 border-gray-300 hover:bg-gray-100"} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {index + 1}. {choice === "" ? " " : choice}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <details className="rounded border bg-white">
              <summary className="cursor-pointer px-3 py-2 font-semibold text-sm text-gray-700">辞書（A-Zの例）</summary>
              <div className="px-3 pb-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-sm">
                  {morseExamples.map((entry) => (
                    <div key={entry.letter} className="rounded border px-2 py-1 bg-gray-50">
                      <span className="font-semibold">{entry.letter}</span>
                      <span className="mx-1 text-gray-400">:</span>
                      <span className="font-mono">{entry.display}</span>
                      <span className="ml-1 text-xs text-gray-500">({entry.code})</span>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          </form>
        </section>
      )}

      {screen === "result" && (
        wordMode === "ikki" ? (
          <section className="space-y-4">
            <h2 className="text-2xl font-bold">一気覚え 結果</h2>
            <p className="text-sm text-gray-700">覚えた文字: {ikkiLearned.length}</p>
            <p className="text-sm text-gray-700">誤答数: {ikkiWrongTotal}</p>

            <div className="overflow-x-auto border rounded">
              <table className="w-full border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 border text-left">文字</th>
                    <th className="p-2 border text-left">モールス信号</th>
                    <th className="p-2 border text-left">誤答回数</th>
                  </tr>
                </thead>
                <tbody>
                  {ikkiWrongEntries.length > 0 ? (
                    ikkiWrongEntries.map(([letter, count]) => (
                      <tr key={letter}>
                        <td className="p-2 border font-semibold">{letter}</td>
                        <td className="p-2 border font-mono">{toDisplayMorse(MORSE_MAP[letter])}</td>
                        <td className="p-2 border">{count}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="p-2 border" colSpan={3}>誤答はありません。</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={handleBackToSetup}
              className="px-6 py-3 rounded bg-gray-700 text-white hover:bg-gray-800"
            >
              戻る
            </button>
          </section>
        ) : (
          <section className="space-y-4">
            <h2 className="text-2xl font-bold">結果</h2>
            <p className="text-sm text-gray-700">正解数: {records.filter((record) => record.correct).length} / {TOTAL_QUESTIONS}</p>

            <div className="overflow-x-auto border rounded">
              <table className="w-full border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 border text-left">No</th>
                    <th className="p-2 border text-left">問題</th>
                    <th className="p-2 border text-left">解答</th>
                    <th className="p-2 border text-left">判定</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.questionNo}>
                      <td className="p-2 border">{record.questionNo}</td>
                      <td className="p-2 border uppercase">{record.question}</td>
                      <td className="p-2 border">{record.answer}</td>
                      <td className={`p-2 border font-semibold ${record.correct ? "text-green-700" : "text-red-700"}`}>
                        {record.correct ? "正解" : "不正解"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={handleBackToSetup}
              className="px-6 py-3 rounded bg-gray-700 text-white hover:bg-gray-800"
            >
              戻る
            </button>
          </section>
        )
      )}
    </main>
  );
}
