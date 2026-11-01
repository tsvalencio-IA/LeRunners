/* Financeiro do encontro LeRunners. Nenhuma escrita no Firebase: notas e valores ficam
   somente no navegador do administrador, com backup JSON explícito. */
const LEDGER_KEY = 'lerunners_rateio_01112026_v1';
const DB_NAME = 'lerunners_finance_receipts_v1';
const fmt = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
let active=false, getEntries=()=>[], ledger={expenses:[],excluded:[]};
const $=id=>document.getElementById(id);
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[c]));
const money=c=>fmt.format(c/100);
const uid=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,11);
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
function alertFinance(msg,bad=false){const node=$('financeFeedback');if(!node)return;node.textContent=msg;node.style.color=bad?'#ffb8b8':'#b6f1cd';}
function loadLedger(){
 try {
  const raw=JSON.parse(localStorage.getItem(LEDGER_KEY)||'{}');
  ledger={expenses:Array.isArray(raw.expenses)?raw.expenses.filter(v=>v&&typeof v.id==='string'&&Number.isSafeInteger(v.cents)&&v.cents>0).map(v=>({id:v.id,date:String(v.date||''),description:String(v.description||''),store:String(v.store||''),cents:v.cents,note:String(v.note||''),receipt:v.receipt&&typeof v.receipt==='object'?{name:String(v.receipt.name||''),type:String(v.receipt.type||'')}:null})):[],excluded:Array.isArray(raw.excluded)?raw.excluded.filter(v=>typeof v==='string'):[]};
 }catch(error){ledger={expenses:[],excluded:[]};alertFinance('Não foi possível ler o arquivo local. Nenhum dado foi apagado.',true);}
}
function persist(){try{localStorage.setItem(LEDGER_KEY,JSON.stringify(ledger));return true;}catch(error){alertFinance('Armazenamento indisponível: exporte uma cópia antes de sair.',true);return false;}}
function getConfirmed(){
 const persons=[];
 for(const group of getEntries()){
  if(group.status==='sim')persons.push({id:group.id+':titular',name:group.nome,group:group.nome});
  (group.guests||[]).forEach((p,i)=>{
   if(p.status==='sim')persons.push({id:group.id+':convidado:'+i,name:p.name+(p.missing?' (nome pendente)':''),group:group.nome});
  });
 }
 return persons.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')||a.id.localeCompare(b.id));
}
function calc(){
 const all=getConfirmed(),included=all.filter(p=>!ledger.excluded.includes(p.id));
 const total=ledger.expenses.reduce((s,x)=>s+x.cents,0),portion=included.length?Math.floor(total/included.length):0,remainder=included.length?total%included.length:0;
 const rows=included.map((p,i)=>({...p,cents:portion+(i<remainder?1:0)}));
 const groups=new Map();
 for(const p of rows){const g=groups.get(p.group)||{group:p.group,cents:0,names:[]};g.cents+=p.cents;g.names.push(p);groups.set(p.group,g);}
 return {all,included,rows,groups:[...groups.values()].sort((a,b)=>a.group.localeCompare(b.group,'pt-BR')),total,portion,remainder};
}
function parseCents(value){
 const raw=String(value||'').trim().replace(/^R\$\s*/i,'').replace(/\s/g,'');
 if(!/^(\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(raw))return null;
 const parts=raw.replace(/\./g,'').split(',');
 const cents=Number(parts[0])*100+Number((parts[1]||'').padEnd(2,'0'));
 return Number.isSafeInteger(cents)&&cents>0&&cents<=999999999?cents:null;
}
function dbOpen(){
 return new Promise((resolve,reject)=>{
  if(!('indexedDB' in window)){reject(new Error('IndexedDB indisponível'));return;}
  const req=indexedDB.open(DB_NAME,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('files'))req.result.createObjectStore('files');};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||new Error('Armazenamento de arquivos indisponível'));
 });
}
async function fileOp(mode,key,value){
 const db=await dbOpen();
 return new Promise((resolve,reject)=>{
  const transaction=db.transaction('files',mode==='get'?'readonly':'readwrite');
  const store=transaction.objectStore('files');
  const req=mode==='get'?store.get(key):mode==='put'?store.put(value,key):store.delete(key);
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||new Error('Erro no comprovante'));
  transaction.oncomplete=()=>db.close();
  transaction.onerror=()=>{db.close();reject(transaction.error||new Error('Erro no armazenamento'));};
 });
}
function personList(){
 const c=calc();
 $('financePayers').innerHTML=c.all.length?c.all.map(p=>{
  const checked=!ledger.excluded.includes(p.id);
  return '<label class="finance-payer"><input type="checkbox" data-payer="'+esc(p.id)+'" '+(checked?'checked':'')+'><span>'+esc(p.name)+'<small>Responsável: '+esc(p.group)+'</small></span></label>';
 }).join(''):'<p class="finance-empty">Nenhum participante com situação “Sim” encontrado.</p>';
 $('financeTotal').textContent=money(c.total);
 $('financeCount').textContent=String(c.included.length);
 $('financeEach').textContent=c.included.length?money(c.portion)+' por pessoa'+(c.remainder?' (ajuste de centavos distribuído)':''):'Sem pessoas incluídas';
 $('financeCheck').textContent=money(c.rows.reduce((sum,p)=>sum+p.cents,0))+' de '+money(c.total);
 $('financeGroups').innerHTML=c.groups.length?c.groups.map(g=>
  '<div class="finance-group"><strong>'+esc(g.group)+'</strong><span>'+g.names.length+' pessoa(s) • '+money(g.cents)+'</span><small>'+g.names.map(p=>esc(p.name)+' — '+money(p.cents)).join(' · ')+'</small></div>'
 ).join(''):'<p class="finance-empty">Selecione os participantes que irão participar do rateio.</p>';
 $('financePdfBtn').disabled=!c.total||!c.included.length;
}
function expenseList(){
 $('financeExpenses').innerHTML=ledger.expenses.length?ledger.expenses.map((e,i)=>
  '<div class="finance-item"><div><strong>'+esc(e.description)+'</strong><small>'+esc(e.date||'Sem data')+(e.store?' • '+esc(e.store):'')+'</small><small>'+ (e.note?esc(e.note):'') +'</small><small>'+ (e.receipt?'📎 '+esc(e.receipt.name):'Sem foto/PDF anexado') +'</small></div><b>'+money(e.cents)+'</b><div class="finance-item-actions"><button type="button" data-action="edit" data-id="'+esc(e.id)+'">Editar</button>'+(e.receipt?'<button type="button" data-action="receipt" data-id="'+esc(e.id)+'">Ver nota</button>':'')+'<button type="button" data-action="delete" data-id="'+esc(e.id)+'">Excluir</button></div></div>'
 ).join(''):'<p class="finance-empty">Nenhuma despesa lançada. Preencha a primeira nota acima.</p>';
}
function render(){if(!active)return;expenseList();personList();}
function resetForm(){
 $('financeForm').reset();$('financeEditId').value='';$('financeDate').value=today();
 $('financeSaveBtn').textContent='Salvar despesa';$('financeCancelEdit').hidden=true;
 $('financeExistingReceipt').textContent='';
}
async function saveExpense(event){
 event.preventDefault();
 const id=$('financeEditId').value||uid();
 const description=$('financeDescription').value.trim();
 const cents=parseCents($('financeAmount').value);
 const date=$('financeDate').value;
 if(description.length<2||description.length>110){alertFinance('Informe a descrição da compra.',true);return;}
 if(cents===null){alertFinance('Valor inválido: use R$ 123,45, maior que zero.',true);return;}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){alertFinance('Informe uma data válida.',true);return;}
 const file=$('financeFile').files[0];
 if(file&&(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)||file.size>5*1024*1024)){alertFinance('Anexe JPG, PNG, WebP ou PDF de até 5 MB.',true);return;}
 const previous=ledger.expenses.find(e=>e.id===id);
 const next={id,description,cents,date,store:$('financeStore').value.trim().slice(0,100),note:$('financeNote').value.trim().slice(0,280),receipt:previous?.receipt||null};
 $('financeSaveBtn').disabled=true;
 try{
  if(file){await fileOp('put',id,file);next.receipt={name:file.name.slice(0,120),type:file.type};}
  const before=ledger.expenses.slice();
  ledger.expenses=previous?ledger.expenses.map(e=>e.id===id?next:e):[...ledger.expenses,next];
  if(!persist()){ledger.expenses=before;throw new Error('Falha ao salvar no navegador');}
  resetForm();render();alertFinance('Despesa salva neste navegador. Exporte um backup para segurança.');
 }catch(err){alertFinance('Não foi possível salvar a nota: '+err.message,true);}
 finally{$('financeSaveBtn').disabled=false;}
}
async function expenseClick(event){
 const button=event.target.closest('button[data-action]');if(!button)return;
 const id=button.dataset.id,e=ledger.expenses.find(x=>x.id===id);if(!e)return;
 if(button.dataset.action==='edit'){
  $('financeEditId').value=e.id;$('financeDescription').value=e.description;$('financeDate').value=e.date;
  $('financeAmount').value=(e.cents/100).toFixed(2).replace('.',',');
  $('financeStore').value=e.store;$('financeNote').value=e.note;
  $('financeExistingReceipt').textContent=e.receipt?'Nota já anexada: '+e.receipt.name:'Nenhuma nota anexada';
  $('financeFile').value='';$('financeSaveBtn').textContent='Salvar alteração';$('financeCancelEdit').hidden=false;
  $('financeForm').scrollIntoView({behavior:'smooth',block:'center'});return;
 }
 if(button.dataset.action==='delete'){
  if(!confirm('Excluir somente esta despesa de '+money(e.cents)+'? A confirmação de participantes não será alterada.'))return;
  const previous=ledger.expenses.slice();ledger.expenses=ledger.expenses.filter(x=>x.id!==id);
  if(!persist()){ledger.expenses=previous;return;}
  try{await fileOp('delete',id);}catch(err){console.warn('Arquivo da nota não excluído',err);}
  resetForm();render();alertFinance('Despesa excluída.');return;
 }
 if(button.dataset.action==='receipt'){
  try{
   const file=await fileOp('get',id);if(!file){alertFinance('Nota não encontrada neste navegador. Restaure o backup.',true);return;}
   const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.download=e.receipt.name;
   document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(err){alertFinance('Falha ao abrir a nota: '+err.message,true);}
 }
}
function downloadFile(name,blob){
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function blobToDataUrl(blob){return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=()=>reject(fr.error);fr.readAsDataURL(blob);});}
async function backup(){
 const files={};
 try{for(const item of ledger.expenses){if(item.receipt){const f=await fileOp('get',item.id);if(f)files[item.id]={name:item.receipt.name,type:item.receipt.type,base64:await blobToDataUrl(f)};}}}
 catch(err){alertFinance('Não foi possível incluir os anexos: '+err.message,true);return;}
 const payload={kind:'LeRunners-Financeiro-Backup-v1',savedAt:new Date().toISOString(),ledger,files};
 downloadFile('LeRunners_Backup_Despesas_01-11-2026.json',new Blob([JSON.stringify(payload)],{type:'application/json'}));
 alertFinance('Backup exportado. Guarde este arquivo para restaurar em outro celular ou computador.');
}
async function restore(event){
 const file=event.target.files[0];event.target.value='';if(!file)return;
 if(file.size>40*1024*1024){alertFinance('Backup maior que 40 MB: não importado.',true);return;}
 let payload;
 try{payload=JSON.parse(await file.text());if(payload.kind!=='LeRunners-Financeiro-Backup-v1'||!Array.isArray(payload.ledger?.expenses)||!Array.isArray(payload.ledger?.excluded))throw Error('Formato não reconhecido');
  for(const e of payload.ledger.expenses)if(!e||typeof e.id!=='string'||typeof e.description!=='string'||!Number.isSafeInteger(e.cents)||e.cents<=0)throw Error('Despesa inválida');
 }catch(err){alertFinance('Backup inválido: '+err.message,true);return;}
 if(!confirm('IMPORTAR BACKUP: isso substituirá as despesas e escolhas de rateio deste navegador. As confirmações no Firebase não serão alteradas. Continuar?'))return;
 const old=ledger;ledger=payload.ledger;
 if(!persist()){ledger=old;return;}
 try{
  for(const [id,doc] of Object.entries(payload.files||{})){
   if(!ledger.expenses.some(x=>x.id===id)||typeof doc.base64!=='string'||!/^data:(image\/jpeg|image\/png|image\/webp|application\/pdf);base64,/.test(doc.base64))continue;
   const blob=await (await fetch(doc.base64)).blob();if(blob.size<=5*1024*1024)await fileOp('put',id,blob);
  }
  render();resetForm();alertFinance('Backup restaurado. Confira os valores e participantes antes do PDF.');
 }catch(err){render();alertFinance('Valores importados, mas houve falha em algum anexo: '+err.message,true);}
}
function groupRateioRows(c){
 let out='';
 for(const g of c.groups){
  out+='<tr class="sub"><td colspan="2"><b>Responsável: '+esc(g.group)+'</b></td><td><b>'+money(g.cents)+'</b></td></tr>';
  for(const p of g.names)out+='<tr><td>'+esc(p.name)+'</td><td>1 cota</td><td>'+money(p.cents)+'</td></tr>';
 }
 return out;
}
async function pdfReport(){
 const c=calc();
 if(!c.total||!c.rows.length){alertFinance('Cadastre despesas e inclua ao menos uma pessoa no rateio.',true);return;}
 if(typeof window.html2pdf!=='function'){alertFinance('Gerador de PDF indisponível neste navegador. Verifique a conexão.',true);return;}
 $('financePdfBtn').disabled=true;
 const report=document.createElement('div');
 report.className='finance-print';
 const expenses=ledger.expenses.map((e,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(e.date)+'</td><td>'+esc(e.description)+(e.store?' • '+esc(e.store):'')+(e.note?'<br><small>'+esc(e.note)+'</small>':'')+'</td><td>'+money(e.cents)+'</td></tr>').join('');
 report.innerHTML='<style>.finance-print{font-family:Arial,sans-serif;color:#152c24;background:white;padding:26px;font-size:11px}.finance-print h1{font-size:25px;color:#12644a;margin:0 0 7px}.finance-print h2{color:#12644a;margin-top:24px;font-size:16px}.finance-print p{font-size:11px}.finance-print table{border-collapse:collapse;width:100%;margin:12px 0}.finance-print th{background:#174c3d;color:white;text-align:left;padding:8px}.finance-print td{border-bottom:1px solid #d7e5de;padding:8px;vertical-align:top}.finance-print td:last-child{text-align:right;white-space:nowrap}.finance-print tr.sub td{background:#e9f2ed}.finance-print .summary{background:#e2f2e8;padding:16px;margin:15px 0}.finance-print .receipt{break-inside:avoid;page-break-inside:avoid;margin:20px 0;border:1px solid #dadada;padding:10px}.finance-print .receipt img{max-width:100%;max-height:490px;display:block;margin:10px auto}</style>'
 +'<h1>LeRunners | Despesas e rateio</h1><p>Encontro de Lanches e Confraternização • 01/11/2026</p><p>Emitido em '+esc(new Date().toLocaleString('pt-BR'))+'</p>'
 +'<div class="summary"><b>Total de despesas: '+money(c.total)+'</b><br>Pessoas incluídas: '+c.rows.length+'<br>Valor base por pessoa: '+money(c.portion)+(c.remainder?' (diferença de '+c.remainder+' centavo(s) distribuída em ordem alfabética)':'')+'<br>Total rateado: '+money(c.rows.reduce((s,p)=>s+p.cents,0))+'</div>'
 +'<h2>1. Despesas lançadas</h2><table><thead><tr><th>#</th><th>Data</th><th>Descrição / estabelecimento</th><th>Valor</th></tr></thead><tbody>'+expenses+'</tbody></table>'
 +'<h2>2. Rateio por responsável e por pessoa</h2><table><thead><tr><th>Pessoa</th><th>Cota</th><th>Valor</th></tr></thead><tbody>'+groupRateioRows(c)+'</tbody></table>'
 +'<p><strong>Critério:</strong> rateio igualitário entre os participantes confirmados selecionados pelo administrador. “Talvez” e “Não vai” não entram automaticamente. As escolhas de rateio não alteram a lista de presença.</p>'
 +'<p><strong>Conferência:</strong> soma dos valores individuais = '+money(c.total)+'.</p>';
 const withImages=ledger.expenses.filter(x=>x.receipt);
 if(withImages.length){report.insertAdjacentHTML('beforeend','<h2>3. Comprovantes anexados</h2><p>Notas em PDF são listadas, mas não incorporadas como páginas de imagem.</p>');
  for(const item of withImages){
   const el=document.createElement('div');el.className='receipt';el.innerHTML='<strong>'+esc(item.description)+'</strong> — '+money(item.cents)+'<br><small>'+esc(item.receipt.name)+'</small>';
   if(item.receipt.type.startsWith('image/')){
    try{const file=await fileOp('get',item.id);if(file){const img=document.createElement('img');img.src=await blobToDataUrl(file);img.alt='Comprovante: '+item.description;el.appendChild(img);}}
    catch(e){el.insertAdjacentHTML('beforeend','<p>Comprovante não encontrado neste dispositivo.</p>');}
   }
   report.appendChild(el);
  }
 }
 report.style.cssText='position:absolute;left:-20000px;top:0;width:730px;background:#fff;z-index:-1';
 document.body.appendChild(report);
 try{
  await window.html2pdf().set({margin:7,filename:'LeRunners_Rateio_01-11-2026.pdf',image:{type:'jpeg',quality:0.96},html2canvas:{scale:1.6,useCORS:true},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},pagebreak:{mode:['css','legacy']}}).from(report).save();
  alertFinance('PDF de despesas e rateio gerado.');
 }catch(err){alertFinance('Falha ao gerar PDF: '+err.message,true);}
 finally{report.remove();$('financePdfBtn').disabled=false;}
}
export function initFinance(getList){
 if(active)return;getEntries=getList;active=true;loadLedger();
 $('financeDate').value=today();
 $('financeForm').addEventListener('submit',saveExpense);
 $('financeCancelEdit').addEventListener('click',resetForm);
 $('financeExpenses').addEventListener('click',expenseClick);
 $('financePayers').addEventListener('change',event=>{
  const element=event.target.closest('input[data-payer]');if(!element)return;
  const id=element.dataset.payer;
  ledger.excluded=element.checked?ledger.excluded.filter(v=>v!==id):[...new Set([...ledger.excluded,id])];
  if(persist())render();else element.checked=!element.checked;
 });
 $('financePdfBtn').addEventListener('click',pdfReport);
 $('financeBackupBtn').addEventListener('click',backup);
 $('financeImportFile').addEventListener('change',restore);
 render();
}
export function refreshFinance(){if(active)render();}
