import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, AreaChart, Area, CartesianGrid, Legend
} from "recharts";

/* ═══════════════════════════════════════════════════════════
   CONFIGURATION
   ═══════════════════════════════════════════════════════════ */
const DEFAULT_CONFIG = {
  BUDGET: 3000000,
  PROJECT_NAME: "ระบบจัดการงบการเงินโครงการ",
  SYNC_INTERVAL: 15,
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbw21wnTrEe1VHkq7iXufZhksoxPTj-LWOPI8Ot2I15hQ3L9-ft5EV7iZT0UoYt1STHD/exec",
  GOOGLE_CLIENT_ID: "200802965519-2vca96qfhktv1qpbuklm8fl8cvvpgo92.apps.googleusercontent.com",
  SHEET_URL: "https://docs.google.com/spreadsheets/d/15UIcPMpPh5xYGBACN4Hz7G4JhNaWXeCNAgQ_ymipJ6g/edit?gid=0#gid=0",
};

/* ═══════════════════════════════════════════════════════════
   CATEGORIES — พร้อมเพดานงบ (max)
   ═══════════════════════════════════════════════════════════ */
const CATS = [
  { id:"training",   label:"ค่าอบรม/สัมมนา",     icon:"🎓", color:"#6366F1", max:500000 },
  { id:"travel_dom", label:"เดินทางในประเทศ",    icon:"🚗", color:"#0EA5E9", max:300000 },
  { id:"travel_int", label:"เดินทางต่างประเทศ",  icon:"✈️", color:"#8B5CF6", max:500000 },
  { id:"equipment",  label:"วัสดุ/อุปกรณ์",       icon:"🔧", color:"#F97316", max:400000 },
  { id:"paper",      label:"ตีพิมพ์/Publication", icon:"📄", color:"#EC4899", max:300000 },
  { id:"salary",     label:"ค่าตอบแทนบุคลากร",   icon:"👥", color:"#10B981", max:500000 },
  { id:"service",    label:"ค่าจ้างบริการ",       icon:"🛠", color:"#EAB308", max:200000 },
  { id:"supplies",   label:"วัสดุสิ้นเปลือง",     icon:"📦", color:"#A855F7", max:150000 },
  { id:"utility",    label:"สาธารณูปโภค",        icon:"💡", color:"#14B8A6", max:100000 },
  { id:"other",      label:"อื่นๆ",              icon:"📋", color:"#64748B", max:50000 },
];
const CM = Object.fromEntries(CATS.map(c => [c.id, c]));

/* ═══════════════════════════════════════════════════════════
   THEME — Professional Light
   ═══════════════════════════════════════════════════════════ */
const T = {
  bg:"#F8FAFC",   s1:"#FFFFFF",   s2:"#FFFFFF",  s3:"#F1F5F9",
  b:"#E2E8F0",    b2:"#CBD5E1",   a:"#4F46E5",   a2:"#6366F1",
  g:"#059669",    gs:"#ECFDF5",
  r:"#DC2626",    rs:"#FEF2F2",
  am:"#D97706",   ams:"#FFFBEB",
  bl:"#0284C7",   bls:"#F0F9FF",
  t:"#1E293B",    m:"#64748B",    d:"#94A3B8",
  card:"#FFFFFF", shadow:"0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.04)",
  shadowLg:"0 4px 12px rgba(0,0,0,.08)",
};

const fmt = n => Number(n).toLocaleString("th-TH");
const fmtTime = d => d ? new Date(d).toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit",second:"2-digit"}) : "—";

/* ═══════════════════════════════════════════════════════════
   DEMO DATA
   ═══════════════════════════════════════════════════════════ */
const DEMO = [
  { id:1, type:"เบิก", person:"กอบกูล",  date:"2026-03-19", category:"training",   item:"ค่าอบรมหลักสูตร AI",      amount:50000,  note:"" },
  { id:2, type:"เบิก", person:"สุเทพ",   date:"2026-03-19", category:"training",   item:"ค่าโครงการอบรม อสม.",     amount:50000,  note:"" },
  { id:3, type:"คืน",  person:"สุเทพ",   date:"2026-03-20", category:"training",   item:"ค่าโครงการอบรม อสม.",     amount:10000,  note:"คืนส่วนที่เหลือ" },
  { id:4, type:"เบิก", person:"พี่ขวัญ", date:"2026-03-20", category:"paper",      item:"ค่าตีพิมพ์ Paper IEEE",   amount:160000, note:"" },
  { id:5, type:"เบิก", person:"อ.บัญชา", date:"2026-03-20", category:"travel_int", item:"ค่าเดินทางประชุม Japan",  amount:100000, note:"" },
  { id:6, type:"คืน",  person:"กอบกูล",  date:"2026-03-21", category:"training",   item:"ค่าอบรมหลักสูตร AI",      amount:5000,   note:"คืนค่าที่พัก" },
  { id:7, type:"คืน",  person:"อ.บัญชา", date:"2026-03-21", category:"travel_int", item:"ค่าเดินทางประชุม Japan",  amount:20000,  note:"ส่วนต่างตั๋ว" },
  { id:8, type:"เบิก", person:"สมหญิง",  date:"2026-03-22", category:"equipment",  item:"ค่า Laptop วิจัย",        amount:45000,  note:"" },
  { id:9, type:"เบิก", person:"อ.บัญชา", date:"2026-03-23", category:"salary",     item:"ค่าตอบแทน RA มี.ค.",      amount:30000,  note:"" },
  { id:10,type:"เบิก", person:"กอบกูล",  date:"2026-03-24", category:"service",    item:"ค่าจ้างแปลเอกสาร",       amount:15000,  note:"" },
];

/* ═══════════════════════════════════════════════════════════
   SYNC ENGINE
   ═══════════════════════════════════════════════════════════ */
function useSyncEngine(scriptUrl, interval, enabled, userEmail, onAuthFail) {
  const [data, setData] = useState([]);
  const [syncState, setSyncState] = useState("idle");
  const [lastSync, setLastSync] = useState(null);
  const [error, setError] = useState(null);
  const [changeCount, setChangeCount] = useState(0);
  const timerRef = useRef(null);
  const isMountedRef = useRef(true);
  const authVerified = useRef(false);
  const isReady = enabled && scriptUrl && !scriptUrl.includes("YOUR_");

  const fetchData = useCallback(async (silent = false) => {
    if (!isReady) return;
    if (!silent) setSyncState("loading"); else setSyncState("syncing");
    try {
      const needAuth = !authVerified.current && userEmail;
      const url = needAuth
        ? `${scriptUrl}?action=authAndRead&email=${encodeURIComponent(userEmail)}&t=${Date.now()}`
        : `${scriptUrl}?action=read&t=${Date.now()}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!isMountedRef.current) return;
      if (needAuth) {
        if (json.authorized === false) { onAuthFail?.(userEmail); return; }
        authVerified.current = true;
        const rows = Array.isArray(json.data) ? json.data : [];
        setData(rows.map(r => ({ ...r, amount: Number(r.amount) || 0 })));
      } else if (Array.isArray(json)) {
        setData(json.map(r => ({ ...r, amount: Number(r.amount) || 0 })));
      }
      setLastSync(new Date()); setSyncState("synced"); setError(null);
    } catch (err) {
      if (isMountedRef.current) { setSyncState("error"); setError(err.message); }
    }
  }, [scriptUrl, isReady, userEmail, onAuthFail]);

  const writeData = useCallback(async (action, payload, optimisticFn) => {
    if (!isReady) { if (optimisticFn) optimisticFn(setData); return true; }
    if (optimisticFn) optimisticFn(setData);
    setSyncState("syncing"); setChangeCount(c => c + 1);
    try {
      const res = await fetch(scriptUrl, { method:"POST", body:JSON.stringify({ action, ...payload }), redirect:"follow" });
      let json; try { json = await res.json(); } catch { json = { success:true }; }
      if (isMountedRef.current) { setSyncState("synced"); setLastSync(new Date()); setError(null); setTimeout(() => fetchData(true), 1200); }
      return json?.success !== false;
    } catch (err) {
      if (isMountedRef.current) { setSyncState("error"); setError(err.message); setTimeout(() => fetchData(true), 2000); }
      return false;
    }
  }, [scriptUrl, isReady, fetchData]);

  useEffect(() => { isMountedRef.current = true; if (isReady) fetchData(); return () => { isMountedRef.current = false; }; }, [isReady]);
  useEffect(() => { if (!isReady || !interval) return; timerRef.current = setInterval(() => fetchData(true), interval * 1000); return () => clearInterval(timerRef.current); }, [isReady, interval, fetchData]);

  return { data, setData, syncState, lastSync, error, changeCount, fetchData, writeData, isReady };
}

function useWidth() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => { const h = () => setW(window.innerWidth); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  return w;
}

/* ═══════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════ */
export default function App() {
  const W = useWidth();
  const mob = W < 768;

  // ── Auth State ──
  const saved = useRef((() => { try { return JSON.parse(localStorage.getItem("fin_session")); } catch { return null; } })());
  const [user, setUser] = useState(saved.current?.user || null);
  const [isAuth, setIsAuth] = useState(!!saved.current?.user);
  const [authErr, setAuthErr] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(false); // กำลังเช็คสิทธิ์กับ Apps Script
  const [demo, setDemo] = useState(false);
  const cfg = {
    clientId: DEFAULT_CONFIG.GOOGLE_CLIENT_ID, scriptUrl: DEFAULT_CONFIG.APPS_SCRIPT_URL,
    budget: DEFAULT_CONFIG.BUDGET, projectName: DEFAULT_CONFIG.PROJECT_NAME,
    sheetUrl: DEFAULT_CONFIG.SHEET_URL, syncInterval: DEFAULT_CONFIG.SYNC_INTERVAL,
  };

  // ── Warm-up ──
  const warmedUp = useRef(false);
  useEffect(() => { if (!isAuth && !warmedUp.current && cfg.scriptUrl) { warmedUp.current = true; fetch(`${cfg.scriptUrl}?action=ping&t=${Date.now()}`).catch(() => {}); } }, [isAuth, cfg.scriptUrl]);

  const onAuthFail = useCallback((email) => { setIsAuth(false); setAuthErr(`${email} ไม่ได้รับอนุญาต — ติดต่อเจ้าของ Sheet เพื่อเพิ่มสิทธิ์`); localStorage.removeItem("fin_session"); }, []);

  const sync = useSyncEngine(cfg.scriptUrl, cfg.syncInterval, isAuth && !demo, user?.email, onAuthFail);
  const tx = demo ? DEMO : sync.data;

  // ── UI State ──
  const [tab, setTab] = useState("dashboard");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState("");
  const [fType, setFType] = useState("all");
  const [fCat, setFCat] = useState("all");
  const [toast, setToast] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [localTx, setLocalTx] = useState(DEMO);
  const activeTx = demo ? localTx : (tx.length ? tx : []);
  const formInit = { type:"เบิก", person:"", date:new Date().toISOString().split("T")[0], category:"training", item:"", amount:"", note:"" };
  const [form, setForm] = useState(formInit);
  const fire = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null), 3500); };

  // ── Google Login (เช็คสิทธิ์ก่อนเข้า) ──
  const gLogin = useCallback(() => {
    if (typeof google === "undefined") { fire("Google Sign-In กำลังโหลด...","error"); return; }
    try {
      google.accounts.oauth2.initTokenClient({
        client_id: cfg.clientId, scope: "email profile",
        callback: (tok) => {
          setAuthLoading(true);
          fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${tok.access_token}` } })
            .then(r => r.json()).then(async (info) => {
              setUser(info);
              setAuthLoading(false);
              setAuthChecking(true);
              setAuthErr(null);
              try {
                const res = await fetch(`${cfg.scriptUrl}?action=authAndRead&email=${encodeURIComponent(info.email)}&t=${Date.now()}`);
                const result = await res.json();
                if (result.authorized) {
                  setIsAuth(true);
                  localStorage.setItem("fin_session", JSON.stringify({ user: info, ts: Date.now() }));
                  // ส่งข้อมูลที่ได้มาให้ sync engine ใช้เลย ไม่ต้อง fetch ซ้ำ
                  if (Array.isArray(result.data)) {
                    sync.setData(result.data.map(r => ({ ...r, amount: Number(r.amount) || 0 })));
                  }
                  fire(`ยินดีต้อนรับ ${info.name}`);
                } else {
                  setAuthErr(`${info.email} ไม่ได้รับอนุญาต — ติดต่อเจ้าของ Sheet เพื่อเพิ่มสิทธิ์`);
                }
              } catch {
                setAuthErr("ไม่สามารถเช็คสิทธิ์ได้ — ลองใหม่อีกครั้ง");
              }
              setAuthChecking(false);
            }).catch(() => { fire("เข้าสู่ระบบไม่สำเร็จ","error"); setAuthLoading(false); });
        }
      }).requestAccessToken();
    } catch { fire("เกิดข้อผิดพลาด กรุณาลองใหม่","error"); }
  }, [cfg, sync]);

  const enterDemo = () => { setDemo(true); setIsAuth(true); setUser({name:"ทดลองใช้งาน",email:"demo@example.com"}); fire("โหมด Demo — ข้อมูลไม่ได้บันทึก","info"); };
  const logout = () => { setUser(null); setIsAuth(false); setDemo(false); setAuthErr(null); localStorage.removeItem("fin_session"); };

  // ── Stats ──
  const budget = DEFAULT_CONFIG.BUDGET;
  const stats = useMemo(() => {
    const tw = activeTx.filter(t=>t.type==="เบิก").reduce((s,t)=>s+Number(t.amount),0);
    const tr = activeTx.filter(t=>t.type==="คืน").reduce((s,t)=>s+Number(t.amount),0);
    const net=tw-tr, rem=budget-net, pct=budget>0?(net/budget)*100:0;
    return { tw, tr, net, rem, pct, st: pct>90?"danger":pct>70?"warning":"safe" };
  }, [activeTx, budget]);

  // ── Category budget tracking ──
  const catBudget = useMemo(() => {
    const m = {};
    activeTx.forEach(t => {
      const c = t.category || "other";
      if (!m[c]) m[c] = { spent:0, returned:0 };
      if (t.type === "เบิก") m[c].spent += Number(t.amount);
      else m[c].returned += Number(t.amount);
    });
    return CATS.map(cat => {
      const d = m[cat.id] || { spent:0, returned:0 };
      const net = d.spent - d.returned;
      const rem = cat.max - net;
      const pct = cat.max > 0 ? (net / cat.max) * 100 : 0;
      return { ...cat, spent:d.spent, returned:d.returned, net, rem, pct, over: rem < 0 };
    });
  }, [activeTx]);

  const byPerson = useMemo(() => {
    const m = {};
    activeTx.forEach(t => { if (!m[t.person]) m[t.person] = { name:t.person, เบิก:0, คืน:0 }; m[t.person][t.type] += Number(t.amount); });
    return Object.values(m).map(p => ({...p, net:p["เบิก"]-p["คืน"]})).sort((a,b) => b.net - a.net);
  }, [activeTx]);

  const byCat = useMemo(() => {
    const m = {};
    activeTx.filter(t=>t.type==="เบิก").forEach(t => { const c=t.category||"other"; m[c]=(m[c]||0)+Number(t.amount); });
    return Object.entries(m).map(([id,v]) => ({id,name:CM[id]?.label||id,icon:CM[id]?.icon||"📋",color:CM[id]?.color||"#64748B",value:v})).sort((a,b) => b.value-a.value);
  }, [activeTx]);

  const balTime = useMemo(() => {
    let b = budget;
    return [...activeTx].sort((a,c) => a.date.localeCompare(c.date) || a.id-c.id).map(t => {
      b += t.type==="คืน" ? Number(t.amount) : -Number(t.amount);
      return { date:t.date, balance:b };
    });
  }, [activeTx, budget]);

  const filtered = useMemo(() => activeTx.filter(t => {
    const s = !search || [t.person,t.item,t.note].some(v => (v||"").includes(search));
    return s && (fType==="all"||t.type===fType) && (fCat==="all"||t.category===fCat);
  }).sort((a,b) => b.id - a.id), [activeTx,search,fType,fCat]);

  // ── CRUD ──
  const resetForm = () => { setForm(formInit); setEditId(null); setShowForm(false); };
  const submit = async () => {
    if (!form.person||!form.item||!form.amount) { fire("กรุณากรอกข้อมูลให้ครบ","error"); return; }
    const amt = Number(form.amount);
    if (editId !== null) {
      if (demo) setLocalTx(p => p.map(t => t.id===editId ? {...t,...form,amount:amt} : t));
      else await sync.writeData("update", { id:editId,...form,amount:amt }, set => set(p => p.map(t => t.id===editId ? {...t,...form,amount:amt} : t)));
      fire("แก้ไขสำเร็จ");
    } else {
      const nid = Math.max(0,...activeTx.map(t=>t.id))+1;
      const nt = {...form, id:nid, amount:amt};
      if (demo) setLocalTx(p => [...p, nt]);
      else await sync.writeData("add", nt, set => set(p => [...p, nt]));
      fire("เพิ่มรายการสำเร็จ");
    }
    resetForm();
  };
  const edit = (t) => { setForm({type:t.type,person:t.person,date:t.date,category:t.category||"other",item:t.item,amount:t.amount,note:t.note||""}); setEditId(t.id); setShowForm(true); setTab("transactions"); setMenuOpen(false); };
  const del = async (id) => {
    if (demo) setLocalTx(p => p.filter(t => t.id !== id));
    else await sync.writeData("delete", { id }, set => set(p => p.filter(t => t.id !== id)));
    fire("ลบรายการแล้ว");
  };

  // ── Styles ──
  const card = { background:T.card, border:`1px solid ${T.b}`, borderRadius:16, padding:mob?16:24, boxShadow:T.shadow };
  const inp = (x={}) => ({background:"#F8FAFC",border:`1.5px solid ${T.b}`,borderRadius:12,padding:"14px 16px",color:T.t,fontSize:16,outline:"none",width:"100%",boxSizing:"border-box",transition:"border-color .2s",fontFamily:"inherit",...x});
  const btnStyle = (bg,x={}) => ({background:bg,color:"#fff",border:"none",borderRadius:12,padding:"12px 24px",fontSize:15,fontWeight:700,cursor:"pointer",transition:"all .15s",fontFamily:"inherit",...x});

  const Badge = ({type}) => (
    <span style={{background:type==="เบิก"?"#FEE2E2":"#D1FAE5",color:type==="เบิก"?"#DC2626":"#059669",padding:"6px 14px",borderRadius:20,fontSize:14,fontWeight:700,display:"inline-flex",alignItems:"center",gap:4}}>
      <span style={{fontSize:10}}>{type==="เบิก"?"▲":"▼"}</span>{type}
    </span>
  );
  const CatB = ({id}) => { const c=CM[id]||CM.other; return <span style={{background:c.color+"18",color:c.color,padding:"5px 12px",borderRadius:8,fontSize:13,fontWeight:700,display:"inline-flex",alignItems:"center",gap:4}}>{c.icon} {c.label}</span>; };
  const CTip = ({active,payload}) => { if(!active||!payload?.length)return null; return <div style={{background:"#fff",border:`1px solid ${T.b}`,borderRadius:12,padding:"12px 16px",boxShadow:T.shadowLg}}>{payload.map((p,i)=><div key={i} style={{color:p.color||T.t,fontSize:14,fontWeight:700}}>{p.name}: ฿{fmt(p.value)}</div>)}</div>; };

  const SyncDot = () => {
    const colors = {idle:T.d,loading:T.am,syncing:T.bl,synced:T.g,error:T.r};
    const labels = {idle:"รอเชื่อมต่อ",loading:"กำลังโหลด...",syncing:"Syncing...",synced:"เชื่อมต่อแล้ว",error:"ผิดพลาด"};
    const c = colors[sync.syncState] || T.d;
    return (
      <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:T.m}}>
        <div style={{position:"relative"}}>
          <div style={{width:10,height:10,borderRadius:"50%",background:c}} />
          {(sync.syncState==="syncing"||sync.syncState==="loading") && <div style={{position:"absolute",top:-3,left:-3,width:16,height:16,borderRadius:"50%",border:`2px solid ${c}`,borderTopColor:"transparent",animation:"spin .8s linear infinite"}} />}
        </div>
        <span>{demo ? "Demo Mode" : labels[sync.syncState]}</span>
        {sync.lastSync && !demo && <span style={{color:T.d}}>| {fmtTime(sync.lastSync)}</span>}
      </div>
    );
  };

  const sc = {safe:{c:T.g,bg:"#ECFDF5",l:"ปกติ"},warning:{c:T.am,bg:"#FFFBEB",l:"ใกล้เกินงบ"},danger:{c:T.r,bg:"#FEF2F2",l:"เกินงบ!"}}[stats.st];

  /* ═══════════════════════════════════════════════════════
     LOGIN SCREEN
     ═══════════════════════════════════════════════════════ */
  /* ═══ หน้าตรวจสอบสิทธิ์ ═══ */
  if (authChecking) return (
    <div style={{fontFamily:"'Noto Sans Thai',system-ui,sans-serif",background:"linear-gradient(135deg,#EEF2FF 0%,#F8FAFC 50%,#ECFDF5 100%)",color:T.t,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
      <div style={{textAlign:"center",maxWidth:400}}>
        <div style={{width:80,height:80,borderRadius:24,margin:"0 auto 28px",background:`linear-gradient(135deg,${T.a},${T.a2})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,fontWeight:800,color:"#fff",boxShadow:`0 12px 40px ${T.a}33`}}>฿</div>
        <div style={{width:48,height:48,border:`4px solid ${T.b}`,borderTopColor:T.a,borderRadius:"50%",animation:"spin .8s linear infinite",margin:"0 auto 24px"}}/>
        <div style={{fontSize:20,fontWeight:700,marginBottom:8}}>กำลังตรวจสอบสิทธิ์...</div>
        <div style={{fontSize:15,color:T.m}}>{user?.email}</div>
        <div style={{fontSize:13,color:T.d,marginTop:12}}>กำลังเช็คว่าคุณมีสิทธิ์เข้าใช้งานหรือไม่</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!isAuth) return (
    <div style={{fontFamily:"'Noto Sans Thai',system-ui,sans-serif",background:"linear-gradient(135deg,#EEF2FF 0%,#F8FAFC 50%,#ECFDF5 100%)",color:T.t,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
      <script src="https://accounts.google.com/gsi/client" async defer/>
      {toast&&<div style={{position:"fixed",top:20,right:20,left:mob?20:"auto",zIndex:9999,background:toast.type==="error"?"#FEF2F2":"#ECFDF5",border:`1px solid ${toast.type==="error"?"#FECACA":"#A7F3D0"}`,borderRadius:14,padding:"14px 22px",color:toast.type==="error"?T.r:T.g,fontSize:15,fontWeight:700,boxShadow:T.shadowLg}}>{toast.msg}</div>}
      <div style={{textAlign:"center",maxWidth:480,width:"100%"}}>
        <div style={{width:80,height:80,borderRadius:24,margin:"0 auto 28px",background:`linear-gradient(135deg,${T.a},${T.a2})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,fontWeight:800,color:"#fff",boxShadow:`0 12px 40px ${T.a}33`}}>฿</div>
        <h1 style={{fontSize:mob?26:32,fontWeight:800,margin:"0 0 8px",color:T.t}}>ระบบจัดการงบการเงิน</h1>
        <p style={{color:T.m,fontSize:16,margin:"0 0 6px"}}>{cfg.projectName}</p>
        <p style={{color:T.d,fontSize:14,margin:"0 0 36px"}}>เชื่อมต่อ Google Sheets แบบ Real-time</p>

        {authErr&&<div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:14,padding:"16px 22px",marginBottom:22,textAlign:"left"}}><div style={{color:T.r,fontWeight:700,fontSize:15}}>⚠ {authErr}</div><div style={{color:T.m,fontSize:13,marginTop:6}}>ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์</div></div>}

        {/* In-App Browser Detection */}
        {(/Line|FBAN|FBAV|Instagram|Messenger/i.test(navigator.userAgent)) && (
          <div style={{background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:14,padding:"18px 22px",marginBottom:22,textAlign:"left"}}>
            <div style={{color:"#92400E",fontWeight:700,fontSize:16,marginBottom:8}}>⚠️ เข้าสู่ระบบด้วย Google ไม่ได้ในแอป LINE / Messenger</div>
            <div style={{color:"#78716C",fontSize:15,lineHeight:1.7,marginBottom:12}}>
              เนื่องจาก Google ไม่อนุญาตให้ล็อกอินผ่านแอปแชท<br/>
              กรุณาเปิดในเบราว์เซอร์ (Chrome, Safari) แทน
            </div>
            <div style={{color:"#92400E",fontSize:14,fontWeight:600,marginBottom:14,padding:"10px 14px",background:"#FEF3C7",borderRadius:10}}>
              💡 <strong>วิธีทำ:</strong> กดจุด 3 จุด <strong>⋮</strong> มุมขวาบน → เลือก "<strong>เปิดใน Browser</strong>"
            </div>
            <button onClick={()=>{navigator.clipboard?.writeText(window.location.href);fire("คัดลอกลิงก์แล้ว — วางใน Chrome / Safari ได้เลย");}} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",padding:"14px",borderRadius:12,background:"#F59E0B",border:"none",color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>📋 คัดลอกลิงก์</button>
          </div>
        )}

        <button onClick={gLogin} disabled={authLoading} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:14,width:"100%",padding:"16px",borderRadius:14,background:"#fff",border:`2px solid ${T.b}`,color:T.t,fontSize:17,fontWeight:700,cursor:authLoading?"wait":"pointer",opacity:authLoading?.6:1,fontFamily:"inherit",marginBottom:12,transition:"all .2s",boxShadow:T.shadow}} onMouseEnter={e=>{if(!authLoading){e.currentTarget.style.borderColor=T.a;e.currentTarget.style.boxShadow=T.shadowLg}}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.b;e.currentTarget.style.boxShadow=T.shadow}}>
          {authLoading ? <div style={{width:22,height:22,border:`3px solid ${T.a}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin .8s linear infinite"}}/> : <svg width="22" height="22" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>}
          {authLoading ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบด้วย Google"}
        </button>
        <button onClick={enterDemo} style={{width:"100%",padding:"14px",borderRadius:14,background:"transparent",border:`2px solid ${T.b}`,color:T.m,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all .2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.am;e.currentTarget.style.color=T.am}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.b;e.currentTarget.style.color=T.m}}>ทดลองใช้งาน (Demo)</button>
      </div>
      <style>{`input:focus,textarea:focus{border-color:${T.a}!important} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  /* ═══════════════════════════════════════════════════════
     MAIN DASHBOARD
     ═══════════════════════════════════════════════════════ */
  return (
    <div style={{fontFamily:"'Noto Sans Thai',system-ui,sans-serif",background:T.bg,color:T.t,minHeight:"100vh"}}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>

      {toast&&<div style={{position:"fixed",top:16,right:16,left:mob?16:"auto",zIndex:9999,background:toast.type==="error"?"#FEF2F2":"#ECFDF5",border:`1px solid ${toast.type==="error"?"#FECACA":"#A7F3D0"}`,borderRadius:12,padding:"14px 20px",color:toast.type==="error"?T.r:T.g,fontSize:15,fontWeight:700,boxShadow:T.shadowLg,animation:"slideIn .3s ease"}}>{toast.msg}</div>}

      {/* HEADER */}
      <header style={{background:"#FFFFFFEE",backdropFilter:"blur(12px)",borderBottom:`1px solid ${T.b}`,padding:mob?"0 16px":"0 28px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,height:mob?60:68,gap:12}}>
        <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
          <div style={{width:38,height:38,borderRadius:12,background:`linear-gradient(135deg,${T.a},${T.a2})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:"#fff",flexShrink:0}}>฿</div>
          {!mob&&<div style={{minWidth:0}}><div style={{fontSize:16,fontWeight:800,color:T.t}}>{cfg.projectName}</div><SyncDot/></div>}
        </div>

        {!mob&&<nav style={{display:"flex",gap:4,background:T.s3,borderRadius:12,padding:4}}>
          {[{k:"dashboard",l:"แดชบอร์ด"},{k:"transactions",l:"รายการ"},{k:"budget",l:"งบหมวดหมู่"},{k:"analytics",l:"วิเคราะห์"}].map(n=>(
            <button key={n.k} onClick={()=>setTab(n.k)} style={{padding:"10px 20px",borderRadius:10,cursor:"pointer",fontSize:15,fontWeight:700,background:tab===n.k?T.a:"transparent",color:tab===n.k?"#fff":T.m,border:"none",fontFamily:"inherit",transition:"all .15s"}}>{n.l}</button>
          ))}
        </nav>}

        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {!mob && sync.isReady && <button onClick={()=>sync.fetchData()} style={btnStyle("transparent",{border:`1.5px solid ${T.b}`,color:T.m,padding:"8px 16px",fontSize:14})}>↻ Refresh</button>}
          {!mob && cfg.sheetUrl && <a href={cfg.sheetUrl} target="_blank" rel="noopener" style={{...btnStyle("transparent",{border:`1.5px solid ${T.b}`,color:T.bl,padding:"8px 16px",fontSize:14,textDecoration:"none",display:"inline-block"})}}>📊 Sheet</a>}
          <button onClick={()=>{setShowForm(true);setTab("transactions");setMenuOpen(false);}} style={btnStyle(T.a,{padding:"10px 20px",fontSize:15})}>+ เพิ่มรายการ</button>
          {!mob&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 12px 6px 6px",background:T.s3,borderRadius:12,border:`1px solid ${T.b}`}}>
            {user?.picture?<img src={user.picture} style={{width:32,height:32,borderRadius:10}} referrerPolicy="no-referrer"/>:<div style={{width:32,height:32,borderRadius:10,background:T.a,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#fff"}}>{user?.name?.[0]}</div>}
            <div><div style={{fontSize:13,fontWeight:700}}>{user?.name}</div><div style={{fontSize:11,color:T.d}}>{user?.email}</div></div>
          </div>}
          <button onClick={logout} style={{background:"none",border:`1.5px solid ${T.b}`,borderRadius:10,padding:"6px 12px",color:T.m,cursor:"pointer",fontSize:14,fontWeight:600,fontFamily:"inherit"}}>ออก</button>
          {mob&&<button onClick={()=>setMenuOpen(!menuOpen)} style={{background:"none",border:"none",color:T.m,cursor:"pointer",fontSize:24,padding:4}}>☰</button>}
        </div>
      </header>

      {/* Mobile menu */}
      {mob&&menuOpen&&<div style={{position:"fixed",top:60,left:0,right:0,background:"#fff",borderBottom:`1px solid ${T.b}`,zIndex:99,padding:12,display:"flex",flexDirection:"column",gap:4,boxShadow:T.shadowLg}}>
        {[{k:"dashboard",l:"แดชบอร์ด"},{k:"transactions",l:"รายการ"},{k:"budget",l:"งบหมวดหมู่"},{k:"analytics",l:"วิเคราะห์"}].map(n=>(
          <button key={n.k} onClick={()=>{setTab(n.k);setMenuOpen(false);}} style={{padding:"14px 18px",borderRadius:12,background:tab===n.k?T.a:"transparent",color:tab===n.k?"#fff":T.m,border:"none",fontSize:16,fontWeight:700,fontFamily:"inherit",textAlign:"left",cursor:"pointer"}}>{n.l}</button>
        ))}
        <div style={{padding:"10px 18px"}}><SyncDot/></div>
        <div style={{display:"flex",gap:8,padding:"4px 12px"}}>
          {sync.isReady&&<button onClick={()=>{sync.fetchData();setMenuOpen(false);}} style={btnStyle("transparent",{border:`1.5px solid ${T.b}`,color:T.m,fontSize:14,flex:1})}>↻ Refresh</button>}
          {cfg.sheetUrl&&<a href={cfg.sheetUrl} target="_blank" rel="noopener" style={{...btnStyle("transparent",{border:`1.5px solid ${T.b}`,color:T.bl,fontSize:14,flex:1,textDecoration:"none",textAlign:"center"})}}>📊 Sheet</a>}
        </div>
      </div>}

      <main style={{maxWidth:1400,margin:"0 auto",padding:mob?"16px":"24px 32px"}}>

        {/* Loading */}
        {!demo && sync.syncState==="loading" && activeTx.length===0 && <div style={{textAlign:"center",padding:80}}>
          <div style={{width:48,height:48,border:`4px solid ${T.b}`,borderTopColor:T.a,borderRadius:"50%",animation:"spin .8s linear infinite",margin:"0 auto 20px"}}/>
          <div style={{color:T.m,fontSize:18,fontWeight:600}}>กำลังโหลดข้อมูลจาก Google Sheet...</div>
        </div>}

        {/* Sync error */}
        {!demo && sync.error && <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:14,padding:"14px 20px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
          <span style={{color:T.r,fontWeight:700,fontSize:15}}>⚠ Sync Error: {sync.error}</span>
          <button onClick={()=>sync.fetchData()} style={{marginLeft:"auto",...btnStyle(T.r,{padding:"8px 16px",fontSize:14})}}>ลองใหม่</button>
        </div>}

        {/* ═══ DASHBOARD ═══ */}
        {tab==="dashboard"&&<div>
          {/* Status bar */}
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,padding:"14px 20px",borderRadius:14,background:sc.bg,border:`1px solid ${sc.c}22`,flexWrap:"wrap"}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:sc.c}}/><span style={{color:sc.c,fontWeight:700,fontSize:16}}>{sc.l} — ใช้งบ {stats.pct.toFixed(1)}%</span><span style={{color:T.m,fontSize:15,marginLeft:"auto"}}>คงเหลือ ฿{fmt(stats.rem)}</span>
          </div>

          {/* Summary cards */}
          <div style={{display:"grid",gridTemplateColumns:mob?"repeat(2,1fr)":"repeat(4,1fr)",gap:mob?10:14,marginBottom:16}}>
            {[{t:"งบทั้งหมด",v:budget,c:T.a},{t:"เบิกรวม",v:stats.tw,c:T.r},{t:"คืนรวม",v:stats.tr,c:T.g},{t:"คงเหลือ",v:stats.rem,c:stats.rem>=0?T.g:T.r}].map((k,i)=>(
              <div key={i} style={{...card,transition:"box-shadow .2s"}} onMouseEnter={e=>e.currentTarget.style.boxShadow=T.shadowLg} onMouseLeave={e=>e.currentTarget.style.boxShadow=T.shadow}>
                <div style={{color:T.m,fontSize:14,fontWeight:600,marginBottom:6}}>{k.t}</div>
                <div style={{fontSize:mob?20:26,fontWeight:800,color:k.c,letterSpacing:-.5}}>฿{fmt(k.v)}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div style={{...card,marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><span style={{fontWeight:700,fontSize:16}}>การใช้งบประมาณ</span><span style={{fontSize:16,color:sc.c,fontWeight:700}}>{stats.pct.toFixed(1)}%</span></div>
            <div style={{width:"100%",height:12,background:T.s3,borderRadius:8,overflow:"hidden"}}><div style={{width:`${Math.min(stats.pct,100)}%`,height:"100%",borderRadius:8,background:`linear-gradient(90deg,${T.a},${sc.c})`,transition:"width 1s ease"}}/></div>
          </div>

          {/* Charts */}
          <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:14,marginBottom:16}}>
            <div style={card}>
              <div style={{fontWeight:700,fontSize:16,marginBottom:14}}>งบคงเหลือตามเวลา</div>
              <ResponsiveContainer width="100%" height={mob?200:240}>
                <AreaChart data={balTime}><defs><linearGradient id="gB" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.a} stopOpacity={.15}/><stop offset="100%" stopColor={T.a} stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke={T.b}/><XAxis dataKey="date" stroke={T.d} fontSize={12} tickLine={false}/><YAxis stroke={T.d} fontSize={12} tickLine={false} tickFormatter={v=>`${(v/1e6).toFixed(1)}M`}/><Tooltip content={<CTip/>}/><Area type="monotone" dataKey="balance" stroke={T.a} strokeWidth={2.5} fill="url(#gB)" name="คงเหลือ"/></AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={card}>
              <div style={{fontWeight:700,fontSize:16,marginBottom:14}}>สัดส่วนหมวดหมู่</div>
              <div style={{display:"flex",alignItems:"center",flexDirection:mob?"column":"row",gap:mob?12:0}}>
                <ResponsiveContainer width={mob?"100%":"50%"} height={mob?180:240}><PieChart><Pie data={byCat} dataKey="value" cx="50%" cy="50%" outerRadius={mob?75:95} innerRadius={mob?38:48} paddingAngle={3} strokeWidth={0}>{byCat.map((c,i)=><Cell key={i} fill={c.color}/>)}</Pie><Tooltip content={<CTip/>}/></PieChart></ResponsiveContainer>
                <div style={{flex:1,width:mob?"100%":"auto"}}>{byCat.map(c=>(
                  <div key={c.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <div style={{width:14,height:14,borderRadius:4,background:c.color,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}><div style={{fontSize:14,fontWeight:600}}>{c.name}</div><div style={{fontSize:13,color:T.m}}>฿{fmt(c.value)}</div></div>
                  </div>
                ))}</div>
              </div>
            </div>
          </div>

          {/* Recent transactions */}
          <div style={card}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><span style={{fontWeight:700,fontSize:16}}>รายการล่าสุด</span><button onClick={()=>setTab("transactions")} style={{background:"none",border:"none",color:T.a,cursor:"pointer",fontSize:15,fontWeight:700,fontFamily:"inherit"}}>ดูทั้งหมด →</button></div>
            {activeTx.slice(-5).reverse().map(t=>(
              <div key={t.id} onClick={()=>edit(t)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid ${T.b}08`,cursor:"pointer",gap:10}}>
                <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
                  <Badge type={t.type}/>
                  <div style={{minWidth:0}}><div style={{fontSize:15,fontWeight:700}}>{t.person}</div><div style={{fontSize:14,color:T.m,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.item}</div></div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:18,fontWeight:800,color:t.type==="เบิก"?T.r:T.g}}>{t.type==="เบิก"?"−":"+"}{fmt(t.amount)}</div><div style={{fontSize:13,color:T.d}}>{t.date}</div></div>
              </div>
            ))}
            {activeTx.length===0&&<div style={{textAlign:"center",padding:40,color:T.d,fontSize:16}}>ยังไม่มีรายการ</div>}
          </div>
        </div>}

        {/* ═══ TRANSACTIONS ═══ */}
        {tab==="transactions"&&<div>
          {showForm&&<div style={{...card,border:`2px solid ${T.a}22`,marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}><span style={{fontSize:20,fontWeight:800}}>{editId?"แก้ไขรายการ":"เพิ่มรายการใหม่"}</span><button onClick={resetForm} style={{background:T.s3,border:"none",borderRadius:10,padding:"6px 14px",color:T.m,cursor:"pointer",fontSize:18,fontFamily:"inherit"}}>✕</button></div>
            <div style={{display:"flex",gap:10,marginBottom:16}}>{["เบิก","คืน"].map(t=>(
              <button key={t} onClick={()=>setForm(f=>({...f,type:t}))} style={{flex:1,padding:14,borderRadius:12,fontSize:16,fontWeight:700,border:`2px solid ${form.type===t?(t==="เบิก"?"#FECACA":"#A7F3D0"):T.b}`,background:form.type===t?(t==="เบิก"?"#FEF2F2":"#ECFDF5"):"#fff",color:form.type===t?(t==="เบิก"?T.r:T.g):T.d,cursor:"pointer",fontFamily:"inherit"}}>{t==="เบิก"?"▲ เบิก":"▼ คืน"}</button>
            ))}</div>
            <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"repeat(3,1fr)",gap:12}}>
              <div><label style={{fontSize:14,color:T.m,fontWeight:700,display:"block",marginBottom:6}}>ชื่อผู้ทำรายการ *</label><input value={form.person} onChange={e=>setForm(f=>({...f,person:e.target.value}))} style={inp()} placeholder="ชื่อ..." list="pls"/><datalist id="pls">{[...new Set(activeTx.map(t=>t.person))].map(p=><option key={p} value={p}/>)}</datalist></div>
              <div><label style={{fontSize:14,color:T.m,fontWeight:700,display:"block",marginBottom:6}}>วันที่ *</label><input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={inp()}/></div>
              <div><label style={{fontSize:14,color:T.m,fontWeight:700,display:"block",marginBottom:6}}>จำนวนเงิน (บาท) *</label><input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} style={inp()} placeholder="0"/></div>
            </div>
            <div style={{marginTop:14}}><label style={{fontSize:14,color:T.m,fontWeight:700,display:"block",marginBottom:8}}>หมวดหมู่ *</label>
              <div style={{display:"grid",gridTemplateColumns:mob?"repeat(2,1fr)":"repeat(5,1fr)",gap:8}}>{CATS.map(c=>{
                const cb = catBudget.find(x=>x.id===c.id);
                return (
                <button key={c.id} onClick={()=>setForm(f=>({...f,category:c.id}))} style={{padding:12,borderRadius:12,fontSize:14,fontWeight:600,border:`2px solid ${form.category===c.id?c.color:T.b}`,background:form.category===c.id?c.color+"12":"#fff",color:form.category===c.id?c.color:T.m,cursor:"pointer",fontFamily:"inherit",textAlign:"center"}}>
                  <div style={{fontSize:20,marginBottom:4}}>{c.icon}</div>
                  <div>{c.label}</div>
                  <div style={{fontSize:11,color:cb?.over?T.r:T.d,marginTop:4}}>เหลือ ฿{fmt(cb?.rem||c.max)}</div>
                </button>
              );})}</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:12,marginTop:14}}>
              <div><label style={{fontSize:14,color:T.m,fontWeight:700,display:"block",marginBottom:6}}>รายละเอียด *</label><input value={form.item} onChange={e=>setForm(f=>({...f,item:e.target.value}))} style={inp()} placeholder="เช่น ค่าอบรม AI..."/></div>
              <div><label style={{fontSize:14,color:T.m,fontWeight:700,display:"block",marginBottom:6}}>หมายเหตุ</label><input value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} style={inp()} placeholder="(ไม่บังคับ)"/></div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginTop:20}}>
              <div style={{fontSize:14,color:T.d}}>{!demo&&sync.isReady?"💾 บันทึกอัตโนมัติ":"⚠ Demo — ไม่บันทึก"}</div>
              <div style={{display:"flex",gap:10}}><button onClick={resetForm} style={btnStyle("transparent",{border:`1.5px solid ${T.b}`,color:T.m})}>ยกเลิก</button><button onClick={submit} style={btnStyle(T.a)}>{editId?"บันทึก":"เพิ่มรายการ"}</button></div>
            </div>
          </div>}

          {/* Filter bar */}
          <div style={{display:"flex",gap:10,marginBottom:14,alignItems:"center",background:"#fff",borderRadius:14,padding:"12px 16px",border:`1px solid ${T.b}`,flexWrap:mob?"wrap":"nowrap",boxShadow:T.shadow}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} style={inp({flex:1,minWidth:mob?"100%":200,padding:"12px 16px",fontSize:16,background:"#F8FAFC"})} placeholder="🔍 ค้นหาชื่อ รายการ หมายเหตุ..."/>
            <div style={{display:"flex",gap:3,background:T.s3,borderRadius:10,padding:3}}>{[["all","ทั้งหมด"],["เบิก","▲ เบิก"],["คืน","▼ คืน"]].map(([v,l])=>(<button key={v} onClick={()=>setFType(v)} style={{padding:"8px 16px",borderRadius:8,border:"none",cursor:"pointer",fontSize:14,fontWeight:700,background:fType===v?T.a:"transparent",color:fType===v?"#fff":T.m,fontFamily:"inherit"}}>{l}</button>))}</div>
            {!mob&&<select value={fCat} onChange={e=>setFCat(e.target.value)} style={inp({width:180,cursor:"pointer",padding:"10px 14px",fontSize:14})}><option value="all">ทุกหมวดหมู่</option>{CATS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}</select>}
            <span style={{color:T.m,fontSize:14,fontWeight:700,whiteSpace:"nowrap"}}>{filtered.length} รายการ</span>
          </div>

          {/* Transaction list */}
          {mob ? <div style={{display:"flex",flexDirection:"column",gap:8}}>{filtered.map(t=>(
            <div key={t.id} style={{...card,padding:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}><Badge type={t.type}/><span style={{fontSize:16,fontWeight:700}}>{t.person}</span></div>
                <span style={{fontSize:20,fontWeight:800,color:t.type==="เบิก"?T.r:T.g}}>{t.type==="เบิก"?"−":"+"}{fmt(t.amount)}</span>
              </div>
              <div style={{fontSize:15,marginBottom:6,color:T.t}}>{t.item}</div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}><CatB id={t.category}/><span style={{fontSize:13,color:T.d}}>{t.date}</span></div>
                <div style={{display:"flex",gap:6}}><button onClick={()=>edit(t)} style={{background:T.s3,border:"none",borderRadius:8,padding:"6px 14px",color:T.a,cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit"}}>แก้ไข</button><button onClick={()=>del(t.id)} style={{background:"#FEF2F2",border:"none",borderRadius:8,padding:"6px 14px",color:T.r,cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit"}}>ลบ</button></div>
              </div>
            </div>
          ))}</div>
          : <div style={{...card,padding:0,overflow:"hidden"}}><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:800}}>
            <thead><tr style={{background:T.s3}}>{["#","ประเภท","ชื่อ","วันที่","หมวดหมู่","รายการ","จำนวนเงิน","หมายเหตุ",""].map(h=><th key={h} style={{textAlign:"left",padding:"14px 12px",color:T.m,fontSize:13,fontWeight:700,borderBottom:`1px solid ${T.b}`}}>{h}</th>)}</tr></thead>
            <tbody>{filtered.map(t=><tr key={t.id} style={{transition:"background .15s",borderBottom:`1px solid ${T.b}08`}} onMouseEnter={e=>e.currentTarget.style.background=T.s3} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <td style={{padding:"12px",fontSize:13,color:T.d}}>{t.id}</td><td style={{padding:"12px"}}><Badge type={t.type}/></td><td style={{padding:"12px",fontSize:15,fontWeight:700}}>{t.person}</td><td style={{padding:"12px",fontSize:14,color:T.m}}>{t.date}</td><td style={{padding:"12px"}}><CatB id={t.category}/></td><td style={{padding:"12px",fontSize:14}}>{t.item}</td><td style={{padding:"12px",fontSize:16,fontWeight:800,color:t.type==="เบิก"?T.r:T.g}}>{t.type==="เบิก"?"−":"+"}{fmt(t.amount)}</td><td style={{padding:"12px",fontSize:13,color:T.d,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.note||"—"}</td>
              <td style={{padding:"12px"}}><div style={{display:"flex",gap:4}}><button onClick={()=>edit(t)} style={{background:T.s3,border:"none",borderRadius:8,padding:"6px 14px",color:T.a,cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit"}}>แก้ไข</button><button onClick={()=>del(t.id)} style={{background:"#FEF2F2",border:"none",borderRadius:8,padding:"6px 14px",color:T.r,cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit"}}>ลบ</button></div></td>
            </tr>)}</tbody></table></div>
            {filtered.length===0&&<div style={{textAlign:"center",padding:50,color:T.d,fontSize:16}}>ไม่พบรายการ</div>}
          </div>}
        </div>}

        {/* ═══ BUDGET PER CATEGORY (NEW) ═══ */}
        {tab==="budget"&&<div>
          <h2 style={{fontSize:22,fontWeight:800,marginBottom:16}}>งบประมาณตามหมวดหมู่</h2>
          <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"repeat(2,1fr)",gap:14}}>
            {catBudget.map(c => (
              <div key={c.id} style={{...card,borderLeft:`4px solid ${c.color}`,transition:"box-shadow .2s"}} onMouseEnter={e=>e.currentTarget.style.boxShadow=T.shadowLg} onMouseLeave={e=>e.currentTarget.style.boxShadow=T.shadow}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:28}}>{c.icon}</span>
                    <div><div style={{fontSize:17,fontWeight:700}}>{c.label}</div><div style={{fontSize:14,color:T.d}}>เพดาน ฿{fmt(c.max)}</div></div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:14,color:T.m,fontWeight:600}}>ใช้ไปแล้ว</div>
                    <div style={{fontSize:20,fontWeight:800,color:c.over?T.r:T.t}}>฿{fmt(c.net)}</div>
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{width:"100%",height:10,background:T.s3,borderRadius:6,overflow:"hidden",marginBottom:10}}>
                  <div style={{width:`${Math.min(Math.max(c.pct,0),100)}%`,height:"100%",borderRadius:6,background:c.pct>90?T.r:c.pct>70?T.am:c.color,transition:"width .5s ease"}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:14}}>
                  <span style={{color:T.m}}>ใช้ {c.pct.toFixed(1)}%</span>
                  <span style={{fontWeight:700,color:c.over?T.r:T.g}}>
                    {c.over ? `เกินงบ ฿${fmt(Math.abs(c.rem))}` : `คงเหลือ ฿${fmt(c.rem)}`}
                  </span>
                </div>
                {c.spent > 0 && <div style={{display:"flex",gap:16,marginTop:10,paddingTop:10,borderTop:`1px solid ${T.b}`}}>
                  <div style={{fontSize:13,color:T.m}}>เบิก <span style={{color:T.r,fontWeight:700}}>฿{fmt(c.spent)}</span></div>
                  {c.returned > 0 && <div style={{fontSize:13,color:T.m}}>คืน <span style={{color:T.g,fontWeight:700}}>฿{fmt(c.returned)}</span></div>}
                </div>}
              </div>
            ))}
          </div>

          {/* Summary */}
          <div style={{...card,marginTop:16}}>
            <div style={{fontWeight:700,fontSize:18,marginBottom:14}}>สรุปเพดานทุกหมวดหมู่</div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
                <thead><tr style={{background:T.s3}}>{["หมวดหมู่","เพดาน","ใช้แล้ว","คืน","สุทธิ","คงเหลือ","สถานะ"].map(h=><th key={h} style={{textAlign:"left",padding:"12px",fontSize:14,fontWeight:700,color:T.m,borderBottom:`1px solid ${T.b}`}}>{h}</th>)}</tr></thead>
                <tbody>{catBudget.map(c=>(
                  <tr key={c.id} style={{borderBottom:`1px solid ${T.b}08`}}>
                    <td style={{padding:"12px",fontSize:15,fontWeight:600}}>{c.icon} {c.label}</td>
                    <td style={{padding:"12px",fontSize:14}}>฿{fmt(c.max)}</td>
                    <td style={{padding:"12px",fontSize:14,color:T.r}}>฿{fmt(c.spent)}</td>
                    <td style={{padding:"12px",fontSize:14,color:T.g}}>฿{fmt(c.returned)}</td>
                    <td style={{padding:"12px",fontSize:15,fontWeight:700}}>฿{fmt(c.net)}</td>
                    <td style={{padding:"12px",fontSize:15,fontWeight:700,color:c.over?T.r:T.g}}>฿{fmt(c.rem)}</td>
                    <td style={{padding:"12px"}}><span style={{padding:"4px 12px",borderRadius:20,fontSize:13,fontWeight:700,background:c.pct>90?"#FEF2F2":c.pct>70?"#FFFBEB":"#ECFDF5",color:c.pct>90?T.r:c.pct>70?T.am:T.g}}>{c.pct>90?"เกินงบ":c.pct>70?"ใกล้เต็ม":"ปกติ"}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </div>}

        {/* ═══ ANALYTICS ═══ */}
        {tab==="analytics"&&<div>
          <div style={{display:"grid",gridTemplateColumns:mob?"repeat(2,1fr)":"repeat(4,1fr)",gap:mob?10:14,marginBottom:16}}>
            {[{v:activeTx.length,l:"รายการทั้งหมด",c:T.a},{v:[...new Set(activeTx.map(t=>t.person))].length,l:"ผู้ทำรายการ",c:T.bl},{v:byCat.length,l:"หมวดหมู่",c:T.am},{v:`${stats.pct.toFixed(0)}%`,l:"ใช้งบแล้ว",c:sc.c}].map((s,i)=>(
              <div key={i} style={{...card,textAlign:"center"}}><div style={{fontSize:mob?24:32,fontWeight:800,color:s.c}}>{s.v}</div><div style={{color:T.m,fontSize:14,marginTop:4,fontWeight:600}}>{s.l}</div></div>
            ))}
          </div>

          <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:14,marginBottom:16}}>
            <div style={card}>
              <div style={{fontWeight:700,fontSize:16,marginBottom:14}}>สรุปตามบุคคล</div>
              <ResponsiveContainer width="100%" height={mob?220:260}><BarChart data={byPerson} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke={T.b}/><XAxis type="number" stroke={T.d} fontSize={12} tickFormatter={v=>`${v/1000}k`}/><YAxis type="category" dataKey="name" stroke={T.d} fontSize={14} width={70}/><Tooltip content={<CTip/>}/><Legend/><Bar dataKey="เบิก" fill="#FCA5A5" radius={[0,6,6,0]} barSize={14}/><Bar dataKey="คืน" fill="#6EE7B7" radius={[0,6,6,0]} barSize={14}/></BarChart></ResponsiveContainer>
            </div>
            <div style={card}>
              <div style={{fontWeight:700,fontSize:16,marginBottom:14}}>ยอดค้างสุทธิ</div>
              {byPerson.map(p => { const mx=Math.max(...byPerson.map(x=>Math.abs(x.net)),1); return(
                <div key={p.name} style={{marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:15,fontWeight:700}}>{p.name}</span><span style={{fontSize:16,fontWeight:800,color:p.net>0?T.r:T.g}}>{p.net>0?"−":"+"}{fmt(Math.abs(p.net))}</span></div>
                  <div style={{width:"100%",height:8,background:T.s3,borderRadius:4,overflow:"hidden"}}><div style={{width:`${(Math.abs(p.net)/mx)*100}%`,height:"100%",borderRadius:4,background:p.net>0?"#FCA5A5":"#6EE7B7"}}/></div>
                </div>
              );})}
            </div>
          </div>

          <div style={card}>
            <div style={{fontWeight:700,fontSize:16,marginBottom:14}}>แนวโน้มงบคงเหลือ</div>
            <ResponsiveContainer width="100%" height={mob?220:280}><AreaChart data={[{date:"เริ่มต้น",balance:budget},...balTime]}>
              <defs><linearGradient id="gB2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.g} stopOpacity={.15}/><stop offset="100%" stopColor={T.g} stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.b}/><XAxis dataKey="date" stroke={T.d} fontSize={12} tickLine={false}/><YAxis stroke={T.d} fontSize={12} tickLine={false} tickFormatter={v=>`${(v/1e6).toFixed(1)}M`}/><Tooltip content={<CTip/>}/>
              <Area type="stepAfter" dataKey="balance" stroke={T.g} strokeWidth={2.5} fill="url(#gB2)" name="คงเหลือ" dot={{fill:T.g,r:4}}/>
            </AreaChart></ResponsiveContainer>
          </div>
        </div>}
      </main>

      <style>{`
        @keyframes slideIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        input:focus,textarea:focus,select:focus{border-color:${T.a}!important;outline:none;box-shadow:0 0 0 3px ${T.a}18}
        button:active{transform:scale(.98)}
        ::selection{background:${T.a}22}
        select option{background:#fff;color:${T.t}}
      `}</style>
    </div>
  );
}
