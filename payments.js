/* LeRunners 17º BPM/I • controles administrativos locais de contribuição.
 * Não armazena pagamentos no Firebase; cópia/transferência por backup JSON.
 */
const KEY='lerunners_17bpmi_20261108_pagamentos_v1';
let active=false,source=()=>[],ledger={adult:3000,child:0,overrides:{},received:{}};
const $=id=>document.getElementById(id);
const brl=n=>(Number(n||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function parseAmount(value,allowEmpty=false){
 const x=String(value??'').trim().replace(/^R\$\s*/i,'').replace(/\s/g,'');
 if(!x&&allowEmpty)return null;
 if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(x))return undefined;
 const p=x.replace(/\./g,'').split(','),n=Number(p[0])*100+Number((p[1]||'').padEnd(2,'0'));
 return Number.isSafeInteger(n)&&n>=0&&n<=999999999?n:undefined;
}
function notice(message,error=false){
 const n=$('paymentMessage');if(n){n.textContent=message;n.style.color=error?'#ffc6cb':'#bbf1d0';}
}
function load(){
 try{const v=JSON.parse(localStorage.getItem(KEY)||'{}');ledger={
  adult:Number.isSafeInteger(v.adult)&&v.adult>=0?v.adult:3000,
  child:Number.isSafeInteger(v.child)&&v.child>=0?v.child:null,
  overrides:v.overrides&&typeof v.overrides==='object'&&!Array.isArray(v.overrides)?v.overrides:{},
  received:v.received&&typeof v.received==='object'&&!Array.isArray(v.received)?v.received:{}
 };}catch(err){notice('Não foi possível carregar o histórico local. Nenhum dado foi excluído.',true);}
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(ledger));return true;}catch(err){notice('Não foi possível salvar neste navegador. Exporte os dados.',true);return false;}}
function people(){
 const rows=[];
 for(const x of source()){
  if(x.status==='sim')rows.push({id:x.id+':titular',name:x.nome,owner:x.nome,kind:'adulto'});
  (x.guests||[]).forEach((g,i)=>{if(g.status==='sim')rows.push({id:x.id+':convidado:'+i,name:g.name,owner:x.nome,kind:g.type==='crianca'?'crianca':'adulto'});});
 }
 return rows.sort((a,b)=>a.owner.localeCompare(b.owner,'pt-BR')||a.id.localeCompare(b.id));
}
function due(person){
 // Crianças são grátis no evento de 08/11, inclusive se houver valor especial salvo antes.
 if(person.kind==='crianca')return 0;
 if(Object.prototype.hasOwnProperty.call(ledger.overrides,person.id)){
  const override=ledger.overrides[person.id];
  if(Number.isSafeInteger(override)&&override>=0)return override;
 }
 return ledger.adult;
}
function collect(){
 const rows=people().map(p=>{
  const value=due(p);
  const paid=Number.isSafeInteger(ledger.received[p.id]?.amount)?ledger.received[p.id].amount:0;
  const status=p.kind==='crianca'?(paid>0?'Pagamento infantil anterior a conferir':'Isento — grátis'):value===null?'Valor indefinido':value===0?'Isento':paid>=value?'Pago':paid>0?'Parcial':'Pendente';
  return {...p,due:value,paid,status,when:ledger.received[p.id]?.when||'',note:ledger.received[p.id]?.note||''};
 });
 const charge=rows.reduce((n,r)=>n+(r.due??0),0),received=rows.reduce((n,r)=>n+r.paid,0);
 const pending=rows.reduce((n,r)=>n+Math.max(0,(r.due??0)-r.paid),0);
 const unknown=rows.filter(r=>r.due===null).length;
 return {rows,charge,received,pending,unknown};
}
function render(){
 if(!active)return;
 const report=collect();
 $('paymentAdults').value=(ledger.adult/100).toFixed(2).replace('.',',');
 $('paymentChildren').value='0,00';
 $('paymentDue').textContent=brl(report.charge);
 $('paymentReceived').textContent=brl(report.received);
 $('paymentPending').textContent=brl(report.pending);
 const oldChildPayments=report.rows.filter(p=>p.kind==='crianca'&&p.paid>0).length;
 $('paymentUnknown').textContent=oldChildPayments?`Crianças grátis. ${oldChildPayments} pagamento(s) infantil(is) antigo(s) precisam de conferência; os registros foram preservados.`:'Crianças grátis: sem cobrança.';
 $('paymentRows').innerHTML=report.rows.length?report.rows.map(p=>{
  if(p.kind==='crianca'){
   const prior=p.paid>0?'<small class="payment-status">Recebimento anterior: '+brl(p.paid)+'. Histórico preservado para conferência.</small>':'';
   return '<section class="payment-person"><div class="payment-person-top"><div><b>'+escape(p.name)+'</b><small>Criança • Responsável: '+escape(p.owner)+'</small></div><strong>GRÁTIS — R$ 0,00</strong></div><small class="payment-status">Isenta de contribuição neste evento.</small>'+prior+'</section>';
  }
  const isOverridden=Object.hasOwn(ledger.overrides,p.id);
  const overridden=isOverridden?ledger.overrides[p.id]:null;
  return '<section class="payment-person" data-person-id="'+escape(p.id)+'"><div class="payment-person-top"><div><b>'+escape(p.name)+'</b><small>'+escape(p.kind==='crianca'?'Criança':'Adulto')+' • Responsável: '+escape(p.owner)+'</small></div><strong>'+ (p.due===null?'A definir':brl(p.due))+'</strong></div>'+
  '<div class="payment-person-row"><label>Valor individual especial (R$)<input class="control payment-override" inputmode="decimal" placeholder="Padrão" value="'+(overridden===null?'':(overridden/100).toFixed(2).replace('.',','))+'"></label>'+
  '<label>Valor recebido (R$)<input class="control payment-received" inputmode="decimal" placeholder="0,00" value="'+(p.paid/100).toFixed(2).replace('.',',')+'"></label></div>'+
  '<div class="payment-person-row"><label>Observação (opcional)<input class="control payment-note" maxlength="120" placeholder="Ex.: recebido via Pix" value="'+escape(p.note)+'"></label>'+
  '<button class="secondary-btn payment-save" type="button">Salvar pagamento</button></div>'+
  '<small class="payment-status">'+escape(p.status)+(p.when?' • atualizado: '+escape(new Date(p.when).toLocaleString('pt-BR')):'')+'</small></section>';
 }).join(''):'<p>Nenhuma pessoa confirmada foi encontrada para este evento.</p>';
 $('paymentPdfBtn').disabled=!report.rows.length;
}
function setPrices(event){
 event.preventDefault();
 const adult=parseAmount($('paymentAdults').value);
 if(adult===undefined||adult===null){notice('Informe um valor válido em reais para adultos.',true);return;}
 const before={adult:ledger.adult,child:ledger.child};ledger.adult=adult;ledger.child=0;
 if(!save()){ledger.adult=before.adult;ledger.child=before.child;return;}
 render();notice('Preço dos adultos salvo. Crianças são grátis neste evento.');
}
function savePerson(event){
 const button=event.target.closest('.payment-save');if(!button)return;
 const row=button.closest('[data-person-id]');if(!row)return;
 const id=row.dataset.personId,p=people().find(q=>q.id===id);if(!p){notice('Participante não encontrado.',true);return;}
 if(p.kind==='crianca'){notice('Crianças são grátis e não têm cobrança.',true);return;}
 const override=parseAmount(row.querySelector('.payment-override').value,true),paid=parseAmount(row.querySelector('.payment-received').value);
 if(override===undefined||paid===undefined||paid===null){notice('Valor inválido. Digite 30,00 ou deixe o valor especial vazio.',true);return;}
 const amount=override===null?ledger.adult:override;
 if(amount!==null&&paid>amount){notice('O recebido não pode exceder o valor individual. Verifique o lançamento.',true);return;}
 const oldOverrides={...ledger.overrides},oldReceived={...ledger.received};
 if(override===null)delete ledger.overrides[id];else ledger.overrides[id]=override;
 ledger.received[id]={amount:paid,when:new Date().toISOString(),note:row.querySelector('.payment-note').value.trim().slice(0,120)};
 if(!save()){ledger.overrides=oldOverrides;ledger.received=oldReceived;return;}
 render();notice('Pagamento salvo para '+p.name+'.');
}
function download(name,content,type){
 const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');
 a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function backup(){
 download('LeRunners_Corrida17BPM_Pagamentos_Backup.json',JSON.stringify({kind:'LeRunners-17BPM-Pagamentos-v1',savedAt:new Date().toISOString(),ledger},null,2),'application/json');
 notice('Backup dos pagamentos salvo. Guarde em local seguro; ele contém dados financeiros.');
}
async function importBackup(event){
 const file=event.target.files[0];event.target.value='';if(!file)return;
 if(file.size>5*1024*1024){notice('Backup muito grande.',true);return;}
 let obj;try{obj=JSON.parse(await file.text());if(obj.kind!=='LeRunners-17BPM-Pagamentos-v1'||!obj.ledger||typeof obj.ledger!=='object'||!Number.isSafeInteger(obj.ledger.adult)||obj.ledger.adult<0||!(obj.ledger.child===null||Number.isSafeInteger(obj.ledger.child)&&obj.ledger.child>=0)||typeof obj.ledger.overrides!=='object'||typeof obj.ledger.received!=='object')throw Error('Formato incorreto');}catch(err){notice('Arquivo incompatível. Nenhum dado foi substituído.',true);return;}
 if(!confirm('Restaurar este backup e substituir os pagamentos deste navegador? As confirmações dos participantes não serão alteradas.'))return;
 const previous=ledger;ledger=obj.ledger;if(!save()){ledger=previous;return;}render();notice('Backup de pagamentos restaurado.');
}
async function pdf(){
 const r=collect();if(!r.rows.length)return;
 if(typeof window.html2pdf!=='function'){notice('O gerador de PDF não carregou.',true);return;}
 const content=document.createElement('div');content.style.cssText='width:710px;padding:23px;font:12px Arial,sans-serif;background:#fff;color:#172e20;position:absolute;left:-25000px;top:0';
 const groups=new Map();
 for(const p of r.rows){if(!groups.has(p.owner))groups.set(p.owner,[]);groups.get(p.owner).push(p);}
 const tr=[...groups.entries()].map(([owner,people])=>'<tr><td colspan="4" style="background:#edf3ed"><strong>Responsável: '+escape(owner)+'</strong></td></tr>'+people.map(p=>'<tr><td>'+escape(p.name)+'</td><td>'+escape(p.kind)+'</td><td>'+ (p.due===null?'A definir':brl(p.due))+'</td><td>'+brl(p.paid)+' • '+escape(p.status)+'</td></tr>').join('')).join('');
 content.innerHTML='<h1 style="color:#11633d">LeRunners | Corrida do 17º BPM/I</h1><h2>Confraternização pós-corrida • 08/11/2026</h2><p>Emitido em '+escape(new Date().toLocaleString('pt-BR'))+'</p><p><strong>Total previsto (valores definidos): '+brl(r.charge)+'</strong><br>Total recebido: '+brl(r.received)+'<br>Total pendente: '+brl(r.pending)+'<br>Participantes sem valor definido: '+r.unknown+'</p><h3>Controle individual dos participantes</h3><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#184f3b;color:white"><th style="padding:8px">Nome</th><th>Tipo</th><th>Valor devido</th><th>Pagamento</th></tr></thead><tbody>'+tr+'</tbody></table><p style="margin-top:24px;font-size:10px">Pagamentos registrados neste navegador do organizador. Não altera lista de presença pública.</p>';
 const style=document.createElement('style');style.textContent='.payment-print td,.payment-print th{border-bottom:1px solid #d4ded8;padding:8px;vertical-align:top;text-align:left}.payment-print tr{break-inside:avoid}';content.classList.add('payment-print');content.prepend(style);document.body.appendChild(content);
 $('paymentPdfBtn').disabled=true;
 try{await window.html2pdf().set({margin:8,filename:'LeRunners_17BPM_08-11-2026_Pagamentos.pdf',image:{type:'jpeg',quality:0.97},html2canvas:{scale:1.5},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},pagebreak:{mode:['css','legacy']}}).from(content).save();notice('Relatório de pagamentos gerado.');}
 catch(err){notice('Não foi possível gerar o PDF: '+err.message,true);}
 finally{content.remove();$('paymentPdfBtn').disabled=false;}
}
export function initPayments(getList){
 if(active)return;active=true;source=getList;load();
 $('paymentPrices').addEventListener('submit',setPrices);
 $('paymentRows').addEventListener('click',savePerson);
 $('paymentBackupBtn').addEventListener('click',backup);
 $('paymentImport').addEventListener('change',importBackup);
 $('paymentPdfBtn').addEventListener('click',pdf);
 render();
}
export function refreshPayments(){if(active)render();}
