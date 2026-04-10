"""
ファイル整理モジュール
PDF 添付ファイルを日付別フォルダに保存する。
"""

import re
import time
from datetime import datetime
from pathlib import Path

from graph_client import GraphClient

# Windows/macOS/Linux で使えないファイル名文字
_ILLEGAL_CHARS = re.compile(r'[\\/:*?"<>|]')


def sanitize_filename(text: str) -> str:
    """ファイル名として安全な文字列に変換する。"""
    cleaned = _ILLEGAL_CHARS.sub("", text)
    cleaned = re.sub(r"\s+", "_", cleaned.strip())
    return cleaned[:100]


def build_output_path(base_dir: Path, received_date: datetime, attachment_name: str) -> Path:
    """
    保存先パスを組み立てる。
    例: invoices/2026-01/20260110_請求書.pdf
    重複時は 20260110_請求書_2.pdf のようにサフィックスを付ける。
    """
    month_folder = base_dir / received_date.strftime("%Y-%m")
    date_prefix = received_date.strftime("%Y%m%d")
    safe_name = sanitize_filename(attachment_name)

    stem = Path(safe_name).stem
    suffix = Path(safe_name).suffix or ".pdf"
    candidate = month_folder / f"{date_prefix}_{stem}{suffix}"

    counter = 2
    while candidate.exists():
        candidate = month_folder / f"{date_prefix}_{stem}_{counter}{suffix}"
        counter += 1

    return candidate


def save_attachment(
    client: GraphClient,
    message_id: str,
    attachment: dict,
    output_path: Path,
) -> Path:
    """
    Graph API から添付ファイルをダウンロードして保存する。
    Returns: 保存先パス
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    data = client.get_attachment_bytes(message_id, attachment["id"])
    output_path.write_bytes(data)
    # API への負荷軽減
    time.sleep(0.2)
    return output_path
