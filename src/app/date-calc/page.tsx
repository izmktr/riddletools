'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Encoding from 'encoding-japanese';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export default function DateCalcPage() {
  const [showManual, setShowManual] = useState(false);
  const [showHolidayViewer, setShowHolidayViewer] = useState(false);
  const [holidayViewYear, setHolidayViewYear] = useState<number>(new Date().getFullYear());
  const [date1Text, setDate1Text] = useState('');
  const [date2Text, setDate2Text] = useState('');
  const [result, setResult] = useState<string>('');
  const [selectedWeekdays, setSelectedWeekdays] = useState<boolean[]>([
    false, false, false, false, false, false, false
  ]);
  const [includeUnselectedHolidays, setIncludeUnselectedHolidays] = useState<boolean>(false);
  const [weekdayCounts, setWeekdayCounts] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [holidayCounts, setHolidayCounts] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [holidayData, setHolidayData] = useState<Map<string, string>>(new Map());
  const date1PickerRef = useRef<HTMLInputElement>(null);
  const date2PickerRef = useRef<HTMLInputElement>(null);
  
  // 祝日CSVを読み込み
  useEffect(() => {
    const loadHolidays = async () => {
      try {
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
        const response = await fetch(`${basePath}/syukujitsu.csv`);
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Shift-JISからUTF-8に変換
        const unicodeArray = Encoding.convert(uint8Array, {
          to: 'UNICODE',
          from: 'SJIS'
        });
        const text = Encoding.codeToString(unicodeArray);
        
        // CSVをパースして日付と祝日名を抽出
        const lines = text.split('\n');
        const holidayMap = new Map<string, string>();
        
        for (let i = 1; i < lines.length; i++) { // ヘッダー行をスキップ
          const line = lines[i].trim();
          if (line) {
            const [dateStr, holidayName] = line.split(',');
            if (dateStr && holidayName) {
              // YYYY/M/D を YYYY-MM-DD に変換（ゼロパディング）
              const parts = dateStr.split('/');
              if (parts.length === 3) {
                const year = parts[0];
                const month = parts[1].padStart(2, '0');
                const day = parts[2].padStart(2, '0');
                const normalizedDate = `${year}-${month}-${day}`;
                holidayMap.set(normalizedDate, holidayName);
              }
            }
          }
        }
        
        setHolidayData(holidayMap);
      } catch (err) {
        console.error('祝日データの読み込みに失敗しました:', err);
      }
    };
    
    loadHolidays();
  }, []);

  // 日付変換に成功した場合のみ日数を計算
  useEffect(() => {
    setResult('');

    if (!date1Text && !date2Text) {
      return;
    }

    // 両方入力されている場合のみ日数を計算
    if (date1Text && date2Text) {
      const date1 = parseDate(date1Text);
      const date2 = parseDate(date2Text);
      
      if (date1 && date2) {
        const diffTime = Math.abs(date2.getTime() - date1.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        setResult(`${diffDays}日`);
        
        // 曜日ごとの出現回数を計算
        const { weekdayCounts: counts, holidayCounts: hCounts } = countWeekdays(date1, date2);
        setWeekdayCounts(counts);
        setHolidayCounts(hCounts);
      }
    }
  }, [date1Text, date2Text, holidayData]);

  // 2つの日付間の各曜日の出現回数を計算
  const countWeekdays = (startDate: Date, endDate: Date): { weekdayCounts: number[], holidayCounts: number[] } => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    const hCounts = [0, 0, 0, 0, 0, 0, 0];
    const start = new Date(Math.min(startDate.getTime(), endDate.getTime()));
    const end = new Date(Math.max(startDate.getTime(), endDate.getTime()));
    
    const current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getDay();
      counts[dayOfWeek]++;
      
      // 祝日チェック
      const dateStr = formatDate(current);
      if (holidayData.has(dateStr)) {
        hCounts[dayOfWeek]++;
      }
      
      current.setDate(current.getDate() + 1);
    }
    
    return { weekdayCounts: counts, holidayCounts: hCounts };
  };

  // 日付をYYYY-MM-DD形式に変換
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 曜日チェックボックスのトグル
  const toggleWeekday = (index: number) => {
    const newSelected = [...selectedWeekdays];
    newSelected[index] = !newSelected[index];
    setSelectedWeekdays(newSelected);
  };

  const clearWeekdaySelection = () => {
    setSelectedWeekdays([false, false, false, false, false, false, false]);
    setIncludeUnselectedHolidays(false);
  };

  const selectWeekdays = () => {
    setSelectedWeekdays([false, true, true, true, true, true, false]);
  };

  const selectWeekend = () => {
    setSelectedWeekdays([true, false, false, false, false, false, true]);
  };

  // 選択された曜日の合計日数を計算
  const getSelectedWeekdaysCount = (): number => {
    let total = selectedWeekdays.reduce((sum, isSelected, index) => {
      return sum + (isSelected ? weekdayCounts[index] : 0);
    }, 0);
    
    // ＋祝日がONの場合、選択していない曜日の祝日数を追加
    if (includeUnselectedHolidays) {
      const unselectedHolidays = selectedWeekdays.reduce((sum, isSelected, index) => {
        return sum + (!isSelected ? holidayCounts[index] : 0);
      }, 0);
      total += unselectedHolidays;
    }
    
    return total;
  };

  // 選択された曜日の祝日数を計算
  const getSelectedHolidaysCount = (): number => {
    let selectedHolidays = selectedWeekdays.reduce((sum, isSelected, index) => {
      return sum + (isSelected ? holidayCounts[index] : 0);
    }, 0);
    
    // ＋祝日がONの場合、選択していない曜日の祝日数も追加
    if (includeUnselectedHolidays) {
      const unselectedHolidays = selectedWeekdays.reduce((sum, isSelected, index) => {
        return sum + (!isSelected ? holidayCounts[index] : 0);
      }, 0);
      selectedHolidays += unselectedHolidays;
    }
    
    return selectedHolidays;
  };

  // 期間内の祝日を取得
  const getHolidaysInRange = (): Array<{ date: string; name: string; dayOfWeek: string }> => {
    if (!date1Text || !date2Text) return [];
    
    const date1 = parseDate(date1Text);
    const date2 = parseDate(date2Text);
    if (!date1 || !date2) return [];
    
    const start = new Date(Math.min(date1.getTime(), date2.getTime()));
    const end = new Date(Math.max(date1.getTime(), date2.getTime()));
    
    const holidaysInRange: Array<{ date: string; name: string; dayOfWeek: string }> = [];
    const current = new Date(start);
    
    while (current <= end) {
      const dateStr = formatDate(current);
      const holidayName = holidayData.get(dateStr);
      if (holidayName) {
        const dayOfWeek = WEEKDAYS[current.getDay()];
        holidaysInRange.push({ date: dateStr, name: holidayName, dayOfWeek });
      }
      current.setDate(current.getDate() + 1);
    }
    
    return holidaysInRange;
  };

  // 祝日リストを表示用にフォーマット（最大6件）
  const formatHolidayList = (holidayList: Array<{ date: string; name: string; dayOfWeek: string }>) => {
    if (holidayList.length === 0) return null;
    
    if (holidayList.length <= 6) {
      return holidayList;
    }
    
    // 7件以上の場合は最初の3件と最後の3件を表示
    return [
      ...holidayList.slice(0, 3),
      { date: '...', name: '...', dayOfWeek: '...' }, // 省略記号
      ...holidayList.slice(-3)
    ];
  };

  const buildValidDate = (year: number, month: number, day: number): Date | null => {
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  };

  const addMonths = (baseDate: Date, months: number): Date => {
    const date = new Date(baseDate);
    date.setMonth(date.getMonth() + months);
    return date;
  };

  // 日付文字列をパース
  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;

    const trimmed = dateStr.trim();
    const normalized = trimmed.replace(/\//g, '-');

    // YYYY-MM-DD, YYYY/M/D, YYYYMMDD
    let match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!match) {
      match = normalized.match(/^(\d{4})(\d{2})(\d{2})$/);
    }
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      return buildValidDate(year, month, day);
    }

    // 年省略形式: M-D, MM-DD, M/D, MM/DD, MMDD
    let month: number | null = null;
    let day: number | null = null;

    const shortMatch = normalized.match(/^(\d{1,2})-(\d{1,2})$/);
    if (shortMatch) {
      month = Number(shortMatch[1]);
      day = Number(shortMatch[2]);
    } else {
      const compactShortMatch = normalized.match(/^(\d{4})$/);
      if (compactShortMatch) {
        month = Number(compactShortMatch[1].slice(0, 2));
        day = Number(compactShortMatch[1].slice(2, 4));
      }
    }

    if (month === null || day === null) {
      return null;
    }

    const today = new Date();
    const currentYear = today.getFullYear();
    const dateWithCurrentYear = buildValidDate(currentYear, month, day);
    if (!dateWithCurrentYear) {
      return null;
    }

    const nineMonthsLater = addMonths(today, 9);
    if (dateWithCurrentYear.getTime() >= nineMonthsLater.getTime()) {
      return buildValidDate(currentYear - 1, month, day);
    }

    return dateWithCurrentYear;
  };

  // カレンダーから日付が選択された時
  const handleCalendarChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setterFunc: (value: string) => void
  ) => {
    const value = e.target.value;
    if (value) {
      // YYYY-MM-DD 形式をそのまま使用
      setterFunc(value);
    }
  };

  const openCalendar = (inputRef: React.RefObject<HTMLInputElement | null>) => {
    const input = inputRef.current;
    if (!input) return;

    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
        return;
      }
    } catch {
      // showPicker が使えない環境では click にフォールバック
    }

    input.focus();
    input.click();
  };

  const recognizedDate1 = parseDate(date1Text);
  const recognizedDate2 = parseDate(date2Text);

  const formatRecognizedDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}(${WEEKDAYS[date.getDay()]})`;
  };

  const rangePreviewText = recognizedDate1 && recognizedDate2
    ? `${formatRecognizedDate(recognizedDate1)}～${formatRecognizedDate(recognizedDate2)}`
    : recognizedDate1
      ? `${formatRecognizedDate(recognizedDate1)}～`
      : recognizedDate2
        ? `～${formatRecognizedDate(recognizedDate2)}`
        : '';

  const holidaysForViewYear = Array.from(holidayData.entries())
    .filter(([date]) => date.startsWith(`${holidayViewYear}-`))
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, name]) => {
      const dateObj = new Date(date);
      return {
        date,
        name,
        dayOfWeek: WEEKDAYS[dateObj.getDay()]
      };
    });

  const holidayCountsByYear = Array.from(holidayData.keys()).reduce((acc, date) => {
    const year = Number(date.slice(0, 4));
    if (!Number.isNaN(year)) {
      acc[year] = (acc[year] ?? 0) + 1;
    }
    return acc;
  }, {} as Record<number, number>);

  const holidayYears = Object.keys(holidayCountsByYear)
    .map((year) => Number(year))
    .filter((year) => !Number.isNaN(year));
  const currentYear = new Date().getFullYear();
  const minHolidayYear = holidayYears.length > 0 ? Math.min(...holidayYears) : currentYear;
  const maxHolidayYear = holidayYears.length > 0 ? Math.max(...holidayYears) : currentYear;

  const maxHolidayCountPerYear = Object.values(holidayCountsByYear).reduce(
    (max, count) => Math.max(max, count),
    0
  );

  const holidayListAreaHeight = maxHolidayCountPerYear > 0
    ? Math.min(Math.max(maxHolidayCountPerYear * 28, 240), 420)
    : 240;

  const canGoPrevYear = holidayViewYear > minHolidayYear;
  const canGoNextYear = holidayViewYear < maxHolidayYear;

  return (
    <main className="max-w-xl mx-auto p-6">
      <div className="mb-4">
        <Link href="/" className="text-blue-500 hover:text-blue-700 text-sm">
          ← トップに戻る
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-4">日付計算ツール</h1>

      <div className="flex items-center mb-4 gap-2">
        <button
          type="button"
          className={`px-4 py-2 rounded text-sm transition-colors ${
            showManual
              ? "bg-gray-200 text-gray-800 hover:bg-gray-300"
              : "bg-green-100 text-green-700 hover:bg-green-200"
          }`}
          onClick={() => setShowManual((v) => !v)}
        >
          {showManual ? '閉じる' : '使い方'}
        </button>
        <button
          type="button"
          className="px-4 py-2 text-sm bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200"
          onClick={() => {
            const initialYear = Math.min(Math.max(currentYear, minHolidayYear), maxHolidayYear);
            setHolidayViewYear(initialYear);
            setShowHolidayViewer(true);
          }}
        >
          祝日表示
        </button>
      </div>
      {showManual && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded text-sm leading-relaxed">
          <h3 className="font-bold mb-2">使い方</h3>
          <ul className="list-disc pl-5 space-y-2">
            <li>テキストボックスに日付を入力（YYYY-MM-DD形式）</li>
            <li>📅 ボタンをクリックしてカレンダーから日付を選択</li>
            <li>2つの日付を入力すると自動的に日数の差を計算します</li>
            <li>曜日のチェックで指定した曜日の出現回数を確認できます</li>
            <li>対応形式: 2024-03-19, 2024/03/19, 20240319, 03-19, 0319</li>
          </ul>
        </div>
      )}
      {showHolidayViewer && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 max-w-lg w-full relative max-h-[80vh]">
            <button
              type="button"
              className="absolute top-2 right-2 px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => setShowHolidayViewer(false)}
            >
              閉じる
            </button>
            <h3 className="text-xl font-bold mb-3">祝日一覧 ({minHolidayYear} ～ {maxHolidayYear})</h3>
            <div className="flex items-center justify-center gap-3 mb-4">
              <button
                type="button"
                className={`px-3 py-1 rounded ${canGoPrevYear ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                onClick={() => setHolidayViewYear((year) => year - 1)}
                aria-label="前年を表示"
                disabled={!canGoPrevYear}
              >
                ←
              </button>
              <p className="text-lg font-semibold w-[8rem] text-center tabular-nums">
                {holidayViewYear}年 <span className="text-base text-gray-700">({holidaysForViewYear.length}日)</span>
              </p>
              <button
                type="button"
                className={`px-3 py-1 rounded ${canGoNextYear ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                onClick={() => setHolidayViewYear((year) => year + 1)}
                aria-label="翌年を表示"
                disabled={!canGoNextYear}
              >
                →
              </button>
            </div>
            <div className="overflow-y-auto border border-gray-200 rounded p-2" style={{ height: `${holidayListAreaHeight}px` }}>
              {holidaysForViewYear.length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {holidaysForViewYear.map((holiday) => (
                    <li key={`${holiday.date}-${holiday.name}`} className="flex items-center gap-2">
                      <span className="text-gray-600 font-mono">{holiday.date}</span>
                      <span className="text-gray-900">{holiday.name}</span>
                      <span
                        className={`text-xs font-semibold ${
                          holiday.dayOfWeek === '日'
                            ? 'text-red-600'
                            : holiday.dayOfWeek === '土'
                              ? 'text-blue-600'
                              : 'text-gray-600'
                        }`}
                      >
                        ({holiday.dayOfWeek})
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-600">{holidayViewYear}年の祝日データはありません。</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold whitespace-nowrap">日付1</label>
            <input
              type="text"
              value={date1Text}
              onChange={(e) => setDate1Text(e.target.value)}
              placeholder="YYYY-MM-DD"
              className="flex-1 p-2 border rounded"
            />
            <div className="relative">
              <button
                type="button"
                onClick={() => openCalendar(date1PickerRef)}
                className="px-3 py-2 bg-blue-200 rounded hover:bg-blue-300"
                title="カレンダーを開く"
              >
                📅
              </button>
              <input
                ref={date1PickerRef}
                type="date"
                onChange={(e) => handleCalendarChange(e, setDate1Text)}
                className="absolute top-0 left-0 w-px h-px opacity-0 pointer-events-none"
                aria-label="日付1をカレンダーで選択"
                tabIndex={-1}
                aria-hidden="true"
              />
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold whitespace-nowrap">日付2</label>
            <input
              type="text"
              value={date2Text}
              onChange={(e) => setDate2Text(e.target.value)}
              placeholder="YYYY-MM-DD"
              className="flex-1 p-2 border rounded"
            />
            <div className="relative">
              <button
                type="button"
                onClick={() => openCalendar(date2PickerRef)}
                className="px-3 py-2 bg-blue-200 rounded hover:bg-blue-300"
                title="カレンダーを開く"
              >
                📅
              </button>
              <input
                ref={date2PickerRef}
                type="date"
                onChange={(e) => handleCalendarChange(e, setDate2Text)}
                className="absolute top-0 left-0 w-px h-px opacity-0 pointer-events-none"
                aria-label="日付2をカレンダーで選択"
                tabIndex={-1}
                aria-hidden="true"
              />
            </div>
          </div>
          {rangePreviewText && (
            <p className="text-sm text-blue-700 mt-2">
              <span className="font-semibold">{rangePreviewText}</span>
            </p>
          )}
        </div>

        {result && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              <p className="font-medium">日数の差 {result}</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 px-4 py-3 rounded">
              <p className="font-medium text-blue-900 mb-3">曜日を指定してカウント</p>
              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={clearWeekdaySelection}
                  className="px-3 py-2 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  全解除
                </button>
                <button
                  type="button"
                  onClick={selectWeekdays}
                  className="px-3 py-2 rounded border border-blue-300 bg-white text-sm font-medium text-blue-900 transition-colors hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  月～金
                </button>
                <button
                  type="button"
                  onClick={selectWeekend}
                  className="px-3 py-2 rounded border border-blue-300 bg-white text-sm font-medium text-blue-900 transition-colors hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  土日
                </button>
                <button
                  type="button"
                  onClick={() => setIncludeUnselectedHolidays((current) => !current)}
                  className={`px-3 py-2 rounded border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 ${includeUnselectedHolidays ? 'bg-yellow-300 border-yellow-500 text-yellow-950' : 'bg-yellow-50 border-yellow-300 text-yellow-900 hover:bg-yellow-100'}`}
                  aria-pressed={includeUnselectedHolidays}
                >
                  ＋祝日
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border border-blue-200 border-collapse bg-white">
                  <tbody>
                    <tr>
                      <th className="border border-blue-200 bg-blue-100 px-3 py-2 text-sm font-semibold text-blue-900 whitespace-nowrap">
                        曜日
                      </th>
                      {WEEKDAYS.map((day, index) => {
                        const isSelected = selectedWeekdays[index];
                        const textColorClass = index === 0
                          ? 'text-red-700'
                          : index === 6
                            ? 'text-blue-700'
                            : 'text-gray-700';

                        return (
                          <td key={`weekday-${index}`} className="border border-blue-200 p-0">
                            <button
                              type="button"
                              onClick={() => toggleWeekday(index)}
                              className={`w-full px-3 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset ${isSelected ? 'bg-blue-500 text-white' : 'bg-white hover:bg-blue-100'} ${isSelected ? '' : textColorClass}`}
                              aria-pressed={isSelected}
                            >
                              {day}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <th className="border border-blue-200 bg-blue-100 px-3 py-2 text-sm font-semibold text-blue-900 whitespace-nowrap">
                        回数(祝日)
                      </th>
                      {WEEKDAYS.map((day, index) => {
                        const isSelected = selectedWeekdays[index];
                        const textColorClass = index === 0
                          ? 'text-red-700'
                          : index === 6
                            ? 'text-blue-700'
                            : 'text-gray-700';

                        return (
                          <td key={`count-${day}`} className="border border-blue-200 p-0">
                            <button
                              type="button"
                              onClick={() => toggleWeekday(index)}
                              className={`w-full px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset ${isSelected ? 'bg-blue-500 text-white' : 'bg-white hover:bg-blue-100'} ${isSelected ? '' : textColorClass}`}
                              aria-pressed={isSelected}
                              aria-label={`${day}曜日 ${weekdayCounts[index]}回 祝日${holidayCounts[index]}回`}
                            >
                              {weekdayCounts[index]}({holidayCounts[index]})
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>

              {selectedWeekdays.some((selected) => selected) && (
                <div className="mt-4 pt-3 border-t border-blue-300">
                  <p className="text-sm text-blue-900 mb-2">
                    選択した曜日の合計{includeUnselectedHolidays && '（＋未選択曜日の祝日）'}:
                    <span className="text-2xl font-bold ml-2">{getSelectedWeekdaysCount()}日</span>
                  </p>
                  <div className="flex gap-4 text-sm">
                    <p className="text-blue-800">
                      祝日を含む: <span className="font-semibold">{getSelectedHolidaysCount()}日</span>
                    </p>
                    <p className="text-blue-800">
                      祝日を含まない: <span className="font-semibold">{getSelectedWeekdaysCount() - getSelectedHolidaysCount()}日</span>
                    </p>
                  </div>
                </div>
              )}
            </div>

            {(() => {
              const holidayList = getHolidaysInRange();
              const displayList = formatHolidayList(holidayList);

              if (holidayList.length > 0) {
                return (
                  <div className="bg-yellow-50 border border-yellow-200 px-4 py-3 rounded">
                    <p className="font-medium text-yellow-900 mb-2">期間内の祝日 ({holidayList.length}件)</p>
                    <div className="space-y-1 text-sm">
                      {displayList?.map((holiday, index) => (
                        holiday.date === '...' ? (
                          <div key={index} className="text-center text-gray-500 py-1">～</div>
                        ) : (
                          <div key={index} className="flex items-center gap-2">
                            <span className="text-gray-600 font-mono">{holiday.date}</span>
                            <span className="text-yellow-900">{holiday.name}</span>
                            <span
                              className={`text-xs font-semibold ${
                                holiday.dayOfWeek === '日'
                                  ? 'text-red-600'
                                  : holiday.dayOfWeek === '土'
                                    ? 'text-blue-600'
                                    : 'text-gray-600'
                              }`}
                            >
                              ({holiday.dayOfWeek})
                            </span>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        )}

        {!result && date1Text && date2Text && (
          <div className="bg-gray-50 border border-gray-200 text-gray-700 px-4 py-3 rounded">
            <p>有効な2つの日付を入力すると日数の差を計算します</p>
          </div>
        )}

      </div>
    </main>
  );
}
