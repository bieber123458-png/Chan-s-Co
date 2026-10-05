import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { PageHead, Card, Empty, Chips, Confirm, Stat, Progress, Field } from '../components/ui.jsx';
import RecordForm, { blankFrom } from '../components/RecordForm.jsx';
import { fmtMoney, fmtNum, fmtShortDate } from '../lib/format.js';
import { monthlySummary, monthOf, round, sum } from '../lib/finance.js';
import { toDateStr } from '../lib/plan.js';

const ORDER_FIELDS = [
  { key: 'date', label: '日期', type: 'date', required: true },
  { key: 'customer', label: '客戶', type: 'text', required: true },
  { key: 'product', label: '品項', type: 'text', placeholder: '例如：婕樂纖纖纖飲' },
  { key: 'qty', label: '數量', type: 'number', default: 1 },
  { key: 'revenue', label: '售價／收入（元）', type: 'money', required: true },
  { key: 'cost', label: '成本（元）', type: 'money', required: true, hint: '進貨成本＋運費等，用來計算毛利' },
  { key: 'note', label: '備註', type: 'text', full: true },
];
const TODO_FIELDS = [
  { key: 'customer', label: '客戶', type: 'text', required: true },
  { key: 'content', label: '跟進內容／待辦', type: 'textarea', rows: 2, required: true },
  { key: 'dueDate', label: '預計跟進日期', type: 'date' },
  { key: 'done', label: '狀態', type: 'checkbox', checkLabel: '已完成' },
];
const SNAP_FIELDS = [
  { key: 'date', label: '紀錄日期', type: 'date', required: true },
  { key: 'total', label: '團隊總人數', type: 'number', required: true },
  { key: 'active', label: '活躍夥伴數', type: 'number', required: true, hint: '自己定義，例如本月有下單或有參加培訓' },
  { key: 'newMembers', label: '這段期間新增夥伴', type: 'number', default: 0 },
  { key: 'trainings', label: '這段期間培訓次數', type: 'number', default: 0 },
  { key: 'note', label: '備註', type: 'text', full: true },
];
const FOLLOW_FIELDS = [
  { key: 'date', label: '日期', type: 'date', required: true },
  { key: 'partner', label: '夥伴', type: 'text', required: true },
  { key: 'content', label: '聊了什麼／對方卡在哪裡', type: 'textarea', rows: 2, required: true },
  { key: 'nextStep', label: '下一步', type: 'text', full: true },
  { key: 'nextDate', label: '下次跟進日', type: 'date', default: '' },
];

function useCrud(col) {
  const { save, remove } = useStore();
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  return { form, setForm, confirm, setConfirm, save: (v) => save(col, v), remove: () => remove(col, confirm.id) };
}

const IG_FIELDS = [
  { key: 'date', label: '紀錄日期', type: 'date', required: true },
  { key: 'followers', label: '粉絲總數', type: 'number', required: true },
  { key: 'views30', label: '近 30 天觀看次數', type: 'number', hint: '洞察報告 → 總覽' },
  { key: 'newFollowers30', label: '近 30 天新粉絲', type: 'number' },
  { key: 'shared30', label: '近 30 天內容被分享', type: 'number' },
  { key: 'note', label: '備註', type: 'text', full: true, placeholder: '例如：9/1–9/30 洞察報告' },
];

function Followers() {
  const { data } = useStore();
  const c = useCrud('igSnapshots');
  const snaps = [...data.igSnapshots].sort((a, b) => b.date.localeCompare(a.date));
  const [latest, prev] = snaps;
  // 還沒有任何紀錄時，用使用者提供的洞察報告數字預填，按下儲存才會寫入
  const firstDraft = { ...blankFrom(IG_FIELDS), followers: 8355, views30: 314000, newFollowers30: 110, shared30: 210, note: '9/1–9/30 洞察報告' };
  const conv = latest?.views30 && latest?.newFollowers30 !== '' && latest?.newFollowers30 != null
    ? Math.round(latest.views30 / Math.max(1, latest.newFollowers30)) : null;

  return (
    <>
      <div className="row between mt"><h3 style={{ fontSize: 16 }}>粉絲數紀錄</h3>
        <button className="btn ghost sm" onClick={() => c.setForm(snaps.length ? blankFrom(IG_FIELDS) : firstDraft)}>＋ 記錄粉絲數</button></div>
      {!latest ? <Empty title="還沒有粉絲數紀錄">建議每週記錄一次，就能看出內容調整後粉絲有沒有成長。</Empty> : (
        <>
          <div className="grid grid-3 mt">
            <Stat label="粉絲總數" value={fmtNum(latest.followers)} sub={`${fmtShortDate(latest.date)} 紀錄`} gold />
            <Stat label="與上次紀錄相比" value={prev ? `${latest.followers - prev.followers >= 0 ? '+' : ''}${fmtNum(latest.followers - prev.followers)}` : '—'} sub={prev ? `上次 ${fmtShortDate(prev.date)}・${fmtNum(prev.followers)}` : '需要兩筆紀錄才能比較'} />
            <Stat label="追蹤轉換" value={conv ? `每 ${fmtNum(conv)} 次觀看` : '—'} sub={conv ? '才多 1 位新粉絲（近 30 天）' : '填寫近 30 天觀看與新粉絲後計算'} />
          </div>
          <div className="table-wrap mt"><table>
            <thead><tr><th>日期</th><th className="num">粉絲</th><th className="num">30 天觀看</th><th className="num">30 天新粉絲</th><th className="num">被分享</th><th>備註</th><th></th></tr></thead>
            <tbody>{snaps.map((x) => (
              <tr key={x.id}><td>{fmtShortDate(x.date)}</td><td className="num">{fmtNum(x.followers)}</td><td className="num">{fmtNum(x.views30)}</td><td className="num">{fmtNum(x.newFollowers30)}</td><td className="num">{fmtNum(x.shared30)}</td><td>{x.note}</td>
                <td style={{ whiteSpace: 'nowrap' }}><button className="icon-btn" onClick={() => c.setForm(x)}>編輯</button><button className="icon-btn" onClick={() => c.setConfirm(x)}>刪除</button></td></tr>))}
            </tbody></table></div>
        </>
      )}
      {c.form && <RecordForm title={c.form.id ? '編輯粉絲數紀錄' : '記錄粉絲數'} fields={IG_FIELDS} initial={c.form} onSave={c.save} onClose={() => c.setForm(null)} />}
      {c.confirm && <Confirm onClose={() => c.setConfirm(null)} onConfirm={c.remove} message="刪除這筆粉絲數紀錄？" />}
    </>
  );
}

function Brand({ month }) {
  const { data, settings } = useStore();
  const posts = data.posts.filter((p) => monthOf(p.date) === month);
  return (
    <Card title="A. 個人品牌（IG）">
      <div className="grid grid-3">
        <Stat label="本月內容產出" value={`${posts.length}／${settings.monthlyContentGoal}`} sub={<Progress value={(posts.length / (settings.monthlyContentGoal || 1)) * 100} />} />
        <Stat label="觸及" value={fmtNum(sum(posts, (p) => p.reach))} sub={`觀看 ${fmtNum(sum(posts, (p) => p.views))}`} />
        <Stat label="互動（分享＋收藏＋留言）" value={fmtNum(sum(posts, (p) => (Number(p.shares) || 0) + (Number(p.saves) || 0) + (Number(p.comments) || 0)))} />
        <Stat label="新增粉絲" value={fmtNum(sum(posts, (p) => p.follows))} />
        <Stat label="免費資源導流" value={fmtNum(sum(posts, (p) => p.leads))} />
      </div>
      {posts.length === 0 && <p className="small muted mt">這個月還沒有內容紀錄。數據來自「社群內容 → 發布紀錄」的手動輸入。</p>}
      <Followers />
    </Card>
  );
}

function Retail({ month }) {
  const { data, save } = useStore();
  const o = useCrud('orders');
  const t = useCrud('retailTodos');
  const orders = data.orders.filter((x) => monthOf(x.date) === month).sort((a, b) => b.date.localeCompare(a.date));
  const revenue = round(sum(orders, (x) => x.revenue));
  const cost = round(sum(orders, (x) => x.cost));
  const todos = [...data.retailTodos].sort((a, b) => Number(a.done) - Number(b.done) || String(a.dueDate).localeCompare(String(b.dueDate)));
  const today = toDateStr();

  return (
    <Card title="B. 零售事業" action={<button className="btn sm" onClick={() => o.setForm(blankFrom(ORDER_FIELDS))}>＋ 新增訂單</button>}>
      <div className="grid grid-4 mb">
        <Stat label="本月訂單" value={orders.length} sub={`今日 ${data.orders.filter((x) => x.date === today).length} 筆`} />
        <Stat label="零售營收" value={fmtMoney(revenue)} />
        <Stat label="成本" value={fmtMoney(cost)} />
        <Stat label="毛利" value={fmtMoney(revenue - cost)} sub={revenue ? `毛利率 ${Math.round(((revenue - cost) / revenue) * 100)}%` : '—'} gold />
      </div>
      <p className="tiny muted mb">營收不等於利潤：毛利＝營收－成本，還沒扣掉廣告、交通等其他事業成本。訂單是業績追蹤；實際入帳請另外在「存錢與負債 → 收支紀錄」記一筆收入，避免月收入漏算或重複。</p>
      {orders.length === 0 ? <Empty title="這個月還沒有訂單" /> : (
        <div className="table-wrap mb"><table>
          <thead><tr><th>日期</th><th>客戶／品項</th><th className="num">營收</th><th className="num">成本</th><th className="num">毛利</th><th></th></tr></thead>
          <tbody>{orders.map((x) => (
            <tr key={x.id}><td>{fmtShortDate(x.date)}</td><td>{x.customer}<div className="tiny muted">{x.product} {x.qty ? `× ${x.qty}` : ''}</div></td>
              <td className="num">{fmtMoney(x.revenue)}</td><td className="num">{fmtMoney(x.cost)}</td><td className="num">{fmtMoney(x.revenue - x.cost)}</td>
              <td style={{ whiteSpace: 'nowrap' }}><button className="icon-btn" onClick={() => o.setForm(x)}>編輯</button><button className="icon-btn" onClick={() => o.setConfirm(x)}>刪除</button></td></tr>))}
          </tbody></table></div>
      )}
      <div className="row between"><h3 style={{ fontSize: 16 }}>客戶跟進與待辦</h3><button className="btn ghost sm" onClick={() => t.setForm(blankFrom(TODO_FIELDS, { dueDate: today }))}>＋ 新增跟進</button></div>
      {todos.length === 0 ? <Empty title="沒有待跟進的客戶" /> : todos.map((x) => (
        <div key={x.id} className="list-item row between" style={{ alignItems: 'flex-start' }}>
          <label className="check" style={{ alignItems: 'flex-start', flex: 1 }}>
            <input type="checkbox" checked={!!x.done} onChange={(e) => save('retailTodos', { ...x, done: e.target.checked }, { silent: true })} />
            <span style={{ textDecoration: x.done ? 'line-through' : 'none', color: x.done ? 'var(--muted)' : undefined }}>
              <strong>{x.customer}</strong>：{x.content}
              {x.dueDate && <span className={`tiny ${!x.done && x.dueDate < today ? '' : 'muted'}`} style={{ color: !x.done && x.dueDate < today ? 'var(--warn)' : undefined }}>（{fmtShortDate(x.dueDate)}{!x.done && x.dueDate < today ? '，已過預計日' : ''}）</span>}
            </span>
          </label>
          <span style={{ whiteSpace: 'nowrap' }}><button className="icon-btn" onClick={() => t.setForm(x)}>編輯</button><button className="icon-btn" onClick={() => t.setConfirm(x)}>刪除</button></span>
        </div>
      ))}
      {o.form && <RecordForm title={o.form.id ? '編輯訂單' : '新增訂單'} fields={ORDER_FIELDS} initial={o.form} onSave={o.save} onClose={() => o.setForm(null)} />}
      {o.confirm && <Confirm strong onClose={() => o.setConfirm(null)} onConfirm={o.remove} message={`刪除 ${o.confirm.customer} 的訂單（${fmtMoney(o.confirm.revenue)}）？`} />}
      {t.form && <RecordForm title={t.form.id ? '編輯跟進' : '新增跟進'} fields={TODO_FIELDS} initial={t.form} onSave={t.save} onClose={() => t.setForm(null)} />}
      {t.confirm && <Confirm onClose={() => t.setConfirm(null)} onConfirm={t.remove} message="刪除這筆跟進紀錄？" />}
    </Card>
  );
}

function Team() {
  const { data, settings } = useStore();
  const s = useCrud('teamSnapshots');
  const f = useCrud('teamFollowups');
  const snaps = [...data.teamSnapshots].sort((a, b) => b.date.localeCompare(a.date));
  const latest = snaps[0];
  const prev = snaps[1];
  const follows = [...data.teamFollowups].sort((a, b) => b.date.localeCompare(a.date));
  const goal = Number(settings.teamGoal) || 0;

  return (
    <Card title="C. 團隊經營" action={<button className="btn sm" onClick={() => s.setForm(blankFrom(SNAP_FIELDS))}>＋ 更新人數</button>}>
      {!latest ? <Empty title="還沒有團隊紀錄">每週更新一次團隊總人數與活躍夥伴，就能看到變化。</Empty> : (
        <div className="grid grid-4 mb">
          <Stat label="團隊總人數" value={latest.total} sub={`目標 ${goal} 人（尚未達成前僅為目標）`} />
          <Stat label="活躍夥伴" value={latest.active} sub={latest.total ? `活躍率 ${Math.round((latest.active / latest.total) * 100)}%` : ''} />
          <Stat label="與上次紀錄相比" value={prev ? `${latest.total - prev.total >= 0 ? '+' : ''}${latest.total - prev.total}` : '—'} sub={prev ? `上次 ${fmtShortDate(prev.date)}` : '需要兩筆紀錄'} />
          <Stat label="距離目標" value={goal ? Math.max(0, goal - latest.total) : '—'} sub={<Progress value={goal ? (latest.total / goal) * 100 : 0} />} />
        </div>
      )}
      {snaps.length > 0 && (
        <div className="table-wrap mb"><table>
          <thead><tr><th>日期</th><th className="num">總人數</th><th className="num">活躍</th><th className="num">新增</th><th className="num">培訓</th><th>備註</th><th></th></tr></thead>
          <tbody>{snaps.map((x) => (
            <tr key={x.id}><td>{fmtShortDate(x.date)}</td><td className="num">{x.total}</td><td className="num">{x.active}</td><td className="num">{fmtNum(x.newMembers)}</td><td className="num">{fmtNum(x.trainings)}</td><td>{x.note}</td>
              <td style={{ whiteSpace: 'nowrap' }}><button className="icon-btn" onClick={() => s.setForm(x)}>編輯</button><button className="icon-btn" onClick={() => s.setConfirm(x)}>刪除</button></td></tr>))}
          </tbody></table></div>
      )}
      <div className="row between"><h3 style={{ fontSize: 16 }}>夥伴跟進紀錄</h3><button className="btn ghost sm" onClick={() => f.setForm(blankFrom(FOLLOW_FIELDS))}>＋ 新增跟進</button></div>
      {follows.length === 0 ? <Empty title="還沒有跟進紀錄" /> : follows.map((x) => (
        <div key={x.id} className="list-item">
          <div className="row between"><strong>{x.partner}</strong><span className="tiny muted">{fmtShortDate(x.date)}</span></div>
          <p className="small">{x.content}</p>
          {x.nextStep && <p className="small muted">下一步：{x.nextStep}{x.nextDate ? `（${fmtShortDate(x.nextDate)}）` : ''}</p>}
          <div className="row"><button className="icon-btn" onClick={() => f.setForm(x)}>編輯</button><button className="icon-btn" onClick={() => f.setConfirm(x)}>刪除</button></div>
        </div>
      ))}
      {s.form && <RecordForm title={s.form.id ? '編輯團隊紀錄' : '更新團隊人數'} fields={SNAP_FIELDS} initial={s.form} onSave={s.save} onClose={() => s.setForm(null)}
        check={(v) => (v.active > v.total ? { active: '活躍夥伴不能多於總人數' } : {})} />}
      {s.confirm && <Confirm onClose={() => s.setConfirm(null)} onConfirm={s.remove} message="刪除這筆團隊紀錄？" />}
      {f.form && <RecordForm title={f.form.id ? '編輯跟進' : '新增夥伴跟進'} fields={FOLLOW_FIELDS} initial={f.form} onSave={f.save} onClose={() => f.setForm(null)} />}
      {f.confirm && <Confirm onClose={() => f.setConfirm(null)} onConfirm={f.remove} message="刪除這筆跟進紀錄？" />}
    </Card>
  );
}

function Income({ month }) {
  const { data, settings } = useStore();
  const m = monthlySummary(data, month);
  const recent = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 - (5 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }).map((k) => ({ k, ...monthlySummary(data, k) }));
  const max = Math.max(1, ...recent.map((r) => r.income));
  const goal = Number(settings.monthlyIncomeGoal) || 0;

  return (
    <Card title="D. 月度收入">
      <div className="grid grid-4 mb">
        <Stat label="本月收入" value={fmtMoney(m.income)} sub={goal ? `目標 ${fmtMoney(goal)}・達成 ${Math.round((m.income / goal) * 100)}%` : ''} />
        <Stat label="事業成本" value={fmtMoney(m.business)} />
        <Stat label="事業淨收入" value={fmtMoney(m.businessNet)} sub="收入－事業成本" gold />
        <Stat label="距離收入目標" value={goal ? fmtMoney(Math.max(0, goal - m.income)) : '—'} sub={<Progress value={goal ? (m.income / goal) * 100 : 0} />} />
      </div>
      <div className="grid grid-2">
        <div>
          <div className="small mb"><strong>收入來源</strong></div>
          {Object.keys(m.incomeByCategory).length === 0 ? <p className="small muted">這個月沒有收入紀錄（在「存錢與負債 → 收支紀錄」新增）。</p>
            : Object.entries(m.incomeByCategory).map(([k, v]) => (
              <div key={k} className="bar-row"><span>{k}</span><div className="bar"><div style={{ width: `${(v / (m.income || 1)) * 100}%` }} /></div><span className="right tiny">{fmtMoney(v)}</span></div>
            ))}
        </div>
        <div>
          <div className="small mb"><strong>近 6 個月收入變化</strong></div>
          {recent.map((r) => (
            <div key={r.k} className="bar-row"><span>{r.k}</span><div className="bar"><div style={{ width: `${(r.income / max) * 100}%` }} /></div><span className="right tiny">{r.hasData ? fmtMoney(r.income) : '無紀錄'}</span></div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function Business() {
  const { settings, saveSettings, toast } = useStore();
  const [month, setMonth] = useState(toDateStr().slice(0, 7));
  const [tab, setTab] = useState('all');
  const [goals, setGoals] = useState({ monthlyIncomeGoal: settings.monthlyIncomeGoal, teamGoal: settings.teamGoal, monthlyContentGoal: settings.monthlyContentGoal });
  const saveGoals = () => {
    const g = Object.fromEntries(Object.entries(goals).map(([k, v]) => [k, Number(v)]));
    if (Object.values(g).some((v) => !Number.isFinite(v) || v < 0)) { toast('目標請輸入 0 以上的數字', 'error'); return; }
    saveSettings(g);
  };

  return (
    <>
      <PageHead eyebrow="BUSINESS" title="事業經營儀表板" desc="目標是方向，不是現況；所有數字都來自你實際輸入的紀錄。" />
      <Card title="目標設定" className="soft">
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          <Field label="月收入目標（元）"><input className="input" type="number" min="0" value={goals.monthlyIncomeGoal} onChange={(e) => setGoals({ ...goals, monthlyIncomeGoal: e.target.value })} /></Field>
          <Field label="團隊人數目標"><input className="input" type="number" min="0" value={goals.teamGoal} onChange={(e) => setGoals({ ...goals, teamGoal: e.target.value })} /></Field>
          <Field label="每月內容篇數目標"><input className="input" type="number" min="0" value={goals.monthlyContentGoal} onChange={(e) => setGoals({ ...goals, monthlyContentGoal: e.target.value })} /></Field>
          <Field label="查看月份"><input className="input" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></Field>
        </div>
        <button className="btn ghost sm" onClick={saveGoals}>儲存目標</button>
      </Card>
      <div className="mb"><Chips value={tab} onChange={setTab} options={[['all', '全部'], ['brand', '個人品牌'], ['retail', '零售'], ['team', '團隊'], ['income', '月度收入']]} /></div>
      {(tab === 'all' || tab === 'brand') && <Brand month={month} />}
      {(tab === 'all' || tab === 'retail') && <Retail month={month} />}
      {(tab === 'all' || tab === 'team') && <Team />}
      {(tab === 'all' || tab === 'income') && <Income month={month} />}
    </>
  );
}
