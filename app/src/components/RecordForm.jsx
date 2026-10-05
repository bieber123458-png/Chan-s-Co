// 通用新增／編輯表單（依欄位定義產生，含基本驗證）
// 欄位型別：text、textarea、date、number（>=0）、money（>=0 金額）、select、checkbox
import { useState } from 'react';
import { Modal, Field } from './ui.jsx';
import { toDateStr } from '../lib/plan.js';

export function blankFrom(fields, extra = {}) {
  const o = {};
  for (const f of fields) {
    if (f.default !== undefined) o[f.key] = typeof f.default === 'function' ? f.default() : f.default;
    else if (f.type === 'date') o[f.key] = toDateStr();
    else if (f.type === 'select') o[f.key] = f.options[0][0];
    else if (f.type === 'checkbox') o[f.key] = false;
    else o[f.key] = '';
  }
  return { ...o, ...extra };
}

export function validate(fields, v) {
  const err = {};
  for (const f of fields) {
    const val = v[f.key];
    const empty = val === '' || val === null || val === undefined;
    if (f.required && empty) { err[f.key] = `請填寫${f.label}`; continue; }
    if (empty) continue;
    if (f.type === 'number' || f.type === 'money') {
      const n = Number(val);
      if (!Number.isFinite(n)) err[f.key] = '請輸入數字';
      else if (n < (f.min ?? 0)) err[f.key] = f.min !== undefined ? `不能小於 ${f.min}` : '不能是負數';
      else if (f.max !== undefined && n > f.max) err[f.key] = `不能大於 ${f.max}`;
      else if (f.type === 'money' && f.positive && n <= 0) err[f.key] = '金額需大於 0';
    }
    if (f.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(val)) err[f.key] = '日期格式不正確';
  }
  return err;
}

export function normalize(fields, v) {
  const out = { ...v };
  for (const f of fields) {
    if ((f.type === 'number' || f.type === 'money') && out[f.key] !== '' && out[f.key] !== undefined) out[f.key] = Number(out[f.key]);
    if (typeof out[f.key] === 'string' && f.type !== 'textarea') out[f.key] = out[f.key].trim();
  }
  return out;
}

export function FieldInput({ f, value, onChange, error }) {
  const cls = `input ${error ? 'invalid' : ''}`;
  if (f.type === 'textarea') return <textarea className={cls} rows={f.rows || 3} value={value ?? ''} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />;
  if (f.type === 'select') {
    // 舊資料的值如果已經不在選項裡，仍然顯示出來，避免編輯時被悄悄改掉
    const opts = value !== '' && value != null && !f.options.some(([k]) => String(k) === String(value)) ? [...f.options, [value, String(value)]] : f.options;
    return (
      <select className={cls} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {opts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
    );
  }
  if (f.type === 'checkbox') return <label className="check"><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />{f.checkLabel}</label>;
  const numeric = f.type === 'number' || f.type === 'money';
  return (
    <input className={cls} type={f.type === 'date' ? 'date' : numeric ? 'number' : 'text'} inputMode={numeric ? 'decimal' : undefined}
      min={numeric ? (f.min ?? 0) : undefined} step={f.step || (numeric ? 'any' : undefined)}
      placeholder={f.placeholder} value={value ?? ''} list={f.suggestions ? `dl-${f.key}` : undefined} onChange={(e) => onChange(e.target.value)} />
  );
}

// check：跨欄位驗證，回傳 { 欄位: 錯誤訊息 }
export default function RecordForm({ title, fields, initial, onSave, onClose, children, onChange, check }) {
  const [v, setV] = useState(initial);
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k, val) => setV((x) => {
    const next = { ...x, [k]: val };
    return onChange ? onChange(next, k) : next;
  });

  const submit = async () => {
    const e = validate(fields, v);
    if (!Object.keys(e).length && check) Object.assign(e, check(normalize(fields, v)));
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const ok = await onSave(normalize(fields, v));
    setBusy(false);
    if (ok !== false && ok !== null) onClose();
  };

  return (
    <Modal title={title} onClose={onClose}
      actions={<><button className="btn ghost" onClick={onClose}>取消</button><button className="btn" onClick={submit} disabled={busy}>{busy ? <span className="spinner" /> : null}儲存</button></>}>
      <div className="form-grid">
        {fields.map((f) => (
          <Field key={f.key} label={f.label + (f.required ? ' *' : '')} hint={f.hint} error={err[f.key]} full={f.full || f.type === 'textarea'}>
            <FieldInput f={f} value={v[f.key]} error={err[f.key]} onChange={(val) => set(f.key, val)} />
            {f.suggestions && <datalist id={`dl-${f.key}`}>{f.suggestions.map((s) => <option key={s} value={s} />)}</datalist>}
          </Field>
        ))}
      </div>
      {typeof children === 'function' ? children(v) : children}
    </Modal>
  );
}
