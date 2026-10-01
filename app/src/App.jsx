import { useCallback, useEffect, useState } from 'react';
import { detectBackend, remote, local, getToken, setToken, getApiBase, setApiBase } from './lib/api.js';
import { StoreProvider, useStore } from './lib/store.jsx';
import { connectCloud } from './lib/cloud.js';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Plan from './pages/Plan.jsx';
import Coach from './pages/Coach.jsx';
import Content from './pages/Content.jsx';
import Stories from './pages/Stories.jsx';
import Business from './pages/Business.jsx';
import Finance from './pages/Finance.jsx';
import Life from './pages/Life.jsx';
import Cards from './pages/Cards.jsx';
import Reviews from './pages/Reviews.jsx';
import Settings from './pages/Settings.jsx';

export const PAGES = {
  home: { name: '今日任務', icon: '☀', C: Home },
  plan: { name: '每月計畫', icon: '▦', C: Plan },
  coach: { name: 'AI 教練', icon: '✦', C: Coach },
  content: { name: '社群內容', icon: '◎', C: Content },
  stories: { name: '限動經營', icon: '◐', C: Stories },
  business: { name: '事業儀表板', icon: '◇', C: Business },
  finance: { name: '存錢與負債', icon: '＄', C: Finance },
  life: { name: '生活與成長', icon: '❀', C: Life },
  cards: { name: '積分與抽卡', icon: '❖', C: Cards },
  review: { name: '每週／每月覆盤', icon: '↻', C: Reviews },
  settings: { name: '設定與備份', icon: '⚙', C: Settings },
};
const BOTTOM = ['home', 'coach', 'content', 'finance'];

const pageFromHash = () => {
  const k = window.location.hash.replace('#/', '').split('?')[0];
  return PAGES[k] ? k : 'home';
};

function Toasts({ items }) {
  return <div className="toasts" aria-live="polite">{items.map((t) => <div key={t.id} className={`toast ${t.type}`}>{t.text}</div>)}</div>;
}

function Layout() {
  const { mode, user, logout } = useStore();
  const [page, setPage] = useState(pageFromHash);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    const on = () => { setPage(pageFromHash()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = (k) => { window.location.hash = `#/${k}`; setDrawer(false); };
  const { C } = PAGES[page];

  const navList = (
    <>
      {Object.entries(PAGES).map(([k, p]) => (
        <button key={k} className={`nav-link ${page === k ? 'active' : ''}`} onClick={() => go(k)}>
          <span className="nav-icon">{p.icon}</span>{p.name}
        </button>
      ))}
      <hr className="divider" />
      <div className="tiny muted" style={{ padding: '0 12px' }}>
        {mode === 'remote' ? <>已登入：{user?.username}<br />資料儲存在伺服器資料庫</> : mode === 'cloud' ? <>Claude 雲端模式<br />資料跟著你的 Claude 帳號，只有你看得到</> : <>本機模式<br />資料只存在這個瀏覽器</>}
      </div>
      {mode === 'remote' && <button className="nav-link small mt" onClick={logout}><span className="nav-icon">⎋</span>登出</button>}
    </>
  );

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-name">小陳的每月經營系統</div><div className="brand-sub">GROW · BUILD · SAVE</div></div>
        {navList}
      </aside>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mobile-top">
          <div className="brand-name" style={{ fontSize: 16 }}>小陳的每月經營系統</div>
          <button className="icon-btn" onClick={() => setDrawer(true)} aria-label="開啟選單">☰</button>
        </div>
        <main className="main"><C go={go} /></main>
      </div>
      <nav className="bottom-nav" aria-label="主要功能">
        {BOTTOM.map((k) => (
          <button key={k} className={page === k ? 'active' : ''} onClick={() => go(k)}>
            <span className="nav-icon">{PAGES[k].icon}</span>{PAGES[k].name.replace('今日任務', '今日').replace('存錢與負債', '財務').replace('社群內容', '社群')}
          </button>
        ))}
        <button className={BOTTOM.includes(page) ? '' : 'active'} onClick={() => setDrawer(true)}><span className="nav-icon">☰</span>更多</button>
      </nav>
      {drawer && <>
        <div className="drawer-backdrop" onClick={() => setDrawer(false)} />
        <div className="drawer">
          <div className="row between mb"><div className="brand-name" style={{ fontSize: 16 }}>功能選單</div><button className="icon-btn" onClick={() => setDrawer(false)} aria-label="關閉">✕</button></div>
          {navList}
        </div>
      </>}
    </div>
  );
}

export default function App() {
  const [state, setState] = useState({ phase: 'loading' });
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((text, type = 'info') => {
    const id = Math.random();
    setToasts((t) => [...t, { id, text, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === 'error' ? 5000 : 2200);
  }, []);

  const boot = useCallback(async () => {
    setState({ phase: 'loading' });
    const status = await detectBackend();
    if (!status && getApiBase()) {
      setState({ phase: 'error', message: `連不到 AI 主機（${getApiBase()}）。請確認網路，或稍後再試。`, apiDown: true });
      return;
    }
    if (!status) {
      // 在 claude.ai 打開時，改用 Claude 雲端（資料跟著 Claude 帳號、AI 用自己的 Claude 帳號）
      const cloud = await connectCloud().catch(() => null);
      if (cloud) {
        try {
          const data = await cloud.loadAll();
          setState({ phase: 'ready', mode: 'cloud', status: null, data, user: null, cloud });
        } catch (e) {
          setState({ phase: 'error', message: e.message });
        }
        return;
      }
      const data = await local.loadAll();
      setState({ phase: 'ready', mode: 'local', status: null, data, user: null });
      return;
    }
    if (!getToken()) { setState({ phase: 'login', status }); return; }
    try {
      const { user } = await remote.me();
      const data = await remote.loadAll();
      setState({ phase: 'ready', mode: 'remote', status, data, user });
    } catch (e) {
      if (e.status === 401) { setToken(null); setState({ phase: 'login', status }); }
      else setState({ phase: 'error', message: e.message });
    }
  }, []);

  useEffect(() => { boot(); }, [boot]);

  const logout = useCallback(async () => {
    await remote.logout();
    setToken(null);
    boot();
  }, [boot]);

  let body;
  if (state.phase === 'loading') body = <div className="loading-page"><div className="row"><span className="spinner" /> 載入中…（第一次開啟可能需要幾秒）</div></div>;
  else if (state.phase === 'error') body = (
    <div className="login-wrap"><div className="card login-card"><h2>載入失敗</h2><p className="mt">{state.message}</p><div className="row mt"><button className="btn" onClick={boot}>重新載入</button>{state.apiDown && <button className="btn ghost" onClick={() => { setApiBase(null); boot(); }}>先用本機模式</button>}</div></div></div>
  );
  else if (state.phase === 'login') body = <Login status={state.status} onDone={(token) => { setToken(token); boot(); }} />;
  else body = (
    <StoreProvider key={state.user?.id || state.mode} mode={state.mode} status={state.status} cloud={state.cloud} initialData={state.data} user={state.user} onLogout={logout} toast={toast}>
      <Layout />
    </StoreProvider>
  );

  return <>{body}<Toasts items={toasts} /></>;
}
