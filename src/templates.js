// 営業報告の定型テンプレート。ワンタップで入力欄に挿入できます。
export const REPORT_TEMPLATES = [
  {
    id: 'visit',
    label: '訪問報告',
    emoji: '🏢',
    body: '【訪問報告】\n訪問先：\n担当者：\n用件：\n結果：\n次回アクション：',
  },
  {
    id: 'deal',
    label: '商談進捗',
    emoji: '📈',
    body: '【商談進捗】\n案件名：\n進捗状況：\n受注確度：\n想定金額：\n課題／ネック：',
  },
  {
    id: 'daily',
    label: '日報',
    emoji: '📝',
    body: '【日報】\n本日の活動：\n成果：\n所感：\n明日の予定：',
  },
  {
    id: 'support',
    label: '対応報告',
    emoji: '🛠️',
    body: '【対応報告】\n顧客：\n内容：\n対応状況：\n今後の対応：',
  },
]
