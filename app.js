/* CIEL V2 — interface + voz + memória + motor de IA
   A chave da IA NÃO fica neste arquivo. O navegador chama /api/chat.
*/
"use strict";

const $=id=>document.getElementById(id);
const ui={
  reply:$("reply"),interim:$("interim"),input:$("input"),mic:$("micButton"),send:$("sendButton"),
  state:$("state"),activity:$("activity"),notice:$("notice"),datetime:$("datetime"),
  connectionText:$("connectionText")
};

const HISTORY_KEY="CIEL_V2_HISTORY";
const AGENDA_KEY="CIEL_V2_AGENDA";
let history=load(HISTORY_KEY,[]);
let agenda=load(AGENDA_KEY,[]);
let recognition=null,listening=false,restarting=false;

function load(key,fallback){
  try{const v=JSON.parse(localStorage.getItem(key)||"null");return v ?? fallback}catch(_){return fallback}
}
function save(key,value){localStorage.setItem(key,JSON.stringify(value))}
function setState(s){ui.state.textContent=s;ui.activity.textContent=s==="OUVINDO"?"Escutando sua voz...":s==="ANALISANDO"?"Analisando com inteligência...":s==="RESPONDENDO"?"CIEL está respondendo...":"Núcleo CIEL ativo"}
function cleanText(text){
  return String(text||"")
    .replace(/\*\*(.*?)\*\*/g,"$1")   // **negrito**
    .replace(/\*(.*?)\*/g,"$1")       // *itálico*
    .replace(/__(.*?)__/g,"$1")       // __negrito__
    .replace(/`{1,3}([^`]*)`{1,3}/g,"$1") // `código`
    .replace(/^#{1,6}\s*/gm,"")       // # títulos
    .replace(/^[\-\*]\s+/gm,"")       // - listas
    .replace(/\*/g,"")                // qualquer asterisco solto que sobrar
    .trim();
}
function show(text){text=cleanText(text);ui.reply.textContent=text;ui.reply.scrollTop=ui.reply.scrollHeight;return text}

function clock(){
  const d=new Date(), period=d.getHours()>=6&&d.getHours()<18?"DIA":"NOITE";
  ui.datetime.textContent=`${d.toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"})} • ${d.toLocaleTimeString("pt-BR",{hour12:false})} • ${period}`;
}
clock();setInterval(clock,1000);

let voices=[];
function getVoice(){
  voices=window.speechSynthesis?.getVoices?.()||[];
  const pt=voices.filter(v=>/^pt(-|_)/i.test(v.lang));
  return pt.find(v=>/brasil|brazil/i.test(v.name))||pt[0]||voices[0]||null;
}
if("speechSynthesis"in window){getVoice();speechSynthesis.onvoiceschanged=getVoice}

function speak(text){
  if(!("speechSynthesis"in window))return;
  try{
    speechSynthesis.cancel();speechSynthesis.resume?.();
    const u=new SpeechSynthesisUtterance(text);u.lang="pt-BR";u.rate=.98;u.pitch=.92;
    const v=getVoice();if(v)u.voice=v;
    u.onstart=()=>setState("RESPONDENDO");u.onend=()=>setState(listening?"OUVINDO":"AGUARDANDO");
    speechSynthesis.speak(u);
  }catch(_){}
}

function localContext(){
  const d=new Date();
  return {
    now:d.toISOString(),
    localDate:d.toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}),
    localTime:d.toLocaleTimeString("pt-BR",{hour12:false}),
    period:d.getHours()>=6&&d.getHours()<18?"dia":"noite",
    agenda:agenda.filter(x=>new Date(x.timestamp)>=new Date()).sort((a,b)=>new Date(a.timestamp)-new Date(b.timestamp)).slice(0,20)
  };
}

async function askAI(text){
  setState("ANALISANDO");ui.notice.textContent="CIEL está analisando sua solicitação...";
  const payload={
    message:text,
    history:history.slice(-12),
    context:localContext()
  };
  const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  let data={};
  try{data=await res.json()}catch(_){}
  if(!res.ok)throw new Error(data.error||"Não foi possível conectar ao motor de inteligência.");
  return data;
}

function addHistory(role,content){
  history.push({role,content,at:new Date().toISOString()});
  if(history.length>30)history=history.slice(-30);
  save(HISTORY_KEY,history);
}

function localTimeAnswer(){
  const d=new Date(),period=d.getHours()>=6&&d.getHours()<18?"dia":"noite";
  return `Agora são ${d.toLocaleTimeString("pt-BR",{hour12:false})}. Hoje é ${d.toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"})}. É ${period}.`;
}

function listAgenda(){
  const upcoming=agenda.filter(x=>new Date(x.timestamp)>=new Date()).sort((a,b)=>new Date(a.timestamp)-new Date(b.timestamp)).slice(0,10);
  if(!upcoming.length)return "Sua agenda está vazia.";
  return upcoming.map((x,i)=>`${i+1}. ${x.title} — ${new Date(x.timestamp).toLocaleDateString("pt-BR")} às ${new Date(x.timestamp).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}`).join(". ");
}

function maybeCreateAgenda(text){
  const l=text.toLowerCase();
  if(!/\b(agende|marque|lembre|lembrete|agenda)\b/.test(l))return null;
  const now=new Date();let d=new Date(now);
  if(/amanhã|amanha/.test(l))d.setDate(d.getDate()+1);
  const date=l.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if(date){let y=date[3]?Number(date[3]):d.getFullYear();if(y<100)y+=2000;d.setFullYear(y,Number(date[2])-1,Number(date[1]))}
  const time=l.match(/\b([01]?\d|2[0-3])(?:[:h]([0-5]\d))?\b/);
  if(time)d.setHours(Number(time[1]),Number(time[2]||0),0,0);
  else if(/amanhã|amanha/.test(l))d.setHours(9,0,0,0);
  const title=text.replace(/^ciel[\s,:-]*/i,"").replace(/\b(agende|marque|lembre|lembrete|agenda)\b/ig,"").replace(/\b(para|pra|dia|às|as|em|amanhã|amanha)\b/ig,"").replace(/\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/g,"").replace(/\b([01]?\d|2[0-3])(?:[:h][0-5]\d)?\b/g,"").replace(/\s+/g," ").trim()||"Compromisso";
  agenda.push({id:Date.now(),title,timestamp:d.toISOString()});save(AGENDA_KEY,agenda);
  return `Agendado: ${title}, ${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}.`;
}

async function process(text){
  text=text.trim();if(!text)return;
  show("Analisando...");
  const agendaResult=maybeCreateAgenda(text);
  if(agendaResult){
    addHistory("user",text);addHistory("assistant",agendaResult);show(agendaResult);speak(agendaResult);return;
  }
  if(/\b(o que tenho|minha agenda|meus compromissos|agenda de hoje)\b/i.test(text)){
    const a=listAgenda();addHistory("user",text);addHistory("assistant",a);show(a);speak(a);return;
  }
  if(/\b(que horas|qual a hora|data de hoje|que dia é|que dia e)\b/i.test(text)){
    const a=localTimeAnswer();addHistory("user",text);addHistory("assistant",a);show(a);speak(a);return;
  }

  addHistory("user",text);
  try{
    const data=await askAI(text);
    const answer=data.answer||"Não recebi uma resposta válida do motor de inteligência.";
    addHistory("assistant",answer);
    const clean=show(answer);speak(clean);
    ui.notice.textContent=data.model?`Motor CIEL: ${data.model}`:"Motor CIEL ativo";
  }catch(err){
    const msg=`Não consegui acessar o motor de inteligência agora. ${err.message}`;
    show(msg);ui.notice.textContent="Verifique se o projeto está no Vercel e se OPENAI_API_KEY foi configurada.";
    speak(msg);
  }
}

/* Voz */
const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
if(Recognition){
  recognition=new Recognition();
  recognition.lang="pt-BR";recognition.continuous=true;recognition.interimResults=true;recognition.maxAlternatives=1;
  recognition.onstart=()=>{listening=true;restarting=false;ui.mic.classList.add("active");ui.connectionText.textContent="ESCUTANDO";setState("OUVINDO");ui.notice.textContent="Microfone ativo. Pode falar."};
  recognition.onresult=e=>{
    let finalText="",interim="";
    for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal)finalText+=e.results[i][0].transcript;else interim+=e.results[i][0].transcript}
    ui.interim.textContent=interim?`“${interim}”`:"";
    if(finalText.trim()){ui.interim.textContent="";process(finalText)}
  };
  recognition.onerror=e=>{
    if(e.error==="not-allowed"||e.error==="service-not-allowed"){listening=false;ui.mic.classList.remove("active");ui.connectionText.textContent="MIC BLOQUEADO";setState("AGUARDANDO");ui.notice.textContent="Permita o microfone no navegador."}
    else if(e.error==="network")ui.notice.textContent="O reconhecimento de voz informou um erro de rede.";
  };
  recognition.onend=()=>{
    if(listening&&!restarting){restarting=true;setTimeout(()=>{if(!listening)return;try{recognition.start()}catch(_){restarting=false}},400)}
  };
}else{ui.mic.disabled=true;ui.notice.textContent="Este navegador não oferece reconhecimento de voz. Use Chrome/Chromium em HTTPS ou localhost."}

ui.mic.onclick=()=>{
  if(listening){listening=false;try{recognition?.stop()}catch(_){}ui.mic.classList.remove("active");ui.connectionText.textContent="PRONTA";setState("AGUARDANDO");return}
  try{speechSynthesis?.resume?.();recognition?.start()}catch(_){}
};
ui.send.onclick=()=>{const t=ui.input.value;ui.input.value="";process(t)};
ui.input.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();ui.send.click()}});

$("agendaButton").onclick=()=>{const a=listAgenda();show(a);speak(a)};
$("timeButton").onclick=()=>{const a=localTimeAnswer();show(a);speak(a)};
$("clearMemoryButton").onclick=()=>{if(confirm("Apagar a memória local de conversas da CIEL?")){history=[];save(HISTORY_KEY,[]);show("Memória de conversas local apagada.");speak("Memória de conversas local apagada.")}};

/* Visual */
const pc=$("particles"),pctx=pc.getContext("2d"),cc=$("coreCanvas"),cctx=cc.getContext("2d");let points=[];
function resize(){const r=Math.max(1,Math.min(2,devicePixelRatio||1));pc.width=innerWidth*r;pc.height=innerHeight*r;const b=cc.getBoundingClientRect();cc.width=Math.max(1,b.width*r);cc.height=Math.max(1,b.height*r);points=Array.from({length:72},()=>({x:Math.random()*pc.width,y:Math.random()*pc.height,r:.5+Math.random()*1.5,v:(Math.random()-.5)*.35}))}
function particleLoop(){pctx.clearRect(0,0,pc.width,pc.height);for(const p of points){p.y+=p.v;if(p.y<0)p.y=pc.height;if(p.y>pc.height)p.y=0;pctx.beginPath();pctx.arc(p.x,p.y,p.r,0,Math.PI*2);pctx.fillStyle="rgba(50,185,255,.42)";pctx.fill()}requestAnimationFrame(particleLoop)}
function coreLoop(t){const w=cc.width,h=cc.height,cx=w/2,cy=h/2,R=Math.min(w,h)*.37,n=72,pts=[];for(let i=0;i<n;i++){const a=i*Math.PI*2/n+t*(listening?.00018:.000075);pts.push({x:cx+Math.cos(a)*R,y:cy+Math.sin(a)*R})}cctx.clearRect(0,0,w,h);cctx.lineWidth=1;for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const d=Math.hypot(pts[i].x-pts[j].x,pts[i].y-pts[j].y);if(d<R*.29){cctx.strokeStyle=`rgba(50,200,255,${Math.max(0,.26-d/(R*.29)*.26)})`;cctx.beginPath();cctx.moveTo(pts[i].x,pts[i].y);cctx.lineTo(pts[j].x,pts[j].y);cctx.stroke()}}for(let i=0;i<n;i++){const q=1+Math.sin(t*.003+i)*.32;cctx.shadowBlur=12;cctx.shadowColor="#29cfff";cctx.fillStyle="rgba(80,220,255,.9)";cctx.beginPath();cctx.arc(pts[i].x,pts[i].y,2.1*q,0,Math.PI*2);cctx.fill()}cctx.shadowBlur=0;requestAnimationFrame(coreLoop)}
addEventListener("resize",resize);resize();particleLoop();requestAnimationFrame(coreLoop);
