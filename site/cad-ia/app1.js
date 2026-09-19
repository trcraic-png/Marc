const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const toast = msg => { const t=$("#toast"); t.textContent=msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),2600); };
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

const state = {
  viewMode:"2d",
  layers:{grid:true,footings:true,columns:true,roof:true},
  project:{
    title:"Nave industrial demo",
    type:"nave_industrial", units:"SI",
    width:24, length:36, height:8, bay:6, levels:1,
    footingW:2, footingL:2, footingT:.5, fc:250, fy:4200, qa:15,
    slabT:.15, wallT:.15, liveLoad:250, deadLoad:350,
    assumed:[], warnings:[], prompt:""
  }
};

const schema = [
  ["width","Ancho (m)","number"],["length","Largo (m)","number"],["height","Altura (m)","number"],["bay","Claro/ejes (m)","number"],
  ["levels","Niveles","number"],["footingW","Zapata ancho (m)","number"],["footingL","Zapata largo (m)","number"],["footingT","Zapata espesor (m)","number"],
  ["fc","f'c (kg/cm²)","number"],["fy","fy (kg/cm²)","number"],["qa","Cap. suelo (t/m²)","number"],["slabT","Losa (m)","number"],
  ["liveLoad","Carga viva (kg/m²)","number"],["deadLoad","Carga muerta (kg/m²)","number"]
];

function parsePrompt(text){
  const p = {...state.project, assumed:[], warnings:[], prompt:text};
  const lower=text.toLowerCase();
  if(/vivienda|casa/.test(lower)) p.type="vivienda";
  else if(/banqueta/.test(lower)) p.type="banquetas";
  else if(/hidrául|hidraul|tuber|red/.test(lower)) p.type="hidraulica";
  else if(/ciment|zapata/.test(lower) && !/nave/.test(lower)) p.type="cimentacion";
  else if(/nave|industrial/.test(lower)) p.type="nave_industrial";

  const dim = text.match(/(d+(?:.d+)?)s*(?:x|×|por)s*(d+(?:.d+)?)s*m/i);
  if(dim){p.width=+dim[1];p.length=+dim[2];}
  const h = text.match(/alturas*(?:de)?s*(d+(?:.d+)?)s*m/i); if(h) p.height=+h[1];
  const bay = text.match(/(?:claro|ejes?|columnas?s+cada)s*(?:de)?s*(d+(?:.d+)?)s*m/i); if(bay) p.bay=+bay[1];
  const levels = text.match(/(d+)s*niveles?/i); if(levels) p.levels=+levels[1];
  const foot = text.match(/zapatas?.{0,35}?(d+(?:.d+)?)s*(?:x|×)s*(d+(?:.d+)?)s*(?:x|×)s*(d+(?:.d+)?)s*m/i);
  if(foot){p.footingW=+foot[1];p.footingL=+foot[2];p.footingT=+foot[3];}
  const fc = text.match(/f['’]?s*cs*(d+(?:.d+)?)/i); if(fc) p.fc=+fc[1];
  const fy = text.match(/fys*(d+(?:.d+)?)/i); if(fy) p.fy=+fy[1];
  const qa = text.match(/(?:capacidad(?:s+del)?s+suelo|suelo)s*(?:de)?s*(d+(?:.d+)?)s*t/m[²2]/i); if(qa) p.qa=+qa[1];
  const slab = text.match(/losas*(?:de)?s*(d+(?:.d+)?)s*cm/i); if(slab) p.slabT=+slab[1]/100;
  const wall = text.match(/muros?s*(?:de)?s*(d+(?:.d+)?)s*cm/i); if(wall) p.wallT=+wall[1]/100;
  const sidewalkW = text.match(/anchos*(d+(?:.d+)?)s*m/i); if(p.type==="banquetas" && sidewalkW) p.bay=+sidewalkW[1];
  const thickness = text.match(/espesors*(d+(?:.d+)?)s*cm/i); if(thickness) p.slabT=+thickness[1]/100;

  const present = key => {
    const words={width:/d+s*(x|×|por)s*d+/i,length:/d+s*(x|×|por)s*d+/i,height:/altura/i,bay:/claro|ejes|cada/i,footingW:/zapata/i,footingL:/zapata/i,footingT:/zapata/i,fc:/f['’]?s*c/i,fy:/fy/i,qa:/suelo|portante/i,levels:/nivel/i,slabT:/losa|espesor/i,liveLoad:/carga viva/i,deadLoad:/carga muerta/i};
    return words[key]?.test(text) || false;
  };
  ["height","bay","fc","fy","qa"].forEach(k=>{if(!present(k)) p.assumed.push(k)});
  if(p.type==="vivienda" && !levels) p.assumed.push("levels");
  if(p.assumed.length) p.warnings.push("Hay parámetros asumidos. Revísalos antes de usar resultados de ingeniería.");
  if(!p.qa || p.qa<=0) p.warnings.push("Falta capacidad portante válida del suelo.");
  if(p.width<=0 || p.length<=0) p.warnings.push("Dimensiones de planta inválidas.");
  p.title = ({nave_industrial:"Nave industrial",cimentacion:"Cimentación",vivienda:"Vivienda",banquetas:"Banquetas",hidraulica:"Red hidráulica"}[p.type]||"Proyecto")+" · "+p.width+" × "+p.length+" m";
  return p;
}

function axes(p){
  const nx=Math.max(2,Math.round(p.width/p.bay)+1);
  const ny=Math.max(2,Math.round(p.length/p.bay)+1);
  return {nx,ny,dx:p.width/(nx-1),dy:p.length/(ny-1),count:nx*ny};
}
function quantities(p){
  const a=p.width*p.length;
  if(p.type==="banquetas"){
    const bw=p.bay||1.5, t=p.slabT||.12, perimeter=2*(p.width+p.length), area=perimeter*bw, concrete=area*t;
    return [{name:"Longitud de banqueta",value:perimeter,unit:"m"},{name:"Área de banqueta",value:area,unit:"m²"},{name:"Concreto",value:concrete,unit:"m³"}];
  }
  if(p.type==="hidraulica"){
    return [{name:"Longitud principal",value:p.length,unit:"m"},{name:"Trazo de referencia",value:p.width,unit:"m"},{name:"Nodos demo",value:Math.max(2,Math.round(p.length/12)),unit:"pzas"}];
  }
  const ax=axes(p), footVol=ax.count*p.footingW*p.footingL*p.footingT;
  const colLen=ax.count*p.height*p.levels;
  const roofArea=a;
  const slabVol=a*p.slabT;
  return [
    {name:"Área de planta",value:a,unit:"m²"},
    {name:"Ejes/columnas",value:ax.count,unit:"pzas"},
    {name:"Concreto zapatas",value:footVol,unit:"m³"},
    {name:"Longitud de columnas",value:colLen,unit:"m"},
    {name:"Área cubierta/losa",value:roofArea,unit:"m²"},
    {name:"Volumen losa ref.",value:slabVol,unit:"m³"}
  ];
}
function calculations(p){
  const ax=axes(p);
  const tributary=ax.dx*ax.dy;
  const serviceAreaLoad=(p.deadLoad+p.liveLoad)/1000;
  const columnLoad=tributary*serviceAreaLoad*p.levels;
  const footingArea=p.footingW*p.footingL;
  const q=footingArea?columnLoad/footingArea:0;
  const wkgm=(p.deadLoad+p.liveLoad)*ax.dy;
  const M=wkgm*ax.dx*ax.dx/8;
  return {ax,tributary,serviceAreaLoad,columnLoad,footingArea,q,util:p.qa?q/p.qa:0,wkgm,M};
}
function renderParams(){
  const c=$("#params");c.innerHTML="";
  schema.forEach(([key,label,type])=>{
    const d=document.createElement("div");d.className="field "+(state.project.assumed.includes(key)?"assumed":"");
    d.innerHTML=`<label>${label}</label><input data-key="${key}" type="${type}" step="any" value="${state.project[key] ?? ""}">`;c.appendChild(d);
  });
  $("#warnings").innerHTML=state.project.warnings.map(w=>`<div class="warning">⚠ ${w}</div>`).join("");
}
function renderQuantities(){
  $("#quantities").innerHTML=quantities(state.project).map(q=>`<div class="qty"><span>${q.name}</span><strong>${fmt(q.value)} ${q.unit}</strong></div>`).join("");
}
function fmt(n){ return (Math.round((+n||0)*100)/100).toLocaleString("es-MX",{maximumFractionDigits:2}); }