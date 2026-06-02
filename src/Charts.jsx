import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, AreaChart, Area, CartesianGrid, Legend
} from "recharts";

/* ═══════════════════════════════════════════════════════════
   Lazy-loaded chart bundle — keeps recharts out of the initial
   (login) chunk. Rendered via <Suspense> from App.jsx.
   ═══════════════════════════════════════════════════════════ */
export default function Charts({ kind, data, mob, T, fmt }) {
  const CTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background:"#fff", border:`1px solid ${T.b}`, borderRadius:12, padding:"12px 16px", boxShadow:T.shadowLg }}>
        {payload.map((p, i) => (
          <div key={i} style={{ color:p.color||T.t, fontSize:14, fontWeight:700 }}>{p.name}: ฿{fmt(p.value)}</div>
        ))}
      </div>
    );
  };

  if (kind === "balanceArea") return (
    <ResponsiveContainer width="100%" height={mob?200:240}>
      <AreaChart data={data}>
        <defs><linearGradient id="gB" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.a} stopOpacity={.15}/><stop offset="100%" stopColor={T.a} stopOpacity={0}/></linearGradient></defs>
        <CartesianGrid strokeDasharray="3 3" stroke={T.b}/><XAxis dataKey="date" stroke={T.d} fontSize={12} tickLine={false}/><YAxis stroke={T.d} fontSize={12} tickLine={false} tickFormatter={v=>`${(v/1e6).toFixed(1)}M`}/><Tooltip content={<CTip/>}/><Area type="monotone" dataKey="balance" stroke={T.a} strokeWidth={2.5} fill="url(#gB)" name="คงเหลือ"/>
      </AreaChart>
    </ResponsiveContainer>
  );

  if (kind === "personBar") return (
    <ResponsiveContainer width="100%" height={mob?220:260}>
      <BarChart data={data} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke={T.b}/><XAxis type="number" stroke={T.d} fontSize={12} tickFormatter={v=>`${v/1000}k`}/><YAxis type="category" dataKey="name" stroke={T.d} fontSize={14} width={70}/><Tooltip content={<CTip/>}/><Legend/><Bar dataKey="เบิก" fill="#FCA5A5" radius={[0,6,6,0]} barSize={14}/><Bar dataKey="คืน" fill="#6EE7B7" radius={[0,6,6,0]} barSize={14}/></BarChart>
    </ResponsiveContainer>
  );

  if (kind === "balanceTrend") return (
    <ResponsiveContainer width="100%" height={mob?220:280}>
      <AreaChart data={data}>
        <defs><linearGradient id="gB2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.g} stopOpacity={.15}/><stop offset="100%" stopColor={T.g} stopOpacity={0}/></linearGradient></defs>
        <CartesianGrid strokeDasharray="3 3" stroke={T.b}/><XAxis dataKey="date" stroke={T.d} fontSize={12} tickLine={false}/><YAxis stroke={T.d} fontSize={12} tickLine={false} tickFormatter={v=>`${(v/1e6).toFixed(1)}M`}/><Tooltip content={<CTip/>}/>
        <Area type="stepAfter" dataKey="balance" stroke={T.g} strokeWidth={2.5} fill="url(#gB2)" name="คงเหลือ" dot={{fill:T.g,r:4}}/>
      </AreaChart>
    </ResponsiveContainer>
  );

  return null;
}
