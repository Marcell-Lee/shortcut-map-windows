'use strict';
const $=id=>document.getElementById(id);
const BUNDLE=JSON.parse($('library-data').textContent), MODS=['Ctrl','Alt','Shift','Win'];
const systemLabels={'Windows':'系统','Windows 设置':'系统设置','Windows 对话框':'系统对话框','Windows 命令提示符':'命令提示符'};
const appLabel=app=>systemLabels[app]||app;
const STORE=BUNDLE.storageKey, LEGACY=BUNDLE.legacyStorageKey;
const LAYOUTS=BUNDLE.layouts||{compact68:BUNDLE.layout};
let rows=LAYOUTS.compact68.rows,labels=LAYOUTS.compact68.labels,physical=rows.flat().map(k=>k.id);
const name=id=>labels[id]||id;
function activateLayout(id){const layout=LAYOUTS[id];if(!layout)throw Error('未知键盘布局。');rows=layout.rows;labels=layout.labels;physical=rows.flat().map(k=>k.id)}
const aliases={ctrl:'Ctrl',control:'Ctrl',alt:'Alt',shift:'Shift',win:'Win',meta:'Win',cmd:'Win',esc:'Escape',escape:'Escape',space:'Space',spacebar:'Space',tab:'Tab',enter:'Enter',return:'Enter',backspace:'Backspace',delete:'Delete',del:'Delete',home:'Home',end:'End',insert:'Insert',ins:'Insert',pageup:'PageUp',pgup:'PageUp',pagedown:'PageDown',pgdn:'PageDown',up:'ArrowUp','↑':'ArrowUp',down:'ArrowDown','↓':'ArrowDown',left:'ArrowLeft','←':'ArrowLeft',right:'ArrowRight','→':'ArrowRight',arrowup:'ArrowUp',arrowdown:'ArrowDown',arrowleft:'ArrowLeft',arrowright:'ArrowRight',printscreen:'PrintScreen',prtscn:'PrintScreen',capslock:'CapsLock',caps:'CapsLock',pause:'Pause',plus:'Plus','+':'Plus',numpadadd:'NumpadAdd',numlock:'NumLock',scrolllock:'ScrollLock','win / cmd':'Win','；':';','，':',','。':'.'};
const shifted={'!':'1','@':'2','#':'3','$':'4','%':'5','^':'6','&':'7','*':'8','(':'9',')':'0','_':'-','Plus':'=','{':'[','}':']','|':'\\',':':';','"':"'",'<':',','>':'.','?':'/','~':'`'};
function token(s){return aliases[s.toLowerCase()]||(/^[a-z]$/i.test(s)?s.toUpperCase():/^f\d{1,2}$/i.test(s)?s.toUpperCase():/^numpad(?:\d|add|subtract|multiply|divide|decimal|enter)$/i.test(s)?'Numpad'+s.slice(6,7).toUpperCase()+s.slice(7).toLowerCase():s)}
function chord(s){s=s.trim();if(s==='+')s='Plus';else s=s.replace(/\+\+$/,'+Plus');const p=s.split('+').map(x=>token(x.trim()));if(p.some(x=>!x)||new Set(p).size!==p.length)throw Error('键名为空或重复。例：F2、Ctrl+S、Ctrl++。');const keys=p.filter(x=>!MODS.includes(x));if(keys.length>1)throw Error('同一步只填一个普通键；先后按的组合请用 > 分隔。');if(keys.some(x=>!(/^(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Escape|Space|Tab|Enter|Backspace|Delete|Home|End|Insert|PageUp|PageDown|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|PrintScreen|CapsLock|Pause|Plus|Numpad(?:[0-9]|Add|Subtract|Multiply|Divide|Decimal|Enter)|NumLock|ScrollLock|[-=\[\]\\;',.\/`])$/.test(x)||Object.hasOwn(shifted,x))))throw Error('无法识别键名。Fn 按法请在映射中记录；长按、重复或鼠标配合请选择“按法说明”。');return [...MODS.filter(x=>p.includes(x)),...keys].join('+')}
function combo(s){if(s.length>200)throw Error('快捷键内容过长。');const strokes=s.split(/\s+>\s+|\s*然后\s*/);if(strokes.length>8)throw Error('最多记录八步连续按键。');return strokes.map(chord).join(' > ')}
const statuses=['已核实','官方默认','待核实'],mapStatuses=['截图已核实','用户已核实','待核实'];
function initial(){activateLayout('compact68');return{version:2,revision:1,layoutId:'compact68',layoutMappings:{},layoutModels:{compact68:BUNDLE.layout.seed.model},model:BUNDLE.layout.seed.model,mappings:structuredClone(BUNDLE.layout.seed.mappings),records:structuredClone(BUNDLE.records)}}
function validate(v){const text=(s,n)=>typeof s==='string'&&s.length<=n;if(!v||v.version!==2||!text(v.model,80)||!v.model.trim()||!Array.isArray(v.records)||v.records.length>5000||!v.mappings)throw Error('备份格式不正确。');v.layoutId??='compact68';v.layoutMappings??={};v.layoutModels??={[v.layoutId]:v.model};if(!Object.hasOwn(LAYOUTS,v.layoutId)||typeof v.layoutMappings!=='object'||!v.layoutMappings||typeof v.layoutModels!=='object'||!v.layoutModels||Object.entries(v.layoutModels).some(([id,model])=>!Object.hasOwn(LAYOUTS,id)||!text(model,80)||!model.trim()))throw Error('键盘布局无效。');activateLayout(v.layoutId);const ids=new Set();for(const r of v.records){if(!r||!text(r.id,100)||!r.id||ids.has(r.id)||!text(r.combo,200)||!['keys','gesture','unbound'].includes(r.kind)||!['global','app'].includes(r.scope)||!statuses.includes(r.status)||!text(r.app,80)||!r.app.trim()||!text(r.action,160)||!text(r.note,500)||!text(r.source,300)||!text(r.category,100)||typeof r.enabled!=='boolean')throw Error('快捷键字段无效或重复。');if(r.kind==='keys')r.combo=combo(r.combo);if(r.kind==='gesture'&&!r.combo.trim())throw Error('按法说明不能为空。');if(r.kind==='unbound'){r.combo='';r.enabled=false}ids.add(r.id)}for(const id of physical)for(const l of ['base','fn']){const m=v.mappings[id]?.[l];if(!m||!text(m.output,40)||!m.output.trim()||!text(m.note,160)||!mapStatuses.includes(m.status))throw Error('键盘映射不完整或无效。')}return v}
function migrate(v){if(v?.version!==1)return validate(v);const next=initial();if(typeof v.model!=='string'||!Array.isArray(v.records)||v.records.length>2000)throw Error('旧版备份无效。');next.model=v.model;next.mappings=v.mappings;const old=BUNDLE.layout.seed.records;for(const r of v.records){const prior=old.find(x=>x.id===r.id);const changed=!prior||['combo','scope','app','action','status','note','source','enabled'].some(k=>r[k]!==prior[k]);if(!changed)continue;const replacement=BUNDLE.legacyRecordIds[r.id];const converted={...r,id:replacement||'legacy-'+r.id,kind:'keys',category:'旧版自定义记录'};if(replacement)next.records=next.records.filter(x=>x.id!==replacement);next.records.push(converted)}for(const [oldId,newId] of Object.entries(BUNDLE.legacyRecordIds)){if(!v.records.some(r=>r.id===oldId))next.records=next.records.filter(r=>r.id!==newId)}return validate(next)}
let state=initial(),layer='base',selected='L',selectedTarget=null,mappingSelected='L',view='all',unassigned=false,editing=null,mods=null,visibleCache=[],availableCache=[];
const heldModifiers=new Set();
let popoverPinned=false,popoverAnchor=null;
function hideKeyPopover(){if(popoverPinned)return;$('key-popover').hidden=true;popoverAnchor=null}
function closeKeyPopover(){popoverPinned=false;$('key-popover').classList.remove('pinned');$('key-popover').hidden=true;popoverAnchor=null}
function positionKeyPopover(){const card=$('key-popover'),anchor=popoverAnchor;if(card.hidden||!anchor?.isConnected)return;const rect=anchor.getBoundingClientRect(),width=card.offsetWidth||360,height=card.offsetHeight||220,gap=10,margin=8;let left=rect.right+gap;if(left+width>innerWidth-margin)left=rect.left-width-gap;if(left<margin)left=Math.max(margin,Math.min(rect.left,innerWidth-width-margin));let top=rect.top;if(top+height>innerHeight-margin)top=rect.bottom-height;if(top<margin)top=margin;card.style.left=Math.round(left)+'px';card.style.top=Math.round(top)+'px'}
function showKeyPopover(button,pin=false){selected=button.dataset.keyId;popoverPinned=pin;popoverAnchor=button;const card=$('key-popover');card.classList.toggle('pinned',pin);card.hidden=false;renderDetail();positionKeyPopover()}
function feedback(msg,error=false){$('save-status').textContent=msg;$('save-status').hidden=!error;$('save-status').style.color=error?'#a32a23':''}
function save(){try{localStorage.setItem(STORE,JSON.stringify(state));feedback('已保存到此浏览器 · '+new Date().toLocaleTimeString('zh-CN')+' · 可导出备份');return true}catch{feedback('本地保存失败；修改只留在当前页面，请立即导出备份。',true);return false}}
try{const raw=localStorage.getItem(STORE);if(raw){state=validate(JSON.parse(raw));feedback('已读取全部快捷键记录。')}else {const legacy=LEGACY&&localStorage.getItem(LEGACY);if(legacy){state=migrate(JSON.parse(legacy));if(save())feedback('已升级旧版：保留自定义记录与键盘映射，原始旧版存储仍在。')}else feedback('已载入默认资料；修改后自动保存。')}}catch(e){feedback('读取失败，暂用初始资料；原存储未清除。'+e.message,true)}
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n}
function output(id,l=layer){const m=state.mappings[id][l];return l==='fn'&&m.output==='透传'?state.mappings[id].base.output:m.output}
function strokes(r){if(r.kind==='unbound')return[];if(r.kind==='keys')return r.combo.split(' > ').map(s=>s.split('+'));const words=r.combo.match(/Ctrl|Alt|Shift|Win|Space|Escape|F\d+|Mouse\w*|Wheel|LeftMouseButton/g)||[];return words.length?[words]:[]}
function keyMatch(r,id){const val=token(output(id));return strokes(r).some(s=>s.some(k=>k===val||shifted[k]===val))}
function chordSignature(value){if(value.includes(' > '))return null;const parts=value.split('+'),modifiers=new Set(parts.filter(p=>MODS.includes(p)));let target=parts.find(p=>!MODS.includes(p));if(!target)return null;if(Object.hasOwn(shifted,target)){target=shifted[target];modifiers.add('Shift')}return [...MODS.filter(m=>modifiers.has(m)),target].join('+')}
function buildAvailable(){
 const used=new Set(state.records.filter(r=>r.enabled&&r.kind==='keys'&&availabilityScope(r)).map(r=>chordSignature(r.combo)).filter(Boolean));
 const targets=new Map();
 for(const id of physical){if(id==='Fn')continue;const target=token(output(id));if(MODS.includes(target))continue;try{chord(target)}catch{continue}const current=targets.get(target);if(!current)targets.set(target,{target,fnOnly:layer==='fn'&&state.mappings[id].fn.output!=='透传'});else if(layer==='fn'&&state.mappings[id].fn.output!=='透传')current.fnOnly=true}
 const available=[];
 for(const {target,fnOnly} of targets.values())for(let mask=0;mask<16;mask++){
  if(mask===0&&!fnOnly)continue;
  const modifiers=MODS.filter((_,i)=>mask&(1<<i)),value=chord([...modifiers,target].join('+'));
  if(!used.has(chordSignature(value)))available.push({combo:value,target,modifiers})
 }
 return available.sort((a,b)=>a.combo.localeCompare(b.combo,'zh-CN'))
}
function availableMatch(candidate,id){const value=token(output(id));return candidate.target===value||candidate.modifiers.includes(value)}
function effectiveMods(){return heldModifiers.size?MODS.filter(m=>heldModifiers.has(m)||mods?.includes(m)):mods}
function filteredAvailable(){const active=effectiveMods();return availableCache.filter(c=>active===null||c.modifiers.length===active.length&&active.every(m=>c.modifiers.includes(m)))}
function availabilityScope(r){return view==='all'||r.scope==='global'||view.startsWith('app:')&&r.app===view.slice(4)}
function occupiedAssignment(target,modifiers){if(!target||modifiers===null||MODS.includes(target))return null;let signature;try{signature=chordSignature(chord([...modifiers,target].join('+')))}catch{return null}const records=state.records.filter(r=>r.enabled&&r.kind==='keys'&&availabilityScope(r)&&chordSignature(r.combo)===signature).sort((a,b)=>a.app.localeCompare(b.app,'zh-CN')||a.action.localeCompare(b.action,'zh-CN'));return records.length?{combo:signature,records}:null}
function inView(r){if(view==='all')return true;if(view==='global')return r.scope==='global';return r.app===view.slice(4)}
function modifierMatch(r){return mods===null||strokes(r).some(s=>{const present=MODS.filter(m=>s.includes(m));return present.length===mods.length&&mods.every(m=>present.includes(m))})}
function filtered(){if(unassigned)return[];return state.records.filter(r=>inView(r)&&modifierMatch(r))}
function renderViewSelector(){const root=$('view-options'),left=root.scrollLeft;root.replaceChildren();const choices=[['all','全部键盘快捷键'],['global','全局快捷键'],...[...new Set(state.records.map(r=>r.app))].sort((a,b)=>a.localeCompare(b,'zh-CN')).map(app=>['app:'+app,appLabel(app)])];if(!choices.some(([id])=>id===view))view='all';for(const [id,label] of choices){const button=el('button',label);button.type='button';button.dataset.view=id;button.setAttribute('aria-pressed',String(view===id));button.onclick=()=>{if(view===id)return;view=id;selectedTarget=null;mods=null;refresh();closeKeyPopover();root.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));button.scrollIntoView?.({block:'nearest',inline:'nearest'})};root.append(button)}root.scrollLeft=left;$('unassigned-toggle').setAttribute('aria-pressed',String(unassigned))}
$('unassigned-toggle').onclick=()=>{unassigned=!unassigned;selectedTarget=null;mods=null;heldModifiers.clear();closeKeyPopover();refresh();$('unassigned-toggle').setAttribute('aria-pressed',String(unassigned))};
$('view-options').addEventListener('wheel',e=>{const box=e.currentTarget,delta=Math.abs(e.deltaY)>Math.abs(e.deltaX)?e.deltaY:e.deltaX;if(!delta||box.scrollWidth<=box.clientWidth)return;const before=box.scrollLeft,next=Math.max(0,Math.min(before+delta,box.scrollWidth-box.clientWidth));if(next===before)return;e.preventDefault();box.scrollLeft=next},{passive:false});
function renderKeyboard(){
 const root=$('keyboard');root.replaceChildren();root.classList.toggle('full-size',state.layoutId==='full');
 const records=visibleCache.filter(r=>r.enabled&&r.kind!=='unbound'),candidates=unassigned?filteredAvailable():null,active=effectiveMods(),target=selectedTarget?token(output(selectedTarget)):null;
 const addKey=(k,div)=>{
   const value=token(output(k.id)),modifier=MODS.includes(value)?value:null;
   const matches=candidates?candidates.filter(c=>availableMatch(c,k.id)):records.filter(r=>keyMatch(r,k.id));
   const g=!candidates&&matches.some(r=>r.scope==='global'),a=!candidates&&matches.some(r=>r.scope==='app');
   const picked=!!candidates&&(k.id===selectedTarget||!!modifier&&!!active?.includes(modifier));
   let partner=false,extended=false;
   if(candidates&&(target||active!==null)){
    if(modifier){const needed=new Set(active||[]);needed.add(modifier);const related=availableCache.filter(c=>(!target||c.target===target)&&[...needed].every(m=>c.modifiers.includes(m)));partner=related.some(c=>c.modifiers.length===needed.size);extended=!partner&&related.length>0}
    else if(target)partner=k.id===selectedTarget&&candidates.some(c=>c.target===target);
    else{partner=candidates.some(c=>c.target===value);extended=!partner&&availableCache.some(c=>c.target===value&&c.modifiers.length>active.length&&active.every(m=>c.modifiers.includes(m)))}
   }
   const occupied=candidates?occupiedAssignment(value,active):null;
   const marking=candidates?(picked?' combo-picked'+(occupied?' combo-assigned':''):partner?' combo-available':occupied?' combo-assigned':extended?' combo-extended':''):(g&&a?' both':g?' global':a?' app':'')+(selected===k.id?' selected':'');
   const b=el('button',undefined,'key'+marking);b.dataset.keyId=k.id;b.style.setProperty('--u',k.u);
   const printed=output(k.id),shortLabel=state.layoutId==='full'&&printed===k.id&&k.id.startsWith('Numpad')?k.id.replace(/^Numpad/,'').replace('Divide','/').replace('Multiply','*').replace('Subtract','−').replace('Add','+').replace('Decimal','.').replace('Enter','Enter'):state.layoutId==='full'&&printed==='NumLock'?'Num':printed;
   b.append(el('strong',shortLabel));
    const keyStatus=candidates?(occupied?occupied.combo+'：'+appLabel(occupied.records[0].app)+' · '+occupied.records[0].action+(occupied.records.length>1?' 等 '+occupied.records.length+' 条':''):matches.length?'可查看未分配组合':'未分配组合需继续选择修饰键'):matches.length+' 条相关记录';
    b.title=keyStatus;b.setAttribute('aria-label',name(k.id)+'，'+(layer==='fn'?'Fn 层，':'默认层，')+output(k.id)+'，'+keyStatus);
   b.setAttribute('aria-pressed',String(candidates?picked:selected===k.id));b.setAttribute('aria-controls','key-popover');
   b.onpointerdown=()=>document.getSelection()?.removeAllRanges();
   b.onmouseenter=()=>{if(!popoverPinned&&!(candidates&&modifier))showKeyPopover(b)};b.onmouseleave=hideKeyPopover;b.onfocus=()=>{if(!popoverPinned&&!(candidates&&modifier))showKeyPopover(b)};b.onblur=hideKeyPopover;
   b.onclick=()=>{
    if(candidates){
     if(modifier){const next=new Set(mods||[]);next.has(modifier)?next.delete(modifier):next.add(modifier);mods=next.size?MODS.filter(m=>next.has(m)):null;refresh();return}
     if(selectedTarget===k.id&&popoverPinned){selectedTarget=null;closeKeyPopover();refresh();return}
     selectedTarget=k.id;selected=k.id;refresh();popoverAnchor=[...root.querySelectorAll('.key')].find(x=>x.dataset.keyId===k.id);showKeyPopover(popoverAnchor,true);return
    }
    if(popoverPinned&&selected===k.id){closeKeyPopover();return}
    popoverPinned=true;selected=k.id;refresh();popoverAnchor=[...root.querySelectorAll('.key')].find(x=>x.dataset.keyId===k.id);showKeyPopover(popoverAnchor,true)
   };
   div.append(b);return b
 };
 if(state.layoutId==='full'){
  const main=el('div',undefined,'full-main'),nav=el('div',undefined,'full-nav'),numpad=el('div',undefined,'full-numpad');
  const navPositions={PrintScreen:[1,1],ScrollLock:[1,2],Pause:[1,3],Insert:[2,1],Home:[2,2],PageUp:[2,3],Delete:[3,1],End:[3,2],PageDown:[3,3],ArrowUp:[5,2],ArrowLeft:[6,1],ArrowDown:[6,2],ArrowRight:[6,3]};
  const numPositions={NumLock:[1,1],NumpadDivide:[1,2],NumpadMultiply:[1,3],NumpadSubtract:[1,4],Numpad7:[2,1],Numpad8:[2,2],Numpad9:[2,3],NumpadAdd:[2,4,2,1],Numpad4:[3,1],Numpad5:[3,2],Numpad6:[3,3],Numpad1:[4,1],Numpad2:[4,2],Numpad3:[4,3],NumpadEnter:[4,4,2,1],Numpad0:[5,1,1,2],NumpadDecimal:[5,3]};
  for(const row of rows){
   const line=el('div',undefined,'full-main-row');
   for(const k of row){
    const navPos=navPositions[k.id],numPos=numPositions[k.id];
    if(navPos||numPos){const b=addKey(k,navPos?nav:numpad),p=navPos||numPos;b.style.gridRow=`${p[0]} / span ${p[2]||1}`;b.style.gridColumn=`${p[1]} / span ${p[3]||1}`}
    else addKey(k,line)
   }
   main.append(line)
  }
  root.append(main,nav,numpad)
 }else for(const row of rows){
  const div=el('div',undefined,'keyrow');
  for(const k of row)addKey(k,div);
  root.append(div)
 }
}
function renderDetail(){
 const root=$('detail-content');root.replaceChildren();
 const available=unassigned?filteredAvailable().filter(c=>availableMatch(c,selected)):null;
 const occupied=unassigned&&!available.length?occupiedAssignment(token(output(selected)),effectiveMods()):null;
 const rs=occupied?occupied.records:unassigned?available:visibleCache.filter(r=>r.enabled&&keyMatch(r,selected)).sort((a,b)=>a.combo.localeCompare(b.combo,'zh-CN')||a.app.localeCompare(b.app,'zh-CN'));
 const table=el('table',undefined,'shortcut-table'),head=el('thead'),headRow=el('tr');
 headRow.append(el('th','快捷键'),el('th','功能'));head.append(headRow);table.append(head);
 const body=el('tbody');
 if(!rs.length){const row=el('tr'),cell=el('td',unassigned?'点击或按住 Ctrl、Alt、Shift、Win 查看可用组合':'当前范围内暂无已记录的快捷键','shortcut-empty');cell.colSpan=2;row.append(cell);body.append(row)}
 for(const r of rs){const availableRow=unassigned&&!occupied,row=el('tr'),shortcut=el('td'),functionCell=el('td'),action=el('button',availableRow?'未分配':r.action,'shortcut-row-action');shortcut.append(el('kbd',r.combo));action.type='button';action.setAttribute('aria-label',(availableRow?'为 ':'编辑 ')+r.combo+(availableRow?' 新增快捷键':' 的功能'));if(occupied||!unassigned&&view==='all'&&!r.app.startsWith('Windows')&&r.app!=='文件资源管理器')action.append(el('small',appLabel(r.app),'shortcut-app-name'));action.onclick=()=>availableRow?openEditor(null,r.combo):openEditor(r);functionCell.append(action);row.append(shortcut,functionCell);body.append(row)}
 table.append(body);root.append(table)
}
function renderMapping(){const m=state.mappings[mappingSelected][layer];$('map-key').value=mappingSelected;$('map-output').value=m.output;$('map-note').value=m.note}
function refresh(){visibleCache=filtered();availableCache=unassigned?buildAvailable():[];$('unassigned-guide').hidden=!unassigned;renderKeyboard();renderDetail();if(popoverPinned){popoverAnchor=[...$('keyboard').querySelectorAll('.key')].find(x=>x.dataset.keyId===selected);if(popoverAnchor){$('key-popover').hidden=false;positionKeyPopover()}else closeKeyPopover()}else hideKeyPopover()}
function render(){document.body.classList.toggle('desktop-wide',state.layoutId==='full'&&!!window.shortcutDesktop);renderViewSelector();if($('map-key').options.length!==physical.length){$('map-key').replaceChildren();for(const id of physical)$('map-key').append(new Option(name(id),id))}$('keyboard-title').textContent=state.layoutId==='full'?'全键盘布局':'68 键布局';$('layout-select').value=state.layoutId;$('model').value=state.model;refresh();renderMapping()}
function switchLayout(id){if(id===state.layoutId)return;const next=structuredClone(state);next.layoutMappings[next.layoutId]=next.mappings;next.layoutModels[next.layoutId]=next.model;next.mappings=structuredClone(next.layoutMappings[id]||LAYOUTS[id].seed.mappings);next.model=next.layoutModels[id]||LAYOUTS[id].seed.model;next.layoutId=id;state=validate(next);selected='L';selectedTarget=null;mappingSelected='L';mods=null;heldModifiers.clear();closeKeyPopover();save();render()}
let captureAppend=false,captureUsedModifier=false;
function recordedKey(e){const c=e.code||'';if(/^Key[A-Z]$/.test(c))return c.slice(3);if(/^Digit[0-9]$/.test(c))return c.slice(5);if(/^Numpad[0-9]$/.test(c))return c;const codes={Minus:'-',Equal:'=',BracketLeft:'[',BracketRight:']',Backslash:'\\',Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/',Backquote:'`',Space:'Space',NumpadAdd:'NumpadAdd',NumpadSubtract:'NumpadSubtract',NumpadMultiply:'NumpadMultiply',NumpadDivide:'NumpadDivide',NumpadDecimal:'NumpadDecimal',NumpadEnter:'NumpadEnter'};return codes[c]||token(e.key)}
function captureChord(e){if($('r-kind').value!=='keys')return;e.preventDefault();e.stopPropagation();if(e.repeat)return;const key=recordedKey(e);if(MODS.includes(key)||['Control','Meta'].includes(e.key)){captureUsedModifier=false;return}if(key==='Escape'){captureAppend=false;$('capture-hint').textContent='已取消录制';return}try{const keys=[e.ctrlKey?'Ctrl':null,e.altKey?'Alt':null,e.shiftKey?'Shift':null,e.metaKey?'Win':null,key].filter(Boolean).join('+');const next=combo(captureAppend&&$('r-combo').value?$('r-combo').value+' > '+keys:keys);$('r-combo').value=next;$('r-combo-manual').value=next;$('capture-next').hidden=false;$('capture-clear').hidden=false;$('capture-hint').textContent='已录入：'+next;captureAppend=false;captureUsedModifier=true}catch(err){$('capture-hint').textContent=err.message}}
function captureModifierOnly(e){if($('r-kind').value!=='keys'||captureUsedModifier||$('r-combo').value)return;const k=token(e.key);if(!MODS.includes(k))return;e.preventDefault();$('r-combo').value=k;$('r-combo-manual').value=k;$('capture-next').hidden=false;$('capture-clear').hidden=false;$('capture-hint').textContent='已录入：'+k}
$('r-combo').addEventListener('keydown',captureChord);$('r-combo').addEventListener('keyup',captureModifierOnly);$('r-combo-manual').addEventListener('input',()=>{$('r-combo').value=$('r-combo-manual').value;$('capture-hint').textContent=$('r-combo').value?'已填写：'+$('r-combo').value:'点击上方输入框，再按组合键'});$('capture-next').onclick=()=>{captureAppend=true;$('capture-hint').textContent='现在按下一步快捷键';$('r-combo').focus()};$('capture-clear').onclick=()=>{$('r-combo').value='';$('r-combo-manual').value='';captureAppend=false;$('capture-next').hidden=true;$('capture-clear').hidden=true;$('capture-hint').textContent='点击上方输入框，再按组合键';$('r-combo').focus()};$('r-kind').onchange=()=>{$('r-combo').readOnly=$('r-kind').value==='keys';$('r-combo').placeholder=$('r-kind').value==='keys'?'点击这里，再按快捷键':'填写按法说明';$('capture-hint').textContent=$('r-kind').value==='keys'?'点击上方输入框，再按组合键':'可直接填写按法说明'};
function openEditor(r=null,preset=''){editing=r?.id||null;$('editor-title').textContent=r?'编辑快捷键':'新增快捷键';for(const f of ['combo','app','action','note','source','category'])$('r-'+f).value=r?.[f]||(f==='combo'?preset:f==='app'&&unassigned&&view.startsWith('app:')?view.slice(4):'');$('r-combo-manual').value=$('r-combo').value;$('r-scope').value=r?.scope||(unassigned&&view==='global'?'global':'app');$('r-kind').value=r?.kind||'keys';$('r-kind').onchange();$('r-enabled').checked=r?.enabled??true;$('delete').hidden=!r;$('form-error').textContent='';$('capture-next').hidden=!$('r-combo').value;$('capture-clear').hidden=!$('r-combo').value;captureAppend=false;captureUsedModifier=false;$('editor').showModal();$('r-combo').focus()}
$('record-form').onsubmit=e=>{e.preventDefault();try{const r={id:editing?.startsWith('user-')?editing:'user-'+crypto.randomUUID(),enabled:$('r-enabled').checked,status:editing?state.records.find(x=>x.id===editing)?.status||'待核实':'待核实'};for(const f of ['combo','scope','app','action','note','source','category','kind'])r[f]=$('r-'+f).value.trim();const next=structuredClone(state),i=next.records.findIndex(x=>x.id===editing);if(i<0)next.records.push(r);else next.records[i]=r;state=validate(next);save();render();$('editor').close()}catch(err){$('form-error').textContent=err.message}};
$('cancel').onclick=()=>$('editor').close();$('delete').onclick=()=>{if(confirm('删除这条网页记录？实际软件设置不变。')){state.records=state.records.filter(r=>r.id!==editing);save();render();$('editor').close()}};
$('add-key').onclick=()=>{let preset='';try{preset=combo([...(mods||[]),token(output(selected))].join('+'))}catch{}openEditor(null,preset)};
document.addEventListener('pointerdown',e=>{if(popoverPinned&&!$('key-popover').contains(e.target)&&!e.target.closest('.key'))closeKeyPopover()});
const modifierEvents={Control:'Ctrl',Shift:'Shift',Alt:'Alt',Meta:'Win',OS:'Win'};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeKeyPopover();if(!unassigned||$('editor').open||e.target.closest?.('input,textarea,select,[contenteditable]'))return;const modifier=modifierEvents[e.key];if(modifier&&!heldModifiers.has(modifier)){heldModifiers.add(modifier);refresh()}});
document.addEventListener('keyup',e=>{const modifier=modifierEvents[e.key];if(modifier&&heldModifiers.delete(modifier))refresh()});
window.addEventListener('blur',()=>{if(heldModifiers.size){heldModifiers.clear();refresh()}});
window.addEventListener('resize',()=>popoverPinned?positionKeyPopover():hideKeyPopover());window.addEventListener('scroll',()=>popoverPinned?positionKeyPopover():hideKeyPopover(),true);
for(const l of ['base','fn'])$(l).onclick=()=>{layer=l;selectedTarget=null;for(const x of ['base','fn'])$(x).setAttribute('aria-pressed',String(x===l));refresh();renderMapping()};
$('map-key').onchange=()=>{mappingSelected=$('map-key').value;renderMapping()};
$('mapping').onsubmit=e=>{e.preventDefault();const out=$('map-output').value.trim();if(!out)return;state.mappings[mappingSelected][layer]={output:out,note:$('map-note').value.trim(),status:state.mappings[mappingSelected][layer].status};save();render()};$('map-reset').onclick=()=>{if(confirm('恢复此键在当前层的初始映射记录？')){state.mappings[mappingSelected][layer]=initial().mappings[mappingSelected][layer];save();render()}};
$('model').onchange=()=>{const s=$('model').value.trim();if(s){state.model=s;state.layoutModels[state.layoutId]=s;save()}else $('model').value=state.model};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='全部快捷键地图-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('import').onclick=()=>$('file').click();$('file').onchange=async()=>{const f=$('file').files[0];try{if(!f)return;if(f.size>5000000)throw Error('备份不能超过 5 MB。');const incoming=migrate(JSON.parse(await f.text()));if(confirm('导入将替换当前网页的全部记录与映射。建议先导出备份。继续吗？')){state=incoming;save();render()}}catch(e){feedback('导入失败：'+e.message,true)}finally{$('file').value=''}};
$('reset').onclick=()=>{if(confirm('恢复初始资料会覆盖自定义记录与映射。请先导出备份，确定恢复吗？')){state=initial();save();render()}};
if(window.shortcutDesktop?.detectKeyboards){
 $('desktop-controls').hidden=false;
 $('layout-select').onchange=()=>switchLayout($('layout-select').value);
 $('detect-keyboard').onclick=async()=>{
  const status=$('desktop-detection');status.hidden=false;status.textContent='正在读取 Windows 键盘设备…';$('detect-keyboard').disabled=true;
  try{
   const result=await window.shortcutDesktop.detectKeyboards();
   if(result.suggestion&&Object.hasOwn(LAYOUTS,result.suggestion.layoutId)){
    switchLayout(result.suggestion.layoutId);
    if(result.suggestion.model&&result.suggestion.model.length<=80){state.model=result.suggestion.model;state.layoutModels[state.layoutId]=state.model;save();render()}
    status.textContent='识别到 '+result.suggestion.model+'，已切换到'+(result.suggestion.layoutId==='full'?'全键盘':'68 键')+'布局。';
   }else status.textContent='检测到 '+result.devices.length+' 组键盘设备；Windows 未提供可信的物理键数。请在上方选择 68 键或全键盘，应用会记住选择。';
  }catch{status.textContent='暂时无法读取键盘设备。请在上方选择布局，应用会记住选择。'}
  finally{$('detect-keyboard').disabled=false}
 };
}
validate(state);render();
