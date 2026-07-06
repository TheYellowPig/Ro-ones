import { useState, useEffect, useCallback } from "react";

const SUPABASE_URL = "https://tiyiulwtnwmktfhxnxpr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpeWl1bHd0bndta3RmaHhueHByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNzc3OTIsImV4cCI6MjA5Nzc1Mzc5Mn0.2DDiitoouP-_D0urnKQioy7Cdawjxl_LWDt4PwR9nuA";
const ADMIN_PASSWORD = "123admin";

async function sb(path, method = "GET", body = null, prefer = "return=representation") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method, headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: prefer },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || `Error ${res.status}`); }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

const api = {
  get:         (table, query = "")  => sb(`${table}?${query}`, "GET"),
  post:        (table, data)        => sb(table, "POST", data),
  patch:       (table, id, data)    => sb(`${table}?id=eq.${id}`, "PATCH", data),
  delete:      (table, id)          => sb(`${table}?id=eq.${id}`, "DELETE", null, "return=minimal"),
  deleteWhere: (table, filter)      => sb(`${table}?${filter}`, "DELETE", null, "return=minimal"),
};

// ── HLA input: mayúsculas, permite A-Z 0-9 * : - ──────────────────────────
function hlaClean(val) {
  return val.toUpperCase().replace(/[^A-Z0-9*:\-]/g, "");
}

// ── Compatibilidad HLA detallada ──────────────────────────────────────────
const ABO_COMPAT = {
  "O+": ["O+","A+","B+","AB+"], "O-": ["O+","O-","A+","A-","B+","B-","AB+","AB-"],
  "A+": ["A+","AB+"], "A-": ["A+","A-","AB+","AB-"],
  "B+": ["B+","AB+"], "B-": ["B+","B-","AB+","AB-"],
  "AB+": ["AB+"], "AB-": ["AB+","AB-"],
};
function aboCompat(d, p) { return (ABO_COMPAT[d] || []).includes(p); }

// Retorna { pct, crossmatch, detalle } donde detalle lista cada locus
function calcHlaCompat(donorHla, patientHla, anticuerpos) {
  if (!donorHla || !patientHla) return null;
  const donorAntigens = [donorHla.hla_a1,donorHla.hla_a2,donorHla.hla_b1,donorHla.hla_b2,donorHla.hla_dr1,donorHla.hla_dr2].filter(Boolean);
  const blocked = anticuerpos.map(a => a.hla_antigeno);
  const crossmatch = donorAntigens.filter(ag => blocked.includes(ag));
  if (crossmatch.length > 0) return { pct: null, crossmatch, detalle: [] };
  const patientAntigens = [patientHla.hla_a1,patientHla.hla_a2,patientHla.hla_b1,patientHla.hla_b2,patientHla.hla_dr1,patientHla.hla_dr2].filter(Boolean);
  const loci = [
    { label: "HLA-A", don: [donorHla.hla_a1,donorHla.hla_a2].filter(Boolean), pat: [patientHla.hla_a1,patientHla.hla_a2].filter(Boolean) },
    { label: "HLA-B", don: [donorHla.hla_b1,donorHla.hla_b2].filter(Boolean), pat: [patientHla.hla_b1,patientHla.hla_b2].filter(Boolean) },
    { label: "HLA-DR", don: [donorHla.hla_dr1,donorHla.hla_dr2].filter(Boolean), pat: [patientHla.hla_dr1,patientHla.hla_dr2].filter(Boolean) },
  ];
  const detalle = loci.map(l => {
    const matches = l.don.filter(a => l.pat.includes(a));
    return { label: l.label, don: l.don, pat: l.pat, matches };
  });
  let matches = 0;
  for (const ag of donorAntigens) { if (patientAntigens.includes(ag)) matches++; }
  const total = Math.max(donorAntigens.length, patientAntigens.length, 1);
  return { pct: Math.round((matches / total) * 100), crossmatch: [], detalle };
}

const S = {
  app: { display:"flex", height:"100vh", fontFamily:"system-ui,-apple-system,sans-serif", background:"var(--color-background-tertiary,#f5f5f3)", color:"var(--color-text-primary,#1a1a1a)" },
  sidebar: { width:220, minWidth:220, background:"var(--color-background-primary,#fff)", borderRight:"0.5px solid var(--color-border-tertiary,#e0e0e0)", display:"flex", flexDirection:"column", padding:"1.5rem 0" },
  logo: { padding:"0 1.25rem 1.5rem", borderBottom:"0.5px solid var(--color-border-tertiary,#e0e0e0)", marginBottom:"1rem" },
  logoTitle: { fontSize:15, fontWeight:500, margin:0 },
  logoSub: { fontSize:12, color:"var(--color-text-secondary,#666)", margin:"2px 0 0" },
  navItem: (a) => ({ display:"flex", alignItems:"center", gap:10, padding:"9px 1.25rem", fontSize:13, fontWeight:a?500:400, color:a?"#185FA5":"var(--color-text-secondary,#555)", background:a?"#E6F1FB":"transparent", borderLeft:a?"2.5px solid #185FA5":"2.5px solid transparent", cursor:"pointer" }),
  main: { flex:1, overflow:"auto", padding:"2rem" },
  pageTitle: { fontSize:22, fontWeight:500, margin:"0 0 1.5rem" },
  card: { background:"var(--color-background-primary,#fff)", border:"0.5px solid var(--color-border-tertiary,#e0e0e0)", borderRadius:12, padding:"1.25rem", marginBottom:"1rem" },
  grid2: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem" },
  label: { display:"block", fontSize:12, color:"var(--color-text-secondary,#666)", marginBottom:4, fontWeight:500 },
  input: { width:"100%", padding:"8px 10px", fontSize:13, border:"0.5px solid var(--color-border-secondary,#ccc)", borderRadius:8, background:"var(--color-background-primary,#fff)", color:"var(--color-text-primary)", boxSizing:"border-box", outline:"none", textTransform:"uppercase", letterSpacing:"0.02em" },
  inputNormal: { width:"100%", padding:"8px 10px", fontSize:13, border:"0.5px solid var(--color-border-secondary,#ccc)", borderRadius:8, background:"var(--color-background-primary,#fff)", color:"var(--color-text-primary)", boxSizing:"border-box", outline:"none" },
  select: { width:"100%", padding:"8px 10px", fontSize:13, border:"0.5px solid var(--color-border-secondary,#ccc)", borderRadius:8, background:"var(--color-background-primary,#fff)", color:"var(--color-text-primary)", boxSizing:"border-box" },
  btn: (v="primary") => ({ padding:"8px 16px", fontSize:13, fontWeight:500, border:v==="primary"?"none":"0.5px solid var(--color-border-secondary)", borderRadius:8, cursor:"pointer", background:v==="primary"?"#185FA5":v==="danger"?"#A32D2D":v==="success"?"#0F6E56":"var(--color-background-secondary,#f0f0f0)", color:v==="ghost"?"var(--color-text-primary)":"#fff" }),
  badge: (c) => { const m={blue:{bg:"#E6F1FB",color:"#0C447C"},red:{bg:"#FCEBEB",color:"#791F1F"},green:{bg:"#EAF3DE",color:"#27500A"},amber:{bg:"#FAEEDA",color:"#633806"},gray:{bg:"#F1EFE8",color:"#444441"}}; const x=m[c]||m.gray; return {display:"inline-block",padding:"2px 8px",borderRadius:6,fontSize:11,fontWeight:500,background:x.bg,color:x.color}; },
  table: { width:"100%", borderCollapse:"collapse", fontSize:13 },
  th: { padding:"8px 12px", textAlign:"left", borderBottom:"0.5px solid var(--color-border-tertiary,#e0e0e0)", fontSize:12, color:"var(--color-text-secondary)", fontWeight:500 },
  td: { padding:"10px 12px", borderBottom:"0.5px solid var(--color-border-tertiary,#e0e0e0)", verticalAlign:"middle" },
  stat: { background:"var(--color-background-secondary,#f5f5f5)", borderRadius:10, padding:"1rem", textAlign:"center" },
  statNum: { fontSize:28, fontWeight:500, margin:0 },
  statLabel: { fontSize:12, color:"var(--color-text-secondary)", margin:"4px 0 0" },
  alert: (t) => ({ padding:"12px 16px", borderRadius:8, fontSize:13, marginBottom:"1rem", background:t==="error"?"#FCEBEB":t==="success"?"#EAF3DE":"#E6F1FB", color:t==="error"?"#791F1F":t==="success"?"#27500A":"#0C447C", border:`0.5px solid ${t==="error"?"#F09595":t==="success"?"#97C459":"#85B7EB"}` }),
  matchCard: { background:"var(--color-background-primary,#fff)", border:"2px solid #1D9E75", borderRadius:12, padding:"1.25rem", marginBottom:"1rem" },
  flex: (gap=8) => ({ display:"flex", alignItems:"center", gap }),
  spaceBetween: { display:"flex", alignItems:"center", justifyContent:"space-between" },
};

// ── HLA Input field ───────────────────────────────────────────────────────────
function HlaInput({ label, value, onChange }) {
  return (
    <div>
      <label style={S.label}>{label}</label>
      <input
        style={S.input}
        value={value}
        placeholder="Ej: A*02:01"
        onChange={e => onChange(hlaClean(e.target.value))}
        onKeyDown={e => { if([",","."].includes(e.key)) e.preventDefault(); }}
      />
    </div>
  );
}

// ── Anticuerpo Input ──────────────────────────────────────────────────────────
function AnticuerpoInput({ value, onChange }) {
  return (
    <input
      style={{ ...S.input, flex:1 }}
      value={value}
      placeholder="Ej: A24, B*57:01"
      onChange={e => onChange(hlaClean(e.target.value))}
      onKeyDown={e => { if([",","."].includes(e.key)) e.preventDefault(); }}
    />
  );
}

// ── Bloque de tipificación HLA visual ────────────────────────────────────────
function HlaTypingBlock({ hla, pra, anticuerpos }) {
  if (!hla) return <p style={{fontSize:13,color:"var(--color-text-secondary)"}}>Sin tipaje registrado.</p>;
  const fields = [
    { label:"HLA-A", v1: hla.hla_a1, v2: hla.hla_a2 },
    { label:"HLA-B", v1: hla.hla_b1, v2: hla.hla_b2 },
    { label:"HLA-DR", v1: hla.hla_dr1, v2: hla.hla_dr2 },
  ];
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:12 }}>
        {fields.map(f => (
          <div key={f.label} style={{ background:"#F5F5F3", borderRadius:8, padding:"10px 12px", border:"0.5px solid #E0E0DE" }}>
            <div style={{ fontSize:11, fontWeight:600, color:"#185FA5", marginBottom:4 }}>{f.label}</div>
            <div style={{ fontSize:14, fontWeight:500, fontFamily:"monospace" }}>
              {f.v1 || <span style={{color:"#aaa"}}>—</span>}
              {f.v2 && <> / {f.v2}</>}
            </div>
          </div>
        ))}
      </div>
      {pra !== null && pra !== undefined && pra !== "" && (
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
          <span style={{ fontSize:12, fontWeight:500, color:"var(--color-text-secondary)" }}>PRA:</span>
          <span style={{ ...S.badge(pra >= 80 ? "red" : pra >= 30 ? "amber" : "green"), fontSize:13 }}>{pra}%</span>
          <span style={{ fontSize:11, color:"var(--color-text-secondary)" }}>
            {pra >= 80 ? "Alto riesgo de rechazo" : pra >= 30 ? "Riesgo moderado" : "Bajo riesgo"}
          </span>
        </div>
      )}
      {anticuerpos && anticuerpos.length > 0 && (
        <div>
          <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", marginBottom:4 }}>Anticuerpos (crossmatch positivo con):</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
            {anticuerpos.map((a,i) => <span key={i} style={S.badge("red")}>{a.hla_antigeno}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── ConfirmDeleteModal ────────────────────────────────────────────────────────
function ConfirmDeleteModal({ nombre, onConfirm, onClose }) {
  const [pass, setPass] = useState(""); const [err, setErr] = useState("");
  const confirm = () => { if (pass !== ADMIN_PASSWORD) return setErr("Contraseña incorrecta."); onConfirm(); };
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"var(--color-background-primary,#fff)", borderRadius:14, padding:"1.5rem", width:380, border:"0.5px solid var(--color-border-tertiary)" }}>
        <h2 style={{ margin:"0 0 0.5rem", fontSize:17, fontWeight:500 }}>¿Estás seguro de borrar esto?</h2>
        <p style={{ fontSize:13, color:"var(--color-text-secondary)", margin:"0 0 1.25rem" }}>Estás a punto de eliminar <strong>{nombre}</strong>. Esta acción no se puede deshacer.</p>
        <label style={S.label}>Contraseña de administrador</label>
        <input style={{ ...S.inputNormal, marginBottom:8 }} type="password" placeholder="Contraseña" value={pass} onChange={e=>{setPass(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&confirm()} autoFocus />
        {err && <p style={{ fontSize:12, color:"#A32D2D", margin:"0 0 8px" }}>{err}</p>}
        <div style={{ ...S.flex(), justifyContent:"flex-end", marginTop:"0.75rem" }}>
          <button style={S.btn("ghost")} onClick={onClose}>Cancelar</button>
          <button style={S.btn("danger")} onClick={confirm}>Sí, eliminar</button>
        </div>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"var(--color-background-primary,#fff)", borderRadius:14, padding:"1.5rem", width: wide ? 720 : 560, maxWidth:"95vw", maxHeight:"88vh", overflowY:"auto", border:"0.5px solid var(--color-border-tertiary)" }}>
        <div style={{ ...S.spaceBetween, marginBottom:"1.25rem" }}>
          <h2 style={{ margin:0, fontSize:18, fontWeight:500 }}>{title}</h2>
          <button onClick={onClose} style={{ ...S.btn("ghost"), padding:"4px 8px", fontSize:18 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ pacientes, donadores, ciclos }) {
  const activos = pacientes.filter(p=>p.estatus==="Activo").length;
  const trasplantados = pacientes.filter(p=>p.estatus==="Trasplantado").length;
  const disponibles = donadores.filter(d=>d.estatus==="Disponible").length;
  return (
    <div>
      <h1 style={S.pageTitle}>Panel principal</h1>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:"1rem", marginBottom:"1.5rem" }}>
        {[{n:activos,l:"Pacientes activos",c:"#185FA5"},{n:disponibles,l:"Donadores disponibles",c:"#0F6E56"},{n:ciclos.length,l:"Ciclos encontrados",c:"#B87333"},{n:trasplantados,l:"Trasplantes realizados",c:"#533AB7"}].map(s=>(
          <div key={s.l} style={S.stat}><p style={{...S.statNum,color:s.c}}>{s.n}</p><p style={S.statLabel}>{s.l}</p></div>
        ))}
      </div>
      <div style={S.grid2}>
        <div style={S.card}>
          <h3 style={{ margin:"0 0 1rem", fontSize:14, fontWeight:500 }}>Últimos pacientes</h3>
          {pacientes.slice(0,5).map(p=>(
            <div key={p.id} style={{ ...S.spaceBetween, padding:"8px 0", borderBottom:"0.5px solid var(--color-border-tertiary)" }}>
              <span style={{ fontSize:13 }}>{p.nombre}</span>
              <div style={S.flex()}><span style={S.badge("gray")}>{p.tipo_sangre}</span><span style={S.badge(p.estatus==="Activo"?"blue":p.estatus==="Trasplantado"?"green":"gray")}>{p.estatus}</span></div>
            </div>
          ))}
          {pacientes.length===0&&<p style={{fontSize:13,color:"var(--color-text-secondary)"}}>Sin pacientes aún.</p>}
        </div>
        <div style={S.card}>
          <h3 style={{ margin:"0 0 1rem", fontSize:14, fontWeight:500 }}>Ciclos recientes</h3>
          {ciclos.slice(0,5).map(c=>(
            <div key={c.id} style={{ ...S.spaceBetween, padding:"8px 0", borderBottom:"0.5px solid var(--color-border-tertiary)" }}>
              <span style={{ fontSize:13 }}>{c.tipo==="Cadena"?"🔗 Cadena":"🔄 Intercambio pareado"}</span>
              <span style={S.badge(c.estatus==="Aprobado"?"green":c.estatus==="Rechazado"?"red":"amber")}>{c.estatus}</span>
            </div>
          ))}
          {ciclos.length===0&&<p style={{fontSize:13,color:"var(--color-text-secondary)"}}>Sin ciclos aún.</p>}
        </div>
      </div>
    </div>
  );
}

const BLOOD_TYPES = ["A+","A-","B+","B-","AB+","AB-","O+","O-"];

// ── HLA Form section (reutilizable) ──────────────────────────────────────────
function HlaFormSection({ hla, setHla, pra, setPra, label = "Tipaje HLA" }) {
  return (
    <>
      <h3 style={{ fontSize:14, fontWeight:500, margin:"1.25rem 0 0.75rem" }}>{label}</h3>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        <HlaInput label="HLA-A1" value={hla.hla_a1} onChange={v=>setHla({...hla,hla_a1:v})} />
        <HlaInput label="HLA-A2" value={hla.hla_a2} onChange={v=>setHla({...hla,hla_a2:v})} />
        <HlaInput label="HLA-B1" value={hla.hla_b1} onChange={v=>setHla({...hla,hla_b1:v})} />
        <HlaInput label="HLA-B2" value={hla.hla_b2} onChange={v=>setHla({...hla,hla_b2:v})} />
        <HlaInput label="HLA-DR1" value={hla.hla_dr1} onChange={v=>setHla({...hla,hla_dr1:v})} />
        <HlaInput label="HLA-DR2" value={hla.hla_dr2} onChange={v=>setHla({...hla,hla_dr2:v})} />
      </div>
      {setPra && (
        <div style={{ marginTop:8 }}>
          <label style={S.label}>PRA % (Panel Reactive Antibody)</label>
          <input style={S.inputNormal} type="number" min="0" max="100" placeholder="0-100" value={pra}
            onChange={e => { const v = parseInt(e.target.value); setPra(isNaN(v)?"":(v>100?100:v<0?0:v)); }} />
        </div>
      )}
    </>
  );
}

// ── Pacientes ─────────────────────────────────────────────────────────────────
function PacientesPage({ pacientes, donadores, refresh }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ nombre:"", fecha_nacimiento:"", tipo_sangre:"O+", notas:"" });
  const [hla, setHla] = useState({ hla_a1:"", hla_a2:"", hla_b1:"", hla_b2:"", hla_dr1:"", hla_dr2:"" });
  const [pra, setPra] = useState("");
  const [anticuerpos, setAnticuerpos] = useState([""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [selHla, setSelHla] = useState(null);
  const [patAnticuerpos, setPatAnticuerpos] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const openAdd = () => {
    setForm({ nombre:"", fecha_nacimiento:"", tipo_sangre:"O+", notas:"" });
    setHla({ hla_a1:"", hla_a2:"", hla_b1:"", hla_b2:"", hla_dr1:"", hla_dr2:"" });
    setPra(""); setAnticuerpos([""]); setError(""); setModal("add");
  };

  const openDetail = async (p) => {
    setSelected(p);
    const [acs, hlaRows] = await Promise.all([
      api.get("anticuerpos_paciente", `id_paciente=eq.${p.id}`),
      api.get("tipaje_hla", `id_persona=eq.${p.id}&tipo_persona=eq.Paciente`),
    ]);
    setPatAnticuerpos(acs);
    setSelHla(hlaRows[0] || null);
    setModal("detail");
  };

  const save = async () => {
    if (!form.nombre.trim()) return setError("El nombre es requerido.");
    setLoading(true); setError("");
    try {
      const payload = { ...form, estatus:"Activo", fecha_nacimiento: form.fecha_nacimiento||null, pra: pra===""?null:Number(pra) };
      const [newPac] = await api.post("pacientes", payload);
      await api.post("tipaje_hla", { id_persona:newPac.id, tipo_persona:"Paciente", ...hla });
      for (const ac of anticuerpos.filter(a=>a.trim())) {
        await api.post("anticuerpos_paciente", { id_paciente:newPac.id, hla_antigeno:ac });
      }
      await refresh(); setModal(null);
    } catch(e) { setError(e.message); }
    setLoading(false);
  };

  const deletePaciente = async (id) => {
    await api.deleteWhere("intercambios", `id_paciente_receptor=eq.${id}`).catch(()=>{});
    await api.deleteWhere("anticuerpos_paciente", `id_paciente=eq.${id}`).catch(()=>{});
    await api.deleteWhere("tipaje_hla", `id_persona=eq.${id}`).catch(()=>{});
    await api.delete("pacientes", id);
    await refresh(); setDeleteTarget(null); setModal(null);
  };

  const updateEstatus = async (id, estatus) => { await api.patch("pacientes", id, { estatus }); await refresh(); setModal(null); };
  const donadorAsociado = id => donadores.find(d=>d.id_paciente_asociado===id);

  return (
    <div>
      <div style={{ ...S.spaceBetween, marginBottom:"1.5rem" }}>
        <h1 style={{ ...S.pageTitle, margin:0 }}>Pacientes</h1>
        <button style={S.btn()} onClick={openAdd}>+ Nuevo paciente</button>
      </div>
      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>{["Nombre","Tipo sangre","PRA","Donador asociado","Estatus","Acciones"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {pacientes.map(p => {
              const don = donadorAsociado(p.id);
              return (
                <tr key={p.id}>
                  <td style={S.td}>{p.nombre}</td>
                  <td style={S.td}><span style={S.badge("gray")}>{p.tipo_sangre}</span></td>
                  <td style={S.td}>{p.pra!=null?<span style={S.badge(p.pra>=80?"red":p.pra>=30?"amber":"green")}>{p.pra}%</span>:<span style={{color:"var(--color-text-secondary)",fontSize:12}}>—</span>}</td>
                  <td style={S.td}>{don?<span style={S.flex()}>{don.nombre}<span style={S.badge("blue")}>{don.tipo_sangre}</span></span>:<span style={{color:"var(--color-text-secondary)",fontSize:12}}>Sin donador</span>}</td>
                  <td style={S.td}><span style={S.badge(p.estatus==="Activo"?"blue":p.estatus==="Trasplantado"?"green":"gray")}>{p.estatus}</span></td>
                  <td style={S.td}>
                    <div style={S.flex()}>
                      <button style={{...S.btn("ghost"),padding:"4px 10px",fontSize:12}} onClick={()=>openDetail(p)}>Ver tipaje</button>
                      <button style={{...S.btn("danger"),padding:"4px 10px",fontSize:12}} onClick={()=>setDeleteTarget(p)}>Borrar</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {pacientes.length===0&&<p style={{textAlign:"center",color:"var(--color-text-secondary)",padding:"2rem 0",fontSize:13}}>No hay pacientes registrados aún.</p>}
      </div>

      {deleteTarget&&<ConfirmDeleteModal nombre={deleteTarget.nombre} onConfirm={()=>deletePaciente(deleteTarget.id)} onClose={()=>setDeleteTarget(null)}/>}

      {modal==="add"&&(
        <Modal title="Registrar nuevo paciente" onClose={()=>setModal(null)} wide>
          {error&&<div style={S.alert("error")}>{error}</div>}
          <div style={S.grid2}>
            <div>
              <label style={S.label}>Nombre completo</label>
              <input style={S.inputNormal} value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} />
            </div>
            <div>
              <label style={S.label}>Fecha de nacimiento (opcional)</label>
              <input style={S.inputNormal} type="date" value={form.fecha_nacimiento} onChange={e=>setForm({...form,fecha_nacimiento:e.target.value})} />
            </div>
            <div>
              <label style={S.label}>Tipo de sangre</label>
              <select style={S.select} value={form.tipo_sangre} onChange={e=>setForm({...form,tipo_sangre:e.target.value})}>
                {BLOOD_TYPES.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <HlaFormSection hla={hla} setHla={setHla} pra={pra} setPra={setPra} label="Tipificación HLA" />

          <h3 style={{ fontSize:14, fontWeight:500, margin:"1.25rem 0 0.75rem" }}>Anticuerpos detectados (Antibody Assignment)</h3>
          <p style={{ fontSize:12, color:"var(--color-text-secondary)", margin:"0 0 0.75rem" }}>Ingresa cada antígeno HLA contra el que el paciente tiene anticuerpos. Formato libre: A*02:01, B57, DR3, etc.</p>
          {anticuerpos.map((ac,i)=>(
            <div key={i} style={{ ...S.flex(), marginBottom:6 }}>
              <AnticuerpoInput value={ac} onChange={v=>{ const c=[...anticuerpos]; c[i]=v; setAnticuerpos(c); }} />
              {anticuerpos.length>1&&<button style={{...S.btn("danger"),padding:"4px 10px",marginLeft:6}} onClick={()=>setAnticuerpos(anticuerpos.filter((_,j)=>j!==i))}>×</button>}
            </div>
          ))}
          <button style={{...S.btn("ghost"),fontSize:12,marginBottom:"1rem"}} onClick={()=>setAnticuerpos([...anticuerpos,""])}>+ Agregar anticuerpo</button>

          <div>
            <label style={S.label}>Notas clínicas</label>
            <textarea style={{...S.inputNormal,height:50,resize:"vertical"}} value={form.notas} onChange={e=>setForm({...form,notas:e.target.value})} />
          </div>
          <div style={{...S.flex(),justifyContent:"flex-end",marginTop:"1.25rem"}}>
            <button style={S.btn("ghost")} onClick={()=>setModal(null)}>Cancelar</button>
            <button style={S.btn()} onClick={save} disabled={loading}>{loading?"Guardando...":"Guardar paciente"}</button>
          </div>
        </Modal>
      )}

      {modal==="detail"&&selected&&(
        <Modal title={`Tipificación — ${selected.nombre}`} onClose={()=>setModal(null)} wide>
          <div style={S.grid2}>
            <div style={S.stat}><p style={{...S.statNum,fontSize:20}}>{selected.tipo_sangre}</p><p style={S.statLabel}>Grupo ABO/Rh</p></div>
            <div style={S.stat}><p style={{...S.statNum,fontSize:20,color:selected.estatus==="Activo"?"#185FA5":"#0F6E56"}}>{selected.estatus}</p><p style={S.statLabel}>Estatus</p></div>
          </div>
          <div style={{ marginTop:"1rem" }}>
            <HlaTypingBlock hla={selHla} pra={selected.pra} anticuerpos={patAnticuerpos} />
          </div>
          {selected.notas&&<div style={{marginTop:"1rem"}}><h3 style={{fontSize:13,fontWeight:500,color:"var(--color-text-secondary)",margin:"0 0 4px"}}>Notas</h3><p style={{fontSize:13,margin:0}}>{selected.notas}</p></div>}
          <div style={{...S.flex(),justifyContent:"flex-end",marginTop:"1.5rem",gap:8}}>
            {selected.estatus==="Activo"&&<button style={S.btn("success")} onClick={()=>updateEstatus(selected.id,"Trasplantado")}>Marcar como trasplantado</button>}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Donadores ─────────────────────────────────────────────────────────────────
function DonadoresPage({ donadores, pacientes, refresh }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ nombre:"", tipo_sangre:"O+", id_paciente_asociado:"", es_altruista:false, notas:"" });
  const [hla, setHla] = useState({ hla_a1:"", hla_a2:"", hla_b1:"", hla_b2:"", hla_dr1:"", hla_dr2:"" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selected, setSelected] = useState(null);
  const [selHla, setSelHla] = useState(null);

  const openAdd = () => {
    setForm({ nombre:"", tipo_sangre:"O+", id_paciente_asociado:"", es_altruista:false, notas:"" });
    setHla({ hla_a1:"", hla_a2:"", hla_b1:"", hla_b2:"", hla_dr1:"", hla_dr2:"" });
    setError(""); setModal("add");
  };

  const openDetail = async d => {
    setSelected(d);
    const hlaRows = await api.get("tipaje_hla", `id_persona=eq.${d.id}&tipo_persona=eq.Donador`);
    setSelHla(hlaRows[0]||null);
    setModal("detail");
  };

  const save = async () => {
    if (!form.nombre.trim()) return setError("El nombre es requerido.");
    setLoading(true); setError("");
    try {
      const data = { ...form, id_paciente_asociado: form.id_paciente_asociado||null, estatus:"Disponible" };
      const [newDon] = await api.post("donadores", data);
      await api.post("tipaje_hla", { id_persona:newDon.id, tipo_persona:"Donador", ...hla });
      await refresh(); setModal(null);
    } catch(e) { setError(e.message); }
    setLoading(false);
  };

  const deleteDonador = async id => {
    await api.deleteWhere("intercambios", `id_donador=eq.${id}`).catch(()=>{});
    await api.deleteWhere("tipaje_hla", `id_persona=eq.${id}`).catch(()=>{});
    await api.delete("donadores", id);
    await refresh(); setDeleteTarget(null);
  };

  const getPaciente = id => pacientes.find(p=>p.id===id);

  return (
    <div>
      <div style={{...S.spaceBetween,marginBottom:"1.5rem"}}>
        <h1 style={{...S.pageTitle,margin:0}}>Donadores</h1>
        <button style={S.btn()} onClick={openAdd}>+ Nuevo donador</button>
      </div>
      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>{["Nombre","Tipo sangre","Paciente asociado","Tipo","Estatus","Acciones"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {donadores.map(d=>{
              const pac=getPaciente(d.id_paciente_asociado);
              return (
                <tr key={d.id}>
                  <td style={S.td}>{d.nombre}</td>
                  <td style={S.td}><span style={S.badge("gray")}>{d.tipo_sangre}</span></td>
                  <td style={S.td}>{pac?pac.nombre:<span style={{color:"var(--color-text-secondary)",fontSize:12}}>—</span>}</td>
                  <td style={S.td}><span style={S.badge(d.es_altruista?"amber":"blue")}>{d.es_altruista?"Altruista":"Dirigido"}</span></td>
                  <td style={S.td}><span style={S.badge(d.estatus==="Disponible"?"green":d.estatus==="Donó"?"gray":"red")}>{d.estatus}</span></td>
                  <td style={S.td}>
                    <div style={S.flex()}>
                      <button style={{...S.btn("ghost"),padding:"4px 10px",fontSize:12}} onClick={()=>openDetail(d)}>Ver tipaje</button>
                      <button style={{...S.btn("danger"),padding:"4px 10px",fontSize:12}} onClick={()=>setDeleteTarget(d)}>Borrar</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {donadores.length===0&&<p style={{textAlign:"center",color:"var(--color-text-secondary)",padding:"2rem 0",fontSize:13}}>No hay donadores registrados.</p>}
      </div>

      {deleteTarget&&<ConfirmDeleteModal nombre={deleteTarget.nombre} onConfirm={()=>deleteDonador(deleteTarget.id)} onClose={()=>setDeleteTarget(null)}/>}

      {modal==="detail"&&selected&&(
        <Modal title={`Tipificación — ${selected.nombre}`} onClose={()=>setModal(null)} wide>
          <div style={S.grid2}>
            <div style={S.stat}><p style={{...S.statNum,fontSize:20}}>{selected.tipo_sangre}</p><p style={S.statLabel}>Grupo ABO/Rh</p></div>
            <div style={S.stat}><p style={{...S.statNum,fontSize:20,color:"#0F6E56"}}>{selected.estatus}</p><p style={S.statLabel}>Estatus</p></div>
          </div>
          <div style={{marginTop:"1rem"}}><HlaTypingBlock hla={selHla} pra={null} anticuerpos={[]} /></div>
        </Modal>
      )}

      {modal==="add"&&(
        <Modal title="Registrar nuevo donador" onClose={()=>setModal(null)} wide>
          {error&&<div style={S.alert("error")}>{error}</div>}
          <div style={S.grid2}>
            <div>
              <label style={S.label}>Nombre completo</label>
              <input style={S.inputNormal} value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} />
            </div>
            <div>
              <label style={S.label}>Tipo de sangre</label>
              <select style={S.select} value={form.tipo_sangre} onChange={e=>setForm({...form,tipo_sangre:e.target.value})}>
                {BLOOD_TYPES.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={{gridColumn:"span 2"}}>
              <label style={S.label}>Paciente al que quería donar (si aplica)</label>
              <select style={S.select} value={form.id_paciente_asociado} onChange={e=>setForm({...form,id_paciente_asociado:e.target.value})}>
                <option value="">-- Donador altruista --</option>
                {pacientes.filter(p=>p.estatus==="Activo").map(p=><option key={p.id} value={p.id}>{p.nombre} ({p.tipo_sangre})</option>)}
              </select>
            </div>
            <div style={{gridColumn:"span 2"}}>
              <label style={{...S.flex(),cursor:"pointer",fontSize:13}}>
                <input type="checkbox" checked={form.es_altruista} onChange={e=>setForm({...form,es_altruista:e.target.checked,id_paciente_asociado:""})} style={{marginRight:6}} />
                Es donador altruista (sin paciente asignado)
              </label>
            </div>
          </div>
          <HlaFormSection hla={hla} setHla={setHla} pra={null} setPra={null} label="Tipificación HLA del donador" />
          <div style={{marginTop:"0.75rem"}}>
            <label style={S.label}>Notas</label>
            <textarea style={{...S.inputNormal,height:50,resize:"vertical"}} value={form.notas} onChange={e=>setForm({...form,notas:e.target.value})} />
          </div>
          <div style={{...S.flex(),justifyContent:"flex-end",marginTop:"1.25rem"}}>
            <button style={S.btn("ghost")} onClick={()=>setModal(null)}>Cancelar</button>
            <button style={S.btn()} onClick={save} disabled={loading}>{loading?"Guardando...":"Guardar donador"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Detalle de compatibilidad HLA entre donador y receptor ───────────────────
function HlaCompatDetail({ result, donorName, patientName }) {
  if (!result) return null;
  if (result.crossmatch.length > 0) {
    return (
      <div style={{ background:"#FCEBEB", borderRadius:8, padding:"10px 12px", marginTop:8 }}>
        <div style={{ fontSize:12, fontWeight:600, color:"#791F1F", marginBottom:4 }}>🚫 CROSSMATCH POSITIVO — Incompatible</div>
        <div style={{ fontSize:12, color:"#791F1F" }}>Anticuerpos del receptor reaccionan con: <strong>{result.crossmatch.join(", ")}</strong></div>
      </div>
    );
  }
  return (
    <div style={{ background:"#F0FAF5", borderRadius:8, padding:"10px 12px", marginTop:8, border:"0.5px solid #9FE1CB" }}>
      <div style={{ fontSize:12, fontWeight:600, color:"#0F6E56", marginBottom:8 }}>✓ Crossmatch negativo — Compatible ABO y HLA</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
        {result.detalle.map(l => (
          <div key={l.label} style={{ background:"#fff", borderRadius:6, padding:"6px 8px", border:"0.5px solid #C6EAD9" }}>
            <div style={{ fontSize:10, fontWeight:600, color:"#185FA5", marginBottom:2 }}>{l.label}</div>
            <div style={{ fontSize:11, fontFamily:"monospace" }}>
              <span style={{ color:"#555" }}>Donador: </span>{l.don.join(", ")||"—"}
            </div>
            <div style={{ fontSize:11, fontFamily:"monospace" }}>
              <span style={{ color:"#555" }}>Receptor: </span>{l.pat.join(", ")||"—"}
            </div>
            {l.matches.length>0&&(
              <div style={{ fontSize:10, marginTop:2 }}>
                <span style={{ color:"#0F6E56", fontWeight:600 }}>✓ Coincide: {l.matches.join(", ")}</span>
              </div>
            )}
            {l.matches.length===0&&l.don.length>0&&l.pat.length>0&&(
              <div style={{ fontSize:10, marginTop:2, color:"#B87333" }}>Sin coincidencia en este locus</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Búsqueda de Cruces ────────────────────────────────────────────────────────
function CrucesPage({ pacientes, donadores, ciclos, refresh }) {
  const [matches, setMatches] = useState([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const buscarCruces = async () => {
    setSearching(true); setMsg(null);
    try {
      const hlaAll = await api.get("tipaje_hla","select=*");
      const anticAll = await api.get("anticuerpos_paciente","select=*");
      const pacActivos = pacientes.filter(p=>p.estatus==="Activo");
      const donDisp = donadores.filter(d=>d.estatus==="Disponible"&&d.id_paciente_asociado);
      const results = [];

      for (let i=0;i<donDisp.length;i++) {
        for (let j=i+1;j<donDisp.length;j++) {
          const dA=donDisp[i], dB=donDisp[j];
          const pA=pacientes.find(p=>p.id===dA.id_paciente_asociado);
          const pB=pacientes.find(p=>p.id===dB.id_paciente_asociado);
          if (!pA||!pB||pA.id===pB.id) continue;
          if (!aboCompat(dB.tipo_sangre,pA.tipo_sangre)) continue;
          if (!aboCompat(dA.tipo_sangre,pB.tipo_sangre)) continue;
          const dBHla=hlaAll.find(h=>h.id_persona===dB.id&&h.tipo_persona==="Donador");
          const pAHla=hlaAll.find(h=>h.id_persona===pA.id&&h.tipo_persona==="Paciente");
          const pAAntc=anticAll.filter(a=>a.id_paciente===pA.id);
          const dAHla=hlaAll.find(h=>h.id_persona===dA.id&&h.tipo_persona==="Donador");
          const pBHla=hlaAll.find(h=>h.id_persona===pB.id&&h.tipo_persona==="Paciente");
          const pBAntc=anticAll.filter(a=>a.id_paciente===pB.id);
          const r1=calcHlaCompat(dBHla,pAHla,pAAntc);
          const r2=calcHlaCompat(dAHla,pBHla,pBAntc);
          if (!r1||r1.pct===null||!r2||r2.pct===null) continue;
          results.push({ tipo:"Pareado", intercambios:[
            { donador:dB, receptor:pA, compat:r1.pct, compatDetail:r1 },
            { donador:dA, receptor:pB, compat:r2.pct, compatDetail:r2 },
          ]});
        }
      }

      const altruistas=donadores.filter(d=>d.estatus==="Disponible"&&d.es_altruista);
      for (const alt of altruistas) {
        for (const pac of pacActivos) {
          const altHla=hlaAll.find(h=>h.id_persona===alt.id&&h.tipo_persona==="Donador");
          const pacHla=hlaAll.find(h=>h.id_persona===pac.id&&h.tipo_persona==="Paciente");
          const pacAntc=anticAll.filter(a=>a.id_paciente===pac.id);
          if (!aboCompat(alt.tipo_sangre,pac.tipo_sangre)) continue;
          const r1=calcHlaCompat(altHla,pacHla,pacAntc);
          if (!r1||r1.pct===null) continue;
          const donPac=donadores.find(d=>d.id_paciente_asociado===pac.id&&d.estatus==="Disponible");
          if (!donPac) continue;
          for (const pac2 of pacActivos) {
            if (pac2.id===pac.id) continue;
            const dpHla=hlaAll.find(h=>h.id_persona===donPac.id&&h.tipo_persona==="Donador");
            const pac2Hla=hlaAll.find(h=>h.id_persona===pac2.id&&h.tipo_persona==="Paciente");
            const pac2Antc=anticAll.filter(a=>a.id_paciente===pac2.id);
            if (!aboCompat(donPac.tipo_sangre,pac2.tipo_sangre)) continue;
            const r2=calcHlaCompat(dpHla,pac2Hla,pac2Antc);
            if (!r2||r2.pct===null) continue;
            results.push({ tipo:"Cadena", intercambios:[
              { donador:alt, receptor:pac, compat:r1.pct, compatDetail:r1 },
              { donador:donPac, receptor:pac2, compat:r2.pct, compatDetail:r2 },
            ]});
          }
        }
      }

      setMatches(results.slice(0,20));
      if (results.length===0) setMsg({ type:"info", text:"No se encontraron combinaciones compatibles." });
    } catch(e) { setMsg({ type:"error", text:e.message }); }
    setSearching(false);
  };

  const aprobar = async match => {
    setSaving(true);
    try {
      const [ciclo]=await api.post("ciclos_intercambio",{ tipo:match.tipo, estatus:"Aprobado", aprobado_at:new Date().toISOString() });
      for (let i=0;i<match.intercambios.length;i++) {
        const {donador,receptor,compat}=match.intercambios[i];
        await api.post("intercambios",{ id_ciclo:ciclo.id, id_donador:donador.id, id_paciente_receptor:receptor.id, compatibilidad_hla_pct:compat, orden:i+1 });
        if (donador.id_paciente_asociado!==receptor.id) await api.patch("donadores",donador.id,{ id_paciente_asociado:receptor.id });
      }
      await refresh();
      setMsg({ type:"success", text:"Ciclo aprobado correctamente." });
      setMatches([]);
    } catch(e) { setMsg({ type:"error", text:e.message }); }
    setSaving(false);
  };

  return (
    <div>
      <h1 style={S.pageTitle}>Búsqueda de cruces</h1>
      <div style={{...S.card,textAlign:"center",padding:"2rem"}}>
        <p style={{fontSize:14,color:"var(--color-text-secondary)",marginBottom:"1.25rem"}}>
          Analiza todos los pacientes y donadores activos. Verifica ABO, crossmatch virtual y compatibilidad HLA locus por locus.
        </p>
        <button style={{...S.btn("success"),fontSize:15,padding:"12px 28px"}} onClick={buscarCruces} disabled={searching}>
          {searching?"⏳ Analizando...":"🔍 Buscar combinaciones de intercambio"}
        </button>
      </div>
      {msg&&<div style={S.alert(msg.type)}>{msg.text}</div>}
      {matches.length>0&&(
        <div>
          <h2 style={{fontSize:16,fontWeight:500,marginBottom:"1rem"}}>{matches.length} combinación(es) compatible(s)</h2>
          {matches.map((m,idx)=>(
            <div key={idx} style={S.matchCard}>
              <div style={{...S.spaceBetween,marginBottom:"1rem"}}>
                <div style={S.flex()}>
                  <span style={{fontSize:16}}>{m.tipo==="Cadena"?"🔗":"🔄"}</span>
                  <strong style={{fontSize:14}}>{m.tipo==="Cadena"?"Cadena de trasplante":"Intercambio pareado"} — {m.intercambios.length} pares</strong>
                </div>
                <button style={S.btn("success")} onClick={()=>aprobar(m)} disabled={saving}>✓ Aprobar</button>
              </div>
              {m.intercambios.map((ix,j)=>(
                <div key={j} style={{paddingTop:j===0?0:12,marginTop:j===0?0:12,borderTop:j===0?"none":"0.5px solid #9FE1CB"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{flex:1,background:"#E6F1FB",borderRadius:8,padding:"8px 12px"}}>
                      <div style={{fontSize:11,color:"#0C447C",fontWeight:500}}>DONADOR</div>
                      <div style={{fontSize:13,fontWeight:500,color:"#185FA5"}}>{ix.donador.nombre}</div>
                      <span style={S.badge("blue")}>{ix.donador.tipo_sangre}</span>
                    </div>
                    <div style={{fontSize:22,color:"#1D9E75"}}>➡</div>
                    <div style={{flex:1,background:"#E1F5EE",borderRadius:8,padding:"8px 12px"}}>
                      <div style={{fontSize:11,color:"#085041",fontWeight:500}}>RECEPTOR</div>
                      <div style={{fontSize:13,fontWeight:500,color:"#0F6E56"}}>{ix.receptor.nombre}</div>
                      <span style={S.badge("green")}>{ix.receptor.tipo_sangre}</span>
                    </div>
                    <div style={{textAlign:"center",minWidth:70}}>
                      <div style={{fontSize:20,fontWeight:500,color:ix.compat>=70?"#0F6E56":ix.compat>=40?"#854F0B":"#A32D2D"}}>{ix.compat}%</div>
                      <div style={{fontSize:11,color:"var(--color-text-secondary)"}}>HLA</div>
                    </div>
                  </div>
                  <HlaCompatDetail result={ix.compatDetail} donorName={ix.donador.nombre} patientName={ix.receptor.nombre} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Historial ─────────────────────────────────────────────────────────────────
function HistorialPage({ ciclos, pacientes, donadores, refresh }) {
  const [detalle, setDetalle] = useState(null);
  const [intercambios, setIntercambios] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const verDetalle = async ciclo => {
    setDetalle(ciclo);
    const ixs = await api.get("intercambios",`id_ciclo=eq.${ciclo.id}&select=*`);
    setIntercambios(ixs);
  };

  const getPaciente = id => pacientes.find(p=>p.id===id);
  const getDonador = id => donadores.find(d=>d.id===id);

  const updateEstatus = async (id, estatus) => {
    await api.patch("ciclos_intercambio",id,{estatus});
    if (estatus==="Completado") {
      for (const ix of intercambios) {
        await api.patch("pacientes",ix.id_paciente_receptor,{estatus:"Trasplantado"});
        await api.patch("donadores",ix.id_donador,{estatus:"Donó"});
      }
    }
    await refresh(); setDetalle(null);
  };

  const deleteCiclo = async id => {
    await api.deleteWhere("intercambios",`id_ciclo=eq.${id}`).catch(()=>{});
    await api.delete("ciclos_intercambio",id);
    await refresh(); setDeleteTarget(null); setDetalle(null);
  };

  return (
    <div>
      <h1 style={S.pageTitle}>Historial de ciclos</h1>
      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>{["Tipo","Estatus","Fecha","Acciones"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {ciclos.map(c=>(
              <tr key={c.id}>
                <td style={S.td}>{c.tipo==="Cadena"?"🔗 Cadena":"🔄 Pareado"}</td>
                <td style={S.td}><span style={S.badge(c.estatus==="Aprobado"?"green":c.estatus==="Completado"?"blue":c.estatus==="Rechazado"?"red":"amber")}>{c.estatus}</span></td>
                <td style={S.td}>{new Date(c.created_at).toLocaleDateString("es-MX")}</td>
                <td style={S.td}>
                  <div style={S.flex()}>
                    <button style={{...S.btn("ghost"),fontSize:12,padding:"4px 10px"}} onClick={()=>verDetalle(c)}>Ver detalle</button>
                    <button style={{...S.btn("danger"),fontSize:12,padding:"4px 10px"}} onClick={()=>setDeleteTarget(c)}>Borrar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {ciclos.length===0&&<p style={{textAlign:"center",color:"var(--color-text-secondary)",padding:"2rem",fontSize:13}}>No hay ciclos registrados.</p>}
      </div>

      {deleteTarget&&<ConfirmDeleteModal nombre={`ciclo del ${new Date(deleteTarget.created_at).toLocaleDateString("es-MX")}`} onConfirm={()=>deleteCiclo(deleteTarget.id)} onClose={()=>setDeleteTarget(null)}/>}

      {detalle&&(
        <Modal title={`Ciclo ${detalle.tipo} — ${detalle.estatus}`} onClose={()=>setDetalle(null)} wide>
          {intercambios.map(ix=>{
            const pac=getPaciente(ix.id_paciente_receptor), don=getDonador(ix.id_donador);
            return (
              <div key={ix.id} style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                <div style={{flex:1,background:"#E6F1FB",borderRadius:8,padding:"8px 12px"}}>
                  <div style={{fontSize:11,color:"#0C447C",fontWeight:500}}>DONADOR</div>
                  <div style={{fontSize:13,fontWeight:500}}>{don?.nombre||"—"}</div>
                  <span style={S.badge("blue")}>{don?.tipo_sangre}</span>
                </div>
                <div style={{fontSize:20,color:"#1D9E75"}}>➡</div>
                <div style={{flex:1,background:"#E1F5EE",borderRadius:8,padding:"8px 12px"}}>
                  <div style={{fontSize:11,color:"#085041",fontWeight:500}}>RECEPTOR</div>
                  <div style={{fontSize:13,fontWeight:500}}>{pac?.nombre||"—"}</div>
                  <span style={S.badge("green")}>{pac?.tipo_sangre}</span>
                </div>
                <div style={{textAlign:"center",minWidth:60}}>
                  <div style={{fontSize:18,fontWeight:500,color:"#185FA5"}}>{ix.compatibilidad_hla_pct}%</div>
                  <div style={{fontSize:11,color:"var(--color-text-secondary)"}}>HLA</div>
                </div>
              </div>
            );
          })}
          {detalle.estatus==="Aprobado"&&(
            <div style={{...S.flex(),justifyContent:"flex-end",marginTop:"1rem",gap:8}}>
              <button style={S.btn("danger")} onClick={()=>updateEstatus(detalle.id,"Rechazado")}>Rechazar</button>
              <button style={S.btn("success")} onClick={()=>updateEstatus(detalle.id,"Completado")}>Marcar como completado</button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ── App Root ──────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("dashboard");
  const [pacientes, setPacientes] = useState([]);
  const [donadores, setDonadores] = useState([]);
  const [ciclos, setCiclos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAll = useCallback(async () => {
    try {
      const [p,d,c] = await Promise.all([
        api.get("pacientes","order=created_at.desc"),
        api.get("donadores","order=created_at.desc"),
        api.get("ciclos_intercambio","order=created_at.desc"),
      ]);
      setPacientes(p); setDonadores(d); setCiclos(c);
    } catch(e) { setError("No se pudo conectar con Supabase. Verifica tus credenciales en app.jsx"); }
    setLoading(false);
  }, []);

  useEffect(()=>{ loadAll(); },[loadAll]);

  const nav = [
    { id:"dashboard", label:"Panel principal", icon:"ti-home" },
    { id:"pacientes", label:"Pacientes", icon:"ti-user" },
    { id:"donadores", label:"Donadores", icon:"ti-heart" },
    { id:"cruces", label:"Buscar cruces", icon:"ti-refresh" },
    { id:"historial", label:"Historial", icon:"ti-calendar" },
  ];

  return (
    <div style={S.app}>
      <nav style={S.sidebar}>
        <div style={S.logo}>
          <p style={S.logoTitle}>🫀 Donación Cruzada</p>
          <p style={S.logoSub}>Sistema de trasplante renal</p>
        </div>
        {nav.map(n=>(
          <div key={n.id} style={S.navItem(page===n.id)} onClick={()=>setPage(n.id)}>
            <i className={`ti ${n.icon}`} style={{fontSize:16}} aria-hidden="true"/>
            {n.label}
          </div>
        ))}
        <div style={{flex:1}}/>
        <div style={{padding:"0.75rem 1.25rem"}}>
          <p style={{fontSize:11,color:"var(--color-text-secondary)",margin:0}}>
            {pacientes.filter(p=>p.estatus==="Activo").length} pacientes activos<br/>
            {donadores.filter(d=>d.estatus==="Disponible").length} donadores disponibles
          </p>
        </div>
      </nav>
      <main style={S.main}>
        {loading?(
          <div style={{textAlign:"center",padding:"4rem",color:"var(--color-text-secondary)"}}>Cargando datos...</div>
        ):error?(
          <div style={{...S.alert("error"),maxWidth:500,margin:"4rem auto"}}><strong>Error de conexión</strong><br/>{error}</div>
        ):(
          <>
            {page==="dashboard"&&<Dashboard pacientes={pacientes} donadores={donadores} ciclos={ciclos}/>}
            {page==="pacientes"&&<PacientesPage pacientes={pacientes} donadores={donadores} refresh={loadAll}/>}
            {page==="donadores"&&<DonadoresPage donadores={donadores} pacientes={pacientes} refresh={loadAll}/>}
            {page==="cruces"&&<CrucesPage pacientes={pacientes} donadores={donadores} ciclos={ciclos} refresh={loadAll}/>}
            {page==="historial"&&<HistorialPage ciclos={ciclos} pacientes={pacientes} donadores={donadores} refresh={loadAll}/>}
          </>
        )}
      </main>
    </div>
  );
}
