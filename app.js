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
const BRING_OPTIONS = ['Bebida','Sobremesa','Doces','Gelo','Decoração','Descartáveis','Outro'];
function normalizeBrings(source,legacy=''){
  const raw=Array.isArray(source)?source:String(legacy||'').split(/[,;+]/);
  return [...new Set(raw.map(x=>String(x||'').trim()).filter(x=>BRING_OPTIONS.includes(x)))];
}
function checkedBrings(){return [...document.querySelectorAll('input[name="bring"]:checked')].map(input=>input.value).filter(value=>BRING_OPTIONS.includes(value));}
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
function validStatus(value, fallback='talvez'){
  return ['sim','talvez','nao'].includes(value)?value:fallback;
}
function normalizeGuests(source,parentStatus,legacyPeople=1,statuses=[]){
  const raw=Array.isArray(source)?source:[];
  const guests=raw.slice(0,9).map((item,index)=>{
    const obj=item && typeof item==='object' && !Array.isArray(item)?item:null;
    return {
      name:String(obj?(obj.name??obj.nome??''):item??'').trim().slice(0,80),
      status:validStatus(obj?.status??statuses[index],parentStatus),
      missing:false
    };
  }).filter(person=>person.name);
  // Cadastros antigos podem ter informado quantidade sem nomes. Não eliminar essas pessoas da contagem.
  const missing=Math.min(9-guests.length,Math.max(0,Number(legacyPeople||1)-1-guests.length));
  for(let i=0;i<missing;i++)guests.push({name:'Nome não informado (cadastro anterior)',status:parentStatus,missing:true});
  return guests;
}
function tally(record){
  const stats={sim:0,talvez:0,nao:0};
  stats[validStatus(record.status)]++;
  for(const guest of record.guests||[])stats[validStatus(guest.status,record.status)]++;
  return stats;
}
function sanitizeRecord(key,data){
  if(!data || typeof data!=='object'||!['sim','nao','talvez'].includes(data.status))return null;
  const guests=normalizeGuests(data.guests,data.status,data.people,data.guestStatuses);
  const brings=normalizeBrings(data.brings,data.bring);
  return {
    id:key,uid:String(data.uid||''),nome:String(data.nome||'').slice(0,80),
    status:data.status,people:Math.max(0,Math.min(10,Number(data.people)||0)),guests,guestsUncertain:Boolean(data.guestsUncertain),
    burger:String(data.burger||'').slice(0,30),costume:String(data.costume||''),
    bring:brings.join(', '),brings,note:String(data.note||'').slice(0,260),
    timestamp:Number(data.timestamp)||0,updatedAt:Number(data.updatedAt)||0
  };
}
function fillOwnResponse(){
  const own=currentList.find(item=>item.id===myId() && item.uid===auth.currentUser?.uid);
  if(!own){$('savedMessage').classList.remove('visible');$('submitBtn').textContent='📩 ENVIAR MINHA RESPOSTA';return;}
  if(document.activeElement && $('rsvpForm').contains(document.activeElement) && document.activeElement!==$('submitBtn'))return;
  $('userName').value=own.nome;
  document.querySelectorAll('[name="status"]').forEach(r=>{r.checked=r.value===own.status;});
  $('guestCount').value=own.guestsUncertain?'unknown':String(Math.min(9,own.guests.length));
  showGuestInputs(own.guests);
  $('burger').value=['tradicional','vegetariano','ambos','nao-vou-comer'].includes(own.burger)?own.burger:'';
  $('costume').value=['sim','nao','talvez'].includes(own.costume)?own.costume:'talvez';
  document.querySelectorAll('input[name="bring"]').forEach(input=>{input.checked=own.brings.includes(input.value);});
  $('note').value=own.note;
  toggleAttending();
  $('savedMessage').textContent='✅ Inscrição encontrada. Altere a presença ou os convidados e salve a atualização.';
  $('savedMessage').classList.add('visible');
  $('submitBtn').textContent='✓ SALVAR MINHA ATUALIZAÇÃO';
}
function createGuestInput(guest,index){
  const el=document.createElement('div');
  el.className='guest-editor-row';
  el.innerHTML=`<label for="guestName${index}">Convidado ${index+1}</label><div class="guest-editor-controls"><input class="control guest-name" id="guestName${index}" type="text" autocomplete="off" maxlength="80" placeholder="Nome e sobrenome" value="${escapeHtml(guest?.missing?'':guest?.name||'')}" aria-label="Nome do convidado ${index+1}" required><select class="control guest-status" aria-label="Presença do convidado ${index+1}"><option value="sim">✓ Confirmado</option><option value="talvez">? Talvez</option><option value="nao">× Não vai</option></select><button class="guest-remove" type="button" title="Remover convidado ${index+1}" aria-label="Excluir convidado ${index+1}">Remover</button></div>`;
  el.querySelector('.guest-status').value=validStatus(guest?.status,document.querySelector('input[name="status"]:checked')?.value||'sim');
  return el;
}
function showGuestInputs(guests){
  const box=$('guestRows');box.replaceChildren();
  guests.forEach((g,i)=>box.appendChild(createGuestInput(g,i)));
  updateGuestVisibility();
}
function readGuestInputs(){
  return [...$('guestRows').querySelectorAll('.guest-editor-row')].map(row=>({
    name:row.querySelector('.guest-name').value.trim().replace(/\s+/g,' '),
    status:row.querySelector('.guest-status').value
  }));
}
function updateGuestVisibility(){
  const countValue=$('guestCount').value;
  $('guestNamesBlock').hidden=countValue==='unknown'||countValue==='0'||document.querySelector('input[name="status"]:checked')?.value==='nao';
}
function toggleGuestNames(){
  if($('guestCount').value==='unknown'){showGuestInputs([]);return;}
  const count=Number($('guestCount').value)||0;
  const rows=readGuestInputs();
  while(rows.length<count)rows.push({name:'',status:document.querySelector('input[name="status"]:checked')?.value==='talvez'?'talvez':'sim'});
  showGuestInputs(rows.slice(0,count));
}
function removeGuestInput(button){
  const rows=readGuestInputs();
  const index=[...$('guestRows').children].indexOf(button.closest('.guest-editor-row'));
  if(index<0)return;
  rows.splice(index,1);
  $('guestCount').value=String(rows.length);
  showGuestInputs(rows);
  toast('Convidado retirado do formulário. Salve para atualizar a lista.');
}
function toggleAttending(){
  const status=document.querySelector('input[name="status"]:checked')?.value;
  $('attendingFields').hidden=status==='nao';
  $('burger').required=status!=='nao';
  updateGuestVisibility();
}
function renderSummary(){
  const confirmed=currentList.filter(e=>tally(e).sim>0);
  const sum=key=>currentList.reduce((n,e)=>n+tally(e)[key],0);
  const yes=sum('sim'),maybe=sum('talvez'),no=sum('nao');
  $('countPeople').textContent=num(yes+maybe);
  $('countYes').textContent=num(yes);
  $('countMaybe').textContent=num(maybe);
  $('countNo').textContent=num(no);
  $('countBurger').textContent=num(currentList.filter(e=>e.status==='sim'&&['tradicional','ambos'].includes(e.burger)).length)+' respostas';
  $('countVeggie').textContent=num(currentList.filter(e=>e.status==='sim'&&e.burger==='vegetariano').length)+' respostas';
  $('countCostume').textContent=num(currentList.filter(e=>e.status==='sim'&&e.costume==='sim').length);
  $('countBringing').textContent=num(currentList.filter(e=>e.status==='sim'&&e.brings.length>0).length);
  const brings={};
  currentList.filter(e=>e.status==='sim').forEach(e=>e.brings.forEach(item=>{brings[item]=(brings[item]||0)+1;}));
  $('bringSummary').innerHTML=Object.entries(brings).sort((a,b)=>b[1]-a[1]).map(([label,n])=>`<span class="pill">${escapeHtml(label)} · ${num(n)}</span>`).join('');
  renderAdminList();
  return {totalPersons:yes,confirmed};
}
function renderAdminList(){
  if(!organizerOpen)return;
  const container=$('adminGuestList');
  if(!currentList.length){container.innerHTML='<div class="empty">Nenhuma resposta registrada.</div>';return;}
  container.innerHTML=currentList.map(e=>{
    const stats=tally(e);
    const guests=(e.guests||[]).map(g=>`<small>↳ ${escapeHtml(g.name)} — ${statusLabel[g.status]}</small>`).join('')+(e.guestsUncertain?'<small>Convidados: ainda não sabe</small>':'');
    return `<div class="admin-person"><div class="admin-row-head"><strong>${escapeHtml(e.nome)} • ${statusLabel[e.status]}</strong><button type="button" class="delete" data-delete-id="${escapeHtml(e.id)}">Remover</button></div><small>${stats.sim} confirmado(s) · ${stats.talvez} talvez · ${stats.nao} não vai(vão)</small>${guests}<small>Hambúrguer: ${escapeHtml(e.burger||'—')} • Fantasia: ${escapeHtml(e.costume||'—')} • Levará: ${escapeHtml(e.bring||'Não informado')}</small>${e.note?`<small>Observação: ${escapeHtml(e.note)}</small>`:''}</div>`;
  }).join('');
}
function renderList(){
  renderSummary();
  const query=normalized($('searchInput').value.trim());
  const filter=$('statusFilter').value;
  const filtered=currentList.filter(e=>{
    const stats=tally(e);
    return (filter==='todos'||stats[filter]>0) && normalized(e.nome+' '+(e.guests||[]).map(g=>g.name).join(' ')).includes(query);
  });
  if(!currentList.length){$('guestList').innerHTML='<div class="empty">Ainda não há respostas registradas. Confirme sua presença!</div>';return;}
  if(!filtered.length){$('guestList').innerHTML='<div class="empty">Nenhum participante encontrado para este filtro.</div>';return;}
  $('guestList').innerHTML=filtered.map(e=>{
    const initials=e.nome.trim().split(/\s+/).slice(0,2).map(v=>v[0]||'').join('').toLocaleUpperCase('pt-BR');
    const stats=tally(e);
    const statsText=[stats.sim?`${stats.sim} confirmado${stats.sim!==1?'s':''}`:'',stats.talvez?`${stats.talvez} talvez`:'',stats.nao?`${stats.nao} não vai${stats.nao!==1?'vão':''}`:''].filter(Boolean).join(' · ');
    const guests=e.guests.map(g=>`<div class="guest-child"><span class="guest-child-name">↳ ${escapeHtml(g.name)}</span><span class="guest-child-status ${g.status}">${statusLabel[g.status]}</span></div>`).join('')+(e.guestsUncertain?'<div class="guest-child"><span class="guest-child-name">↳ Convidados: a definir</span></div>':'');
    const mine=e.id===myId()&&e.uid===auth.currentUser?.uid;
    return `<article class="guest group-guest"><div class="avatar">${escapeHtml(initials)}</div><div class="group-guest-main"><h3>${escapeHtml(e.nome)}</h3><small class="group-guest-meta">${statsText}</small>${guests?`<div class="guest-children">${guests}</div>`:''}${mine?`<button type="button" class="guest-edit" data-edit-own="${escapeHtml(e.id)}">Editar minha inscrição / convidados</button>`:''}</div><span class="tag ${e.status}">${statusLabel[e.status]}</span></article>`;
  }).join('');
}
async function saveResponse(ev){
  ev.preventDefault();
  if(runningSave)return;
  if(!connected||!auth.currentUser){toast('A lista está temporariamente indisponível. Tente novamente.',true);return;}
  const nome=$('userName').value.trim().replace(/\s+/g,' ');
  const status=document.querySelector('[name="status"]:checked')?.value;
  if(nome.length<3||nome.length>80||nome.split(' ').length<2){toast('Preencha seu nome e sobrenome antes de enviar a confirmação.',true);$('userName').focus();return;}
  if(!['sim','nao','talvez'].includes(status)){toast('Escolha Sim, Não ou Talvez.',true);return;}
  const guestsUncertain=status!=='nao'&&$('guestCount').value==='unknown';
  const guestsCount=status==='nao'||guestsUncertain?0:Number($('guestCount').value);
  if(!Number.isInteger(guestsCount)||guestsCount<0||guestsCount>9){toast('Quantidade de convidados inválida.',true);return;}
  const guests=status==='nao'||guestsUncertain?[]:readGuestInputs();
  if(guests.length!==guestsCount){toast('Confira a quantidade de convidados.',true);return;}
  const invalid=guests.find(g=>g.name.length<2||g.name.length>80||!['sim','talvez','nao'].includes(g.status));
  if(invalid){toast('Preencha o nome e a confirmação de cada convidado.',true);$('guestRows').querySelector('.guest-name:placeholder-shown')?.focus();return;}
  if(status!=='nao'&&!['tradicional','vegetariano','ambos','nao-vou-comer'].includes($('burger').value)){toast('Selecione sua preferência de hambúrguer antes de confirmar.',true);$('burger').focus();return;}
  const people=(status!=='nao'?1:0)+guests.filter(g=>g.status!=='nao').length;
  const brings=status==='nao'?[]:checkedBrings();
  const payload={nome,status,people,guests:guests.map(g=>g.name),guestStatuses:guests.map(g=>g.status),guestsUncertain,uid:auth.currentUser.uid,burger:status==='nao'?'':$('burger').value,
    costume:status==='nao'?'':$('costume').value,bring:brings.join(', '),brings,
    note:$('note').value.trim(),updatedAt:Date.now()};
  const already=currentList.find(e=>e.id===myId());
  if(already&&already.uid!==payload.uid){toast('Este registro pertence a outra sessão. Não será alterado.',true);return;}
  payload.timestamp=already?.timestamp||Date.now();
  runningSave=true;$('submitBtn').disabled=true;
  const originalLabel=$('submitBtn').textContent;$('submitBtn').textContent='Salvando sua resposta...';
  try{
    const id=already?already.id:push(listaRef).key;
    if(!id)throw new Error('Falha ao criar identificador');
    await set(ref(db,`${DATA_PATH}/${id}`),payload);
    localStorage.setItem(STORAGE_KEY,id);localStorage.setItem(NAME_KEY,nome);
    $('savedMessage').textContent='✅ Resposta registrada. Você pode atualizar os convidados e a presença quando quiser.';
    $('savedMessage').classList.add('visible');$('submitBtn').textContent='✓ SALVAR MINHA ATUALIZAÇÃO';
    toast('Confirmações salvas. Lista atualizada para todos!');
  }catch(error){console.error('Falha no envio:',error);toast('Não foi possível salvar agora. Tente novamente em instantes.',true);$('submitBtn').textContent=originalLabel;}
  finally{runningSave=false;$('submitBtn').disabled=false;}
}
function cleanUrl(){return location.origin+location.pathname+'?v=20261101d';}
function whatsapp(message){
  window.open('https://api.whatsapp.com/send?text='+encodeURIComponent(message),'_blank','noopener,noreferrer');
}
function shareWhatsApp(){
  const groups=currentList.filter(e=>tally(e).sim>0).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  const people=groups.reduce((n,e)=>n+tally(e).sim,0);
  let message=`🎃 *HALLOWEEN LERUNNERS 2026*\n📅 *Domingo, 1º de novembro • véspera de feriado*\n📍 ${config.place}\n🕒 ${config.time}\n\n`;
  message+=`✅ *PESSOAS CONFIRMADAS* (${people})\n\n`;
  if(groups.length){
    message+=groups.map((e,i)=>{
      const confirmedGuests=e.guests.filter(g=>g.status==='sim');
      const primary=`${i+1}. ${e.nome}${e.status==='sim'?'':' (responsável pelo grupo)'}`;
      return primary+(confirmedGuests.length?'\n'+confirmedGuests.map(g=>`   ↳ ${g.name} ✓`).join('\n'):'')+(e.guestsUncertain?'\n   ↳ Convidados: a definir':'');
    }).join('\n\n');
  }else message+='Ainda aguardando confirmações.';
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
  const totals=currentList.reduce((acc,e)=>{const s=tally(e);for(const k of ['sim','talvez','nao'])acc[k]+=s[k];return acc;},{sim:0,talvez:0,nao:0});
  const rows=currentList.map((e,i)=>{
    const s=tally(e);
    const guests=e.guests.map(g=>`${escapeHtml(g.name)} — ${statusLabel[g.status]}`).join('<br>')||(e.guestsUncertain?'A definir':'—');
    return `<tr><td>${i+1}</td><td>${escapeHtml(e.nome)}</td><td>${statusLabel[e.status]}</td><td>${s.sim} confirmados / ${s.talvez} talvez / ${s.nao} não</td><td>${guests}</td><td>${escapeHtml(e.burger||'—')}</td><td>${escapeHtml(e.costume||'—')}</td><td>${escapeHtml(e.bring||'—')}</td><td>${escapeHtml(e.note||'—')}</td></tr>`;
  }).join('');
  return `<div style="font:13px/1.45 Arial,sans-serif;color:#211823;background:white;padding:22px;width:1120px"><h1 style="font-size:30px;margin:0;color:#9e461a">🎃 ${escapeHtml(config.title)}</h1><p style="color:#555;margin:7px 0 16px">01/11/2026 • ${escapeHtml(config.time)} • ${escapeHtml(config.place)}</p><div style="background:#fff3e8;padding:14px;margin-bottom:20px"><b>${totals.sim} pessoas confirmadas</b> • ${totals.talvez} aguardando confirmação • ${totals.nao} não vão • ${currentList.length} inscrições</div><h2>Lista de confirmações por grupo</h2><table style="border-collapse:collapse;width:100%;font-size:10px"><thead><tr style="background:#342030;color:white"><th>#</th><th>Responsável</th><th>Resposta</th><th>Grupo</th><th>Convidados e situação</th><th>Hambúrguer</th><th>Fantasia</th><th>Levará</th><th>Recado</th></tr></thead><tbody>${rows}</tbody></table><p style="color:#555;font-size:11px;margin-top:22px">Atualizado em ${new Date().toLocaleString('pt-BR')} • Powered by thIAguinho Soluções Digitais</p></div>`;
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
  $('guestRows').addEventListener('click',e=>{const b=e.target.closest('.guest-remove');if(b)removeGuestInput(b);});
  $('guestList').addEventListener('click',e=>{if(e.target.closest('[data-edit-own]')){document.querySelector('#confirmar').scrollIntoView({behavior:'smooth',block:'start'});$('userName').focus({preventScroll:true});}});
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