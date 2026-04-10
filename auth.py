"""
Microsoft Graph API 認証モジュール
MSAL を使ってデバイスコードフローまたはクライアント資格情報フローでトークンを取得する。
"""

import json
import os
from pathlib import Path

import msal

SCOPES_DELEGATED = ["https://graph.microsoft.com/Mail.Read"]
SCOPES_APP = ["https://graph.microsoft.com/.default"]
TOKEN_CACHE_PATH = Path(".token_cache.json")


class GraphAuthenticator:
    def __init__(self, client_id: str, tenant_id: str, client_secret: str = ""):
        self.client_id = client_id
        self.tenant_id = tenant_id
        self.client_secret = client_secret
        self.authority = f"https://login.microsoftonline.com/{tenant_id}"
        self._cache = self._load_cache()

    def _load_cache(self) -> msal.SerializableTokenCache:
        cache = msal.SerializableTokenCache()
        if TOKEN_CACHE_PATH.exists():
            cache.deserialize(TOKEN_CACHE_PATH.read_text(encoding="utf-8"))
        return cache

    def _save_cache(self) -> None:
        if self._cache.has_state_changed:
            TOKEN_CACHE_PATH.write_text(self._cache.serialize(), encoding="utf-8")

    def get_token(self) -> str:
        """アクセストークンを返す。キャッシュがあればサイレント取得、なければフローを起動。"""
        if self.client_secret:
            return self._get_token_client_credentials()
        return self._get_token_device_code()

    def _get_token_client_credentials(self) -> str:
        app = msal.ConfidentialClientApplication(
            self.client_id,
            authority=self.authority,
            client_credential=self.client_secret,
            token_cache=self._cache,
        )
        result = app.acquire_token_for_client(scopes=SCOPES_APP)
        self._save_cache()
        if "access_token" not in result:
            raise RuntimeError(
                f"クライアント資格情報フローでトークン取得失敗: {result.get('error_description', result)}"
            )
        return result["access_token"]

    def _get_token_device_code(self) -> str:
        app = msal.PublicClientApplication(
            self.client_id,
            authority=self.authority,
            token_cache=self._cache,
        )

        # キャッシュからサイレント取得を試みる
        accounts = app.get_accounts()
        if accounts:
            result = app.acquire_token_silent(scopes=SCOPES_DELEGATED, account=accounts[0])
            if result and "access_token" in result:
                self._save_cache()
                return result["access_token"]

        # デバイスコードフロー起動
        flow = app.initiate_device_flow(scopes=SCOPES_DELEGATED)
        if "user_code" not in flow:
            raise RuntimeError(
                f"デバイスコードフロー開始失敗: {flow.get('error_description', flow)}"
            )

        print("\n" + "=" * 60)
        print(flow["message"])
        print("=" * 60 + "\n")

        result = app.acquire_token_by_device_flow(flow)
        self._save_cache()

        if "access_token" not in result:
            raise RuntimeError(
                f"デバイスコードフローでトークン取得失敗: {result.get('error_description', result)}"
            )
        return result["access_token"]
