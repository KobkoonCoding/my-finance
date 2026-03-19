import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, AreaChart, Area, CartesianGrid, Legend
} from "recharts";

/* ═══════════════════════════════════════════════════════════
   CONFIGURATION — แก้ไขค่าเหล่านี้ก่อน Deploy
   ═══════════════════════════════════════════════════════════ */
const DEFAULT_CONFIG = {
  BUDGET: 3000000,
  PROJECT_NAME: "ระบบจัดการงบการเงินโครงการ",
  SYNC_INTERVAL: 15,         // วินาที - auto refresh
  APPS_SCRIPT_URL: "",       // URL จาก Google Apps Script Deploy
  GOOGLE_CLIENT_ID: "",      // จาก Google Cloud Console
  AUTHORIZED_EMAILS: [],     // email ที่อนุญาตให้เข้าใช้
  SHEET_URL: "",             // URL ของ Google Sheet (สำหรับปุ่ม "เปิด Sheet")
};

/* ═══════════════════════════════════════════════════════════
   CATEGORIES
   ═══════════════════════════════════════════════════════════ */
const CATS = [
  { id:"training",   label:"ค่าอบรม/สัมมนา",     icon:"🎓", color:"#7C6FFF" },
  { id:"travel_dom", label:"เดินทางในประเทศ",    icon:"🚗", color:"#38BDF8" },
  { id:"travel_int", label:"เดินทางต่างประเทศ",  icon:"✈️", color:"#818CF8" },
  { id:"equipment",  label:"วัสดุ/อุปกรณ์",       icon:"🔧", color:"#FB923C" },
  { id:"paper",      label:"ตีพิมพ์/Publication", icon:"📄", color:"#F472B6" },
  { id:"salary",     label:"ค่าตอบแทนบุคลากร",   icon:"👥", color:"#34D399" },
  { id:"service",    label:"ค่าจ้างบริการ",       icon:"🛠", color:"#FBBF24" },
  { id:"supplies",   label:"วัสดุสิ้นเปลือง",     icon:"📦", color:"#A78BFA" },
  { id:"utility",    label:"สาธารณูปโภค",        icon:"💡", color:"#2DD4BF" },
  { id:"other",      label:"อื่นๆ",              icon:"📋", color:"#94A3B8" },
];
const CM = Object.fromEntries(CATS.map(c => [c.id, c]));

/* ═══════════════════════════════════════════════════════════
   THEME — Warm dark with teal accents
   ═══════════════════════════════════════════════════════════ */
const T = {
  bg:"#06090E",    s1:"#0B0F17",   s2:"#111621",  s3:"#171D2B",
  b:"#1C2335",     b2:"#283044",   a:"#7C6FFF",   a2:"#9D93FF",
  g:"#34D399",     gs:"rgba(52,211,153,.12)",
  r:"#FB7185",     rs:"rgba(251,113,133,.12)",
  am:"#FBBF24",    ams:"rgba(251,191,36,.12)",
  bl:"#38BDF8",    bls:"rgba(56,189,248,.12)",
  t:"#E6E8F0",    m:"#8890A8",    d:"#505873",
};
const fmt = n => Number(n).toLocaleString("th-TH");
const fmtTime = d => d ? new Date(d).toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit",second:"2-digit"}) : "—";

/* ═══════════════════════════════════════════════════════════
   DEMO DATA
   ═══════════════════════════════════════════════════════════ */
const DEMO = [
  { id:1, type:"เบิก", person:"กอบกูล",  date:"2026-03-19", category:"training",   item:"ค่าอบรมหลักสูตร AI",      amount:50000,  note:"" },
  { id:2, type:"เบิก", person:"อสุเทพ",  date:"2026-03-19", category:"training",   item:"ค่าโครงการอบรม อสม.",     amount:50000,  note:"" },
  { id:3, type:"คืน",  person:"อสุเทพ",  date:"2026-03-20", category:"training",   item:"ค่าโครงการอบรม อสม.",     amount:10000,  note:"คืนส่วนที่เหลือ" },
  { id:4, type:"เบิก", person:"พี่ขฟ",   date:"2026-03-20", category:"paper",      item:"ค่าตีพิมพ์ Paper IEEE",   amount:160000, note:"" },
  { id:5, type:"เบิก", person:"อ.บัญชา", date:"2026-03-20", category:"travel_int", item:"ค่าเดินทางประชุม Japan",  amount:100000, note:"" },
  { id:6, type:"คืน",  person:"กอบกูล",  date:"2026-03-21", category:"training",   item:"ค่าอบรมหลักสูตร AI",      amount:5000,   note:"คืนค่าที่พัก" },
  { id:7, type:"คืน",  person:"อ.บัญชา", date:"2026-03-21", category:"travel_int", item:"ค่าเดินทางประชุม Japan",  amount:20000,  note:"ส่วนต่างตั๋ว" },
  { id:8, type:"เบิก", person:"สมหญิง",  date:"2026-03-22", category:"equipment",  item:"ค่า Laptop วิจัย",        amount:45000,  note:"" },
  { id:9, type:"เบิก", person:"อ.บัญชา", date:"2026-03-23", category:"salary",     item:"ค่าตอบแทน RA มี.ค.",      amount:30000,  note:"" },
  { id:10,type:"เบิก", person:"กอบกูล",  date:"2026-03-24", category:"service",    item:"ค่าจ้างแปลเอกสาร",       amount:15000,  note:"" },
];

/* ═══════════════════════════════════════════════════════════
   SYNC ENGINE — หัวใจของ Real-time
   ═══════════════════════════════════════════════════════════ */
function useSyncEngine(scriptUrl, interval, enabled) {
  const [data, setData] = useState([]);
  const [syncState, setSyncState] = useState("idle");
  const [lastSync, setLastSync] = useState(null);
  const [error, setError] = useState(null);
  const [changeCount, setChangeCount] = useState(0);
  const timerRef = useRef(null);
  const isMountedRef = useRef(true);

  const isReady = enabled && scriptUrl && !scriptUrl.includes("YOUR_");

  // ── FETCH (Read from Sheet) ──
  const fetchData = useCallback(async (silent = false) => {
    if (!isReady) return;
    if (!silent) setSyncState("loading");
    else setSyncState("syncing");
    try {
      const res = await fetch(`${scriptUrl}?action=read&t=${Date.now()}`);
      const json = await res.json();
      if (isMountedRef.current && Array.isArray(json)) {
        setData(json.map(r => ({ ...r, amount: Number(r.amount) || 0 })));
        setLastSync(new Date());
        setSyncState("synced");
        setError(null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setSyncState("error");
        setError(err.message);
      }
    }
  }, [scriptUrl, isReady]);

  // ── WRITE (Optimistic update + sync to Sheet) ──
  const writeData = useCallback(async (action, payload, optimisticFn) => {
    if (!isReady) {
      // Demo mode: just do optimistic update
      if (optimisticFn) optimisticFn(setData);
      return true;
    }
    // Optimistic update first
    if (optimisticFn) optimisticFn(setData);
    setSyncState("syncing");
    setChangeCount(c => c + 1);
    try {
      const res = await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const json = await res.json();
      if (isMountedRef.current) {
        setSyncState("synced");
        setLastSync(new Date());
        setError(null);
        // Refresh from Sheet after write to ensure consistency
        setTimeout(() => fetchData(true), 800);
      }
      return json?.success !== false;
    } catch (err) {
      if (isMountedRef.current) {
        setSyncState("error");
        setError(err.message);
      }
      return false;
    }
  }, [scriptUrl, isReady, fetchData]);

  // ── AUTO POLL ──
  useEffect(() => {
    isMountedRef.current = true;
    if (isReady) fetchData();
    return () => { isMountedRef.current = false; };
  }, [isReady]);

  useEffect(() => {
    if (!isReady || !interval) return;
    timerRef.current = setInterval(() => fetchData(true), interval * 1000);
    return () => clearInterval(timerRef.current);
  }, [isReady, interval, fetchData]);

  return { data, setData, syncState, lastSync, error, changeCount, fetchData, writeData, isReady };
}

/* ═══════════════════════════════════════════════════════════
   RESPONSIVE HOOK
   ═══════════════════════════════════════════════════════════ */
function useWidth() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}

/* ═══════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════ */
export default function App() {
  const W = useWidth();
  const mob = W < 768;

  // ── Auth State ──
  const [user, setUser] = useState(null);
  const [isAuth, setIsAuth] = useState(false);
  const [authErr, setAuthErr] = useState(null);
  const [demo, setDemo] = useState(false);
  const [showCfg, setShowCfg] = useState(false);
  const [cfg, setCfg] = useState({
    clientId: DEFAULT_CONFIG.GOOGLE_CLIENT_ID,
    scriptUrl: DEFAULT_CONFIG.APPS_SCRIPT_URL,
    budget: DEFAULT_CONFIG.BUDGET,
    projectName: DEFAULT_CONFIG.PROJECT_NAME,
    emails: DEFAULT_CONFIG.AUTHORIZED_EMAILS.join("\n"),
    sheetUrl: DEFAULT_CONFIG.SHEET_URL,
    syncInterval: DEFAULT_CONFIG.SYNC_INTERVAL,
  });

  // ── Sync Engine ──
  const sync = useSyncEngine(cfg.scriptUrl, cfg.syncInterval, isAuth && !demo);
  const tx = demo ? DEMO : (sync.data.length ? sync.data : DEMO);
  const setTx = demo ? () => {} : sync.setData;

  // ── UI State ──
  const [tab, setTab] = useState("dashboard");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState("");
  const [fType, setFType] = useState("all");
  const [fCat, setFCat] = useState("all");
  const [toast, setToast] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [localTx, setLocalTx] = useState(DEMO); // for demo mode

  const activeTx = demo ? localTx : tx;

  const formInit = { type:"เบิก", person:"", date:new Date().toISOString().split("T")[0], category:"training", item:"", amount:"", note:"" };
  const [form, setForm] = useState(formInit);

  const fire = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null), 3200); };

  // ── Google Login ──
  const gLogin = useCallback(() => {
    if (typeof google === "undefined") { fire("Google Sign-In กำลังโหลด...","error"); return; }
    try {
      google.accounts.oauth2.initTokenClient({
        client_id: cfg.clientId, scope: "email profile",
        callback: (tok) => {
          fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${tok.access_token}` } })
            .then(r => r.json()).then(info => {
              setUser(info);
              const ok = cfg.emails.split("\n").map(e => e.trim().toLowerCase()).filter(Boolean);
              if (ok.length === 0 || ok.includes(info.email.toLowerCase())) {
                setIsAuth(true); setAuthErr(null); fire(`ยินดีต้อนรับ ${info.name}`);
              } else {
                setAuthErr(`${info.email} ไม่ได้รับอนุญาต`);
              }
            }).catch(() => fire("เข้าสู่ระบบไม่สำเร็จ","error"));
        }
      }).requestAccessToken();
    } catch { fire("ตั้งค่า Client ID ก่อน","error"); }
  }, [cfg]);

  const enterDemo = () => { setDemo(true); setIsAuth(true); setUser({name:"ทดลองใช้งาน",email:"demo@example.com"}); fire("โหมด Demo — ข้อมูลไม่ได้บันทึก"); };

  // ── Stats ──
  const budget = Number(cfg.budget) || DEFAULT_CONFIG.BUDGET;
  const stats = useMemo(() => {
    const tw = activeTx.filter(t=>t.type==="เบิก").reduce((s,t)=>s+Number(t.amount),0);
    const tr = activeTx.filter(t=>t.type==="คืน").reduce((s,t)=>s+Number(t.amount),0);
    const net=tw-tr, rem=budget-net, pct=budget>0?(net/budget)*100:0;
    return { tw, tr, net, rem, pct, st: pct>90?"danger":pct>70?"warning":"safe" };
  }, [activeTx, budget]);

  const byPerson = useMemo(() => {
    const m={};
    activeTx.forEach(t=>{ if(!m[t.person]) m[t.person]={name:t.person,เบิก:0,คืน:0}; m[t.person][t.type]+=Number(t.amount); });
    return Object.values(m).map(p=>({...p,net:p["เบิก"]-p["คืน"]})).sort((a,b)=>b.net-a.net);
  },[activeTx]);

  const byCat = useMemo(() => {
    const m={};
    activeTx.filter(t=>t.type==="เบิก").forEach(t=>{ const c=t.category||"other"; m[c]=(m[c]||0)+Number(t.amount); });
    return Object.entries(m).map(([id,v])=>({id,name:CM[id]?.label||id,icon:CM[id]?.icon||"📋",color:CM[id]?.color||"#94A3B8",value:v})).sort((a,b)=>b.value-a.value);
  },[activeTx]);

  const balTime = useMemo(() => {
    let b=budget;
    return [...activeTx].sort((a,c)=>a.date.localeCompare(c.date)||a.id-c.id).map(t=>{
      b+=t.type==="คืน"?Number(t.amount):-Number(t.amount);
      return {date:t.date,balance:b};
    });
  },[activeTx,budget]);

  const filtered = useMemo(()=>activeTx.filter(t=>{
    const s=!search||[t.person,t.item,t.note].some(v=>(v||"").includes(search));
    return s&&(fType==="all"||t.type===fType)&&(fCat==="all"||t.category===fCat);
  }).sort((a,b)=>b.id-a.id),[activeTx,search,fType,fCat]);

  // ── CRUD ──
  const resetForm = () => { setForm(formInit); setEditId(null); setShowForm(false); };

  const submit = async () => {
    if (!form.person||!form.item||!form.amount) { fire("กรุณากรอกข้อมูลให้ครบ","error"); return; }
    const amt = Number(form.amount);

    if (editId !== null) {
      if (demo) {
        setLocalTx(p => p.map(t => t.id === editId ? {...t,...form,amount:amt} : t));
      } else {
        await sync.writeData("update", { id:editId, ...form, amount:amt },
          set => set(p => p.map(t => t.id === editId ? {...t,...form,amount:amt} : t))
        );
      }
      fire("แก้ไขสำเร็จ ✓");
    } else {
      const nid = Math.max(0,...activeTx.map(t=>t.id))+1;
      const nt = {...form, id:nid, amount:amt};
      if (demo) {
        setLocalTx(p => [...p, nt]);
      } else {
        await sync.writeData("add", nt,
          set => set(p => [...p, nt])
        );
      }
      fire("เพิ่มรายการสำเร็จ ✓");
    }
    resetForm();
  };

  const edit = (t) => {
    setForm({type:t.type,person:t.person,date:t.date,category:t.category||"other",item:t.item,amount:t.amount,note:t.note||""});
    setEditId(t.id); setShowForm(true); setTab("transactions"); setMenuOpen(false);
  };

  const del = async (id) => {
    if (demo) {
      setLocalTx(p => p.filter(t => t.id !== id));
    } else {
      await sync.writeData("delete", { id },
        set => set(p => p.filter(t => t.id !== id))
      );
    }
    fire("ลบรายการแล้ว");
  };

  // ── UI Helpers ──
  const Badge = ({type}) => (
    <span style={{background:type==="เบิก"?T.rs:T.gs,color:type==="เบิก"?T.r:T.g,padding:"4px 12px",borderRadius:20,fontSize:11,fontWeight:700,display:"inline-flex",alignItems:"center",gap:3}}>
      <span style={{fontSize:8}}>{type==="เบิก"?"▲":"▼"}</span>{type}
    </span>
  );
  const CatB = ({id}) => { const c=CM[id]||CM.other; return <span style={{background:c.color+"14",color:c.color,padding:"3px 10px",borderRadius:7,fontSize:11,fontWeight:600,display:"inline-flex",alignItems:"center",gap:3}}>{c.icon} {c.label}</span>; };
  const CTip = ({active,payload}) => { if(!active||!payload?.length)return null; return <div style={{background:T.s2,border:`1px solid ${T.b}`,borderRadius:10,padding:"10px 14px",boxShadow:"0 8px 30px rgba(0,0,0,.5)"}}>{payload.map((p,i)=><div key={i} style={{color:p.color||T.t,fontSize:12,fontWeight:600}}>{p.name}: ฿{fmt(p.value)}</div>)}</div>; };
  const inp = (x={}) => ({background:T.bg,border:`1.5px solid ${T.b}`,borderRadius:11,padding:"12px 14px",color:T.t,fontSize:14,outline:"none",width:"100%",boxSizing:"border-box",transition:"border-color .2s",fontFamily:"inherit",...x});
  const btn = (bg,x={}) => ({background:bg,color:"#fff",border:"none",borderRadius:11,padding:"11px 22px",fontSize:13,fontWeight:700,cursor:"pointer",transition:"all .15s",fontFamily:"inherit",...x});

  const SyncDot = () => {
    const colors = {idle:T.d,loading:T.am,syncing:T.bl,synced:T.g,error:T.r};
    const labels = {idle:"รอเชื่อมต่อ",loading:"กำลังโหลด...",syncing:"กำลัง Sync...",synced:"เชื่อมต่อแล้ว",error:"ผิดพลาด"};
    const c = colors[sync.syncState] || T.d;
    return (
      <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:T.m}} title={sync.error||""}>
        <div style={{position:"relative"}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:c}} />
          {(sync.syncState==="syncing"||sync.syncState==="loading") && <div style={{position:"absolute",top:-3,left:-3,width:14,height:14,borderRadius:"50%",border:`2px solid ${c}`,borderTopColor:"transparent",animation:"spin .8s linear infinite"}} />}
        </div>
        <span>{demo ? "Demo Mode" : labels[sync.syncState]}</span>
        {sync.lastSync && !demo && <span style={{color:T.d}}>| {fmtTime(sync.lastSync)}</span>}
      </div>
    );
  };

  const sc = {safe:{c:T.g,bg:T.gs,l:"ปกติ"},warning:{c:T.am,bg:T.ams,l:"ใกล้เกินงบ"},danger:{c:T.r,bg:T.rs,l:"เกินงบ!"}}[stats.st];

  /* ═══════════════════════════════════════════════════════
     LOGIN SCREEN
     ═══════════════════════════════════════════════════════ */
  if (!isAuth) return (
    <div style={{fontFamily:"'Noto Sans Thai',sans-serif",background:T.bg,color:T.t,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <script src="https://accounts.google.com/gsi/client" async defer/>
      {toast&&<div style={{position:"fixed",top:20,right:20,left:mob?20:"auto",zIndex:9999,background:toast.type==="error"?"#451A2A":"#0D3324",border:`1px solid ${toast.type==="error"?T.r:T.g}`,borderRadius:14,padding:"13px 20px",color:"#fff",fontSize:13,fontWeight:600,boxShadow:"0 12px 50px rgba(0,0,0,.6)"}}>{toast.msg}</div>}
      <div style={{textAlign:"center",maxWidth:440,width:"100%",position:"relative",zIndex:1}}>
        <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
          <div style={{position:"absolute",top:"20%",left:"15%",width:350,height:350,borderRadius:"50%",background:"radial-gradient(circle,#7C6FFF06,transparent 70%)"}}/>
          <div style={{position:"absolute",bottom:"15%",right:"10%",width:300,height:300,borderRadius:"50%",background:"radial-gradient(circle,#34D39906,transparent 70%)"}}/>
        </div>
        <div style={{width:72,height:72,borderRadius:22,margin:"0 auto 24px",background:`linear-gradient(135deg,${T.a},${T.a2})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,fontWeight:800,color:"#fff",boxShadow:`0 12px 40px ${T.a}33`,position:"relative",zIndex:1}}>฿</div>
        <h1 style={{fontSize:mob?22:26,fontWeight:800,margin:"0 0 8px"}}>ระบบจัดการงบการเงิน</h1>
        <p style={{color:T.m,fontSize:13,margin:"0 0 6px"}}>{cfg.projectName}</p>
        <p style={{color:T.d,fontSize:12,margin:"0 0 30px"}}>Real-time sync กับ Google Sheets</p>

        {authErr&&<div style={{background:T.rs,border:`1px solid ${T.r}33`,borderRadius:14,padding:"14px 20px",marginBottom:20,textAlign:"left"}}><div style={{color:T.r,fontWeight:700,fontSize:13}}>⚠ {authErr}</div><div style={{color:T.d,fontSize:11,marginTop:4}}>ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์</div></div>}

        <button onClick={gLogin} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,width:"100%",padding:"15px",borderRadius:14,background:T.s2,border:`1.5px solid ${T.b}`,color:T.t,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:10,transition:"all .2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.a}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.b}}>
          <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          เข้าสู่ระบบด้วย Google
        </button>
        <button onClick={enterDemo} style={{width:"100%",padding:"13px",borderRadius:14,background:"transparent",border:`1.5px solid ${T.b}`,color:T.m,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginBottom:24,transition:"all .2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.am;e.currentTarget.style.color=T.am}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.b;e.currentTarget.style.color=T.m}}>🧪 ทดลองใช้งาน (Demo)</button>
        <button onClick={()=>setShowCfg(!showCfg)} style={{background:"none",border:"none",color:T.d,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>⚙ ตั้งค่า {showCfg?"▲":"▼"}</button>
        {showCfg&&<div style={{background:T.s2,border:`1px solid ${T.b}`,borderRadius:14,padding:22,marginTop:12,textAlign:"left"}}>
          {[{k:"clientId",l:"Google Client ID"},{k:"scriptUrl",l:"Apps Script URL"},{k:"sheetUrl",l:"Google Sheet URL"},{k:"budget",l:"งบประมาณ (บาท)",t:"number"},{k:"projectName",l:"ชื่อโครงการ"},{k:"syncInterval",l:"Auto Sync ทุกกี่วินาที",t:"number"}].map(f=>(
            <div key={f.k} style={{marginBottom:10}}><label style={{fontSize:10,color:T.m,fontWeight:700,display:"block",marginBottom:3}}>{f.l}</label><input value={cfg[f.k]} onChange={e=>setCfg(p=>({...p,[f.k]:e.target.value}))} style={inp({fontSize:12})} type={f.t||"text"}/></div>
          ))}
          <div><label style={{fontSize:10,color:T.m,fontWeight:700,display:"block",marginBottom:3}}>Email ที่อนุญาต (1/บรรทัด, เว้นว่าง=ทุกคน)</label><textarea value={cfg.emails} onChange={e=>setCfg(p=>({...p,emails:e.target.value}))} style={{...inp({fontSize:11}),height:80,resize:"vertical",fontFamily:"'JetBrains Mono',monospace"}}/></div>
        </div>}
      </div>
      <style>{`input:focus,textarea:focus{border-color:${T.a}!important} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  /* ═══════════════════════════════════════════════════════
     MAIN DASHBOARD
     ═══════════════════════════════════════════════════════ */
  return (
    <div style={{fontFamily:"'Noto Sans Thai',sans-serif",background:T.bg,color:T.t,minHeight:"100vh"}}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet"/>

      {toast&&<div style={{position:"fixed",top:16,right:16,left:mob?16:"auto",zIndex:9999,background:toast.type==="error"?"#451A2A":"#0D3324",border:`1px solid ${toast.type==="error"?T.r:T.g}`,borderRadius:12,padding:"12px 18px",color:"#fff",fontSize:13,fontWeight:600,boxShadow:"0 8px 40px rgba(0,0,0,.5)",animation:"slideIn .3s ease"}}>{toast.msg}</div>}

      {/* HEADER */}
      <header style={{background:`${T.s1}EE`,backdropFilter:"blur(14px)",borderBottom:`1px solid ${T.b}`,padding:mob?"0 14px":"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,height:mob?54:62,gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
          <div style={{width:34,height:34,borderRadius:10,background:`linear-gradient(135deg,${T.a},${T.a2})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:"#fff",flexShrink:0}}>฿</div>
          {!mob&&<div style={{minWidth:0}}><div style={{fontSize:14,fontWeight:800,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cfg.projectName}</div><SyncDot/></div>}
        </div>

        {!mob&&<nav style={{display:"flex",gap:3,background:T.bg,borderRadius:12,padding:3}}>
          {[{k:"dashboard",l:"แดชบอร์ด",i:"◈"},{k:"transactions",l:"รายการ",i:"☰"},{k:"analytics",l:"วิเคราะห์",i:"◎"}].map(n=>(
            <button key={n.k} onClick={()=>setTab(n.k)} style={{padding:"8px 18px",borderRadius:9,cursor:"pointer",fontSize:12,fontWeight:700,background:tab===n.k?T.a:"transparent",color:tab===n.k?"#fff":T.m,border:"none",fontFamily:"inherit",transition:"all .15s"}}>{n.i} {n.l}</button>
          ))}
        </nav>}

        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {!mob && sync.isReady && <button onClick={()=>sync.fetchData()} style={{...btn("transparent",{border:`1px solid ${T.b}`,color:T.m,padding:"7px 12px",fontSize:11})}}>↻ Refresh</button>}
          {!mob && cfg.sheetUrl && <a href={cfg.sheetUrl} target="_blank" rel="noopener" style={{...btn("transparent",{border:`1px solid ${T.b}`,color:T.am,padding:"7px 12px",fontSize:11,textDecoration:"none",display:"inline-block"})}}> 📊 Sheet</a>}
          <button onClick={()=>{setShowForm(true);setTab("transactions");setMenuOpen(false);}} style={btn(T.a,{padding:"7px 16px",fontSize:12})}>+ เพิ่ม</button>
          {!mob&&<div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px 5px 5px",background:T.s2,borderRadius:10,border:`1px solid ${T.b}`}}>
            {user?.picture?<img src={user.picture} style={{width:26,height:26,borderRadius:7}} referrerPolicy="no-referrer"/>:<div style={{width:26,height:26,borderRadius:7,background:T.a,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff"}}>{user?.name?.[0]}</div>}
            <div><div style={{fontSize:10,fontWeight:700}}>{user?.name}</div><div style={{fontSize:8,color:T.d}}>{user?.email}</div></div>
          </div>}
          <button onClick={()=>{setUser(null);setIsAuth(false);setDemo(false);setAuthErr(null);}} style={{background:"none",border:"none",color:T.d,cursor:"pointer",fontSize:14}}>✕</button>
          {mob&&<button onClick={()=>setMenuOpen(!menuOpen)} style={{background:"none",border:"none",color:T.m,cursor:"pointer",fontSize:20}}>☰</button>}
        </div>
      </header>

      {/* Mobile menu */}
      {mob&&menuOpen&&<div style={{position:"fixed",top:54,left:0,right:0,background:T.s1,borderBottom:`1px solid ${T.b}`,zIndex:99,padding:10,display:"flex",flexDirection:"column",gap:4}}>
        {[{k:"dashboard",l:"◈ แดชบอร์ด"},{k:"transactions",l:"☰ รายการ"},{k:"analytics",l:"◎ วิเคราะห์"}].map(n=>(
          <button key={n.k} onClick={()=>{setTab(n.k);setMenuOpen(false);}} style={{padding:"12px 16px",borderRadius:10,background:tab===n.k?T.a:"transparent",color:tab===n.k?"#fff":T.m,border:"none",fontSize:14,fontWeight:700,fontFamily:"inherit",textAlign:"left",cursor:"pointer"}}>{n.l}</button>
        ))}
        <div style={{padding:"8px 16px"}}><SyncDot/></div>
        <div style={{display:"flex",gap:6,padding:"4px 10px"}}>
          {sync.isReady&&<button onClick={()=>{sync.fetchData();setMenuOpen(false);}} style={{...btn("transparent",{border:`1px solid ${T.b}`,color:T.m,fontSize:11,flex:1})}}>↻ Refresh</button>}
          {cfg.sheetUrl&&<a href={cfg.sheetUrl} target="_blank" rel="noopener" style={{...btn("transparent",{border:`1px solid ${T.b}`,color:T.am,fontSize:11,flex:1,textDecoration:"none",textAlign:"center"})}}>📊 Sheet</a>}
        </div>
      </div>}

      <main style={{maxWidth:1400,margin:"0 auto",padding:mob?"14px":"22px 28px"}}>

        {/* ═══ DASHBOARD ═══ */}
        {tab==="dashboard"&&<div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,padding:"10px 16px",borderRadius:12,background:sc.bg,border:`1px solid ${sc.c}18`,flexWrap:"wrap"}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:sc.c,boxShadow:`0 0 10px ${sc.c}66`}}/><span style={{color:sc.c,fontWeight:700,fontSize:13}}>{sc.l} — ใช้งบ {stats.pct.toFixed(1)}%</span><span style={{color:T.d,fontSize:12,marginLeft:"auto"}}>เหลือ ฿{fmt(stats.rem)}</span>
          </div>

          <div style={{display:"grid",gridTemplateColumns:mob?"repeat(2,1fr)":"repeat(4,1fr)",gap:mob?8:12,marginBottom:14}}>
            {[{t:"งบทั้งหมด",v:budget,c:T.a,i:"◆"},{t:"เบิกรวม",v:stats.tw,c:T.r,i:"▲"},{t:"คืนรวม",v:stats.tr,c:T.g,i:"▼"},{t:"คงเหลือ",v:stats.rem,c:T.am,i:"◉"}].map((k,i)=>(
              <div key={i} style={{background:T.s2,border:`1px solid ${T.b}`,borderRadius:14,padding:mob?"14px":"18px 20px",overflow:"hidden",position:"relative",transition:"border-color .2s"}} onMouseEnter={e=>e.currentTarget.style.borderColor=k.c+"44"} onMouseLeave={e=>e.currentTarget.style.borderColor=T.b}>
                <div style={{position:"absolute",top:-20,right:-20,width:70,height:70,borderRadius:"50%",background:k.c+"08"}}/>
                <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:5}}><span style={{color:k.c,fontSize:11}}>{k.i}</span><span style={{color:T.m,fontSize:10,fontWeight:700,letterSpacing:.5}}>{k.t}</span></div>
                <div style={{fontSize:mob?16:20,fontWeight:800,color:k.c,fontFamily:"'JetBrains Mono',monospace",letterSpacing:-1}}>฿{fmt(k.v)}</div>
              </div>
            ))}
          </div>

          <div style={{background:T.s2,border:`1px solid ${T.b}`,borderRadius:14,padding:"14px 18px",marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontWeight:700,fontSize:12}}>การใช้งบ</span><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:sc.c,fontWeight:700}}>{stats.pct.toFixed(1)}%</span></div>
            <div style={{width:"100%",height:8,background:T.bg,borderRadius:6,overflow:"hidden"}}><div style={{width:`${Math.min(stats.pct,100)}%`,height:"100%",borderRadius:6,background:`linear-gradient(90deg,${T.a},${sc.c})`,transition:"width 1s ease"}}/></div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:12,marginBottom:14}}>
            <div style={{background:T.s2,border:`1px solid ${T.b}`,borderRadius:14,padding:mob?14:20}}>
              <div style={{fontWeight:700,fontSize:12,marginBottom:12}}>งบคงเหลือตามเวลา</div>
              <ResponsiveContainer width="100%" height={mob?180:220}>
                <AreaChart data={balTime}><defs><linearGradient id="gB" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.a} stopOpacity={.3}/><stop offset="100%" stopColor={T.a} stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke={T.b}/><XAxis dataKey="date" stroke={T.d} fontSize={9} tickLine={false}/><YAxis stroke={T.d} fontSize={9} tickLine={false} tickFormatter={v=>`${(v/1e6).toFixed(1)}M`}/><Tooltip content={<CTip/>}/><Area type="monotone" dataKey="balance" stroke={T.a} strokeWidth={2} fill="url(#gB)" name="คงเหลือ"/></AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{background:T.s2,border:`1px solid ${T.b}`,borderRadius:14,padding:mob?14:20}}>
              <div style={{fontWeight:700,fontSize:12,marginBottom:12}}>สัดส่วนตามหมวดหมู่</div>
              <div style={{display:"flex",alignItems:"center",flexDirection:mob?"column":"row",gap:mob?10:0}}>
                <ResponsiveContainer width={mob?"100%":"50%"} height={mob?170:220}><PieChart><Pie data={byCat} dataKey="value" cx="50%" cy="50%" outerRadius={mob?70:85} innerRadius={mob?35:42} paddingAngle={3} strokeWidth={0}>{byCat.map((c,i)=><Cell key={i} fill={c.color}/>)}</Pie><Tooltip content={<CTip/>}/></PieChart></ResponsiveContainer>
                <div style={{flex:1,width:mob?"100%":"auto"}}>{byCat.map(c=>(
                  <div key={c.id} style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}><span style={{fontSize:13}}>{c.icon}</span><div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div><div style={{fontSize:10,color:T.d,fontFamily:"'JetBrains Mono',monospace"}}>฿{fmt(c.value)}</div></div></div>
                ))}</div>
              </div>
            </div>
          </div>

          <div style={{background:T.s2,border:`1px solid ${T.b}`,borderRadius:14,padding:mob?14:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontWeight:700,fontSize:12}}>รายการล่าสุด</span><button onClick={()=>setTab("transactions")} style={{background:"none",border:"none",color:T.a,cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit"}}>ดูทั้งหมด →</button></div>
            {mob ? activeTx.slice(-4).reverse().map(t=>(
              <div key={t.id} onClick={()=>edit(t)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${T.b}12`,cursor:"pointer",gap:8}}>
                <div style={{minWidth:0}}><div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}><Badge type={t.type}/><span style={{fontSize:12,fontWeight:600}}>{t.person}</span></div><div style={{fontSize:11,color:T.m,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.item}</div></div>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:14,fontWeight:700,color:t.type==="เบิก"?T.r:T.g,flexShrink:0}}>{t.type==="เบิก"?"−":"+"}{fmt(t.amount)}</span>
              </div>
            )) : <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 3px"}}><thead><tr>{["ประเภท","ชื่อ","วันที่","หมวดหมู่","รายการ","จำนวนเงิน"].map(h=><th key={h} style={{textAlign:"left",padding:"5px 10px",color:T.d,fontSize:9,fontWeight:700,letterSpacing:.8}}>{h}</th>)}</tr></thead><tbody>{activeTx.slice(-5).reverse().map(t=>(
              <tr key={t.id} style={{background:T.bg,cursor:"pointer"}} onClick={()=>edit(t)} onMouseEnter={e=>e.currentTarget.style.background=T.s3} onMouseLeave={e=>e.currentTarget.style.background=T.bg}><td style={{padding:"9px 10px",borderRadius:"8px 0 0 8px"}}><Badge type={t.type}/></td><td style={{padding:"9px 10px",fontSize:12,fontWeight:600}}>{t.person}</td><td style={{padding:"9px 10px",fontSize:11,color:T.m}}>{t.date}</td><td style={{padding:"9px 10px"}}><CatB id={t.category}/></td><td style={{padding:"9px 10px",fontSize:11}}>{t.item}</td><td style={{padding:"9px 10px",borderRadius:"0 8px 8px 0",fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:700,color:t.type==="เบิก"?T.r:T.g}}>{t.type==="เบิก"?"−":"+"}{fmt(t.amount)}</td></tr>
            ))}</tbody></table>}
          </div>
        </div>}

        {/* ═══ TRANSACTIONS ═══ */}
        {tab==="transactions"&&<div>
          {showForm&&<div style={{background:T.s2,border:`1px solid ${T.a}30`,borderRadius:14,padding:mob?18:26,marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}><span style={{fontSize:15,fontWeight:800}}>{editId?"✏ แก้ไข":"➕ เพิ่มรายการ"}</span><button onClick={resetForm} style={{background:"none",border:"none",color:T.m,cursor:"pointer",fontSize:18}}>✕</button></div>
            <div style={{display:"flex",gap:8,marginBottom:12}}>{["เบิก","คืน"].map(t=>(
              <button key={t} onClick={()=>setForm(f=>({...f,type:t}))} style={{flex:1,padding:11,borderRadius:10,fontSize:13,fontWeight:700,border:`2px solid ${form.type===t?(t==="เบิก"?T.r:T.g):T.b}`,background:form.type===t?(t==="เบิก"?T.rs:T.gs):"transparent",color:form.type===t?(t==="เบิก"?T.r:T.g):T.d,cursor:"pointer",fontFamily:"inherit"}}>{t==="เบิก"?"▲ เบิก":"▼ คืน"}</button>
            ))}</div>
            <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"repeat(3,1fr)",gap:10}}>
              <div><label style={{fontSize:10,color:T.m,fontWeight:700,display:"block",marginBottom:3}}>ชื่อผู้ทำรายการ *</label><input value={form.person} onChange={e=>setForm(f=>({...f,person:e.target.value}))} style={inp()} placeholder="ชื่อ..." list="pls"/><datalist id="pls">{[...new Set(activeTx.map(t=>t.person))].map(p=><option key={p} value={p}/>)}</datalist></div>
              <div><label style={{fontSize:10,color:T.m,fontWeight:700,display:"block",marginBottom:3}}>วันที่ *</label><input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={inp()}/></div>
              <div><label style={{fontSize:10,color:T.m,fontWeight:700,display:"block",marginBottom:3}}>จำนวนเงิน (บาท) *</label><input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} style={inp({fontFamily:"'JetBrains Mono',monospace"})} placeholder="0"/></div>
            </div>
            <div style={{marginTop:10}}><label style={{fontSize:10,color:T.m,fontWeight:700,display:"block",marginBottom:5}}>หมวดหมู่ *</label>
              <div style={{display:"grid",gridTemplateColumns:mob?"repeat(3,1fr)":"repeat(5,1fr)",gap:5}}>{CATS.map(c=>(
                <button key={c.id} onClick={()=>setForm(f=>({...f,category:c.id}))} style={{padding:mob?"7px 3px":"9px 5px",borderRadius:9,fontSize:mob?9:10,fontWeight:600,border:`2px solid ${form.category===c.id?c.color:T.b}`,background:form.category===c.id?c.color+"14":"transparent",color:form.category===c.id?c.color:T.m,cursor:"pointer",fontFamily:"inherit",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}><span style={{fontSize:15}}>{c.icon}</span>{c.label}</button>
              ))}</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:10,marginTop:10}}>
              <div><label style={{fontSize:10,color:T.m,fontWeight:700,display:"block",marginBottom:3}}>รายละเอียด *</label><input value={form.item} onChange={e=>setForm(f=>({...f,item:e.target.value}))} style={inp()} placeholder="เช่น ค่าอบรม AI..."/></div>
              <div><label style={{fontSize:10,color:T.m,fontWeight:700,display:"block",marginBottom:3}}>หมายเหตุ</label><input value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} style={inp()} placeholder="(ไม่บังคับ)"/></div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginTop:16}}>
              <div style={{fontSize:11,color:T.d}}>{!demo&&sync.isReady?"💾 บันทึกลง Google Sheets อัตโนมัติ":"⚠ Demo — ข้อมูลไม่ได้บันทึก"}</div>
              <div style={{display:"flex",gap:8}}><button onClick={resetForm} style={btn("transparent",{border:`1px solid ${T.b}`,color:T.m})}>ยกเลิก</button><button onClick={submit} style={btn(T.a)}>{editId?"บันทึก":"เพิ่มรายการ"}</button></div>
            </div>
          </div>}

          <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center",background:T.s2,borderRadius:12,padding:"9px 12px",border:`1px solid ${T.b}`,flexWrap:mob?"wrap":"nowrap"}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} style={inp({flex:1,minWidth:mob?"100%":180,padding:"9px 12px",fontSize:13})} placeholder="🔍 ค้นหา..."/>
            <div style={{display:"flex",gap:2,background:T.bg,borderRadius:9,padding:2}}>{[["all","ทั้งหมด"],["เบิก","▲เบิก"],["คืน","▼คืน"]].map(([v,l])=>(<button key={v} onClick={()=>setFType(v)} style={{padding:"6px 12px",borderRadius:7,border:"none",cursor:"pointer",fontSize:10,fontWeight:700,background:fType===v?T.a:"transparent",color:fType===v?"#fff":T.m,fontFamily:"inherit"}}>{l}</button>))}</div>
            {!mob&&<select value={fCat} onChange={e=>setFCat(e.target.value)} style={inp({width:150,cursor:"pointer",padding:"8px 10px",fontSize:11})}><option value="all">ทุกหมวดหมู่</option>{CATS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}</select>}
            <span style={{color:T.d,fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>{filtered.length} รายการ</span>
          </div>

          {mob ? <div style={{display:"flex",flexDirection:"column",gap:6}}>{filtered.map(t=>(
            <div key={t.id} style={{background:T.s2,border:`1px solid ${T.b}`,borderRadius:12,padding:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}><Badge type={t.type}/><span style={{fontSize:13,fontWeight:700}}>{t.person}</span></div>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:15,fontWeight:700,color:t.type==="เบิก"?T.r:T.g}}>{t.type==="เบิก"?"−":"+"}{fmt(t.amount)}</span>
              </div>
              <div style={{fontSize:12,marginBottom:3}}>{t.item}</div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:4}}><CatB id={t.category}/><span style={{fontSize:10,color:T.d}}>{t.date}</span></div>
                <div style={{display:"flex",gap:3}}><button onClick={()=>edit(t)} style={{background:T.bg,border:`1px solid ${T.b}`,borderRadius:6,padding:"3px 10px",color:T.a,cursor:"pointer",fontSize:10,fontWeight:700,fontFamily:"inherit"}}>แก้ไข</button><button onClick={()=>del(t.id)} style={{background:T.bg,border:`1px solid ${T.b}`,borderRadius:6,padding:"3px 10px",color:T.r,cursor:"pointer",fontSize:10,fontWeight:700,fontFamily:"inherit"}}>ลบ</button></div>
              </div>
            </div>
          ))}</div>
          : <div style={{background:T.s2,border:`1px solid ${T.b}`,borderRadius:14,overflow:"hidden"}}><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:780}}>
            <thead><tr style={{background:T.bg}}>{["#","ประเภท","ชื่อ","วันที่","หมวดหมู่","รายการ","จำนวนเงิน","หมายเหตุ",""].map(h=><th key={h} style={{textAlign:"left",padding:"11px 10px",color:T.d,fontSize:10,fontWeight:700,borderBottom:`1px solid ${T.b}`}}>{h}</th>)}</tr></thead>
            <tbody>{filtered.map(t=><tr key={t.id} style={{transition:"background .15s"}} onMouseEnter={e=>e.currentTarget.style.background=T.s3} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <td style={{padding:"10px",fontSize:10,color:T.d}}>{t.id}</td><td style={{padding:"10px"}}><Badge type={t.type}/></td><td style={{padding:"10px",fontSize:12,fontWeight:600}}>{t.person}</td><td style={{padding:"10px",fontSize:11,color:T.m}}>{t.date}</td><td style={{padding:"10px"}}><CatB id={t.category}/></td><td style={{padding:"10px",fontSize:11}}>{t.item}</td><td style={{padding:"10px",fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:700,color:t.type==="เบิก"?T.r:T.g}}>{t.type==="เบิก"?"−":"+"}{fmt(t.amount)}</td><td style={{padding:"10px",fontSize:10,color:T.d,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.note||"—"}</td>
              <td style={{padding:"10px"}}><div style={{display:"flex",gap:3}}><button onClick={()=>edit(t)} style={{background:T.bg,border:`1px solid ${T.b}`,borderRadius:6,padding:"3px 10px",color:T.a,cursor:"pointer",fontSize:10,fontWeight:700,fontFamily:"inherit"}}>แก้ไข</button><button onClick={()=>del(t.id)} style={{background:T.bg,border:`1px solid ${T.b}`,borderRadius:6,padding:"3px 10px",color:T.r,cursor:"pointer",fontSize:10,fontWeight:700,fontFamily:"inherit"}}>ลบ</button></div></td>
            </tr>)}</tbody></table></div>
            {filtered.length===0&&<div style={{textAlign:"center",padding:40,color:T.d}}>📭 ไม่พบรายการ</div>}
          </div>}
        </div>}

        {/* ═══ ANALYTICS ═══ */}
        {tab==="analytics"&&<div>
          <div style={{display:"grid",gridTemplateColumns:mob?"repeat(2,1fr)":"repeat(4,1fr)",gap:mob?8:12,marginBottom:14}}>
            {[{v:activeTx.length,l:"รายการ",c:T.a},{v:[...new Set(activeTx.map(t=>t.person))].length,l:"ผู้ทำรายการ",c:T.bl},{v:byCat.length,l:"หมวดหมู่",c:T.am},{v:`${stats.pct.toFixed(0)}%`,l:"ใช้งบแล้ว",c:sc.c}].map((s,i)=>(
              <div key={i} style={{background:T.s2,border:`1px solid ${T.b}`,borderRadius:14,padding:mob?14:18,textAlign:"center"}}><div style={{fontSize:mob?20:26,fontWeight:800,color:s.c,fontFamily:"'JetBrains Mono',monospace"}}>{s.v}</div><div style={{color:T.m,fontSize:11,marginTop:2,fontWeight:600}}>{s.l}</div></div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:12,marginBottom:14}}>
            <div style={{background:T.s2,border:`1px solid ${T.b}`,borderRadius:14,padding:mob?14:20}}>
              <div style={{fontWeight:700,fontSize:12,marginBottom:12}}>สรุปตามบุคคล</div>
              <ResponsiveContainer width="100%" height={mob?200:250}><BarChart data={byPerson} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke={T.b}/><XAxis type="number" stroke={T.d} fontSize={9} tickFormatter={v=>`${v/1000}k`}/><YAxis type="category" dataKey="name" stroke={T.d} fontSize={11} width={65}/><Tooltip content={<CTip/>}/><Legend/><Bar dataKey="เบิก" fill={T.r} radius={[0,4,4,0]} barSize={10}/><Bar dataKey="คืน" fill={T.g} radius={[0,4,4,0]} barSize={10}/></BarChart></ResponsiveContainer>
            </div>
            <div style={{background:T.s2,border:`1px solid ${T.b}`,borderRadius:14,padding:mob?14:20}}>
              <div style={{fontWeight:700,fontSize:12,marginBottom:12}}>ยอดค้างสุทธิ</div>
              {byPerson.map((p,i)=>{const mx=Math.max(...byPerson.map(x=>Math.abs(x.net)),1);return(
                <div key={p.name} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12,fontWeight:600}}>{p.name}</span><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:700,color:p.net>0?T.r:T.g}}>{p.net>0?"−":"+"}{fmt(Math.abs(p.net))}</span></div><div style={{width:"100%",height:6,background:T.bg,borderRadius:3,overflow:"hidden"}}><div style={{width:`${(Math.abs(p.net)/mx)*100}%`,height:"100%",borderRadius:3,background:CATS[i%CATS.length].color}}/></div></div>
              );})}
            </div>
          </div>
          <div style={{background:T.s2,border:`1px solid ${T.b}`,borderRadius:14,padding:mob?14:20,marginBottom:14}}>
            <div style={{fontWeight:700,fontSize:12,marginBottom:12}}>หมวดหมู่ค่าใช้จ่าย</div>
            <div style={{display:"grid",gridTemplateColumns:mob?"repeat(2,1fr)":"repeat(5,1fr)",gap:8}}>{byCat.map(c=>(
              <div key={c.id} style={{background:T.bg,border:`1px solid ${T.b}`,borderRadius:12,padding:mob?12:14,textAlign:"center",transition:"border-color .2s"}} onMouseEnter={e=>e.currentTarget.style.borderColor=c.color+"44"} onMouseLeave={e=>e.currentTarget.style.borderColor=T.b}>
                <div style={{fontSize:20,marginBottom:3}}>{c.icon}</div><div style={{fontSize:10,fontWeight:600,marginBottom:2}}>{c.name}</div><div style={{fontSize:mob?13:15,fontWeight:800,color:c.color,fontFamily:"'JetBrains Mono',monospace"}}>฿{fmt(c.value)}</div><div style={{fontSize:9,color:T.d,marginTop:2}}>{stats.tw>0?((c.value/stats.tw)*100).toFixed(1):0}%</div>
              </div>
            ))}</div>
          </div>
          <div style={{background:T.s2,border:`1px solid ${T.b}`,borderRadius:14,padding:mob?14:20}}>
            <div style={{fontWeight:700,fontSize:12,marginBottom:12}}>แนวโน้มงบคงเหลือ</div>
            <ResponsiveContainer width="100%" height={mob?200:260}><AreaChart data={[{date:"เริ่มต้น",balance:budget},...balTime]}>
              <defs><linearGradient id="gB2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.g} stopOpacity={.2}/><stop offset="100%" stopColor={T.g} stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.b}/><XAxis dataKey="date" stroke={T.d} fontSize={9} tickLine={false}/><YAxis stroke={T.d} fontSize={9} tickLine={false} tickFormatter={v=>`${(v/1e6).toFixed(1)}M`}/><Tooltip content={<CTip/>}/>
              <Area type="stepAfter" dataKey="balance" stroke={T.g} strokeWidth={2} fill="url(#gB2)" name="คงเหลือ" dot={{fill:T.g,r:3}}/>
            </AreaChart></ResponsiveContainer>
          </div>
        </div>}
      </main>

      <style>{`
        @keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        input:focus,textarea:focus,select:focus{border-color:${T.a}!important;outline:none}
        button:active{transform:scale(.97)}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${T.b};border-radius:2px}
        select option{background:${T.s2};color:${T.t}}
      `}</style>
    </div>
  );
}
