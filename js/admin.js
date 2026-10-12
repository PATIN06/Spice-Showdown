/* Spice Showdown: admin. Edits a draft menu in this browser and exports data/menu.json.
   Nothing here can change what players see until menu.json is committed to the repo. */
(function(){
'use strict';
var SS=window.SS,$=SS.$,$$=SS.$$,store=SS.store,el=SS.el;
var draft=null,published=null,saveT=null,warned=false;
var rowTarget=-1,pendingImg=null;

function clone(o){return JSON.parse(JSON.stringify(o))}

/* ---------- PIN (soft lock, hash lives in menu.json) ---------- */
function djb2(s){var h=5381,i;for(i=0;i<s.length;i++){h=((h<<5)+h+s.charCodeAt(i))>>>0}return 'x'+h.toString(36)}
function sha256(str){
  var c=window.crypto;
  if(c&&c.subtle&&c.subtle.digest&&typeof TextEncoder!=='undefined'){
    return c.subtle.digest('SHA-256',new TextEncoder().encode('spice:'+str)).then(function(buf){
      return Array.prototype.map.call(new Uint8Array(buf),function(x){return ('0'+x.toString(16)).slice(-2)}).join('');
    });
  }
  return Promise.resolve(djb2('spice:'+str));
}
function unlocked(){return store.sget(SS.KEY_UNLOCK)==='1'}

/* ---------- screens ---------- */
function showOnly(id){
  $('#boot').hidden=true;
  ['lock','dash'].forEach(function(s){$('#'+s).hidden=s!==id});
  var node=$('#'+id);node.classList.remove('enter');void node.offsetWidth;node.classList.add('enter');
  $('#lockNow').hidden=!(id==='dash'&&published&&published.adminPinHash);
}
function showDash(){showOnly('dash');renderAll()}
function showLock(){showOnly('lock');$('#pin').focus()}

/* ---------- draft persistence ---------- */
function commit(now){
  renderStatus();
  clearTimeout(saveT);
  var go=function(){
    if(!store.set(SS.KEY_DRAFT,draft)&&!warned){warned=true;SS.toast('This browser could not store the draft (photos may be too large). Export menu.json before you leave.')}
  };
  if(now)go();else saveT=setTimeout(go,400);
}
function outputMenu(){return SS.normalizeMenu(draft)}
function outputText(){return JSON.stringify(outputMenu(),null,2)+'\n'}

/* ---------- render ---------- */
function renderAll(){renderList();renderSettings();renderStatus();renderStats();renderPin()}

function renderStatus(){
  var out=outputMenu(),n=out.dishes.length;
  var dirty=JSON.stringify(out)!==JSON.stringify(published);
  var box=$('#status');
  box.classList.toggle('dirty',dirty);
  $('#statusTitle').textContent=dirty?'Unpublished changes':'Draft matches the published menu';
  var tip=n<3?' The menu needs at least 3 dishes before players can start.':'';
  $('#statusText').textContent=(dirty?'Players still see the old menu. Download menu.json and commit it to publish.':'Nothing to publish.')+tip;
  $('#listCount').textContent=n+(n===1?' dish':' dishes')+(n>1?' · '+(n-1)+' duels':'');
}

function renderList(){
  var ul=$('#adminList');ul.innerHTML='';
  if(!draft.dishes.length){ul.appendChild(el('li','empty','No dishes yet. Add one with the form.'));return}
  draft.dishes.forEach(function(d,i){
    var li=el('li','arow');

    var pic=el('div','apic');
    var img=document.createElement('img');img.src=SS.imgSrc(d);img.alt=d.name;
    var pb=el('button','btn',d.img?'Replace photo':'Add photo');pb.type='button';
    pb.addEventListener('click',function(){rowTarget=i;$('#rowFile').value='';$('#rowFile').click()});
    pic.appendChild(img);pic.appendChild(pb);
    if(d.img){
      var rb=el('button','link','Remove photo');rb.type='button';
      rb.addEventListener('click',function(){delete d.img;commit(true);renderList()});
      pic.appendChild(rb);
    }

    var f=el('div','afields');
    var lab=el('label','field');lab.style.margin='0';
    var cap=el('span','sr-only','Dish name');
    var inp=document.createElement('input');inp.className='input';inp.maxLength=40;inp.value=d.name;
    inp.id='dn-'+d.id;lab.htmlFor=inp.id;
    var good=d.name;
    inp.addEventListener('input',function(){if(inp.value.trim()){d.name=inp.value.slice(0,40);good=d.name}commit(false)});
    inp.addEventListener('change',function(){if(!inp.value.trim()){inp.value=good}d.name=good;img.alt=good;commit(true)});
    lab.appendChild(cap);lab.appendChild(inp);
    f.appendChild(lab);
    f.appendChild(SS.heatPicker(d.heat,function(n){d.heat=n;commit(true)}));

    var act=el('div','aact');
    function ib(html,label,cls,fn,dis){
      var b=el('button','iconbtn'+(cls?' '+cls:''));b.type='button';b.innerHTML=html;b.setAttribute('aria-label',label+' '+d.name);b.title=label;b.disabled=!!dis;
      b.addEventListener('click',fn);return b;
    }
    act.appendChild(ib(SS.UP,'Move up','',function(){move(i,-1)},i===0));
    act.appendChild(ib(SS.DOWN,'Move down','',function(){move(i,1)},i===draft.dishes.length-1));
    act.appendChild(ib(SS.CROSS,'Remove','danger',function(){draft.dishes.splice(i,1);commit(true);renderList()}));

    li.appendChild(pic);li.appendChild(f);li.appendChild(act);
    ul.appendChild(li);
  });
}
function move(i,dir){
  var j=i+dir,a=draft.dishes;
  if(j<0||j>=a.length)return;
  var t=a[i];a[i]=a[j];a[j]=t;
  commit(true);renderList();
}

function renderSettings(){
  $('#setTitle').value=draft.title;
  $('#setTagline').value=draft.tagline;
  $('#setShuffle').checked=draft.shuffle!==false;
}

function renderStats(){
  var t=SS.getTotals(),keys=Object.keys(t.items);
  var rows=keys.map(function(k){
    var it=t.items[k],m=null,i;
    for(i=0;i<draft.dishes.length;i++){if(draft.dishes[i].name.trim().toLowerCase()===k){m=draft.dishes[i];break}}
    return {name:it.name,img:m?SS.imgSrc(m):SS.placeholderURI(it.name),picks:it.picks,duels:it.duels};
  }).sort(function(a,b){return b.picks-a.picks||b.duels-a.duels||a.name.localeCompare(b.name)});
  var bars=$('#statBars');
  if(!rows.length){
    bars.innerHTML='';bars.appendChild(el('li','empty','No games played on this device yet.'));
    $('#statTop').textContent='';
    $('#statNote').textContent='Stats are kept per browser, so each device has its own count.';
  }else{
    SS.renderBars(bars,rows);
    $('#statTop').textContent='Most picked: '+SS.topLine(rows);
    var g=t.games||0;
    $('#statNote').textContent=g+(g===1?' game':' games')+' played on this device. Stats are kept per browser.';
  }
  $('#statReset').hidden=!rows.length;
}

function renderPin(){
  var pubPin=!!published.adminPinHash,drPin=!!draft.adminPinHash;
  var s;
  if(drPin&&pubPin)s='A PIN is set and published. This page asks for it before it opens.';
  else if(drPin)s='A PIN is set in your draft. Export menu.json to publish it.';
  else if(pubPin)s='The published menu has a PIN, but your draft removes it. Export menu.json to publish that change.';
  else s='No PIN is set. Anyone who knows the admin.html address can open this page and edit their own draft.';
  $('#pinState').textContent=s;
}

/* ---------- add form ---------- */
var addHeat=SS.heatPicker(3);
$('#addHeatField').appendChild(addHeat);
function setPreview(data){
  pendingImg=data;
  var p=$('#dropPrev'),d=$('#drop');
  if(data){p.src=data;p.hidden=false;d.classList.add('has');$('#dropText').textContent='Tap to change photo'}
  else{p.removeAttribute('src');p.hidden=true;d.classList.remove('has');$('#dropText').textContent='Drop a photo here or tap to choose'}
}
function takeFile(f){
  SS.fileToData(f).then(setPreview).catch(function(){$('#formMsg').textContent='That image could not be read. Try a JPG or PNG.'});
}
$('#dishPhoto').addEventListener('change',function(e){var f=e.target.files&&e.target.files[0];if(f)takeFile(f)});
var drop=$('#drop');
drop.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#dishPhoto').click()}});
['dragenter','dragover'].forEach(function(t){drop.addEventListener(t,function(e){e.preventDefault();drop.classList.add('over')})});
['dragleave','drop'].forEach(function(t){drop.addEventListener(t,function(e){e.preventDefault();drop.classList.remove('over')})});
drop.addEventListener('drop',function(e){var f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];if(f)takeFile(f)});
$('#addForm').addEventListener('submit',function(e){
  e.preventDefault();
  var msg=$('#formMsg'),inp=$('#dishName'),name=inp.value.trim();
  if(!name){msg.textContent='Give the dish a name first.';inp.focus();return}
  if(draft.dishes.length>=SS.MAX_DISHES){msg.textContent='The menu is full at '+SS.MAX_DISHES+' dishes. Remove one to add another.';return}
  var d={id:SS.uid(),name:name.slice(0,40),heat:addHeat.getValue()};
  if(pendingImg)d.img=pendingImg;
  draft.dishes.push(d);
  commit(true);renderList();
  inp.value='';setPreview(null);$('#dishPhoto').value='';
  msg.textContent=d.name+' added.';
  inp.focus();
});

/* replace a photo on an existing row */
$('#rowFile').addEventListener('change',function(e){
  var f=e.target.files&&e.target.files[0],d=draft.dishes[rowTarget];
  if(!f||!d)return;
  SS.fileToData(f).then(function(data){d.img=data;commit(true);renderList()}).catch(function(){SS.toast('That image could not be read. Try a JPG or PNG.')});
});

/* ---------- settings ---------- */
$('#setTitle').addEventListener('input',function(){draft.title=$('#setTitle').value;commit(false)});
$('#setTagline').addEventListener('input',function(){draft.tagline=$('#setTagline').value;commit(false)});
$('#setShuffle').addEventListener('change',function(){draft.shuffle=$('#setShuffle').checked;commit(true)});

/* ---------- publish ---------- */
function ready(){
  if(outputMenu().dishes.length<3){$('#pubMsg').textContent='Add at least 3 dishes before you export.';return false}
  $('#pubMsg').textContent='';return true;
}
$('#dl').addEventListener('click',function(){
  if(!ready())return;
  var text=outputText();
  try{
    var blob=new Blob([text],{type:'application/json'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');a.href=url;a.download='menu.json';
    document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(url);a.remove()},1000);
    $('#pubMsg').textContent='menu.json is downloading. Put it in the data folder of your repo.';
  }catch(err){
    showJson(text);
    $('#pubMsg').textContent='The download was blocked. Copy the JSON from the box below instead.';
  }
});
function showJson(text){
  var box=$('#jsonBox');box.value=text;box.hidden=false;box.focus();box.select();
}
$('#copy').addEventListener('click',function(){
  if(!ready())return;
  var text=outputText();
  var fallback=function(){showJson(text);$('#pubMsg').textContent='Copy blocked. The JSON is selected below: press Ctrl+C (or Cmd+C).'};
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(function(){$('#pubMsg').textContent='JSON copied. Paste it into data/menu.json.'}).catch(fallback);
  }else fallback();
});
$('#importBtn').addEventListener('click',function(){$('#importFile').value='';$('#importFile').click()});
$('#importFile').addEventListener('change',function(e){
  var f=e.target.files&&e.target.files[0];if(!f)return;
  var fr=new FileReader();
  fr.onload=function(){
    try{
      var m=SS.normalizeMenu(JSON.parse(fr.result));
      if(!m.dishes.length)throw new Error('empty');
      draft=m;commit(true);renderAll();
      $('#pubMsg').textContent='Imported '+m.dishes.length+' dishes into the draft.';
    }catch(err){$('#pubMsg').textContent='That file is not a valid menu.json.'}
  };
  fr.onerror=function(){$('#pubMsg').textContent='That file could not be read.'};
  fr.readAsText(f);
});
$('#preview').addEventListener('click',function(){clearTimeout(saveT);store.set(SS.KEY_DRAFT,draft)});
SS.twoStep($('#discard'),'Tap again to discard',function(){
  draft=clone(published);commit(true);renderAll();
  $('#pubMsg').textContent='Draft reset to the published menu.';
});
SS.twoStep($('#statReset'),'Tap again to reset',function(){
  store.set(SS.KEY_TOTALS,{games:0,items:{}});renderStats();
});

/* ---------- PIN ---------- */
$('#pinSet').addEventListener('click',function(){
  var v=$('#pinNew').value;
  if(v.length<4){$('#pinMsg').textContent='Use at least 4 characters.';return}
  sha256(v).then(function(h){
    draft.adminPinHash=h;$('#pinNew').value='';commit(true);renderPin();
    $('#pinMsg').textContent='PIN saved in the draft. Export menu.json to publish it.';
  });
});
$('#pinClear').addEventListener('click',function(){
  delete draft.adminPinHash;commit(true);renderPin();
  $('#pinMsg').textContent='PIN removed from the draft. Export menu.json to publish the change.';
});
$('#lockForm').addEventListener('submit',function(e){
  e.preventDefault();
  sha256($('#pin').value).then(function(h){
    if(h===published.adminPinHash){store.sset(SS.KEY_UNLOCK,'1');$('#pin').value='';$('#lockMsg').textContent='';showDash()}
    else{$('#lockMsg').textContent='That PIN does not match.';$('#pin').select()}
  });
});
$('#lockNow').addEventListener('click',function(){store.sdel(SS.KEY_UNLOCK);showLock()});

/* ---------- boot ---------- */
SS.loadPublished().then(function(r){
  published=r.menu;
  var d=store.get(SS.KEY_DRAFT);
  draft=d?SS.normalizeMenu(d):clone(published);
  if(published.adminPinHash&&!unlocked())showLock();else showDash();
  if(r.source==='sample')SS.toast('data/menu.json could not be loaded, so the built-in sample menu is shown. Serve the folder over http (see the README).');
});
})();
