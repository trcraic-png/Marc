function renderMemory(){
  const p=state.project, c=calculations(p), q=quantities(p);
  const assumptions=p.assumed.length?p.assumed.map(k=>`<li>${schema.find(x=>x[0]===k)?.[1]||k}: valor asumido ${p[k]}</li>`).join(""):"<li>No hay supuestos detectados por el parser.</li>";
  const qaCheck=c.q<=p.qa;
  $("#memoryDoc").innerHTML=`
  <div class="memorySection"><span class="kicker">CIM65 CAD IA · MEMORIA PRELIMINAR</span><h2>${p.title}</h2><p>Generada a partir de la instrucción: “${escapeHtml(p.prompt||$("#prompt").value)}”. Esta memoria sirve para trazabilidad y predimensionamiento; no sustituye el análisis, revisión normativa ni firma profesional requerida.</p></div>
  <div class="memorySection"><h3>1. Datos generales</h3><p>Planta: ${fmt(p.width)} × ${fmt(p.length)} m · Altura: ${fmt(p.height)} m · Niveles: ${p.levels} · Tipo: ${p.type.replace("_"," ")}.</p></div>
  <div class="memorySection"><h3>2. Materiales y parámetros</h3><p>Concreto f'c = ${fmt(p.fc)} kg/cm² · Acero fy = ${fmt(p.fy)} kg/cm² · Capacidad portante indicada = ${fmt(p.qa)} t/m².</p></div>
  <div class="memorySection"><h3>3. Hipótesis / supuestos</h3><ul>${assumptions}</ul></div>
  <div class="memorySection"><h3>4. Cargas preliminares</h3>
    <div class="formula">q_serv = (CM + CV) / 1000 = (${fmt(p.deadLoad)} + ${fmt(p.liveLoad)}) / 1000 = ${fmt(c.serviceAreaLoad)} t/m²</div>
    <p>Esta simplificación no incluye peso propio detallado, viento, sismo, cargas puntuales, equipos, temperatura ni combinaciones reglamentarias.</p>
  </div>
  <div class="memorySection"><h3>5. Área tributaria y carga axial demo</h3>
    <div class="formula">A_tr = Δx × Δy = ${fmt(c.ax.dx)} × ${fmt(c.ax.dy)} = ${fmt(c.tributary)} m²
P_serv ≈ A_tr × q_serv × niveles = ${fmt(c.tributary)} × ${fmt(c.serviceAreaLoad)} × ${p.levels} = ${fmt(c.columnLoad)} t</div>
  </div>
  <div class="memorySection"><h3>6. Verificación preliminar de zapata</h3>
    <div class="formula">A_z = ${fmt(p.footingW)} × ${fmt(p.footingL)} = ${fmt(c.footingArea)} m²
q_suelo = P_serv / A_z = ${fmt(c.columnLoad)} / ${fmt(c.footingArea)} = ${fmt(c.q)} t/m²
Utilización = q_suelo / q_adm = ${fmt(c.q)} / ${fmt(p.qa)} = ${fmt(c.util*100)} %</div>
    <p><strong>Resultado demo:</strong> ${qaCheck?"La presión simplificada no excede la capacidad indicada.":"La presión simplificada EXCEDE la capacidad indicada."} Aún deben revisarse excentricidad, peso de cimentación/rellenos, cortante, punzonamiento, flexión, asentamientos y geotecnia.</p>
  </div>
  <div class="memorySection"><h3>7. Viga simplemente apoyada · referencia</h3>
    <div class="formula">w = (CM + CV) × ancho tributario = (${fmt(p.deadLoad)} + ${fmt(p.liveLoad)}) × ${fmt(c.ax.dy)} = ${fmt(c.wkgm)} kg/m
M_max = wL²/8 = ${fmt(c.wkgm)} × ${fmt(c.ax.dx)}² / 8 = ${fmt(c.M)} kg·m</div>
    <p>No se dimensiona acero/perfil en este MVP porque faltan combinaciones, sistema resistente, continuidad, propiedades de sección y norma seleccionada.</p>
  </div>
  <div class="memorySection"><h3>8. Cuantificación geométrica</h3><ul>${q.map(x=>`<li>${x.name}: ${fmt(x.value)} ${x.unit}</li>`).join("")}</ul></div>
  <div class="memorySection"><h3>9. Observaciones</h3><ul><li>Validar estudio de mecánica de suelos.</li><li>Definir reglamento y combinaciones de carga aplicables.</li><li>Agregar sismo, viento, equipos y condiciones reales de apoyo.</li><li>El modelo CAD generado por reglas debe revisarse antes de emitir planos IFC.</li></ul></div>`;
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function draw(){
  const cv=$("#viewer"),ctx=cv.getContext("2d"),p=state.project;
  const W=cv.width,H=cv.height;ctx.clearRect(0,0,W,H);
  ctx.save();ctx.translate(W/2,H/2);
  if(state.viewMode==="2d") draw2d(ctx,p,W,H); else draw3d(ctx,p,W,H);
  ctx.restore();$("#viewerInfo").textContent=`${fmt(p.width)} × ${fmt(p.length)} m · ${state.viewMode.toUpperCase()}`;
}
function draw2d(ctx,p,W,H){
  const m=70,s=Math.min((W-2*m)/p.width,(H-2*m)/p.length);
  const ox=-p.width*s/2,oy=-p.length*s/2;
  if(state.layers.grid){
    ctx.strokeStyle="rgba(62,152,196,.25)";ctx.lineWidth=1;
    for(let x=0;x<=p.width;x++){ctx.beginPath();ctx.moveTo(ox+x*s,oy);ctx.lineTo(ox+x*s,oy+p.length*s);ctx.stroke()}
    for(let y=0;y<=p.length;y++){ctx.beginPath();ctx.moveTo(ox,oy+y*s);ctx.lineTo(ox+p.width*s,oy+y*s);ctx.stroke()}
  }
  ctx.strokeStyle="#63d9ff";ctx.lineWidth=2;ctx.strokeRect(ox,oy,p.width*s,p.length*s);
  const a=axes(p);
  for(let i=0;i<a.nx;i++)for(let j=0;j<a.ny;j++){
    const x=ox+i*a.dx*s,y=oy+j*a.dy*s;
    if(state.layers.footings){ctx.fillStyle="rgba(229,72,77,.22)";ctx.strokeStyle="#d95358";const fw=p.footingW*s,fl=p.footingL*s;ctx.fillRect(x-fw/2,y-fl/2,fw,fl);ctx.strokeRect(x-fw/2,y-fl/2,fw,fl)}
    if(state.layers.columns){ctx.fillStyle="#dfe8ef";ctx.fillRect(x-3,y-3,6,6)}
  }
  ctx.fillStyle="#7c9aab";ctx.font="14px ui-monospace,monospace";ctx.fillText(`${p.width} m`,ox+p.width*s/2-20,oy-18);ctx.save();ctx.rotate(-Math.PI/2);ctx.fillText(`${p.length} m`,-(oy+p.length*s/2)-20,ox-18);ctx.restore();
}
function iso(x,y,z){return {x:(x-y)*.85,y:(x+y)*.42-z};}
function draw3d(ctx,p,W,H){
  const scale=Math.min(15,330/Math.max(p.width,p.length)),a=axes(p);
  ctx.translate(0,85);
  const pt=(x,y,h=0)=>{const o=iso(x*scale,y*scale,h*scale);return {x:o.x,y:o.y}};
  if(state.layers.roof){
    const pts=[pt(0,0,p.height),pt(p.width,0,p.height),pt(p.width,p.length,p.height),pt(0,p.length,p.height)];
    ctx.fillStyle="rgba(71,215,255,.10)";ctx.strokeStyle="#4fbfdf";ctx.beginPath();pts.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.closePath();ctx.fill();ctx.stroke();
  }
  for(let i=0;i<a.nx;i++)for(let j=0;j<a.ny;j++){
    const x=i*a.dx,y=j*a.dy,b=pt(x,y,0),t=pt(x,y,p.height);
    if(state.layers.columns){ctx.strokeStyle="#e1e8ee";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(t.x,t.y);ctx.stroke()}
    if(state.layers.footings){const f=pt(x,y,0);ctx.fillStyle="rgba(229,72,77,.45)";ctx.fillRect(f.x-5,f.y-3,10,6)}
  }
  if(state.layers.grid){
    ctx.strokeStyle="rgba(80,120,145,.28)";ctx.lineWidth=1;
    for(let i=0;i<a.nx;i++){let p1=pt(i*a.dx,0,0),p2=pt(i*a.dx,p.length,0);ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke()}
    for(let j=0;j<a.ny;j++){let p1=pt(0,j*a.dy,0),p2=pt(p.width,j*a.dy,0);ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke()}
  }
}
function runPipeline(){
  $$("#pipeline li").forEach(x=>x.className="");
  const steps=["interpret","validate","calculate","model","review","export"], labels=["Interpretando instrucción","Validando parámetros","Calculando geometría","Generando modelo CAD","Preparando revisión","Exportaciones listas"];
  steps.forEach((s,i)=>setTimeout(()=>{
    $$("#pipeline li").forEach((li,j)=>{li.classList.toggle("done",j<i);li.classList.toggle("active",j===i)});
    $("#jobStatus").textContent=labels[i]+"…";
    if(i===steps.length-1){setTimeout(()=>{$$("#pipeline li").forEach(li=>{li.classList.remove("active");li.classList.add("done")});$("#jobStatus").textContent="Modelo demo y memoria preliminar generados.";},280)}
  },i*240));
}
function applyProject(p){state.project=p;$("#projectTitle").textContent=p.title;renderParams();renderQuantities();renderMemory();draw();saveVersion(false);}
function saveVersion(show=true){
  const list=JSON.parse(localStorage.getItem("cim65_versions")||"[]");
  list.unshift({id:Date.now(),date:new Date().toISOString(),project:state.project,prompt:state.project.prompt||$("#prompt").value});
  localStorage.setItem("cim65_versions",JSON.stringify(list.slice(0,30)));renderHistory();if(show)toast("Versión guardada.");
}
function renderHistory(){
  const list=JSON.parse(localStorage.getItem("cim65_versions")||"[]");
  $("#history").innerHTML=list.length?list.map((v,i)=>`<div class="historyItem"><div><strong>V${list.length-i} · ${escapeHtml(v.project.title)}</strong><p>${escapeHtml(v.prompt||"Sin instrucción")}</p><small>${new Date(v.date).toLocaleString("es-MX")}</small></div><button class="ghost restore" data-id="${v.id}">Restaurar</button></div>`).join(""):`<p>No hay versiones guardadas.</p>`;
  $$(".restore").forEach(b=>b.onclick=()=>{const v=list.find(x=>String(x.id)===b.dataset.id);if(v){state.project=v.project;$("#prompt").value=v.prompt;$("#projectTitle").textContent=v.project.title;renderAll();showView("workspace");toast("Versión restaurada.")}});
}
function renderAll(){renderParams();renderQuantities();renderMemory();draw();renderHistory()}
function download(name,content,type="text/plain"){
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function dxf(){
  const p=state.project,a=axes(p),lines=[];const add=(x1,y1,x2,y2,layer="CIM65")=>lines.push(`0\nLINE\n8\n${layer}\n10\n${x1}\n20\n${y1}\n30\n0\n11\n${x2}\n21\n${y2}\n31\n0`);
  add(0,0,p.width,0,"CONTORNO");add(p.width,0,p.width,p.length,"CONTORNO");add(p.width,p.length,0,p.length,"CONTORNO");add(0,p.length,0,0,"CONTORNO");
  for(let i=0;i<a.nx;i++)add(i*a.dx,0,i*a.dx,p.length,"EJES");
  for(let j=0;j<a.ny;j++)add(0,j*a.dy,p.width,j*a.dy,"EJES");
  return `0\nSECTION\n2\nENTITIES\n${lines.join("\n")}\n0\nENDSEC\n0\nEOF\n`;
}
function scr(){
  const p=state.project,a=axes(p),out=["_.-LAYER","_M","CIM65_CONTORNO","","_.RECTANG","0,0",`${p.width},${p.length}`];
  out.push("_.-LAYER","_M","CIM65_EJES","");
  for(let i=0;i<a.nx;i++)out.push("_.LINE",`${fmt(i*a.dx)},0`,`${fmt(i*a.dx)},${p.length}`,"");
  for(let j=0;j<a.ny;j++)out.push("_.LINE",`0,${fmt(j*a.dy)}`,`${p.width},${fmt(j*a.dy)}`,"");
  out.push("_.ZOOM","_E");
  return out.join("\n")+"\n";
}
const CAD_BACKEND_URL="https://hyreskelwwyezbzdovnq.supabase.co/functions/v1/cim65-cad-aps";
const CAD_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5cmVza2Vsd3d5ZXpiemRvdm5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNzM1MDksImV4cCI6MjEwNDg0OTUwOX0.Ne3QFw93-HAJqf3OkBwB9BEsVu4fJa7icxvYnKbtuug";
function cadAccessKey(){
  let key=sessionStorage.getItem("cim65_cad_key")||"";
  if(!key){
    key=(window.prompt("Ingresa la clave de acceso de CIM65 CAD IA")||"").trim().toUpperCase();
    if(key) sessionStorage.setItem("cim65_cad_key",key);
  }
  return key;
}
async function cadApi(action,payload={}){
  const key=cadAccessKey();
  if(!key) throw new Error("Se requiere la clave CAD IA.");
  const r=await fetch(CAD_BACKEND_URL,{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization":"Bearer "+CAD_ANON_KEY,
      "apikey":CAD_ANON_KEY,
      "x-cad-key":key
    },
    body:JSON.stringify({action,...payload})
  });
  const j=await r.json().catch(()=>({ok:false,error:"INVALID_BACKEND_RESPONSE"}));
  if(r.status===403){
    sessionStorage.removeItem("cim65_cad_key");
    throw new Error("Clave CAD IA incorrecta.");
  }
  if(!r.ok||!j.ok){
    if(j.error==="APS_NOT_CONFIGURED") throw new Error("Backend activo. Faltan Client ID y Client Secret de Autodesk APS.");
    if(j.error==="APS_ACTIVITY_NOT_CONFIGURED") throw new Error("Autodesk ya responde, pero falta crear/configurar la Activity de AutoCAD.");
    throw new Error(j.detail||j.error||("Backend "+r.status));
  }
  return j;
}
async function loadAps(){
  $("#apsState").textContent="Backend seguro activo";
  $("#apsEngine").textContent="Autodesk.AutoCAD+26_0";
  $("#apsActivity").textContent="Modo script-first";
  $("#apsBadge").textContent="Backend CAD: conectado";
  $("#apsBadge").className="badge good";
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function apsStatusLabel(s){
  const x=String(s||"").toLowerCase();
  if(x==="pending") return "En cola";
  if(x==="inprogress") return "AutoCAD modelando";
  if(x==="success") return "DWG generado";
  if(x==="failed") return "Falló";
  if(x==="cancelled") return "Cancelado";
  return s||"Procesando";
}
async function testAps(){
  $("#testApsBtn").disabled=true;$("#testApsBtn").textContent="Probando…";
  try{
    const s=await cadApi("status");
    $("#apsEngine").textContent=s.engine||"Autodesk.AutoCAD+26_0";
    $("#apsActivity").textContent=s.activityMode==="script-first"?"Script dinámico → DWG":"Preparada";
    if(!s.apsConfigured){
      $("#apsState").textContent="Backend OK · faltan credenciales Autodesk";
      toast("Backend CAD IA conectado. Falta cargar Client ID y Client Secret de Autodesk APS.");
      return;
    }
    await cadApi("test");
    const boot=await cadApi("bootstrap");
    $("#apsState").textContent="Autodesk APS conectado";
    $("#apsActivity").textContent=boot.activity?.activityId||s.activityId||"Activity lista";
    $("#apsBadge").textContent="Autodesk: conectado";
    $("#apsBadge").className="badge good";
    toast("Autodesk APS, bucket y Activity listos.");
  }catch(e){toast(e.message||String(e))}
  finally{$("#testApsBtn").disabled=false;$("#testApsBtn").textContent="Probar conexión Autodesk"}
}
async function makeDwg(){
  const btn=$("#dwgBtn");
  btn.disabled=true;
  const original=btn.textContent;
  try{
    btn.textContent="Preparando…";
    const s=await cadApi("status");
    if(!s.apsConfigured){
      toast("El backend ya está listo. Falta cargar Client ID y Client Secret de Autodesk APS.");
      return;
    }
    $("#jobStatus").textContent="Preparando Autodesk APS…";
    await cadApi("bootstrap");
    btn.textContent="Enviando…";
    $("#jobStatus").textContent="Enviando modelo a AutoCAD 2027…";
    const job=await cadApi("generate",{project:state.project});
    const id=job.workitem?.id;
    if(!id) throw new Error("Autodesk no devolvió un WorkItem ID.");
    window.lastApsJob=job;
    btn.textContent="AutoCAD…";
    let final=null;
    for(let i=0;i<90;i++){
      await sleep(i===0?1500:4000);
      const r=await cadApi("jobStatus",{id,bucketKey:job.bucketKey,outputKey:job.outputKey});
      const status=String(r.status?.status||"").toLowerCase();
      $("#jobStatus").textContent="Autodesk · "+apsStatusLabel(status)+" · "+id.slice(0,12);
      if(status==="success"){final=r;break}
      if(status==="failed"||status==="cancelled"){
        const report=r.status?.reportUrl?" · reporte disponible":"";
        throw new Error("El WorkItem terminó en estado "+status+report);
      }
    }
    if(!final) throw new Error("El WorkItem sigue procesándose. Puedes volver a pulsar DWG para revisar/generar otro.");
    if(!final.downloadUrl) throw new Error("DWG generado, pero no se pudo crear el enlace de descarga.");
    btn.textContent="Descargando…";
    const a=document.createElement("a");
    a.href=final.downloadUrl;
    a.download=job.outputKey||"CIM65_modelo.dwg";
    a.rel="noopener";
    document.body.appendChild(a);a.click();a.remove();
    $("#jobStatus").textContent="DWG real generado por AutoCAD 2027.";
    toast("DWG real generado. Se inició la descarga.");
  }catch(e){
    $("#jobStatus").textContent="Autodesk: "+(e.message||String(e));
    toast(e.message||String(e));
  }finally{
    btn.disabled=false;btn.textContent=original;
  }
}
function showView(id){$$(".view").forEach(v=>v.classList.toggle("active",v.id===id));$$(".navBtn").forEach(b=>b.classList.toggle("active",b.dataset.view===id))}
$$(".navBtn").forEach(b=>b.onclick=()=>showView(b.dataset.view));
$$("[data-prompt]").forEach(b=>b.onclick=()=>{$("#prompt").value=b.dataset.prompt});
$("#runBtn").onclick=()=>{runPipeline();const p=parsePrompt($("#prompt").value);setTimeout(()=>applyProject(p),520)};
$("#applyParamsBtn").onclick=()=>{$$("#params input").forEach(i=>state.project[i.dataset.key]=+i.value);state.project.assumed=[];state.project.warnings=[];state.project.title=state.project.title.split(" · ")[0]+` · ${state.project.width} × ${state.project.length} m`;$("#projectTitle").textContent=state.project.title;renderAll();saveVersion(false);toast("Parámetros aplicados.")};
$$(".seg").forEach(b=>b.onclick=()=>{$$(".seg").forEach(x=>x.classList.remove("active"));b.classList.add("active");state.viewMode=b.dataset.mode;draw()});
$$(".layers input").forEach(i=>i.onchange=()=>{state.layers[i.dataset.layer]=i.checked;draw()});
$("#jsonBtn").onclick=()=>download("cim65_proyecto.json",JSON.stringify(state.project,null,2),"application/json");
$("#csvBtn").onclick=()=>download("cim65_cantidades.csv","Concepto,Valor,Unidad\n"+quantities(state.project).map(q=>`"${q.name}",${q.value},"${q.unit}"`).join("\n"),"text/csv");
$("#dxfBtn").onclick=()=>download("cim65_modelo_demo.dxf",dxf(),"application/dxf");
$("#scrBtn").onclick=()=>download("cim65_autocad_demo.scr",scr(),"text/plain");
$("#dwgBtn").onclick=makeDwg;
$("#printBtn").onclick=()=>{showView("memory");setTimeout(()=>window.print(),80)};
$("#saveVersionBtn").onclick=()=>saveVersion(true);
$("#testApsBtn").onclick=testAps;
window.addEventListener("resize",draw);
state.project.prompt=$("#prompt").value;
renderAll();loadAps();