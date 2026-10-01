// 共用介面元件
import { useEffect, useState } from 'react';

export function PageHead({ eyebrow, title, desc, action }) {
  return (
    <div className="page-head row between">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {desc && <p>{desc}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ title, action, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card-title">
          {typeof title === 'string' ? <h2>{title}</h2> : title}
          {action && <div className="row">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, gold }) {
  return (
    <div className={`stat ${gold ? 'gold' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function Progress({ value }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return <div className="progress" role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${v}%` }} /></div>;
}

export function Empty({ icon = '✦', title, children }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div style={{ fontWeight: 500, color: 'var(--tea-dark)' }}>{title}</div>
      {children && <div className="small mt">{children}</div>}
    </div>
  );
}

export function Field({ label, hint, error, children, full }) {
  return (
    <div className={`field ${full ? 'full' : ''}`}>
      {label && <label>{label}</label>}
      {children}
      {error ? <span className="err-text">{error}</span> : hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function Modal({ title, onClose, children, actions }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <h3>{title}</h3>
        {children}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}

// 刪除確認。重要資料（財務）使用 strong 會多一段提醒
export function Confirm({ title = '確定要刪除嗎？', message, strong, confirmText = '確定刪除', onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={title}
      onClose={onClose}
      actions={<>
        <button className="btn ghost" onClick={onClose}>取消</button>
        <button className="btn danger" disabled={busy} onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); onClose(); }}>
          {busy ? <span className="spinner" /> : null}{confirmText}
        </button>
      </>}
    >
      <p>{message || '刪除後無法復原。'}</p>
      {strong && <div className="notice warn mt">這是財務紀錄，刪除後相關的統計（餘額、剩餘債務、存錢進度）都會重新計算。建議先匯出備份。</div>}
    </Modal>
  );
}

export function Chips({ options, value, onChange }) {
  return (
    <div className="chips">
      {options.map(([k, label]) => (
        <button key={k} type="button" className={`chip ${value === k ? 'active' : ''}`} onClick={() => onChange(k)}>{label}</button>
      ))}
    </div>
  );
}

// 表單 state 小工具
export function useForm(initial) {
  const [form, setForm] = useState(initial);
  const bind = (key) => ({
    value: form[key] ?? '',
    onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })),
  });
  return [form, setForm, bind];
}
