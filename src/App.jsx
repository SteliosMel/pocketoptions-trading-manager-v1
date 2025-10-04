
import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { CheckCircle, XCircle, RotateCcw, Wallet, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Pencil, Trash2, X, LogIn, LogOut, RefreshCcw, ShieldPlus } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { createClient } from "@supabase/supabase-js";

// Supabase client (enabled when env vars exist)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// Utils
const num=(n,d=2)=> (Number.isNaN(Number(n))?'0.00':Number(n).toFixed(d));
const parsePct=v=>{ if(v===''||v==null) return 0; let s=String(v).trim(); if(s.endsWith('%')) s=s.slice(0,-1); const n=Number(s); return !isFinite(n)?0:(n>1?n/100:n); }
const toPctStr=p=>`${(Number(p)*100).toFixed(2)}%`;
const todayStr=()=>{ const d=new Date(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${d.getFullYear()}-${m}-${day}`; }
const addDays=(iso,days)=>{ const d=new Date(iso); d.setDate(d.getDate()+days); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${d.getFullYear()}-${m}-${day}`; }
const toISO=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const weekRange=iso=>{ const b=iso?new Date(iso):new Date(); const day=(b.getDay()+6)%7; const s=new Date(b); s.setDate(b.getDate()-day); const e=new Date(s); e.setDate(s.getDate()+6); return {from:toISO(s), to:toISO(e)}; }
const monthRange=iso=>{ const b=iso?new Date(iso):new Date(); const s=new Date(b.getFullYear(), b.getMonth(), 1); const e=new Date(b.getFullYear(), b.getMonth()+1, 0); return {from:toISO(s), to:toISO(e)}; }
function monthMatrix(y,m){ const f=new Date(y,m,1); const w=(f.getDay()+6)%7 + 1; const s=new Date(f); s.setDate(f.getDate()-(w-1)); const cells=[]; for(let i=0;i<42;i++){ const d=new Date(s); d.setDate(s.getDate()+i); cells.push({ iso:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`, inMonth:d.getMonth()===m, day:d.getDate(), dow:(d.getDay()+6)%7 }); } return cells; }

export default function App(){
  // Auth (optional)
  const cloudEnabled = !!supabase;
  const [user,setUser]=useState(null);
  const [accessToken,setAccessToken]=useState(null);
  const [authError,setAuthError]=useState('');
  const [authEmail,setAuthEmail]=useState('');
  const [authPass,setAuthPass]=useState('');

  const [profile,setProfile]=useState(null); // {name,email,is_admin}
  const [syncStatus,setSyncStatus]=useState('idle');

  useEffect(()=>{
    let unsub = () => {};
    (async ()=>{
      if(!supabase){ setUser(null); return; }
      const { data } = await supabase.auth.getSession();
      setUser(data?.session?.user || null);
      setAccessToken(data?.session?.access_token || null);
      const { data: sub } = supabase.auth.onAuthStateChange((_e, session)=>{
        setUser(session?.user || null);
        setAccessToken(session?.access_token || null);
      });
      unsub = sub?.subscription?.unsubscribe || (()=>{});
    })();
    return ()=>{ try{unsub();}catch{} };
  },[]);

  useEffect(()=>{
    (async()=>{
      if(!supabase || !user) return;
      setSyncStatus('loading');
      // ensure profile exists
      const { data: prof, error } = await supabase.from('profiles').select('email,name,is_admin').eq('id', user.id).maybeSingle();
      if(error){ setSyncStatus('error'); return; }
      if(!prof){
        const name = user.user_metadata?.name || (user.email||'').split('@')[0];
        const { error: insErr } = await supabase.from('profiles').insert({ id: user.id, email: user.email, name });
        if(insErr){ setSyncStatus('error'); return; }
        setProfile({ email: user.email, name, is_admin: false });
      } else {
        setProfile(prof);
      }
      // load user_data
      const { data: ud, error: udErr } = await supabase.from('user_data').select('data').eq('user_id', user.id).maybeSingle();
      if(!udErr && ud?.data?.summaries){ setSummaries(ud.data.summaries); }
      setSyncStatus('saved');
    })();
  },[user]);

  useEffect(()=>{
    const t=setTimeout(async()=>{
      if(!supabase || !user) return;
      setSyncStatus('saving');
      const payload={ summaries };
      const { error } = await supabase.from('user_data').upsert({ user_id: user.id, data: payload });
      setSyncStatus(error ? 'error' : 'saved');
    },700);
    return ()=>clearTimeout(t);
  },[summaries,user]);

  async function signUp(email,password){
    setAuthError('');
    const { error } = await supabase.auth.signUp({ email, password });
    if(error) setAuthError(error.message);
  }
  async function signIn(email,password){
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if(error) setAuthError(error.message);
  }
  async function signOut(){ await supabase?.auth.signOut(); }

  // Trading state
  const [initialBalance,setInitialBalance]=useState(1000);
  const [dailyTarget,setDailyTarget]=useState(50);
  const [targetMode,setTargetMode]=useState('amount');
  const [targetPercent,setTargetPercent]=useState('3');
  const [payoutInput,setPayoutInput]=useState('92');
  const [lockAfterTarget,setLockAfterTarget]=useState(true);
  const [customStake,setCustomStake]=useState('');
  const [darkMode,setDarkMode]=useState(false);
  const [tradingDate,setTradingDate]=useState(todayStr());
  const [carryOver,setCarryOver]=useState(true);
  const [recalcForwardOnSave,setRecalcForwardOnSave]=useState(true);
  const [trades,setTrades]=useState([]);

  useEffect(()=>{ try{ const s=localStorage.getItem('po_theme'); if(s) setDarkMode(s==='dark'); }catch{} },[]);
  useEffect(()=>{ try{ localStorage.setItem('po_theme', darkMode?'dark':'light'); }catch{} },[darkMode]);
  useEffect(()=>{ document.documentElement.classList.toggle('dark', darkMode) },[darkMode]);

  const payout=useMemo(()=>parsePct(payoutInput),[payoutInput]);
  const realizedPnL=useMemo(()=>trades.reduce((s,t)=>s+t.pnl,0),[trades]);
  const wins=useMemo(()=>trades.filter(t=>t.result==='win').length,[trades]);
  const losses=useMemo(()=>trades.filter(t=>t.result==='loss').length,[trades]);
  const targetAmount=useMemo(()=> targetMode==='amount'?(Number(dailyTarget)||0):(Number(initialBalance)||0)*parsePct(targetPercent),[targetMode,dailyTarget,targetPercent,initialBalance]);
  const remainingTarget=useMemo(()=>Math.max(0, Number(targetAmount)-realizedPnL),[targetAmount,realizedPnL]);
  const suggestedStake=useMemo(()=>{ const p=Number(payout); if(p<=0) return 0; if(lockAfterTarget&&remainingTarget<=0) return 0; return Math.round((remainingTarget/p)*100)/100; },[payout,remainingTarget,lockAfterTarget]);
  const currentBalance=useMemo(()=> Number(initialBalance)+realizedPnL,[initialBalance,realizedPnL]);
  const totalTrades=trades.length;
  const winRate=totalTrades?(wins/totalTrades)*100:0;
  const dayPct=initialBalance?(realizedPnL/Number(initialBalance))*100:0;

  function addTrade(result){
    const p=Number(payout);
    let stake=customStake!==''?Number(customStake):suggestedStake;
    if(!isFinite(stake)||stake<=0) return;
    const pnl = result==='win'? stake*p : -stake;
    const nb = currentBalance + pnl;
    setTrades(prev=>[...prev, {id:prev.length+1, stake:Math.round(stake*100)/100, payout:p, result, pnl:Math.round(pnl*100)/100, balance:Math.round(nb*100)/100} ]);
    setCustomStake('');
  }
  const resetDay=()=>{ setTrades([]); setCustomStake(''); }
  function hardReset(){ setTrades([]); setInitialBalance(1000); setDailyTarget(50); setTargetMode('amount'); setTargetPercent('3'); setPayoutInput('92'); setLockAfterTarget(true); setCustomStake(''); }

  // Summaries (local by default; cloud-syncs if logged in)
  const [summaries,setSummaries]=useState(()=>{ try{ return JSON.parse(localStorage.getItem('po_day_summaries_v6')||'{}'); } catch { return {}; } });
  useEffect(()=>{ try{ localStorage.setItem('po_day_summaries_v6', JSON.stringify(summaries)); } catch {} },[summaries]);

  const [editingDay,setEditingDay]=useState(null);
  function recalcForwardFrom(dateISO, baseMap){
    const map = {...(baseMap || summaries)};
    const keys = Object.keys(map).sort();
    const idx = keys.indexOf(dateISO);
    if (idx === -1) return map;
    let prevEnd = Number(map[keys[idx]]?.endBalance ?? 0);
    for (let i=idx+1; i<keys.length; i++){
      const k = keys[i];
      const s = map[k];
      if (!s) continue;
      const startBalance = Number(prevEnd);
      const endBalance   = Number(startBalance) + Number(s.pnl||0);
      map[k] = {...s, startBalance, endBalance};
      prevEnd = endBalance;
    }
    return map;
  }
  function saveDay({advance=true}={}){
    const d=tradingDate;
    const summary={ date:d, startBalance:Number(initialBalance), endBalance:Number(currentBalance), pnl:Number(realizedPnL), trades:totalTrades, wins, losses, winRate: totalTrades? Number(((wins/totalTrades)*100).toFixed(2)) : 0, targetAmount:Number(targetAmount), payout:Number(payout), tradesLog: trades.slice() };
    setSummaries(prev=>{ let next={...prev,[d]:summary}; if(recalcForwardOnSave) next=recalcForwardFrom(d,next); return next; });
    setTrades([]); setCustomStake(''); setEditingDay(null);
    if(advance){ if(carryOver) setInitialBalance(Number(currentBalance)); setTradingDate(addDays(d,1)); }
  }
  const closeDay=()=>saveDay({advance:true});

  // Calendar state
  const [calYear,setCalYear]=useState(()=>new Date(tradingDate).getFullYear());
  const [calMonth,setCalMonth]=useState(()=>new Date(tradingDate).getMonth());
  useEffect(()=>{ const d=new Date(tradingDate); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); },[tradingDate]);
  const calCells=useMemo(()=>monthMatrix(calYear,calMonth),[calYear,calMonth]);
  const prevMonth=()=>{ const d=new Date(calYear,calMonth,1); d.setMonth(d.getMonth()-1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }
  const nextMonth=()=>{ const d=new Date(calYear,calMonth,1); d.setMonth(d.getMonth()+1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }

  const sortedData=useMemo(()=>{ const arr=Object.values(summaries); arr.sort((a,b)=>a.date.localeCompare(b.date)); return arr; },[summaries]);
  const [rangeFrom,setRangeFrom]=useState(sortedData[0]?.date||todayStr());
  const [rangeTo,setRangeTo]=useState(sortedData[sortedData.length-1]?.date||todayStr());
  useEffect(()=>{ if(sortedData.length){ setRangeFrom(sortedData[0].date); setRangeTo(sortedData[sortedData.length-1].date) }},[sortedData.length]);
  const [quickFilter,setQuickFilter]=useState('all');
  function setCalendarToISO(iso){ const d=new Date(iso); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }
  function applyQuickFilter(type){
    setQuickFilter(type);
    if(type==='week'){ const {from,to}=weekRange(tradingDate); setRangeFrom(from); setRangeTo(to); setCalendarToISO(from); }
    else if(type==='month'){ const {from,to}=monthRange(tradingDate); setRangeFrom(from); setRangeTo(to); setCalendarToISO(from); }
    else if(type==='all'){ if(sortedData.length){ setRangeFrom(sortedData[0].date); setRangeTo(sortedData[sortedData.length-1].date); setCalendarToISO(sortedData[sortedData.length-1].date);} else { const t=todayStr(); setRangeFrom(t); setRangeTo(t);} }
  }
  const filteredData=useMemo(()=> sortedData.filter(d=>(!rangeFrom||d.date>=rangeFrom)&&(!rangeTo||d.date<=rangeTo)).map(d=>({date:d.date.slice(5), pnl:Number(d.pnl), endBalance:Number(d.endBalance)})),[sortedData,rangeFrom,rangeTo]);

  const [detailsOpen,setDetailsOpen]=useState(false);
  const [detailsDate,setDetailsDate]=useState(null);
  const openDayDetails=(date)=>{ setDetailsDate(date); setDetailsOpen(true); };
  const closeDetails=()=>{ setDetailsOpen(false); setDetailsDate(null); };
  function reopenForEditing(date){
    const s=summaries[date]; if(!s) return;
    setTradingDate(date);
    setInitialBalance(Number(s.startBalance)||0);
    setTrades(Array.isArray(s.tradesLog)?s.tradesLog.slice():[]);
    setEditingDay(date);
    setDetailsOpen(false);
    window.scrollTo({top:0, behavior:'smooth'});
  }
  function deleteDay(date){ const next={...summaries}; delete next[date]; setSummaries(next); setDetailsOpen(false); }
  const details = detailsDate ? summaries[detailsDate] : null;

  // Admin create-user UI
  const [newEmail,setNewEmail]=useState('');
  const [newName,setNewName]=useState('');
  const [newPass,setNewPass]=useState('');
  const [newIsAdmin,setNewIsAdmin]=useState(false);
  const [adminMsg,setAdminMsg]=useState('');

  async function adminCreateUser(){
    setAdminMsg('');
    if(!accessToken){ setAdminMsg('No access token'); return; }
    try{
      const res = await fetch('/.netlify/functions/admin-create-user', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'Authorization': 'Bearer '+accessToken },
        body: JSON.stringify({ email:newEmail, password:newPass, name:newName, is_admin:newIsAdmin })
      });
      const j = await res.json();
      if(!res.ok){ setAdminMsg('Error: '+(j.error||res.statusText)); return; }
      setAdminMsg('User created ✔ ('+j.user_id+')');
      setNewEmail(''); setNewName(''); setNewPass(''); setNewIsAdmin(false);
    }catch(e){ setAdminMsg('Error: '+e.message); }
  }

  // Sign-in gate (only if Supabase configured)
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
                <div className="flex items-center gap-2"><Wallet className="h-5 w-5" /><h1 className="text-lg font-semibold">Pocket Options — Sign in</h1></div>
                <div className="flex items-center gap-2">
                  <Button variant={darkMode ? "outline" : "default"} onClick={() => setDarkMode(false)}>Light</Button>
                  <Button variant={darkMode ? "default" : "outline"} onClick={() => setDarkMode(true)}>Dark</Button>
                </div>
              </div>
              <div className="text-xs text-gray-600">Cloud sync enabled — sign in to keep data per user.</div>
              <div className="space-y-2"><label className="text-sm font-medium">Email</label><Input type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="you@example.com" /></div>
              <div className="space-y-2"><label className="text-sm font-medium">Password</label><Input type="password" value={authPass} onChange={e=>setAuthPass(e.target.value)} placeholder="••••••••" /></div>
              {authError && <div className="text-xs text-rose-500">{authError}</div>}
              <div className="flex gap-2">
                <Button onClick={()=>signIn(authEmail, authPass)} className="flex-1"><LogIn className="h-4 w-4 mr-2"/> Sign in</Button>
                <Button variant="outline" onClick={()=>signUp(authEmail, authPass)} className="flex-1">Create account</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-${darkMode?'dark':'light'}`}>
      <style>{`
        .day-cell { min-height:84px; cursor:pointer; }
        .app-light { background: #f8fafc; color:#111827; }
        .app-dark  { background:#0b1220; color:#e5e7eb; }
        .app-dark input { background:#111827!important; color:#e5e7eb!important; border-color:#374151!important; }
        .app-dark .bg-white { background:#1f2937!important; }
        .app-dark .bg-gray-50 { background:#0f172a!important; }
        .app-dark .border-gray-200 { border-color:#374151!important; }
      `}</style>

      <div className="min-h-screen w-full bg-gray-50 p-6 text-gray-900">
        <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 shadow-sm bg-white border border-gray-200" style={{maxWidth:420}}>
            <CardContent className="p-5 space-y-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2"><Wallet className="h-5 w-5"/><h1 className="text-xl font-semibold">Pocket Options Daily Manager</h1></div>
                <div className="flex items-center gap-2">
                  <Button variant={darkMode?'outline':'default'} onClick={()=>setDarkMode(false)}>Light</Button>
                  <Button variant={darkMode?'default':'outline'} onClick={()=>setDarkMode(true)}>Dark</Button>
                  {cloudEnabled && user && (<Button variant="outline" onClick={signOut}><LogOut className="h-4 w-4 mr-2"/> Sign out</Button>)}
                </div>
              </div>

              {cloudEnabled && user && profile && (
                <div className="rounded-lg border border-gray-200 p-2 text-xs flex items-center justify-between">
                  <div>Signed in as <b>{profile.name||user.email}</b> {profile.is_admin && <span className="ml-1 text-emerald-500">(admin)</span>}</div>
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
                <Input type="number" inputMode="decimal" value={initialBalance} onChange={e=>setInitialBalance(Number(e.target.value))} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Daily profit target</label>
                <div className="flex items-center gap-2">
                  <Button variant={targetMode==='amount'?'default':'outline'} onClick={()=>setTargetMode('amount')}>Amount</Button>
                  <Button variant={targetMode==='percent'?'default':'outline'} onClick={()=>setTargetMode('percent')}>Percent</Button>
                </div>
                {targetMode==='amount' ? (
                  <Input type="number" inputMode="decimal" value={dailyTarget} onChange={e=>setDailyTarget(Number(e.target.value))} />
                ) : (
                  <div className="flex gap-2 items-center">
                    <Input type="text" value={targetPercent} onChange={e=>setTargetPercent(e.target.value)} placeholder="3 or 3% or 0.03" />
                    <span className="text-sm">= {num(targetAmount)} (at {toPctStr(parsePct(targetPercent))} of initial)</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Pair payout</label>
                <div className="flex gap-2 items-center">
                  <Input type="text" value={payoutInput} onChange={e=>setPayoutInput(e.target.value)} placeholder="92 or 0.92 or 92%" />
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
                <div className="rounded-2xl bg-white p-4 border border-gray-200"><div className="text-xs">Profit needed to hit target</div><div className={`text-2xl font-semibold ${remainingTarget<=0?'text-emerald-400':''}`}>{num(remainingTarget)}</div></div>
                <div className="rounded-2xl bg-white p-4 border border-gray-200"><div className="text-xs">Cycle losses (to recover)</div><div className="text-2xl font-semibold">{num(trades.filter(t=>t.result==='loss').reduce((s,t)=>s+Math.abs(t.pnl),0))}</div></div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Suggested next position (auto)</label>
                <Input value={suggestedStake} readOnly />
                <div className="text-xs">Formula: (Target − Realized P&L) / Payout</div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Or set custom stake</label>
                <Input type="number" inputMode="decimal" placeholder="Optional override" value={customStake} onChange={e=>setCustomStake(e.target.value)} />
                <div className="text-xs">If provided, this amount will be used for the next Win/Loss action.</div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button className="flex-1" onClick={()=>addTrade('win')}><CheckCircle className="h-4 w-4 mr-2"/> Win</Button>
                <Button variant="destructive" className="flex-1" onClick={()=>addTrade('loss')}><XCircle className="h-4 w-4 mr-2"/> Loss</Button>
              </div>

              <div className="flex gap-2">
                <Button variant="secondary" onClick={resetDay}><RotateCcw className="h-4 w-4 mr-2"/> Reset trades (today)</Button>
                <Button variant="outline" onClick={hardReset}>Hard reset</Button>
              </div>

              <div className="border-t border-gray-200 pt-4 mt-2 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Carry over end balance to next day</div>
                    <div className="text-xs">If ON, tomorrow's initial balance = today's current balance</div>
                  </div>
                  <Switch checked={carryOver} onCheckedChange={setCarryOver} />
                </div>
                {editingDay ? (
                  <Button onClick={()=>saveDay({advance:false})}><CalendarIcon className="h-4 w-4 mr-2"/> Save edits for {editingDay}</Button>
                ) : (
                  <Button onClick={closeDay}><CalendarIcon className="h-4 w-4 mr-2"/> Τέλος ημέρας (save to calendar)</Button>
                )}
              </div>

              {cloudEnabled && profile?.is_admin && (
                <div className="border-t border-gray-200 pt-4 mt-2 space-y-3">
                  <div className="flex items-center gap-2 font-semibold"><ShieldPlus className="h-4 w-4"/> Admin ▸ Add user</div>
                  <div className="space-y-2">
                    <Input placeholder="Email" value={newEmail} onChange={e=>setNewEmail(e.target.value)} />
                    <Input placeholder="Name (optional)" value={newName} onChange={e=>setNewName(e.target.value)} />
                    <Input placeholder="Password" type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} />
                    <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={newIsAdmin} onChange={e=>setNewIsAdmin(e.target.checked)} />Make admin</label>
                    <div className="flex gap-2">
                      <Button onClick={adminCreateUser}>Create account</Button>
                      {adminMsg && <div className="text-xs">{adminMsg}</div>}
                    </div>
                  </div>
                </div>
              )}

            </CardContent>
          </Card>

          <Card className="lg:col-span-2 shadow-sm bg-white border border-gray-200">
            <CardContent className="p-5 space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-white p-4 border border-gray-200"><div className="text-xs">Current balance</div><div className="text-2xl font-semibold">{num(currentBalance)}</div></div>
                <div className="rounded-2xl bg-white p-4 border border-gray-200"><div className="text-xs">Realized P&L (today)</div><div className={`text-2xl font-semibold ${realizedPnL>=0?'text-emerald-400':'text-rose-400'}`}>{num(realizedPnL)}</div></div>
                <div className="rounded-2xl bg-white p-4 border border-gray-200"><div className="text-xs">Win rate</div><div className="text-2xl font-semibold">{(totalTrades? (wins/totalTrades*100):0).toFixed(1)}%</div></div>
                <div className="rounded-2xl bg-white p-4 border border-gray-200"><div className="text-xs">Day % vs initial</div><div className={`${dayPct>=0?'text-emerald-400':'text-rose-400'} text-2xl font-semibold`}>{num(dayPct,2)}%</div></div>
              </div>

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
                  <div className="grid grid-cols-7 text-xs text-gray-600 mb-2">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=><div key={d} className="px-2 py-1">{d}</div>)}</div>
                  <div className="grid grid-cols-7 gap-2">
                    {calCells.map((c,idx)=>{
                      const s=summaries[c.iso]; const pnl=s?.pnl??null; const pnlClass = pnl==null? 'text-gray-500' : (pnl>=0?'text-emerald-500':'text-rose-500');
                      return (
                        <div key={idx} className={`day-cell border rounded-lg p-2 ${c.inMonth?'bg-white border-gray-200':'bg-gray-50 border-gray-200 opacity-60'}`} onClick={()=> s && openDayDetails(c.iso)}>
                          <div className="text-xs flex items-center justify-between">
                            <span className="font-medium">{c.day}</span>
                            {s && <span className={`text-[10px] ${pnl>=0?'text-emerald-500':'text-rose-500'}`}>{num(pnl)}</span>}
                          </div>
                          {s && <div className={`mt-2 text-xs ${pnlClass}`}>{pnl>=0?'+':''}{num(pnl)} PnL</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-white border border-gray-200">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <div className="font-semibold">Charts</div>
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    <Button variant={quickFilter==='week'?'default':'outline'} onClick={()=>applyQuickFilter('week')}>This week</Button>
                    <Button variant={quickFilter==='month'?'default':'outline'} onClick={()=>applyQuickFilter('month')}>This month</Button>
                    <Button variant={quickFilter==='all'?'default':'outline'} onClick={()=>applyQuickFilter('all')}>All time</Button>
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
            </CardContent>
          </Card>
        </div>
      </div>

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

            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <Button onClick={()=>reopenForEditing(detailsDate)}><Pencil className="h-4 w-4 mr-2"/> Reopen to edit</Button>
              <Button variant="outline" onClick={()=>{ setSummaries(prev=>recalcForwardFrom(detailsDate, prev)); setDetailsOpen(false); }}>
                <RefreshCcw className="h-4 w-4 mr-2" /> Recalculate forward
              </Button>
              <Button variant="destructive" onClick={()=>deleteDay(detailsDate)}><Trash2 className="h-4 w-4 mr-2"/> Delete day</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
