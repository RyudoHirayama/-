/**
 * アントレサロンからの請求書メールに添付された PDF を
 * Google ドライブの指定フォルダに自動保存するスクリプト。
 *
 * 仕組み:
 *   1. 時間主導型トリガー（例: 15分おき）で saveEntreSalonInvoices() が実行される
 *   2. 差出人アドレスが一致する未処理メールを Gmail から検索
 *   3. 添付の PDF を指定フォルダに保存
 *   4. 処理済みラベルを付けて、次回以降の重複保存を防止
 *
 * ▼ 初回セットアップ手順は README.md を参照してください。
 */

// ========= 設定（ここを自分の環境に合わせて変更）=========

// アントレサロンの差出人メールアドレス。
// 完全一致でも、ドメインだけ（例: 'entresalon.co.jp'）でもOK。
// 複数指定したい場合はカンマ区切りで配列に追加してください。
var SENDER_ADDRESSES = [
  'seikyu@gs.entre-salon.com'   // アントレサロンの請求書送信元アドレス
];

// 保存先 Google ドライブフォルダの ID。
// （Claude が作成した「アントレサロン請求書」フォルダの ID が入っています）
var DRIVE_FOLDER_ID = '1Tzjh0B5rcPvn6bmxbWBo480DdsGmwBp7';

// 処理済みメールに付けるラベル名（重複保存防止用）。存在しなければ自動作成されます。
var PROCESSED_LABEL = 'アントレサロン請求書/保存済み';

// 保存対象とする添付ファイルの拡張子（小文字）。PDF のみ対象。
var TARGET_EXTENSIONS = ['pdf'];

// 1回の実行で処理する最大スレッド数（実行時間の上限対策）。
var MAX_THREADS_PER_RUN = 20;

// =========================================================

/**
 * メイン関数。トリガーからこの関数を呼び出します。
 */
function saveEntreSalonInvoices() {
  var folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  var label = getOrCreateLabel_(PROCESSED_LABEL);

  // 差出人条件を Gmail 検索クエリに変換。
  // 例: (from:invoice@entresalon.co.jp) has:attachment filename:pdf -label:"..."
  var fromQuery = SENDER_ADDRESSES
    .map(function (addr) { return 'from:' + addr; })
    .join(' OR ');

  var query = '(' + fromQuery + ') has:attachment filename:pdf -label:"' + PROCESSED_LABEL + '"';

  var threads = GmailApp.search(query, 0, MAX_THREADS_PER_RUN);
  Logger.log('検索ヒット: ' + threads.length + ' スレッド');

  var savedCount = 0;

  for (var t = 0; t < threads.length; t++) {
    var thread = threads[t];
    var messages = thread.getMessages();
    var savedInThread = false;

    for (var m = 0; m < messages.length; m++) {
      var attachments = messages[m].getAttachments();

      for (var a = 0; a < attachments.length; a++) {
        var attachment = attachments[a];
        if (!isTargetAttachment_(attachment)) {
          continue;
        }

        var fileName = buildFileName_(messages[m], attachment);
        if (folderHasFile_(folder, fileName)) {
          // 同名ファイルが既にある場合はスキップ（重複防止）
          continue;
        }

        folder.createFile(attachment.copyBlob()).setName(fileName);
        savedCount++;
        savedInThread = true;
        Logger.log('保存: ' + fileName);
      }
    }

    // 添付を1つでも保存したら、処理済みラベルを付けて次回スキップ
    if (savedInThread) {
      thread.addLabel(label);
    }
  }

  Logger.log('完了: ' + savedCount + ' 件の PDF を保存しました');
}

/**
 * 添付が保存対象（PDF）かどうか判定。
 */
function isTargetAttachment_(attachment) {
  var name = (attachment.getName() || '').toLowerCase();
  var contentType = (attachment.getContentType() || '').toLowerCase();

  if (contentType.indexOf('pdf') !== -1) {
    return true;
  }
  for (var i = 0; i < TARGET_EXTENSIONS.length; i++) {
    if (name.lastIndexOf('.' + TARGET_EXTENSIONS[i]) === name.length - (TARGET_EXTENSIONS[i].length + 1)) {
      return true;
    }
  }
  return false;
}

/**
 * 保存ファイル名を組み立てる。
 * 受信日（YYYY-MM-DD）を先頭に付けて、フォルダ内で時系列に並ぶようにする。
 * 例: 2026-06-13_請求書.pdf
 */
function buildFileName_(message, attachment) {
  var tz = Session.getScriptTimeZone();
  var datePrefix = Utilities.formatDate(message.getDate(), tz, 'yyyy-MM-dd');
  return datePrefix + '_' + attachment.getName();
}

/**
 * フォルダ内に同名ファイルが存在するか確認。
 */
function folderHasFile_(folder, fileName) {
  var files = folder.getFilesByName(fileName);
  return files.hasNext();
}

/**
 * ラベルを取得（なければ作成）。
 */
function getOrCreateLabel_(labelName) {
  var label = GmailApp.getUserLabelByName(labelName);
  if (!label) {
    label = GmailApp.createLabel(labelName);
  }
  return label;
}

/**
 * 時間主導型トリガーを作成するヘルパー。
 * スクリプトエディタでこの関数を「1回だけ」実行すると、
 * 15分おきに saveEntreSalonInvoices() が自動実行されるようになります。
 */
function createTrigger() {
  // 既存の同名トリガーを削除（重複登録防止）
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'saveEntreSalonInvoices') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger('saveEntreSalonInvoices')
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log('トリガーを作成しました（15分おきに実行）');
}
