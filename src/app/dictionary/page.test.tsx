import { fireEvent, render, screen } from "@testing-library/react";
import DictionaryPage from "./page";

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = jest.fn().mockImplementation(async (url: string) => ({
    ok: true,
    text: async () => url.endsWith("/index.csv")
      ? "First,first.csv\nSecond,second.csv"
      : url.endsWith("/first.csv")
        ? "Word\napple\npear"
        : "Word\npineapple\nmelon",
  }));
});

afterEach(() => {
  global.fetch = originalFetch;
});

test("keeps the query when selecting and switching dictionaries, and searches the new data", async () => {
  render(<DictionaryPage />);
  await screen.findByRole("option", { name: "First" });
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "apple" } });

  fireEvent.change(screen.getByRole("combobox"), { target: { value: "first.csv" } });
  await screen.findByRole("cell", { name: "pear" });
  expect(input).toHaveValue("apple");

  fireEvent.click(screen.getByRole("button", { name: "検索" }));
  expect(screen.queryByRole("cell", { name: "pear" })).not.toBeInTheDocument();

  fireEvent.change(screen.getByRole("combobox"), { target: { value: "second.csv" } });
  await screen.findByRole("cell", { name: "melon" });
  expect(input).toHaveValue("apple");

  fireEvent.click(screen.getByRole("button", { name: "検索" }));
  expect(screen.getByRole("cell", { name: "pineapple" })).toBeInTheDocument();
  expect(screen.queryByRole("cell", { name: "melon" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "リセット" }));
  expect(input).toHaveValue("");
  expect(screen.getByRole("cell", { name: "melon" })).toBeInTheDocument();
});

test("keeps the query when loading a local CSV", async () => {
  render(<DictionaryPage />);
  await screen.findByRole("option", { name: "First" });
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "first.csv" } });
  await screen.findByRole("cell", { name: "pear" });
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "apple" } });
  fireEvent.click(screen.getByRole("button", { name: "検索" }));

  const file = new File(["Word\ncrabapple\npeach"], "local.csv", { type: "text/csv" });
  Object.defineProperty(file, "text", {
    value: async () => "Word\ncrabapple\npeach",
  });
  fireEvent.change(screen.getByLabelText("CSVファイルを選択"), {
    target: { files: [file] },
  });

  await screen.findByRole("cell", { name: "peach" });
  expect(input).toHaveValue("apple");
  expect(screen.getByRole("combobox")).toHaveValue("");

  fireEvent.click(screen.getByRole("button", { name: "検索" }));
  expect(screen.getByRole("cell", { name: "crabapple" })).toBeInTheDocument();
  expect(screen.queryByRole("cell", { name: "peach" })).not.toBeInTheDocument();
});

test.each([51, 500, 501])("shows 50 rows before searching and up to 500 of %i matches", async (count) => {
  const data = Array.from({ length: count }, (_, i) => `match-${i + 1}`).join("\n");
  global.fetch = jest.fn().mockImplementation(async (url: string) => ({
    ok: true,
    text: async () => url.endsWith("/index.csv")
      ? "First,first.csv\nSecond,second.csv"
      : `${url.endsWith("/first.csv") ? "Word" : "Other"}\n${data}`,
  }));
  const { container } = render(<DictionaryPage />);
  const displayedRowCount = () => container.querySelectorAll("tbody tr").length;
  await screen.findByRole("option", { name: "First" });
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "first.csv" } });
  await screen.findByText(`表示50件（全${count}件）`);
  expect(displayedRowCount()).toBe(50);

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "match-" } });
  fireEvent.click(screen.getByRole("button", { name: "検索" }));
  expect(displayedRowCount()).toBe(Math.min(count, 500));
  expect(screen.getByRole("cell", { name: `match-${Math.min(count, 500)}` })).toBeInTheDocument();
  expect(screen.queryByRole("cell", { name: "match-501" })).not.toBeInTheDocument();
  expect(screen.getByText(count > 500 ? "500件以上" : `${count}件`)).toBeInTheDocument();
  const warning = screen.queryByText("最大件数を超えました（先頭500件のみ表示）");
  if (count > 500) {
    expect(warning).toBeInTheDocument();
  } else {
    expect(warning).not.toBeInTheDocument();
  }

  fireEvent.click(screen.getByRole("button", { name: "リセット" }));
  expect(displayedRowCount()).toBe(50);
  expect(screen.queryByText("最大件数を超えました（先頭500件のみ表示）")).not.toBeInTheDocument();

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "match-" } });
  fireEvent.click(screen.getByRole("button", { name: "検索" }));
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "second.csv" } });
  await screen.findByText("Other");
  expect(displayedRowCount()).toBe(50);
  expect(screen.getByRole("textbox")).toHaveValue("match-");
  expect(screen.queryByText("最大件数を超えました（先頭500件のみ表示）")).not.toBeInTheDocument();
});
