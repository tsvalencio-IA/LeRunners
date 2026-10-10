/* LeRunners Halloween 2026 — mantém o Firebase do formulário original.
 * Separação de dados: lerunners_lista/halloween_2026/respostas
 * Configuração: lerunners_config/halloween_2026
 * NÃO remove nem migra a lista histórica do Treinão/AMICC.
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getDatabase, ref, push, set, onValue, remove } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCo4nKN6xtKT_qlAcVXB_h1voYt10NwBwA',
  authDomain: 'lerunners-evento.firebaseapp.com',
  databaseURL: 'https://lerunners-evento-default-rtdb.firebaseio.com',
  projectId: 'lerunners-evento',
  storageBucket: 'lerunners-evento.firebasestorage.app',
  messagingSenderId: '437924326674',
  appId: '1:437924326674:web:051968a5466ee6518117cb'
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const DATA_PATH = 'lerunners_lista/halloween_2026/respostas';
const CONFIG_PATH = 'lerunners_config/halloween_2026';
const STORAGE_KEY = 'lerunners_halloween_2026_my_response';
const NAME_KEY = 'lerunners_halloween_2026_name';
const listaRef = ref(db, DATA_PATH);
const configRef = ref(db, CONFIG_PATH);
let connected = false;
let currentList = [];
let organizerOpen = false;
let runningSave = false;
let deferredInstall = null;
let toastTimer;
const defaults = Object.freeze({
  title: 'Halloween LeRunners',
  time: 'Horário a confirmar',
  place: 'Nossa chácara',
  message: 'Confraternização da equipe com hambúrgueres artesanais, piscina e atrações de Halloween.',
  version: 1
});
let config = { ...defaults };
const $ = id => document.getElementById(id);
const escapeHtml = input => String(input ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalized = input => String(input ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
const num = n => Number(n || 0).toLocaleString('pt-BR');
const statusLabel = {sim:'Confirmado',talvez:'Talvez',nao:'Não vai'};
const statusEmoji = {sim:'✅',talvez:'🤔',nao:'❌'};
const att = record => record.status !== 'nao';
const myId = () => localStorage.getItem(STORAGE_KEY) || '';

function toast(message, error=false){
  const el = $('toast');el.textContent=message;el.className='toast'+(error?' error':'');el.hidden=false;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.hidden=true;},4800);
}
function setStatus(state,message){
  connected = state === 'online';
  $('statusText').textContent=message;
  $('statusDot').className='dot'+(state==='online'?' online':state==='offline'?' offline':'');
  $('statusDot').parentElement.title=message;
}
function updateConfigUI(){
  $('heroEventTitle').textContent='🎃 '+config.title+' • 2026';
  $('heroMessage').textContent=config.message;
  $('heroPlace').textContent=config.place;
  $('heroTime').textContent=config.time;
  $('configTitle').value=config.title;
  $('configTime').value=config.time;
  $('configPlace').value=config.place;
  $('configMessage').value=config.message;
  document.title=`${config.title} • 01/11/2026`;
}
function sanitizeRecord(key, data){
  if(!data || typeof data !== 'object' || !['sim','nao','talvez'].includes(data.status)) return null;
  return {
    id:key, uid:String(data.uid||''), nome:String(data.nome||'').slice(0,80),
    status:data.status, people:data.status==='nao'?0:Math.max(1,Math.min(10,Number(data.people)||1)),
    burger:String(data.burger||'').slice(0,30), guests:Array.isArray(data.guests)?data.guests.map(g=>String(g).trim().slice(0,80)).filter(Boolean).slice(0,9):[],
    costume:String(data.costume||''), bring:String(data.bring||'').slice(0,50),
    note:String(data.note||'').slice(0,260), timestamp:Number(data.timestamp)||0,
    updatedAt:Number(data.updatedAt)||0
  };
}
function fillOwnResponse(){
  const own = currentList.find(item=>item.id===myId() && item.uid===auth.currentUser?.uid);
  if(!own){$('savedMessage').classList.remove('visible');$('submitBtn').textContent='📩 ENVIAR MINHA RESPOSTA';return;}
  // Preserva digitação em andamento caso os outros atletas atualizem a lista.
  if(document.activeElement && $('rsvpForm').contains(document.activeElement) && document.activeElement!==$('submitBtn')) return;
  $('userName').value=own.nome;
  document.querySelectorAll('[name="status"]').forEach(r=>{r.checked=r.value===own.status;});
  const guestNames=own.guests||[];
  $('guestCount').value=String(Math.min(9,Math.max(0,own.people-1)));
  $('guestNames').value=guestNames.join('\n');
  toggleGuestNames();
  $('burger').value=['tradicional','vegetariano','ambos','nao-vou-comer'].includes(own.burger)?own.burger:'';
  $('costume').value=['sim','nao','talvez'].includes(own.costume)?own.costume:'talvez';
  $('bring').value=['Bebida','Sobremesa','Doces','Gelo','Decoração','Descartáveis','Outro'].includes(own.bring)?own.bring:'';
  $('note').value=own.note;
  toggleAttending();
  $('savedMessage').textContent='✅ Sua resposta já foi registrada. Você pode alterá-la e clicar em SALVAR ATUALIZAÇÃO.';
  $('savedMessage').classList.add('visible');
  $('submitBtn').textContent='✓ SALVAR MINHA ATUALIZAÇÃO';
}
function toggleGuestNames(){
  const guests=Number($('guestCount').value)||0;
  $('guestNamesBlock').hidden=guests===0;
  $('guestNames').required=guests>0 && document.querySelector('input[name="status"]:checked')?.value!=='nao';
}
function toggleAttending(){
  const status=document.querySelector('input[name="status"]:checked')?.value;
  $('attendingFields').hidden=status==='nao';
  $('burger').required=status!=='nao';
  toggleGuestNames();
}
function renderSummary(){
  const confirmed=currentList.filter(e=>e.status==='sim');
  const totalPersons=confirmed.reduce((total,e)=>total+e.people,0);
  const countStatus=status=>currentList.filter(e=>e.status===status).length;
  $('countPeople').textContent=num(totalPersons);
  $('countYes').textContent=num(countStatus('sim'));
  $('countMaybe').textContent=num(countStatus('talvez'));
  $('countNo').textContent=num(countStatus('nao'));
  $('countBurger').textContent=num(confirmed.filter(e=>['tradicional','ambos'].includes(e.burger)).length)+' respostas';
  $('countVeggie').textContent=num(confirmed.filter(e=>e.burger==='vegetariano').length)+' respostas';
  $('countCostume').textContent=num(confirmed.filter(e=>e.costume==='sim').length);
  $('countBringing').textContent=num(confirmed.filter(e=>Boolean(e.bring)).length);
  const brings={};
  confirmed.filter(e=>e.bring).forEach(e=>{brings[e.bring]=(brings[e.bring]||0)+1;});
  $('bringSummary').innerHTML=Object.entries(brings).sort((a,b)=>b[1]-a[1]).map(([label,n])=>`<span class="pill">${escapeHtml(label)} · ${num(n)}</span>`).join('');
  renderAdminList();
  return {totalPersons,confirmed};
}
function renderAdminList(){
  if(!organizerOpen)return;
  const container=$('adminGuestList');
  if(!currentList.length){container.innerHTML='<div class="empty">Nenhuma resposta registrada.</div>';return;}
  container.innerHTML=currentList.map(e=>{
    const guestList=(e.guests||[]).join(', ');
    const guestInfo=e.people>1?`${e.people-1} convidado(s) • ${escapeHtml(guestList||'Nomes não informados no cadastro anterior')}`:'Sem convidados';
    return `<div class="admin-person"><div class="admin-row-head"><strong>${escapeHtml(e.nome)} • ${statusLabel[e.status]}</strong><button type="button" class="delete" data-delete-id="${escapeHtml(e.id)}">Remover</button></div><small>${guestInfo}</small><small>Hambúrguer: ${escapeHtml(e.burger||'—')} • Fantasia: ${escapeHtml(e.costume||'—')} • Levará: ${escapeHtml(e.bring||'Não informado')}</small>${e.note?`<small>Observação: ${escapeHtml(e.note)}</small>`:''}</div>`;
  }).join('');
}
function renderList(){
  renderSummary();
  const query=normalized($('searchInput').value.trim());
  const filter=$('statusFilter').value;
  const filtered=currentList.filter(e=>(filter==='todos'||filter===e.status)&&normalized(e.nome+' '+(e.guests||[]).join(' ')).includes(query));
  if(!currentList.length){$('guestList').innerHTML='<div class="empty">Ainda não há respostas registradas. Confirme sua presença!</div>';return;}
  if(!filtered.length){$('guestList').innerHTML='<div class="empty">Nenhum participante encontrado para este filtro.</div>';return;}
  $('guestList').innerHTML=filtered.map(e=>{
    const initials=e.nome.trim().split(/\s+/).slice(0,2).map(v=>v[0]||'').join('').toLocaleUpperCase('pt-BR');
    const people=e.status!=='nao'?` • ${e.people} pessoa${e.people>1?'s':''}`:'';
    const guests=e.guests?.length ? `<small>Convidados: ${escapeHtml(e.guests.join(', '))}</small>`:'';
    return `<article class="guest"><div class="avatar">${escapeHtml(initials)}</div><div><h3>${escapeHtml(e.nome)}</h3><small>${statusEmoji[e.status]} ${statusLabel[e.status]}${people}</small>${guests}</div><span class="tag ${e.status}">${statusLabel[e.status]}</span></article>`;
  }).join('');
}
async function saveResponse(ev){
  ev.preventDefault();
  if(runningSave)return;
  if(!connected || !auth.currentUser){toast('A lista está temporariamente indisponível. Tente novamente.',true);return;}
  const nome=$('userName').value.trim().replace(/\s+/g,' ');
  const status=document.querySelector('[name="status"]:checked')?.value;
  if(nome.length<3 || nome.length>80 || nome.split(' ').length<2){toast('Preencha seu nome e sobrenome antes de enviar a confirmação.',true);$('userName').focus();return;}
  if(!['sim','nao','talvez'].includes(status)){toast('Escolha Sim, Não ou Talvez.',true);return;}
  const guestsCount=status==='nao'?0:Number($('guestCount').value);
  if(!Number.isInteger(guestsCount)||guestsCount<0||guestsCount>9){toast('Quantidade de convidados inválida.',true);return;}
  const guests=status==='nao'?[]:$('guestNames').value.split(/\n|,/).map(s=>s.trim().replace(/\s+/g,' ')).filter(Boolean);
  if(status!=='nao'&&guests.length!==guestsCount){toast(`Informe os nomes dos ${guestsCount} convidados, um por linha.`,true);$('guestNames').focus();return;}
  if(guests.some(g=>g.length<2||g.length>80)){toast('Confira os nomes dos convidados.',true);$('guestNames').focus();return;}
  if(status!=='nao'&&!['tradicional','vegetariano','ambos','nao-vou-comer'].includes($('burger').value)){toast('Selecione sua preferência de hambúrguer antes de confirmar.',true);$('burger').focus();return;}
  const people=status==='nao'?0:guestsCount+1;
  const payload={
    nome,status,people,guests,uid:auth.currentUser.uid,
    burger:status==='nao'?'':$('burger').value,
    costume:status==='nao'?'':$('costume').value,
    bring:status==='nao'?'':$('bring').value,
    note:$('note').value.trim(),
    updatedAt:Date.now()
  };
  const already=currentList.find(e=>e.id===myId());
  if(already && already.uid!==payload.uid){toast('Este registro pertence a outra sessão. Não será alterado.',true);return;}
  if(already && already.uid===payload.uid)payload.timestamp=already.timestamp||Date.now();
  else payload.timestamp=Date.now();
  runningSave=true;$('submitBtn').disabled=true;
  const originalLabel=$('submitBtn').textContent;$('submitBtn').textContent='Salvando sua resposta...';
  try{
    const id=already ? already.id : push(listaRef).key;
    if(!id)throw new Error('Falha ao criar identificador');
    await set(ref(db,`${DATA_PATH}/${id}`),payload);
    localStorage.setItem(STORAGE_KEY,id);
    localStorage.setItem(NAME_KEY,nome);
    $('savedMessage').textContent='✅ Resposta registrada. Você pode atualizá-la aqui quando quiser.';
    $('savedMessage').classList.add('visible');
    $('submitBtn').textContent='✓ SALVAR MINHA ATUALIZAÇÃO';
    toast('Sua resposta foi salva e aparecerá na lista ao vivo!');
  }catch(error){console.error('Falha no envio:',error);toast('Não foi possível salvar agora. Tente novamente em instantes.',true);$('submitBtn').textContent=originalLabel;}
  finally{runningSave=false;$('submitBtn').disabled=false;}
}
function cleanUrl(){return location.origin+location.pathname+'?v=20261101';}
function whatsapp(message){
  window.open('https://api.whatsapp.com/send?text='+encodeURIComponent(message),'_blank','noopener,noreferrer');
}
function shareWhatsApp(){
  const confirmed=currentList.filter(e=>e.status==='sim').sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  const people=confirmed.reduce((n,e)=>n+e.people,0);
  let message=`🎃 *HALLOWEEN LERUNNERS 2026*\n📅 *Domingo, 1º de novembro • véspera de feriado*\n📍 ${config.place}\n🕒 ${config.time}\n\n`;
  message+=`✅ *LISTA DE CONFIRMADOS* (${people} pessoas)\n\n`;
  if(confirmed.length){
    message+=confirmed.map((e,i)=>`${i+1}. ${e.nome}${e.guests?.length?` (+${e.guests.length}: ${e.guests.join(', ')})`:e.people>1?` (+${e.people-1} convidado(s))`:''}`).join('\n');
  } else message+='Ainda aguardando confirmações.';
  message+=`\n\n🔗 *Confirme ou atualize sua presença:*\n${cleanUrl()}`;
  whatsapp(message);
}
function inviteMessage(){
  return `🎃 *HALLOWEEN LERUNNERS 2026*\n\n📅 Domingo, 1º de novembro de 2026 • véspera do feriado de Finados\n📍 ${config.place}\n🕒 ${config.time}\n\n🍔 Hambúrgueres artesanais • Piscina • Confraternização\n\n*Confirme sua presença:*\n${cleanUrl()}`;
}
async function shareInvitation(){
  if(!organizerOpen)return;
  const fileUrl=new URL('assets/fotos/convite-whatsapp.jpg?v=20261101',cleanUrl()).href;
  try{
    if(navigator.share && navigator.canShare){
      const response=await fetch(fileUrl);
      if(!response.ok)throw new Error('Imagem indisponível');
      const file=new File([await response.blob()],'Convite-LeRunners-Halloween-2026.jpg',{type:'image/jpeg'});
      if(navigator.canShare({files:[file]})){
        await navigator.share({title:'Convite Halloween LeRunners',text:inviteMessage(),files:[file]});
        return;
      }
    }
  }catch(error){if(error?.name==='AbortError')return;console.warn('Compartilhamento de imagem indisponível:',error);}
  whatsapp(inviteMessage());
  toast('No WhatsApp, o link exibirá a imagem do convite quando a prévia estiver disponível. Você também pode baixar a arte.');
}
async function copyInviteLink(){
  if(!organizerOpen)return;
  try{
    await navigator.clipboard.writeText(cleanUrl());
    toast('Link copiado. Pronto para enviar aos convidados.');
  }catch(error){
    window.prompt('Copie o link do convite:',cleanUrl());
  }
}
function openLogin(){
  $('loginError').hidden=true;$('adminPassword').value='';$('loginOverlay').hidden=false;
  document.body.style.overflow='hidden';$('adminPassword').focus();
}
function closeLogin(){ $('loginOverlay').hidden=true;document.body.style.overflow=''; }
function adminVisibility(state){
  organizerOpen=state;
  $('adminPanel').classList.toggle('open',state);
  $('adminPanel').setAttribute('aria-hidden',String(!state));
  if(state){renderSummary();renderAdminList();$('adminPanel').scrollIntoView({behavior:'smooth',block:'start'});}
}
async function submitLogin(event){
  event.preventDefault();
  const value=$('adminPassword').value.trim().toLocaleLowerCase('pt-BR');
  const data=new TextEncoder().encode('lerunners-halloween-2026-admin-v3:'+value);
  const digest=await crypto.subtle.digest('SHA-256',data);
  const hex=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  if(hex!=='823c489b191e9db4d75c2068784637848684a8ec60255080ad09ff330c05df12'){
    $('loginError').hidden=false;$('adminPassword').select();return;
  }
  closeLogin();adminVisibility(true);
}
function openOrganizer(){
  if(organizerOpen){adminVisibility(false);return;}
  openLogin();
}
async function saveConfig(){
  if(!organizerOpen){toast('Abra a área de organização.',true);return;}
  const title=$('configTitle').value.trim();
  const time=$('configTime').value.trim();
  const place=$('configPlace').value.trim();
  const message=$('configMessage').value.trim();
  if(!title||!time||!place||!message){toast('Preencha todos os dados do evento.',true);return;}
  try{await set(configRef,{title,time,place,message,version:1});toast('Informações publicadas em tempo real!');}
  catch(e){console.error(e);toast('Não foi possível salvar. Tente novamente.',true);}
}
async function deleteRecord(id){
  if(!organizerOpen)return;
  const entry=currentList.find(e=>e.id===id);
  if(!entry)return;
  if(!confirm(`Remover APENAS a resposta de ${entry.nome} do Halloween?`))return;
  try{await remove(ref(db,`${DATA_PATH}/${id}`));toast('Resposta removida.');}
  catch(e){console.error(e);toast('Não foi possível remover a resposta.',true);}
}
async function clearHalloween(){
  if(!organizerOpen)return;
  const phrase=prompt('ATENÇÃO: esta ação é irreversível e apaga TODAS as respostas de Halloween 2026. Digite APAGAR HALLOWEEN 2026 para confirmar:');
  if(phrase!=='APAGAR HALLOWEEN 2026'){if(phrase!==null)toast('Exclusão cancelada.');return;}
  try{await remove(listaRef);localStorage.removeItem(STORAGE_KEY);$('savedMessage').classList.remove('visible');toast('Lista do Halloween apagada; histórico de outros eventos preservado.');}
  catch(e){console.error(e);toast('Falha ao limpar a lista.',true);}
}
function htmlForPDF(){
  const confirmed=currentList.filter(e=>e.status==='sim');
  const persons=confirmed.reduce((n,e)=>n+e.people,0);
  const rows=currentList.map((e,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(e.nome)}</td><td>${statusLabel[e.status]}</td><td>${e.people||'—'}</td><td>${escapeHtml((e.guests||[]).join(', ')||(e.people>1?'Não informados':'—'))}</td><td>${escapeHtml(e.burger||'—')}</td><td>${escapeHtml(e.costume||'—')}</td><td>${escapeHtml(e.bring||'—')}</td><td>${escapeHtml(e.note||'—')}</td></tr>`).join('');
  return `<div style="font:13px/1.45 Arial,sans-serif;color:#211823;background:white;padding:22px;width:1120px"><h1 style="font-size:30px;margin:0;color:#9e461a">🎃 ${escapeHtml(config.title)}</h1><p style="color:#555;margin:7px 0 16px">01/11/2026 • ${escapeHtml(config.time)} • ${escapeHtml(config.place)}</p><div style="background:#fff3e8;padding:14px;margin-bottom:20px"><b>${persons} pessoas confirmadas</b> • ${confirmed.length} respostas Sim • ${currentList.filter(e=>e.status==='talvez').length} Talvez • ${currentList.filter(e=>e.status==='nao').length} Não • ${currentList.length} respostas totais</div><h2>Lista de confirmações</h2><table style="border-collapse:collapse;width:100%;font-size:10px"><thead><tr style="background:#342030;color:white"><th>#</th><th>Nome</th><th>Resposta</th><th>Pessoas</th><th>Convidados</th><th>Hambúrguer</th><th>Fantasia</th><th>Levará</th><th>Recado</th></tr></thead><tbody>${rows}</tbody></table><p style="color:#555;font-size:11px;margin-top:22px">Atualizado em ${new Date().toLocaleString('pt-BR')} • Powered by thIAguinho Soluções Digitais</p></div>`;
}
async function downloadPDF(){
  if(!organizerOpen)return;
  if(!currentList.length){toast('Ainda não há respostas para exportar.',true);return;}
  if(typeof window.html2pdf!=='function'){toast('Biblioteca de PDF indisponível. Verifique a conexão e tente novamente.',true);return;}
  const container=document.createElement('div');
  container.setAttribute('aria-hidden','true');
  Object.assign(container.style,{position:'fixed',top:'0',left:'0',zIndex:'2147483646',width:'1120px',pointerEvents:'none',background:'#fff'});
  container.innerHTML=htmlForPDF();
  container.querySelectorAll('th,td').forEach(e=>{e.style.padding='7px';e.style.border='1px solid #ddd';e.style.textAlign='left';e.style.overflowWrap='anywhere';});
  document.body.appendChild(container);
  try{
    if(document.fonts?.ready)await document.fonts.ready;
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    await window.html2pdf().set({margin:7,filename:'LeRunners_Halloween_01-11-2026_Confirmacoes.pdf',image:{type:'jpeg',quality:.98},html2canvas:{scale:1.5,useCORS:true,backgroundColor:'#ffffff',scrollX:0,scrollY:0,windowWidth:1120},jsPDF:{unit:'mm',format:'a4',orientation:'landscape'},pagebreak:{mode:['css','legacy']}}).from(container).save();
    toast('PDF gerado.');
  }catch(e){console.error('Erro PDF',e);toast('Não foi possível gerar o PDF.',true);}
  finally{container.remove();}
}
function openMedia(button){
  const photo=button.getAttribute('data-photo');
  const video=button.getAttribute('data-video');
  const modal=$('mediaModal'),figure=$('mediaFigure');
  figure.replaceChildren();
  if(photo){
    const img=document.createElement('img');img.src=photo;img.alt=button.querySelector('img')?.alt||'Foto da equipe';figure.appendChild(img);
    const cap=document.createElement('figcaption');cap.textContent=button.getAttribute('data-caption')||'';figure.appendChild(cap);
  }else if(video){
    const vid=document.createElement('video');vid.className='media-modal-video';vid.controls=true;vid.playsInline=true;vid.preload='metadata';vid.src=video;figure.appendChild(vid);
    const cap=document.createElement('figcaption');cap.textContent='Vídeo real da chácara';figure.appendChild(cap);
  }
  modal.hidden=false;document.body.style.overflow='hidden';$('closeMedia').focus();
}
function closeMedia(){
  const modal=$('mediaModal');modal.hidden=true;
  const vid=$('mediaFigure').querySelector('video');if(vid){vid.pause();vid.removeAttribute('src');vid.load();}
  $('mediaFigure').replaceChildren();document.body.style.overflow='';
}
function wireEvents(){
  $('rsvpForm').addEventListener('submit',saveResponse);
  document.querySelectorAll('[name="status"]').forEach(e=>e.addEventListener('change',toggleAttending));
  $('searchInput').addEventListener('input',renderList);
  $('statusFilter').addEventListener('change',renderList);
  $('shareListBtn').addEventListener('click',shareWhatsApp);
  $('inviteBtn').addEventListener('click',shareInvitation);
  $('copyInviteBtn').addEventListener('click',copyInviteLink);
  $('loginForm').addEventListener('submit',submitLogin);
  $('cancelLogin').addEventListener('click',closeLogin);
  $('loginOverlay').addEventListener('click',e=>{if(e.target===$('loginOverlay'))closeLogin();});
  $('guestCount').addEventListener('change',toggleGuestNames);
  $('pdfBtn').addEventListener('click',downloadPDF);
  $('adminBtn').addEventListener('click',openOrganizer);
  $('closeAdminBtn').addEventListener('click',()=>adminVisibility(false));
  $('saveConfigBtn').addEventListener('click',saveConfig);
  $('clearBtn').addEventListener('click',clearHalloween);
  $('adminGuestList').addEventListener('click',e=>{const button=e.target.closest('[data-delete-id]');if(button)deleteRecord(button.dataset.deleteId);});
  document.querySelectorAll('.gallery-tile').forEach(b=>b.addEventListener('click',()=>openMedia(b)));
  $('closeMedia').addEventListener('click',closeMedia);
  $('mediaModal').addEventListener('click',e=>{if(e.target===$('mediaModal'))closeMedia();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('mediaModal').hidden)closeMedia();else if(!$('loginOverlay').hidden)closeLogin();}});
  window.addEventListener('pagehide',()=>{document.body.style.overflow='';});
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('installBtn').hidden=false;});
  $('installBtn').addEventListener('click',async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$('installBtn').hidden=true;});
  window.addEventListener('appinstalled',()=>{$('installBtn').hidden=true;deferredInstall=null;});
}
async function connectLive(){
  try{
    await signInAnonymously(auth);
    setStatus('connecting','Sincronizando...');
    onValue(configRef,snapshot=>{
      const incoming=snapshot.val();
      config=(incoming && typeof incoming==='object'&& incoming.version===1)
        ? {title:String(incoming.title||defaults.title),time:String(incoming.time||defaults.time),place:String(incoming.place||defaults.place),message:String(incoming.message||defaults.message),version:1}
        : {...defaults};
      updateConfigUI();
    },error=>{console.warn('Configuração inacessível',error);updateConfigUI();});
    onValue(listaRef,snapshot=>{
      currentList=[];
      if(snapshot.exists())snapshot.forEach(child=>{const valid=sanitizeRecord(child.key,child.val());if(valid)currentList.push(valid);});
      currentList.sort((a,b)=>(b.updatedAt||b.timestamp)-(a.updatedAt||a.timestamp));
      setStatus('online','Atualizado em tempo real');
      renderList();fillOwnResponse();
    },error=>{console.error('Erro RTDB',error);setStatus('offline','Lista indisponível');$('guestList').innerHTML='<div class="empty">A lista está temporariamente indisponível. Tente novamente em instantes.</div>';toast('A lista está temporariamente indisponível.',true);});
  }catch(error){console.error('Erro autenticação Firebase',error);setStatus('offline','Conexão indisponível');$('guestList').innerHTML='<div class="empty">Não foi possível carregar a lista no momento.</div>';toast('Não foi possível conectar agora. Tente novamente.',true);}
}
wireEvents();
$('userName').value=localStorage.getItem(NAME_KEY)||localStorage.getItem('amicc_nome')||'';
toggleAttending();
toggleGuestNames();
updateConfigUI();
connectLive();
if('serviceWorker' in navigator && location.protocol==='https:')window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(error=>console.warn('PWA indisponível',error)));
