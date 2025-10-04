import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { CheckCircle, XCircle, RotateCcw, Wallet, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Pencil, Trash2, X, LogIn, LogOut, RefreshCcw } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from "recharts";
import { createClient } from "@supabase/supabase-js";

// ===== Supabase client (env-based) =====
// Read keys injected by Vite/Netlify (must start with VITE_)
const supabaseUrl = import.meta?.env?.VITE_SUPABASE_URL;
const supabaseKey = import.meta?.env?.VITE_SUPABASE_ANON_KEY;
// DEBUG (temporary)
if (typeof window !== 'undefined') {
  console.log('ENV check', {
    VITE_SUPABASE_URL: supabaseUrl,
    VITE_SUPABASE_ANON_KEY: supabaseKey ? supabaseKey.slice(0, 6) + '…' : supabaseKey
  });
}
// Create the client only when both envs exist (e.g., on Netlify build). Otherwise keep it null
// and the app will work in local-only mode (no cloud sync/auth).
console.log('Supabase client:', supabase ? 'OK' : 'NULL');
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// --- Helper utils ---
function num(n, d = 2) {
  if (Number.isNaN(Number(n))) return "0.00";
  return Number(n).toFixed(d);
}

function parsePct(v) {
  // Accepts 92 or 0.92 or "92%" and returns 0.92
  if (v === "" || v == null) return 0;
  let s = String(v).trim();
  if (s.endsWith("%")) s = s.slice(0, -1);
  const n = Number(s);
  if (!isFinite(n)) return 0;
  return n > 1 ? n / 100 : n;
}

function toPctStr(p) {
  return `${(Number(p) * 100).toFixed(2)}%`;
}

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function addDays(iso, days){
  const d = new Date(iso);
  d.setDate(d.getDate()+days);
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function toISO(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function weekRange(anchorISO){
  const base = anchorISO ? new Date(anchorISO) : new Date();
  const day = (base.getDay()+6)%7; // 0 Mon..6 Sun
  const start = new Date(base);
  start.setDate(base.getDate()-day);
  const end = new Date(start);
  end.setDate(start.getDate()+6);
  return { from: toISO(start), to: toISO(end) };
}

function monthRange(anchorISO){
  const base = anchorISO ? new Date(anchorISO) : new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const end = new Date(base.getFullYear(), base.getMonth()+1, 0);
  return { from: toISO(start), to: toISO(end) };
}

function monthMatrix(year, month){
  // month: 0-11
  const first = new Date(year, month, 1);
  // ISO weekday: 1=Mon ... 7=Sun
  const isoWeekday = (first.getDay()+6)%7 + 1; // getDay: 0 Sun..6 Sat
  const start = new Date(first);
  start.setDate(first.getDate() - (isoWeekday-1)); // back to Monday
  const cells = [];
  for(let i=0;i<42;i++){
    const d = new Date(start);
    d.setDate(start.getDate()+i);
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    cells.push({
      iso,
      inMonth: d.getMonth()===month,
      day: d.getDate(),
      dow: (d.getDay()+6)%7, // 0-6 Mon..Sun
    });
  }
  return cells;
}

export default function App() {
  // ===== Auth state (Supabase) =====
  const cloudEnabled = !!supabase;
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(!!supabase);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      if (!supabase) { setAuthLoading(false); return; }
      const { data } = await supabase.auth.getSession();
      setUser(data?.session?.user || null);
      setAuthLoading(false);
      const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
        setUser(session?.user || null);
      });
      unsub = sub.subscription.unsubscribe;
    })();
    return () => { try { unsub(); } catch {} };
  }, []);

  async function signUp(email, password){
    setAuthError("");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setAuthError(error.message);
  }
  async function signIn(email, password){
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
  }
  async function signOut(){ await supabase?.auth.signOut(); }

  const [initialBalance, setInitialBalance] = useState(1000);
  const [dailyTarget, setDailyTarget] = useState(50); // amount mode
  const [targetMode, setTargetMode] = useState("amount"); // 'amount' | 'percent'
  const [targetPercent, setTargetPercent] = useState("3"); // percent mode, accepts 3 / 0.03 / 3%
  const [payoutInput, setPayoutInput] = useState("92"); // user-facing, flexible input
  const [lockAfterTarget, setLockAfterTarget] = useState(true);
  const [customStake, setCustomStake] = useState("");
  const [darkMode, setDarkMode] = useState(false);

  // Persist theme
  useEffect(() => {
    try {
      const saved = localStorage.getItem('po_theme');
      if (saved) setDarkMode(saved === 'dark');
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('po_theme', darkMode ? 'dark' : 'light'); } catch {}
  }, [darkMode]);

  // New: trading date + carry over
  const [tradingDate, setTradingDate] = useState(todayStr());
  const [carryOver, setCarryOver] = useState(true);
  const [recalcForwardOnSave, setRecalcForwardOnSave] = useState(true);

  // Ensure dark fallback applies at runtime
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', darkMode);
    }
  }, [darkMode]);

  // trade = { id, stake, payout, result: 'win'|'loss', pnl, balance }
  const [trades, setTrades] = useState([]);

  const payout = useMemo(() => parsePct(payoutInput), [payoutInput]);

  const realizedPnL = useMemo(
    () => trades.reduce((sum, t) => sum + t.pnl, 0),
    [trades]
  );

  const wins = useMemo(() => trades.filter(t => t.result === "win").length, [trades]);
  const losses = useMemo(() => trades.filter(t => t.result === "loss").length, [trades]);

  // Losses in the current martingale cycle (since last win)
  const cycleLosses = useMemo(() => {
    let sum = 0;
    for (let i = trades.length - 1; i >= 0; i--) {
      const t = trades[i];
      if (t.result === "loss") sum += Math.abs(t.pnl); // pnl is negative
      else break; // reset when last result is a win
    }
    return sum;
  }, [trades]);

  // Resolve daily target as an AMOUNT, regardless of input mode
  const targetAmount = useMemo(() => {
    if (targetMode === "amount") return Number(dailyTarget) || 0;
    const pct = parsePct(targetPercent);
    return (Number(initialBalance) || 0) * pct;
  }, [targetMode, dailyTarget, targetPercent, initialBalance]);

  const remainingTarget = useMemo(() => {
    const r = Math.max(0, Number(targetAmount) - realizedPnL);
    return r;
  }, [targetAmount, realizedPnL]);

  const suggestedStake = useMemo(() => {
    const p = Number(payout);
    if (p <= 0) return 0;

    // If target achieved and locked, suggest 0
    if (lockAfterTarget && remainingTarget <= 0) return 0;

    // Correct formula: need to reach the daily target from current P&L
    const need = remainingTarget; // already equals max(0, targetAmount - realizedPnL)
    const stake = need / p;
    return Math.max(0, Math.round(stake * 100) / 100);
  }, [payout, remainingTarget, lockAfterTarget]);

  const currentBalance = useMemo(
    () => Number(initialBalance) + realizedPnL,
    [initialBalance, realizedPnL]
  );

  function addTrade(result) {
    const p = Number(payout);
    let stake = customStake !== "" ? Number(customStake) : suggestedStake;
    if (!isFinite(stake) || stake <= 0) return;

    const pnl = result === "win" ? stake * p : -stake;
    const newBalance = currentBalance + pnl;

    const trade = {
      id: trades.length + 1,
      stake: Math.round(stake * 100) / 100,
      payout: p,
      result,
      pnl: Math.round(pnl * 100) / 100,
      balance: Math.round(newBalance * 100) / 100,
    };

    setTrades(prev => [...prev, trade]);
    setCustomStake("");
  }

  function resetDay() {
    setTrades([]);
    setCustomStake("");
  }

  function hardReset() {
    setTrades([]);
    setInitialBalance(1000);
    setDailyTarget(50);
    setTargetMode("amount");
    setTargetPercent("3");
    setPayoutInput("92");
    setLockAfterTarget(true);
    setCustomStake("");
  }

  // Derived stats
  const totalTrades = trades.length;
  const winRate = totalTrades ? (wins / totalTrades) * 100 : 0;
  const dayPct = initialBalance ? (realizedPnL / Number(initialBalance)) * 100 : 0;

  // --- Day summaries (calendar + charts) ---
  // map dateISO -> summary
  const [summaries, setSummaries] = useState(() => {
    try { return JSON.parse(localStorage.getItem('po_day_summaries_v2')||'{}'); } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem('po_day_summaries_v2', JSON.stringify(summaries)); } catch {}
  }, [summaries]);

  // Cloud sync (Supabase): load and save per-user data
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle'|'loading'|'saving'|'saved'|'error'

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase || !user) return;
      setSyncStatus('loading');
      // Try to fetch existing row
      const { data, error } = await supabase.from('user_data').select('data').eq('user_id', user.id).maybeSingle();
      if (cancelled) return;
      if (error) {
        setSyncStatus('error');
        return;
      }
      if (!data) {
        // If no row yet: create it, seed with local summaries if any
        const payload = { summaries };
        await supabase.from('user_data').insert({ user_id: user.id, data: payload });
        setSyncStatus('saved');
      } else {
        const remote = data.data || {};
        if (remote.summaries && Object.keys(remote.summaries).length) {
          setSummaries(remote.summaries);
        } else if (Object.keys(summaries||{}).length) {
          // push local up if remote empty
          await supabase.from('user_data').upsert({ user_id: user.id, data: { summaries } });
        }
        setSyncStatus('saved');
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!supabase || !user) return;
    const t = setTimeout(async () => {
      setSyncStatus('saving');
      const { error } = await supabase.from('user_data').upsert({ user_id: user.id, data: { summaries } });
      setSyncStatus(error ? 'error' : 'saved');
    }, 600); // debounce saves
    return () => clearTimeout(t);
  }, [summaries, user]);

  // EDITING: track when we are editing an existing day (loaded trades)
  const [editingDay, setEditingDay] = useState(null); // string | null (ISO date)

  // === Recalculate forward utility ===
  function recalcForwardFrom(dateISO, baseMap){
    const map = {...(baseMap || summaries)};
    const keys = Object.keys(map).sort();
    const idx = keys.indexOf(dateISO);
    if (idx === -1) return map;
    let prevEnd = Number(map[keys[idx]]?.endBalance ?? 0);
    for (let i = idx + 1; i < keys.length; i++){
      const k = keys[i];
      const s = map[k];
      if (!s) continue;
      const startBalance = Number(prevEnd);
      const endBalance = startBalance + Number(s.pnl || 0);
      map[k] = { ...s, startBalance, endBalance };
      prevEnd = endBalance;
    }
    return map;
  }

  function saveDay({ advance = true } = {}){
    const dateToSave = tradingDate;
    const summary = {
      date: dateToSave,
      startBalance: Number(initialBalance),
      endBalance: Number(currentBalance),
      pnl: Number(realizedPnL),
      trades: totalTrades,
      wins, losses,
      winRate: totalTrades ? Number(((wins/totalTrades)*100).toFixed(2)) : 0,
      targetAmount: Number(targetAmount),
      payout: Number(payout),
      tradesLog: trades.slice(), // ✅ persist full trades of the day
    };
    setSummaries(prev => {
      let next = { ...prev, [dateToSave]: summary };
      if (recalcForwardOnSave) {
        next = recalcForwardFrom(dateToSave, next);
      }
      return next;
    });

    // reset state
    setTrades([]);
    setCustomStake("");
    setEditingDay(null);

    if (advance) {
      if (carryOver) setInitialBalance(Number(currentBalance));
      setTradingDate(addDays(dateToSave, 1));
    }
  }

  // Backward-compatible helper (old name)
  function closeDay(){ saveDay({ advance: true }); }

  // Calendar state
  const [calYear, setCalYear] = useState(() => new Date(tradingDate).getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date(tradingDate).getMonth()); // 0-11
  useEffect(()=>{
    const d = new Date(tradingDate);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
  }, [tradingDate]);

  const calCells = useMemo(()=> monthMatrix(calYear, calMonth), [calYear, calMonth]);
  function prevMonth(){
    const d = new Date(calYear, calMonth, 1); d.setMonth(d.getMonth()-1);
    setCalYear(d.getFullYear()); setCalMonth(d.getMonth());
  }
  function nextMonth(){
    const d = new Date(calYear, calMonth, 1); d.setMonth(d.getMonth()+1);
    setCalYear(d.getFullYear()); setCalMonth(d.getMonth());
  }

  // Charts data (sorted by date)
  const sortedData = useMemo(() => {
    const arr = Object.values(summaries);
    arr.sort((a,b)=> a.date.localeCompare(b.date));
    return arr;
  }, [summaries]);

  const [rangeFrom, setRangeFrom] = useState(sortedData[0]?.date || todayStr());
  const [rangeTo, setRangeTo] = useState(sortedData[sortedData.length-1]?.date || todayStr());
  useEffect(()=>{
    if(sortedData.length){
      setRangeFrom(sortedData[0].date);
      setRangeTo(sortedData[sortedData.length-1].date);
    }
  },[sortedData.length]);

  const [quickFilter, setQuickFilter] = useState('all'); // 'week' | 'month' | 'all' | 'custom'
  function setCalendarToISO(iso){
    const d = new Date(iso);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
  }
  function applyQuickFilter(type){
    setQuickFilter(type);
    if(type==='week'){
      const {from,to} = weekRange(tradingDate);
      setRangeFrom(from); setRangeTo(to);
      setCalendarToISO(from);
    } else if(type==='month'){
      const {from,to} = monthRange(tradingDate);
      setRangeFrom(from); setRangeTo(to);
      setCalendarToISO(from);
    } else if(type==='all'){
      if(sortedData.length){
        setRangeFrom(sortedData[0].date);
        setRangeTo(sortedData[sortedData.length-1].date);
        setCalendarToISO(sortedData[sortedData.length-1].date);
      } else {
        const t = todayStr();
        setRangeFrom(t); setRangeTo(t);
      }
    }
  }

  const filteredData = useMemo(()=>{
    return sortedData.filter(d => (!rangeFrom || d.date>=rangeFrom) && (!rangeTo || d.date<=rangeTo))
      .map(d => ({
        date: d.date.slice(5), // MM-DD
        pnl: Number(d.pnl),
        endBalance: Number(d.endBalance)
      }));
  }, [sortedData, rangeFrom, rangeTo]);

  // ---- Day Details / Edit Modal ----
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsDate, setDetailsDate] = useState(null);

  function openDayDetails(date){ setDetailsDate(date); setDetailsOpen(true); }
  function closeDetails(){ setDetailsOpen(false); setDetailsDate(null); }

  function reopenForEditing(date){
    const s = summaries[date];
    if (!s) return;
    setTradingDate(date);
    setInitialBalance(Number(s.startBalance) || 0);
    setTrades(Array.isArray(s.tradesLog) ? s.tradesLog.slice() : []);
    setEditingDay(date);
    setDetailsOpen(false);
  }

  function deleteDay(date){
    const next = {...summaries};
    delete next[date];
    setSummaries(next);
    setDetailsOpen(false);
  }

  const details = detailsDate ? summaries[detailsDate] : null;

  // ===== Auth gate UI =====
  const [authEmail, setAuthEmail] = useState("");
  const [authPass, setAuthPass] = useState("");

  if (cloudEnabled && !user) {
    return (
      <div className={`app-${darkMode ? 'dark' : 'light'}`}>
        <style>{`
          .app-dark { background-color: #0b1220; color: #f3f4f6; }
          .app-light { background: #f8fafc; color: #111827; }
          .app-dark input { background-color: #111827 !important; color: #f3f4f6 !important; border-color: #374151 !important; }
        `}</style>
        <div className="min-h-screen w-full flex items-center justify-center p-6">
          <Card className="max-w-md w-full bg-white border border-gray-200">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  <h1 className="text-lg font-semibold">Pocket Options — Sign in</h1>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant={darkMode ? "outline" : "default"} onClick={() => setDarkMode(false)}>Light</Button>
                  <Button variant={darkMode ? "default" : "outline"} onClick={() => setDarkMode(true)}>Dark</Button>
                </div>
              </div>

              <div className="text-xs text-gray-600">Cloud sync is enabled. Sign up or sign in to keep your data per user.</div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <Input type="password" value={authPass} onChange={e=>setAuthPass(e.target.value)} placeholder="••••••••" />
              </div>
              {authError && <div className="text-xs text-rose-500">{authError}</div>}
              <div className="flex gap-2">
                <Button onClick={()=>signIn(authEmail, authPass)} className="flex-1"><LogIn className="h-4 w-4 mr-2"/> Sign in</Button>
                <Button variant="outline" onClick={()=>signUp(authEmail, authPass)} className="flex-1">Create account</Button>
              </div>

              {!cloudEnabled && <div className="text-xs">Cloud disabled (missing env). Using local storage only.</div>}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-${darkMode ? 'dark' : 'light'}`}>
      {/* Fallback CSS so dark mode works even if Tailwind dark mode isn't configured in preview */}
      <style>{`
        .day-cell { min-height: 84px; cursor: pointer; }

        /* ========== LIGHT THEME ========== */
        .app-light { background: #f8fafc; color: #111827; }
        .app-light input { background: #ffffff !important; color: #111827 !important; border-color: #e5e7eb !important; }
        .app-light .bg-white { background: #ffffff !important; }
        .app-light .bg-gray-50 { background: #f9fafb !important; }
        .app-light .border-gray-200 { border-color: #e5e7eb !important; }
        .app-light .text-gray-600 { color: #4b5563 !important; }
        .app-light .text-gray-700 { color: #374151 !important; }
        .app-light .text-gray-900 { color: #111827 !important; }

        /* =========== DARK THEME =========== */
        .app-dark { background-color: #0b1220; color: #f3f4f6; }
        .app-dark label, .app-dark h1, .app-dark span, .app-dark div, .app-dark th, .app-dark td { color: #e5e7eb !important; }
        .app-dark input { background-color: #111827 !important; color: #f3f4f6 !important; border-color: #374151 !important; }
        .app-dark .bg-white { background-color: #1f2937 !important; }
        .app-dark .bg-gray-50 { background-color: #0f172a !important; }
        .app-dark .border-gray-200 { border-color: #374151 !important; }
        .app-dark .text-emerald-400 { color: #34d399 !important; }
        .app-dark .text-rose-400 { color: #fb7185 !important; }
        /* Ensure inputs never overflow their container */
        input { max-width: 100% !important; box-sizing: border-box; }
        .app-light .card-content, .app-dark .card-content { overflow: hidden; }

        /* modal */
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index: 50; }
        .modal-card { width: 92%; max-width: 560px; border-radius: 16px; background: #fff; padding: 16px; }
        .app-dark .modal-card { background: #1f2937; }
      `}</style>

      <div className="min-h-screen w-full bg-gray-50 p-6 text-gray-900">
        <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Inputs */}
          <Card className="lg:col-span-1 shadow-sm bg-white border border-gray-200" style={{ maxWidth: 420 }}>
            <CardContent className="p-5 space-y-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  <h1 className="text-xl font-semibold">Pocket Options Daily Manager</h1>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant={darkMode ? "outline" : "default"} onClick={() => setDarkMode(false)}>Light</Button>
                  <Button variant={darkMode ? "default" : "outline"} onClick={() => setDarkMode(true)}>Dark</Button>
                  {cloudEnabled && user && (
                    <Button variant="outline" onClick={signOut}><LogOut className="h-4 w-4 mr-2"/> Sign out</Button>
                  )}
                </div>
              </div>

              {cloudEnabled && user && (
                <div className="rounded-lg border border-gray-200 p-2 text-xs flex items-center justify-between">
                  <div>Signed in as <b>{user.email}</b></div>
                  <div className={`text-xs ${syncStatus==='error'?'text-rose-500': (syncStatus==='saving'?'text-gray-600':'text-emerald-500')}`}>Cloud: {syncStatus}</div>
                </div>
              )}

              {editingDay && (
                <div className="rounded-lg border border-gray-200 p-2 text-xs">
                  <div className="font-semibold mb-1">Editing day: {editingDay}</div>
                  <div>Record extra trades and then press <b>Save edits</b> below.</div>
                  <div className="mt-2 flex items-center gap-2">
                    <Switch checked={recalcForwardOnSave} onCheckedChange={setRecalcForwardOnSave} />
                    <span>Recalculate following days on save</span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Trading date</label>
                <Input type="date" value={tradingDate} onChange={e=>setTradingDate(e.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Initial balance (today)</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={initialBalance}
                  onChange={e => setInitialBalance(Number(e.target.value))}
                />
              </div>

              {/* Target selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Daily profit target</label>
                <div className="flex items-center gap-2">
                  <Button variant={targetMode === "amount" ? "default" : "outline"} onClick={() => setTargetMode("amount")}>Amount</Button>
                  <Button variant={targetMode === "percent" ? "default" : "outline"} onClick={() => setTargetMode("percent")}>Percent</Button>
                </div>
                {targetMode === "amount" ? (
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={dailyTarget}
                    onChange={e => setDailyTarget(Number(e.target.value))}
                    placeholder="e.g. 5 (currency units)"
                  />
                ) : (
                  <div className="flex gap-2 items-center">
                    <Input
                      type="text"
                      value={targetPercent}
                      onChange={e => setTargetPercent(e.target.value)}
                      placeholder="e.g. 3 or 3% or 0.03"
                    />
                    <span className="text-sm">
                      = {num(targetAmount)} (at {toPctStr(parsePct(targetPercent))} of initial)
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Pair payout</label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="text"
                    value={payoutInput}
                    onChange={e => setPayoutInput(e.target.value)}
                    placeholder="92 or 0.92 or 92%"
                  />
                  <span className="text-sm">= {toPctStr(payout)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm font-medium">Stop when target is hit</div>
                  <div className="text-xs">If ON, suggested stake becomes 0 after target is reached.</div>
                </div>
                <Switch checked={lockAfterTarget} onCheckedChange={setLockAfterTarget} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white p-4 border border-gray-200">
                  <div className="text-xs">Profit needed to hit target</div>
                  <div className={`text-2xl font-semibold ${remainingTarget <= 0 ? 'text-emerald-400' : ''}`}>{num(remainingTarget)}</div>
                </div>
                <div className="rounded-2xl bg-white p-4 border border-gray-200">
                  <div className="text-xs">Cycle losses (to recover)</div>
                  <div className="text-2xl font-semibold">{num(cycleLosses)}</div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Suggested next position (auto)</label>
                <Input value={suggestedStake} readOnly />
                <div className="text-xs">Formula: (Target − Realized P&L) / Payout</div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Or set custom stake</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="Optional override"
                  value={customStake}
                  onChange={e => setCustomStake(e.target.value)}
                />
                <div className="text-xs">If provided, this amount will be used for the next Win/Loss action.</div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button className="flex-1" onClick={() => addTrade("win")}>
                  <CheckCircle className="h-4 w-4 mr-2" /> Win
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => addTrade("loss")}>
                  <XCircle className="h-4 w-4 mr-2" /> Loss
                </Button>
              </div>

              <div className="flex gap-2">
                <Button variant="secondary" onClick={resetDay}>
                  <RotateCcw className="h-4 w-4 mr-2" /> Reset trades (today)
                </Button>
                <Button variant="outline" onClick={hardReset}>Hard reset</Button>
              </div>

              {/* End of Day */}
              <div className="border-t border-gray-200 pt-4 mt-2 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Carry over end balance to next day</div>
                    <div className="text-xs">If ON, tomorrow's initial balance = today's current balance</div>
                  </div>
                  <Switch checked={carryOver} onCheckedChange={setCarryOver} />
                </div>
                {editingDay ? (
                  <Button onClick={()=>saveDay({advance:false})}>
                    <CalendarIcon className="h-4 w-4 mr-2" /> Save edits for {editingDay}
                  </Button>
                ) : (
                  <Button onClick={closeDay}>
                    <CalendarIcon className="h-4 w-4 mr-2" /> Τέλος ημέρας (save to calendar)
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right column: Live status + History */}
          <Card className="lg:col-span-2 shadow-sm bg-white border border-gray-200">
            <CardContent className="p-5 space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-white p-4 border border-gray-200">
                  <div className="text-xs">Current balance</div>
                  <div className="text-2xl font-semibold">{num(currentBalance)}</div>
                </div>
                <div className="rounded-2xl bg-white p-4 border border-gray-200">
                  <div className="text-xs">Realized P&L (today)</div>
                  <div className={`text-2xl font-semibold ${realizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{num(realizedPnL)}</div>
                </div>
                <div className="rounded-2xl bg-white p-4 border border-gray-200">
                  <div className="text-xs">Win rate</div>
                  <div className="text-2xl font-semibold">{num(winRate, 1)}%</div>
                </div>
                <div className="rounded-2xl bg-white p-4 border border-gray-200">
                  <div className="text-xs">Day % vs initial</div>
                  <div className={`text-2xl font-semibold ${dayPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{num(dayPct, 2)}%</div>
                </div>
              </div>

              {/* Calendar */}
              <div className="rounded-2xl bg-white border border-gray-200">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <div className="font-semibold flex items-center gap-2"><CalendarIcon className="h-4 w-4"/> Calendar</div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={prevMonth}><ChevronLeft className="h-4 w-4"/></Button>
                    <div className="text-sm font-medium">{new Date(calYear, calMonth).toLocaleDateString(undefined,{month:'long', year:'numeric'})}</div>
                    <Button variant="outline" onClick={nextMonth}><ChevronRight className="h-4 w-4"/></Button>
                  </div>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-7 text-xs text-gray-600 mb-2">
                    {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=> <div key={d} className="px-2 py-1">{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {calCells.map((c, idx)=>{
                      const s = summaries[c.iso];
                      const pnl = s?.pnl ?? null;
                      const pnlClass = pnl==null ? 'text-gray-500' : (pnl>=0 ? 'text-emerald-500' : 'text-rose-500');
                      return (
                        <div key={idx} className={`day-cell border rounded-lg p-2 ${c.inMonth? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200 opacity-60'}`} onClick={()=> s && openDayDetails(c.iso)}>
                          <div className="text-xs flex items-center justify-between">
                            <span className="font-medium">{c.day}</span>
                            {s && <span className={`text-[10px] ${pnl>=0?'text-emerald-500':'text-rose-500'}`}>{num(pnl)}</span>}
                          </div>
                          {s && (
                            <div className={`mt-2 text-xs ${pnlClass}`}>{pnl>=0?'+':''}{num(pnl)} PnL</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="rounded-2xl bg-white border border-gray-200">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <div className="font-semibold">Charts</div>
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    <Button variant={quickFilter==='week'? 'default':'outline'} onClick={()=>applyQuickFilter('week')}>This week</Button>
                    <Button variant={quickFilter==='month'? 'default':'outline'} onClick={()=>applyQuickFilter('month')}>This month</Button>
                    <Button variant={quickFilter==='all'? 'default':'outline'} onClick={()=>applyQuickFilter('all')}>All time</Button>
                    <span className="mx-2 hidden md:inline">|</span>
                    <span>From</span>
                    <Input type="date" value={rangeFrom} onChange={e=>{setRangeFrom(e.target.value); setQuickFilter('custom');}} />
                    <span>to</span>
                    <Input type="date" value={rangeTo} onChange={e=>{setRangeTo(e.target.value); setQuickFilter('custom');}} />
                  </div>
                </div>
                <div className="p-4 space-y-6">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={filteredData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="pnl" name="Daily PnL" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={filteredData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="endBalance" name="End balance" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Explanation */}
              <div className="text-xs text-gray-600 leading-relaxed">
                <p className="mb-2 font-medium text-gray-700">How it works</p>
                <ul className="list-disc ml-5 space-y-1">
                  <li><span className="font-semibold">Users & Cloud:</span> sign in to keep your data per user. Data is stored server-side.</li>
                  <li><span className="font-semibold">Payout input:</span> you can type <code>92</code>, <code>0.92</code> or <code>92%</code>. Internally it becomes 0.92.</li>
                  <li><span className="font-semibold">Daily target modes:</span> choose <em>Amount</em> or <em>Percent</em>. In percent mode the target is <code>initial × percent</code>.</li>
                  <li><span className="font-semibold">Suggested position:</span> <code>(Target − RealizedPnL) / Payout</code> (i.e., win once to reach today's target from the current P&L).</li>
                  <li><span className="font-semibold">End of day:</span> saves date, balances, PnL and full trades log to calendar. Click a day to <em>view</em> or <em>edit</em>.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Details / Edit Modal */}
      {detailsOpen && (
        <div className="modal-backdrop" onClick={closeDetails}>
          <div className="modal-card" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Day details — {detailsDate}</div>
              <Button variant="outline" onClick={closeDetails}><X className="h-4 w-4"/></Button>
            </div>

            {!details ? (
              <div className="text-sm">No data for this day.</div>
            ) : (
              <div className="space-y-2 text-sm">
                <div>Start balance: <b>{num(details.startBalance)}</b></div>
                <div>End balance: <b>{num(details.endBalance)}</b></div>
                <div>PnL: <b className={details.pnl>=0? 'text-emerald-400':'text-rose-400'}>{num(details.pnl)}</b></div>
                <div>Trades: <b>{details.trades}</b> (wins {details.wins} / losses {details.losses})</div>
                <div>Win rate: <b>{num(details.winRate,2)}%</b></div>
              </div>
            )}

            <div className="flex items-center gap-2 mt-4">
              <Button onClick={()=>reopenForEditing(detailsDate)}><Pencil className="h-4 w-4 mr-2"/> Reopen to edit</Button>
              <Button variant="outline" onClick={()=>{ setSummaries(prev => recalcForwardFrom(detailsDate, prev)); setDetailsOpen(false); }}>
                <RefreshCcw className="h-4 w-4 mr-2"/> Recalculate forward
              </Button>
              <Button variant="destructive" onClick={()=>deleteDay(detailsDate)}><Trash2 className="h-4 w-4 mr-2"/> Delete day</Button>
            </div>

            {details && !Array.isArray(details.tradesLog) && (
              <div className="mt-3 text-xs text-gray-600">
                This day was saved without a trades log. Reopening will start with an empty list of trades. You can re-record only the adjustments you need and save again.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
