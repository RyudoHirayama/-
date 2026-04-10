"""
Microsoft Graph API クライアント
ページネーション・エラーハンドリング・添付ファイル取得を担う薄いラッパー。
"""

import base64
import time
from typing import Any, Generator

import requests

GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"


class GraphClient:
    def __init__(self, access_token: str):
        self.session = requests.Session()
        self.session.headers.update({"Authorization": f"Bearer {access_token}"})

    def get(self, endpoint: str, params: dict | None = None) -> dict:
        """GETリクエストを送り、JSONをパースして返す。非2xxは例外。"""
        url = endpoint if endpoint.startswith("http") else f"{GRAPH_BASE_URL}{endpoint}"
        response = self.session.get(url, params=params)
        self._raise_for_status(response)
        return response.json()

    def get_all_pages(
        self, endpoint: str, params: dict | None = None
    ) -> Generator[dict, None, None]:
        """@odata.nextLink を追いながら全ページのアイテムを yield する。"""
        url = endpoint if endpoint.startswith("http") else f"{GRAPH_BASE_URL}{endpoint}"
        current_params = params

        while url:
            response = self.session.get(url, params=current_params)
            self._raise_for_status(response)
            data = response.json()

            for item in data.get("value", []):
                yield item

            url = data.get("@odata.nextLink")
            current_params = None  # nextLink には既にパラメータが含まれる

    def get_attachment_bytes(self, message_id: str, attachment_id: str) -> bytes:
        """添付ファイルの生バイトを返す（contentBytes を base64 デコード）。"""
        endpoint = f"/me/messages/{message_id}/attachments/{attachment_id}"
        data = self.get(endpoint)
        return base64.b64decode(data["contentBytes"])

    def _raise_for_status(self, response: requests.Response) -> None:
        if response.status_code == 429:
            retry_after = int(response.headers.get("Retry-After", 10))
            print(f"  レート制限: {retry_after}秒待機中...")
            time.sleep(retry_after)
            raise RuntimeError("429 Too Many Requests — 呼び出し元でリトライしてください")
        if not response.ok:
            raise RuntimeError(
                f"Graph API エラー {response.status_code}: {response.text[:300]}"
            )
