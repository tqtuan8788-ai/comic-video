const BLOCKLIST = [
  'gore',
  'máu me',
  'chặt chém',
  '18+',
  'nsfw',
  'tục tĩu',
  'bạo lực cực đoan',
  'self-harm',
  'suicide',
  'tự tử',
  'phân biệt chủng tộc',
];

export interface SafetyResult {
  allowed: boolean;
  reason?: string;
  matched?: string;
}

export const checkContentSafety = (text: string): SafetyResult => {
  if (!text || !text.trim()) return { allowed: true };
  const lower = text.toLowerCase();
  for (const token of BLOCKLIST) {
    if (lower.includes(token)) {
      return { allowed: false, reason: 'Nội dung bị chặn bởi guardrails', matched: token };
    }
  }
  return { allowed: true };
};
