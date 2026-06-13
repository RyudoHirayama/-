# アントレサロン請求書 自動保存（Outlook → Gmail → Google ドライブ）

アントレサロンから **Outlook（`hirayama@hirayamakeizai.jp`）** に届く請求書メールの
**PDF 添付ファイル** を、Google ドライブのフォルダに **自動で保存** する仕組みです。

メールが届くたびに手作業でダウンロード→保存する必要がなくなります。

---

## 全体の流れ

```
[アントレサロン]
   │ 請求書メール（seikyu@gs.entre-salon.com）
   ▼
[Outlook 受信トレイ] hirayama@hirayamakeizai.jp
   │ ① Outlook のルールで自動転送
   ▼
[Gmail] hirayama.ryudo@gmail.com
   │ ② Apps Script が15分おきにチェック
   │   （題名に「アントレサロン請求書」を含むメールが対象）
   ▼
[Google ドライブ] 「アントレサロン請求書」フォルダに PDF を保存
```

- **①** は Outlook 側の転送ルール（無料・標準機能）
- **②** は Google Apps Script（あなたの Gmail アカウント上で自動実行）

> Outlook は Gmail を直接読めず、Apps Script は Outlook を直接読めないため、
> 「Outlook → Gmail への転送」で両者を橋渡しします。

---

## 保存先フォルダ

- 名前: **アントレサロン請求書**（マイドライブ直下）
- フォルダURL: https://drive.google.com/drive/folders/1Tzjh0B5rcPvn6bmxbWBo480DdsGmwBp7

（このフォルダは作成済みです）

---

## セットアップ手順

### STEP 1. Outlook で自動転送ルールを作る

アントレサロンからの請求書を、Gmail（`hirayama.ryudo@gmail.com`）に自動転送します。

1. Outlook（Web版 outlook.office.com など）の **設定 → メール → ルール** を開く
2. **「新しいルールを追加」** をクリック
3. 条件と動作を次のように設定:
   - 名前: `アントレサロン請求書 転送`
   - 条件（差出人）: **`seikyu@gs.entre-salon.com`**
   - アクション: **転送（Forward）** → 宛先 **`hirayama.ryudo@gmail.com`**
4. 保存

> ヒント: Outlook の「転送」が件名に `FW:` を付けても問題ありません。
> 後段のスクリプトは **題名（件名）に「アントレサロン請求書」が含まれるか** で
> 判定するため、`FW:` が付いていても含まれていればヒットします。
> 添付PDFはそのまま引き継がれます。

> 注意: スクリプトは「件名にキーワードを含むメール」を対象にするため、
> 請求書メールの件名に **「アントレサロン請求書」** が入っている必要があります。
> 実際の件名が異なる場合は、`Code.gs` の `SUBJECT_KEYWORD` を実際の件名に
> 合わせて変更してください。

### STEP 2. Apps Script プロジェクトを作る

1. ブラウザで <https://script.google.com>（`hirayama.ryudo@gmail.com` でログイン）を開く
2. **「新しいプロジェクト」** をクリック
3. エディタの中身をすべて削除し、このリポジトリの [`Code.gs`](./Code.gs) の中身を
   **すべて貼り付け** て保存（Ctrl+S / ⌘+S）

設定値（`Code.gs` 先頭）は記入済みです。必要に応じて変更してください。

| 変数 | 値 |
| --- | --- |
| `SUBJECT_KEYWORD` | `アントレサロン請求書`（題名にこれを含むメールが対象） |
| `DRIVE_FOLDER_ID` | 保存先フォルダID（設定済み） |

### STEP 3. 自動実行を有効にする

1. スクリプトエディタ上部の関数選択メニューで **`createTrigger`** を選ぶ
2. **「実行」** ボタンを押す
3. 初回は Google の **権限承認** 画面が出ます → アカウントを選び、
   「詳細」→「（プロジェクト名）に移動」→「許可」で承認
   （Gmail の読み取りと Drive への保存に必要です）
4. これで **15分おきに自動実行** されます

### STEP 4. 動作確認

1. アントレサロンの請求書メールを1通、手動で Gmail に転送してテストできます
   （または Outlook ルール設定後、新しい請求書が届くのを待つ）
2. 関数選択メニューで **`saveEntreSalonInvoices`** を選び「実行」
3. 上記の Google ドライブフォルダに PDF が保存されていれば成功です
   （「表示 → ログ」で処理結果を確認できます）

---

## 保存されるファイル名

受信日が先頭に付くので、フォルダ内で日付順に並びます。

```
2026-06-13_請求書.pdf
```

---

## 設定の変更（任意）

`Code.gs` 先頭の変数で挙動を調整できます。

| 変数 | 内容 |
| --- | --- |
| `SUBJECT_KEYWORD` | 題名（件名）に含まれていれば処理対象とするキーワード |
| `DRIVE_FOLDER_ID` | 保存先フォルダの ID（URL末尾の文字列） |
| `PROCESSED_LABEL` | 処理済みメールに付ける Gmail ラベル名 |
| `MAX_THREADS_PER_RUN` | 1回の実行で処理する最大メール数 |

実行間隔（既定15分）を変えたい場合は、`createTrigger` 内の
`.everyMinutes(15)` を `.everyHours(1)` などに変更し、再度 `createTrigger` を実行してください。

---

## よくある質問

- **過去のメールも保存される？**
  はい。条件に一致する未処理メールはすべて対象です（転送後に Gmail に届いたもの）。
- **同じ請求書が二重に保存される？**
  されません。処理済みラベルと同名ファイルのチェックで重複を防ぎます。
- **転送せず Outlook から直接 Google ドライブに保存したい**
  その場合は Microsoft Power Automate を使う別方式になります。必要なら相談してください。
- **PDF 以外の添付（画像など）も保存したい**
  `Code.gs` の `TARGET_EXTENSIONS` に拡張子を追加してください。
