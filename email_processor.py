"""
メール検索・添付ファイル取得モジュール
Microsoft Graph API でメールボックスを検索し、請求書レコードを返す。
"""

import time
from datetime import datetime, timezone, timedelta
from typing import Generator

from graph_client import GraphClient


def search_invoice_emails(
    client: GraphClient,
    sender_keyword: str,
    subject_keyword: str,
    days_back: int,
) -> Generator[dict, None, None]:
    """
    条件に一致するメールを検索し、レコードを yield する。

    Yields:
        {
            "message_id": str,
            "received_date": datetime,
            "subject": str,
            "sender_name": str,
            "sender_email": str,
            "has_attachments": bool,
        }
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days_back)

    # KQL 検索で送信者キーワードに合致するメールを取得
    # $search と $filter は併用不可のため、日付フィルタは Python 側で行う
    params = {
        "$search": f'"from:{sender_keyword}"',
        "$select": "id,subject,from,receivedDateTime,hasAttachments",
        "$top": "50",
        "$orderby": "receivedDateTime desc",
    }

    for msg in client.get_all_pages("/me/messages", params=params):
        received_str = msg.get("receivedDateTime", "")
        try:
            received_date = datetime.fromisoformat(received_str.replace("Z", "+00:00"))
        except ValueError:
            continue

        # 日付範囲フィルタ
        if received_date < cutoff:
            break  # orderby desc なのでここより古いものは不要

        sender = msg.get("from", {}).get("emailAddress", {})
        yield {
            "message_id": msg["id"],
            "received_date": received_date,
            "subject": msg.get("subject", "（件名なし）"),
            "sender_name": sender.get("name", ""),
            "sender_email": sender.get("address", ""),
            "has_attachments": msg.get("hasAttachments", False),
        }


def get_pdf_attachments(client: GraphClient, message_id: str) -> list[dict]:
    """
    メッセージの PDF 添付ファイル一覧を返す。

    Returns:
        [{"id": str, "name": str, "size": int}, ...]
    """
    params = {"$select": "id,name,contentType,size"}
    data = client.get(f"/me/messages/{message_id}/attachments", params=params)
    attachments = data.get("value", [])

    pdf_attachments = []
    for att in attachments:
        content_type = att.get("contentType", "")
        name = att.get("name", "")
        if content_type == "application/pdf" or name.lower().endswith(".pdf"):
            pdf_attachments.append({
                "id": att["id"],
                "name": name,
                "size": att.get("size", 0),
            })
    return pdf_attachments
