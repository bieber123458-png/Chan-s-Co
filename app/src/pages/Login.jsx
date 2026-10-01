import { useState } from 'react';
import { remote } from '../lib/api.js';

export default function Login({ status, onDone }) {
  const [isRegister, setIsRegister] = useState(!!status?.registrationOpen);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (username.trim().length < 2) return setError('帳號至少 2 個字');
    if (password.length < 6) return setError('密碼至少 6 個字元');
    setBusy(true);
    try {
      const r = isRegister ? await remote.register(username.trim(), password) : await remote.login(username.trim(), password);
      onDone(r.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <div className="eyebrow">MONTHLY · GROW YOUR BUSINESS</div>
        <h1 style={{ fontSize: 24, color: 'var(--tea-dark)', marginTop: 4 }}>小陳的每月經營系統</h1>
        <p className="muted small mt">{isRegister ? '建立你的帳號，資料會安全保存在伺服器資料庫，換裝置登入也看得到。' : '登入後繼續你的每月經營計畫。'}</p>
        <div className="field mt">
          <label htmlFor="u">帳號</label>
          <input id="u" className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="p">密碼</label>
          <input id="p" className="input" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
          {isRegister && <span className="hint">至少 6 個字元</span>}
        </div>
        {error && <div className="notice err">{error}</div>}
        <button className="btn block" disabled={busy}>{busy ? <span className="spinner" /> : null}{isRegister ? '建立帳號' : '登入'}</button>
        {status?.registrationOpen && (
          <button type="button" className="btn ghost block mt" onClick={() => { setIsRegister(!isRegister); setError(''); }}>
            {isRegister ? '已經有帳號？登入' : '建立新帳號'}
          </button>
        )}
        {!status?.aiConfigured && <p className="tiny muted mt">提醒：伺服器尚未設定 AI 金鑰，AI 功能會顯示未設定。</p>}
      </form>
    </div>
  );
}
