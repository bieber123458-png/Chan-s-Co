// 金額、日期與數字格式
export const fmtMoney = (n) => {
  if (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) return '—';
  const v = Math.round(Number(n));
  return `${v < 0 ? '-' : ''}NT$${Math.abs(v).toLocaleString('zh-TW')}`;
};
export const fmtNum = (n) => (n === null || n === undefined || n === '' ? '—' : Number(n).toLocaleString('zh-TW'));
export const fmtPct = (n) => (n === null || n === undefined ? '—' : `${Math.round(n)}%`);

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
export const fmtDate = (s) => {
  if (!s) return '—';
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}（${WEEK[dt.getDay()]}）`;
};
export const fmtShortDate = (s) => (s ? s.slice(5).replace('-', '/') : '—');
export const fmtDateTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// 表單數字欄位：空字串保留為空，其餘轉數字
export const numOrEmpty = (v) => (v === '' || v === null || v === undefined ? '' : Number(v));

// 驗證金額：必須是 >= 0 的數字
export const validAmount = (v, { allowZero = false } = {}) => {
  if (v === '' || v === null || v === undefined) return false;
  const n = Number(v);
  return Number.isFinite(n) && (allowZero ? n >= 0 : n > 0);
};
export const validDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
