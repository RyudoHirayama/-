#!/usr/bin/env python3
"""
銀座アントレサロン 請求書自動取得ツール

使い方:
    python fetch_invoices.py                        # 通常実行（デバイスコードフロー）
    python fetch_invoices.py --days-back 90         # 直近90日分
    python fetch_invoices.py --dry-run              # ダウンロードせずにプレビュー
    python fetch_invoices.py --auth client          # クライアント資格情報フロー
"""

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

from auth import GraphAuthenticator
from graph_client import GraphClient
from email_processor import search_invoice_emails, get_pdf_attachments
from file_organizer import build_output_path, save_attachment
from summary_writer import load_or_create_workbook, append_invoice_rows, save_summary


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Outlookメールから銀座アントレサロンの請求書を取得・整理します"
    )
    parser.add_argument(
        "--days-back",
        type=int,
        default=None,
        metavar="N",
        help="何日前まで遡って検索するか（デフォルト: .env の DAYS_BACK）",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=None,
        metavar="DIR",
        help="保存先ディレクトリ（デフォルト: .env の INVOICE_OUTPUT_DIR）",
    )
    parser.add_argument(
        "--auth",
        choices=["device", "client"],
        default=None,
        help="認証フロー: device=デバイスコード, client=クライアント資格情報",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="検索結果を表示するだけでダウンロードしない",
    )
    return parser.parse_args()


def validate_env() -> dict:
    """必須環境変数を検証して dict で返す。不足時は sys.exit。"""
    missing = []
    for key in ("AZURE_CLIENT_ID", "AZURE_TENANT_ID"):
        if not os.getenv(key):
            missing.append(key)
    if missing:
        print(f"エラー: .env に次の変数が設定されていません: {', '.join(missing)}")
        print("  cp .env.example .env  してから .env を編集してください。")
        print("  Azure Portal でアプリを登録する方法は .env.example を参照してください。")
        sys.exit(1)

    return {
        "client_id": os.getenv("AZURE_CLIENT_ID"),
        "tenant_id": os.getenv("AZURE_TENANT_ID"),
        "client_secret": os.getenv("AZURE_CLIENT_SECRET", ""),
        "sender_keyword": os.getenv("SEARCH_SENDER", "銀座アントレサロン"),
        "subject_keyword": os.getenv("SEARCH_SUBJECT_KEYWORD", "請求書"),
        "output_dir": os.getenv("INVOICE_OUTPUT_DIR", "invoices"),
        "days_back": int(os.getenv("DAYS_BACK", "365")),
    }


def main() -> None:
    load_dotenv()
    args = parse_args()
    config = validate_env()

    # CLI 引数で .env を上書き
    if args.days_back is not None:
        config["days_back"] = args.days_back
    if args.output_dir is not None:
        config["output_dir"] = args.output_dir
    if args.auth == "device":
        config["client_secret"] = ""
    elif args.auth == "client" and not config["client_secret"]:
        print("エラー: --auth client を指定しましたが AZURE_CLIENT_SECRET が設定されていません。")
        sys.exit(1)

    output_dir = Path(config["output_dir"])
    summary_path = output_dir / "summary.xlsx"

    print(f"検索条件: 送信者='{config['sender_keyword']}' / 直近{config['days_back']}日間")
    if args.dry_run:
        print("※ドライランモード: ファイルはダウンロードされません\n")

    # 認証
    try:
        authenticator = GraphAuthenticator(
            client_id=config["client_id"],
            tenant_id=config["tenant_id"],
            client_secret=config["client_secret"],
        )
        token = authenticator.get_token()
    except RuntimeError as e:
        print(f"\n認証エラー: {e}")
        print("Azure AD アプリの設定を確認してください（.env.example 参照）。")
        sys.exit(1)

    client = GraphClient(token)

    # メール検索とダウンロード
    email_count = 0
    file_count = 0
    summary_records = []

    try:
        for email in search_invoice_emails(
            client,
            sender_keyword=config["sender_keyword"],
            subject_keyword=config["subject_keyword"],
            days_back=config["days_back"],
        ):
            if not email["has_attachments"]:
                continue

            email_count += 1
            date_str = email["received_date"].strftime("%Y-%m-%d")
            print(f"[{date_str}] {email['subject']} ({email['sender_name']})")

            try:
                attachments = get_pdf_attachments(client, email["message_id"])
            except RuntimeError as e:
                print(f"  添付ファイル取得エラー: {e}")
                continue

            if not attachments:
                print("  → PDF 添付なし、スキップ")
                continue

            for att in attachments:
                output_path = build_output_path(
                    output_dir, email["received_date"], att["name"]
                )
                size_kb = att["size"] // 1024
                print(f"  → {att['name']} ({size_kb} KB)")

                if not args.dry_run:
                    try:
                        saved_path = save_attachment(client, email["message_id"], att, output_path)
                        relative_path = str(saved_path.relative_to(Path(".")))
                        summary_records.append({
                            "received_date": email["received_date"],
                            "subject": email["subject"],
                            "sender_name": email["sender_name"],
                            "sender_email": email["sender_email"],
                            "filename": relative_path,
                        })
                        file_count += 1
                        print(f"     保存: {relative_path}")
                    except Exception as e:
                        print(f"     保存エラー: {e}")

    except RuntimeError as e:
        print(f"\nAPI エラー: {e}")
        sys.exit(1)

    # Excel サマリー更新
    if not args.dry_run and summary_records:
        wb = load_or_create_workbook(summary_path)
        added = append_invoice_rows(wb, summary_records)
        save_summary(wb, summary_path)
        print(f"\nサマリー更新: {added}行追記 → {summary_path}")

    # 完了メッセージ
    print(f"\n完了: {email_count}件のメールを検索、{file_count}件のファイルをダウンロードしました。")
    if args.dry_run:
        print("（ドライランのためファイルは保存されていません）")


if __name__ == "__main__":
    main()
