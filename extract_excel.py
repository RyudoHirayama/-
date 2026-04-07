#!/usr/bin/env python3
"""ExcelファイルからデータをCSVに抽出するスクリプト"""

import argparse
import sys
from pathlib import Path

import pandas as pd


def extract_excel_to_csv(
    input_path: str,
    output_path: str | None = None,
    sheet: str | int = 0,
    encoding: str = "utf-8-sig",
) -> str:
    """ExcelファイルをCSVに変換する。

    Args:
        input_path: 入力Excelファイルのパス
        output_path: 出力CSVファイルのパス (省略時は入力ファイルと同名.csv)
        sheet: シート名またはインデックス (デフォルト: 0)
        encoding: CSV出力エンコーディング (デフォルト: utf-8-sig)

    Returns:
        出力CSVファイルのパス
    """
    input_file = Path(input_path)

    if not input_file.exists():
        raise FileNotFoundError(f"ファイルが見つかりません: {input_path}")

    if input_file.suffix.lower() not in (".xlsx", ".xls"):
        raise ValueError(f"対応していないファイル形式です: {input_file.suffix} (.xlsx または .xls のみ対応)")

    if output_path is None:
        output_file = input_file.with_suffix(".csv")
    else:
        output_file = Path(output_path)

    # シート指定が数字文字列の場合はintに変換
    if isinstance(sheet, str) and sheet.isdigit():
        sheet = int(sheet)

    try:
        df = pd.read_excel(input_file, sheet_name=sheet, engine="openpyxl")
    except ValueError as e:
        raise ValueError(f"シートの読み込みに失敗しました: {e}") from e

    df.to_csv(output_file, index=False, encoding=encoding)
    return str(output_file)


def main():
    parser = argparse.ArgumentParser(
        description="ExcelファイルのデータをCSVに抽出します",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用例:
  python extract_excel.py data.xlsx
  python extract_excel.py data.xlsx -o result.csv
  python extract_excel.py data.xlsx -s "Sheet1"
  python extract_excel.py data.xlsx --encoding utf-8
""",
    )
    parser.add_argument("input", help="入力Excelファイルのパス (.xlsx / .xls)")
    parser.add_argument("-o", "--output", help="出力CSVファイルのパス (省略時: 入力ファイルと同名.csv)")
    parser.add_argument("-s", "--sheet", default="0", help="シート名またはインデックス (デフォルト: 0)")
    parser.add_argument(
        "--encoding",
        default="utf-8-sig",
        help="CSV出力エンコーディング (デフォルト: utf-8-sig、BOM付きでExcelで文字化けしない)",
    )

    args = parser.parse_args()

    try:
        output = extract_excel_to_csv(
            input_path=args.input,
            output_path=args.output,
            sheet=args.sheet,
            encoding=args.encoding,
        )
        print(f"完了: {output}")
    except (FileNotFoundError, ValueError) as e:
        print(f"エラー: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
