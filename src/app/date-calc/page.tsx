'use client';

import { useState, useEffect, useRef } from 'react';
import Encoding from 'encoding-japanese';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export default function DateCalcPage() {
  const [date1Text, setDate1Text] = useState('');
  const [date2Text, setDate2Text] = useState('');
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [selectedWeekdays, setSelectedWeekdays] = useState<boolean[]>([
    false, false, false, false, false, false, false
  ]);
  const [includeUnselectedHolidays, setIncludeUnselectedHolidays] = useState<boolean>(false);
  const [weekdayCounts, setWeekdayCounts] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [holidayCounts, setHolidayCounts] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [holidayData, setHolidayData] = useState<Map<string, string>>(new Map());
  
  const date1InputRef = useRef<HTMLInputElement>(null);
  const date2InputRef = useRef<HTMLInputElement>(null);

  // 祝日CSVを読み込み
  useEffect(() => {
    const loadHolidays = async () => {
      try {
        const response = await fetch('/syukujitsu.csv');
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

  // 日付の妥当性チェックと日数計算
  useEffect(() => {
    setError('');
    setResult('');

    if (!date1Text && !date2Text) {
      return;
    }

    // 日付1のチェック
    if (date1Text) {
      const date1 = parseDate(date1Text);
      if (!date1) {
        setError('日付1が有効な日付ではありません');
        return;
      }
    }

    // 日付2のチェック
    if (date2Text) {
      const date2 = parseDate(date2Text);
      if (!date2) {
        setError('日付2が有効な日付ではありません');
        return;
      }
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

  // 日付文字列をパース
  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    
    // YYYY-MM-DD, YYYY/MM/DD, YYYYMMDD などの形式に対応
    const normalized = dateStr.replace(/\//g, '-').replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
    const date = new Date(normalized);
    
    // 無効な日付の場合
    if (isNaN(date.getTime())) {
      return null;
    }
    
    return date;
  };

  // カレンダーボタンのクリック
  const openCalendar = (inputRef: React.RefObject<HTMLInputElement | null>) => {
    if (inputRef.current) {
      inputRef.current.showPicker();
    }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-indigo-900">
          日付計算ツール
        </h1>
        
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="space-y-6">
            {/* 日付1入力 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                日付1
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={date1Text}
                  onChange={(e) => setDate1Text(e.target.value)}
                  placeholder="YYYY-MM-DD"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <button
                  onClick={() => openCalendar(date1InputRef)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                  title="カレンダーを開く"
                >
                  📅
                </button>
                <input
                  ref={date1InputRef}
                  type="date"
                  onChange={(e) => handleCalendarChange(e, setDate1Text)}
                  className="hidden"
                />
              </div>
            </div>

            {/* 日付2入力 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                日付2
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={date2Text}
                  onChange={(e) => setDate2Text(e.target.value)}
                  placeholder="YYYY-MM-DD"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <button
                  onClick={() => openCalendar(date2InputRef)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                  title="カレンダーを開く"
                >
                  📅
                </button>
                <input
                  ref={date2InputRef}
                  type="date"
                  onChange={(e) => handleCalendarChange(e, setDate2Text)}
                  className="hidden"
                />
              </div>
            </div>

            {/* 結果表示 */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                  <p className="font-medium">エラー</p>
                  <p>{error}</p>
                </div>
              )}
              
              {result && !error && (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
                    <p className="font-medium">日数の差</p>
                    <p className="text-3xl font-bold mt-2">{result}</p>
                  </div>
                  
                  {/* 曜日選択チェックボックス */}
                  <div className="bg-blue-50 border border-blue-200 px-4 py-3 rounded-md">
                    <p className="font-medium text-blue-900 mb-3">曜日を指定してカウント</p>
                    <div className="flex flex-wrap gap-3">
                      {WEEKDAYS.map((day, index) => {
                        // 日曜日は赤、土曜日は青、その他は通常の色
                        const bgColorClass = index === 0 
                          ? 'bg-red-50 border-red-300 hover:bg-red-100'
                          : index === 6 
                          ? 'bg-blue-100 border-blue-400 hover:bg-blue-200'
                          : 'bg-white border-blue-300 hover:bg-blue-100';
                        
                        const textColorClass = index === 0
                          ? 'text-red-700'
                          : index === 6
                          ? 'text-blue-700'
                          : 'text-gray-700';
                        
                        return (
                          <label
                            key={index}
                            className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded border ${bgColorClass} transition-colors`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedWeekdays[index]}
                              onChange={() => toggleWeekday(index)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <span className={`text-sm font-medium ${textColorClass}`}>
                              {day}
                            </span>
                            <span className="text-xs text-gray-500">
                              ({weekdayCounts[index]}回)
                            </span>
                          </label>
                        );
                      })}
                      
                      {/* ＋祝日ボタン */}
                      <label className="flex items-center gap-2 cursor-pointer bg-yellow-50 px-3 py-2 rounded border border-yellow-300 hover:bg-yellow-100 transition-colors">
                        <input
                          type="checkbox"
                          checked={includeUnselectedHolidays}
                          onChange={(e) => setIncludeUnselectedHolidays(e.target.checked)}
                          className="w-4 h-4 text-yellow-600 rounded focus:ring-2 focus:ring-yellow-500"
                        />
                        <span className="text-sm font-medium text-yellow-900">
                          ＋祝日
                        </span>
                      </label>
                    </div>
                    
                    {/* 選択された曜日の合計 */}
                    {selectedWeekdays.some(selected => selected) && (
                      <div className="mt-4 pt-3 border-t border-blue-300">
                        <p className="text-sm text-blue-900 mb-2">
                          選択した曜日の合計{includeUnselectedHolidays && '（＋未選択曜日の祝日）'}: 
                          <span className="text-2xl font-bold ml-2">
                            {getSelectedWeekdaysCount()}日
                          </span>
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
                  
                  {/* 期間内の祝日リスト */}
                  {(() => {
                    const holidayList = getHolidaysInRange();
                    const displayList = formatHolidayList(holidayList);
                    
                    if (holidayList.length > 0) {
                      return (
                        <div className="bg-yellow-50 border border-yellow-200 px-4 py-3 rounded-md">
                          <p className="font-medium text-yellow-900 mb-2">
                            期間内の祝日 ({holidayList.length}件)
                          </p>
                          <div className="space-y-1 text-sm">
                            {displayList?.map((holiday, index) => (
                              holiday.date === '...' ? (
                                <div key={index} className="text-center text-gray-500 py-1">
                                  ～
                                </div>
                              ) : (
                                <div key={index} className="flex items-center gap-2">
                                  <span className="text-gray-600 font-mono">
                                    {holiday.date}
                                  </span>
                                  <span className="text-yellow-900">
                                    {holiday.name}
                                  </span>
                                  <span className={`text-xs font-semibold ${
                                    holiday.dayOfWeek === '日' ? 'text-red-600' :
                                    holiday.dayOfWeek === '土' ? 'text-blue-600' :
                                    'text-gray-600'
                                  }`}>
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
              
              {!error && !result && date1Text && date2Text && (
                <div className="bg-gray-50 border border-gray-200 text-gray-700 px-4 py-3 rounded-md">
                  <p>日付を入力してください</p>
                </div>
              )}
            </div>

            {/* 使い方の説明 */}
            <div className="mt-6 text-sm text-gray-600">
              <p className="font-medium mb-2">使い方：</p>
              <ul className="list-disc list-inside space-y-1">
                <li>テキストボックスに日付を入力（YYYY-MM-DD形式）</li>
                <li>📅 ボタンをクリックしてカレンダーから日付を選択</li>
                <li>2つの日付を入力すると自動的に日数の差を計算します</li>
                <li>曜日のチェックボックスで指定した曜日の出現回数を確認できます</li>
                <li>対応形式: 2024-03-19, 2024/03/19, 20240319</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
