/* Spice Showdown: หน้าผู้จัด
   แก้ฉบับร่างในเบราว์เซอร์ แล้วกด "บันทึกและเผยแพร่" เพื่อ commit data/menu.json และรูปลง GitHub repo
   ด้วย GitHub API (ต้องใช้ fine-grained token ที่มีสิทธิ์ Contents: Read and write เฉพาะ repo นี้)
   ถ้าไม่เชื่อมต่อ ยังดาวน์โหลด menu.json ไปวางเองได้ */
(function(){
'use strict';
var SS=window.SS,$=SS.$,store=SS.store,el=SS.el,stats=SS.stats;
var statsT=null,statsBusy=false;
var KEY_GH='ss.gh.v1';
var draft=null,published=null,saveT=null,warned=false;
var rowTarget=-1,pendingImg=null,flashId=null,newId=null;
var gh=null,baseSha=null,saving=false,conflict=null,phase='idle',watchT=null;

function clone(o){return JSON.parse(JSON.stringify(o))}
function sig(m){var o=SS.normalizeMenu(m);delete o.version;delete o.adminPinHash;return JSON.stringify(o)}
function outputMenu(){return SS.normalizeMenu(draft)}
function isDirty(){return sig(draft)!==sig(published)}
function say(id,t){$('#'+id).textContent=t||''}

/* ---------- ฉบับร่าง ---------- */
function commit(now){
  renderStatus();
  clearTimeout(saveT);
  var go=function(){
    if(!store.set(SS.KEY_DRAFT,draft)&&!warned){warned=true;SS.toast('เบราว์เซอร์เก็บฉบับร่างไม่ได้ (รูปอาจใหญ่เกิน) ให้บันทึกหรือดาวน์โหลด menu.json ก่อนปิดหน้า')}
  };
  if(now)go();else saveT=setTimeout(go,400);
}

/* ---------- สถานะ ---------- */
function setStatus(kind,title,text){
  var box=$('#status');
  ['dirty','saving','waiting','error','just-saved'].forEach(function(c){box.classList.toggle(c,c===kind)});
  $('#statusTitle').textContent=title;$('#statusText').textContent=text;
}
function setProg(f){$('#progBar').style.width=Math.round(Math.max(0,Math.min(1,f))*100)+'%'}
function renderStatus(){
  var n=outputMenu().dishes.length;
  $('#listCount').textContent=n+' จาน'+(n>1?' · '+(n-1)+' รอบ':'');
  if(saving)return;
  var dirty=isDirty(),tip=n<3?' เมนูต้องมีอย่างน้อย 3 จานผู้เล่นถึงจะเริ่มเกมได้':'';
  if(dirty){
    setStatus('dirty','มีการแก้ไขที่ยังไม่ได้เผยแพร่',(gh?'ผู้เล่นยังเห็นเมนูเดิม กด "บันทึกและเผยแพร่" ได้เลย':'ผู้เล่นยังเห็นเมนูเดิม เชื่อมต่อ GitHub แล้วกดบันทึก หรือดาวน์โหลด menu.json ไปวางเอง')+'.'+tip);
  }else if(phase==='idle'){
    setStatus('','ฉบับร่างตรงกับเมนูที่เผยแพร่','ไม่มีอะไรต้องเผยแพร่.'+tip);
  }
}

/* ---------- รายการเมนู ---------- */
function renderAll(){renderList();renderSettings();renderStatus()}
function renderList(){
  var ul=$('#adminList');ul.innerHTML='';
  if(!draft.dishes.length){ul.appendChild(el('li','empty','ยังไม่มีเมนู เพิ่มได้จากฟอร์มด้านล่าง'));return}
  draft.dishes.forEach(function(d,i){
    var li=el('li','arow'+(d.id===newId?' new':'')+(d.id===flashId?' flash':''));
    var pic=el('div','apic');
    var img=document.createElement('img');SS.setImg(img,d);img.alt=d.name;
    var pb=el('button','btn',d.img?'เปลี่ยนรูป':'เพิ่มรูป');pb.type='button';
    pb.addEventListener('click',function(){rowTarget=i;$('#rowFile').value='';$('#rowFile').click()});
    pic.appendChild(img);pic.appendChild(pb);
    if(d.img){
      var rb=el('button','link','ลบรูป');rb.type='button';
      rb.addEventListener('click',function(){delete d.img;flashId=d.id;newId=null;commit(true);renderList()});
      pic.appendChild(rb);
    }
    var f=el('div','afields');
    var lab=el('label','field');lab.style.margin='0';
    var cap=el('span','sr-only','ชื่อเมนู');
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
    act.appendChild(ib(SS.UP,'ย้ายขึ้น','',function(){move(i,-1)},i===0));
    act.appendChild(ib(SS.DOWN,'ย้ายลง','',function(){move(i,1)},i===draft.dishes.length-1));
    act.appendChild(ib(SS.CROSS,'ลบ','danger',function(){
      if(li.classList.contains('leaving'))return;
      li.classList.add('leaving');
      setTimeout(function(){var k=draft.dishes.indexOf(d);if(k>=0)draft.dishes.splice(k,1);newId=flashId=null;commit(true);renderList()},340);
    }));
    li.appendChild(pic);li.appendChild(f);li.appendChild(act);
    ul.appendChild(li);
  });
}
function move(i,dir){
  var j=i+dir,a=draft.dishes;
  if(j<0||j>=a.length)return;
  var t=a[i];a[i]=a[j];a[j]=t;
  flashId=t.id;newId=null;
  commit(true);renderList();
}
function renderSettings(){
  $('#setTitle').value=draft.title;
  $('#setTagline').value=draft.tagline;
  $('#setHow').value=(draft.howTo||[]).join('\n');
  $('#setShuffle').checked=draft.shuffle!==false;
}

/* ---------- ฟอร์มเพิ่มเมนู ---------- */
var addHeat=SS.heatPicker(3);
$('#addHeatField').appendChild(addHeat);
function setPreview(data){
  pendingImg=data;
  var p=$('#dropPrev'),d=$('#drop');
  if(data){p.src=data;p.hidden=false;d.classList.add('has');$('#dropText').textContent='แตะเพื่อเปลี่ยนรูป'}
  else{p.removeAttribute('src');p.hidden=true;d.classList.remove('has');$('#dropText').textContent='ลากรูปมาวาง หรือแตะเพื่อเลือกรูป'}
}
function takeFile(f){
  SS.fileToData(f).then(setPreview).catch(function(){say('formMsg','อ่านรูปนี้ไม่ได้ ลองใช้ไฟล์ JPG หรือ PNG')});
}
$('#dishPhoto').addEventListener('change',function(e){var f=e.target.files&&e.target.files[0];if(f)takeFile(f)});
var drop=$('#drop');
drop.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#dishPhoto').click()}});
['dragenter','dragover'].forEach(function(t){drop.addEventListener(t,function(e){e.preventDefault();drop.classList.add('over')})});
['dragleave','drop'].forEach(function(t){drop.addEventListener(t,function(e){e.preventDefault();drop.classList.remove('over')})});
drop.addEventListener('drop',function(e){var f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];if(f)takeFile(f)});
$('#addForm').addEventListener('submit',function(e){
  e.preventDefault();
  var inp=$('#dishName'),name=inp.value.trim();
  if(!name){say('formMsg','ตั้งชื่อเมนูก่อน');inp.focus();return}
  if(draft.dishes.length>=SS.MAX_DISHES){say('formMsg','เมนูเต็มแล้ว ('+SS.MAX_DISHES+' จาน) ลบจานเดิมก่อนถึงจะเพิ่มได้');return}
  var d={id:SS.uid(),name:name.slice(0,40),heat:addHeat.getValue()};
  if(pendingImg)d.img=pendingImg;
  draft.dishes.push(d);
  newId=d.id;flashId=null;
  commit(true);renderList();
  inp.value='';setPreview(null);$('#dishPhoto').value='';
  say('formMsg','เพิ่ม '+d.name+' แล้ว');
  inp.focus();
});
$('#rowFile').addEventListener('change',function(e){
  var f=e.target.files&&e.target.files[0],d=draft.dishes[rowTarget];
  if(!f||!d)return;
  SS.fileToData(f).then(function(data){d.img=data;flashId=d.id;newId=null;commit(true);renderList()}).catch(function(){SS.toast('อ่านรูปนี้ไม่ได้ ลองใช้ไฟล์ JPG หรือ PNG')});
});

/* ---------- ตั้งค่าเกม ---------- */
$('#setTitle').addEventListener('input',function(){draft.title=$('#setTitle').value;commit(false)});
$('#setTagline').addEventListener('input',function(){draft.tagline=$('#setTagline').value;commit(false)});
$('#setHow').addEventListener('input',function(){draft.howTo=$('#setHow').value.split('\n').slice(0,40);commit(false)});
$('#howReset').addEventListener('click',function(){draft.howTo=SS.DEFAULT_HOWTO.slice();$('#setHow').value=draft.howTo.join('\n');commit(true)});
$('#setShuffle').addEventListener('change',function(){draft.shuffle=$('#setShuffle').checked;commit(true)});

/* ---------- สำรอง / นำเข้า ---------- */
function download(text,name){
  var blob=new Blob([text],{type:'application/json'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;a.download=name;
  document.body.appendChild(a);a.click();
  setTimeout(function(){URL.revokeObjectURL(url);a.remove()},1000);
}
$('#dl').addEventListener('click',function(){
  if(outputMenu().dishes.length<3){say('pubMsg','เพิ่มเมนูให้ครบอย่างน้อย 3 จานก่อน');return}
  try{download(JSON.stringify(outputMenu(),null,2)+'\n','menu.json');say('pubMsg','กำลังดาวน์โหลด menu.json')}
  catch(err){say('pubMsg','เบราว์เซอร์บล็อกการดาวน์โหลด')}
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
      say('pubMsg','นำเข้า '+m.dishes.length+' จานเข้าฉบับร่างแล้ว');
    }catch(err){say('pubMsg','ไฟล์นี้ไม่ใช่ menu.json ที่ถูกต้อง')}
  };
  fr.onerror=function(){say('pubMsg','อ่านไฟล์ไม่ได้')};
  fr.readAsText(f);
});
$('#preview').addEventListener('click',function(){clearTimeout(saveT);store.set(SS.KEY_DRAFT,draft)});
SS.twoStep($('#discard'),'แตะอีกครั้งเพื่อทิ้ง',function(){
  if(saving)return;
  draft=clone(published);conflict=null;$('#conflict').hidden=true;commit(true);renderAll();
  say('pubMsg','ทิ้งการแก้ไขแล้ว กลับไปใช้เมนูที่เผยแพร่');
});

/* ---------- GitHub API ---------- */
function ghCall(method,path,body,tries){
  tries=tries||(method==='PATCH'?1:3);
  var n=0;
  function once(){
    n++;
    var ctrl=typeof AbortController!=='undefined'?new AbortController():null;
    var timer=setTimeout(function(){if(ctrl)ctrl.abort()},30000);
    var init={method:method,cache:'no-store',headers:{'Accept':'application/vnd.github+json','Authorization':'Bearer '+gh.token,'X-GitHub-Api-Version':'2022-11-28'}};
    if(ctrl)init.signal=ctrl.signal;
    if(body){init.body=JSON.stringify(body);init.headers['Content-Type']='application/json'}
    return fetch('https://api.github.com'+path,init).then(function(r){
      clearTimeout(timer);
      return r.text().then(function(t){
        var j=null;try{j=t?JSON.parse(t):null}catch(e){}
        return {status:r.status,ok:r.ok,json:j,remaining:r.headers&&r.headers.get?r.headers.get('x-ratelimit-remaining'):null};
      });
    },function(){clearTimeout(timer);return {status:0,ok:false,network:true}}).then(function(res){
      if((res.network||res.status>=500)&&n<tries)return new Promise(function(ok){setTimeout(ok,800*n)}).then(once);
      return res;
    });
  }
  return once();
}
function ghMessage(r,what){
  if(r.network)return 'เชื่อมต่อ GitHub ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง';
  if(r.status===401)return 'GitHub ไม่รับ token นี้ (ผิดหรือหมดอายุ) สร้าง token ใหม่แล้วเชื่อมต่ออีกครั้ง';
  if(r.status===403&&r.remaining==='0')return 'ใช้โควตา GitHub เกินชั่วคราว รอสักครู่แล้วลองใหม่';
  if(r.status===403)return 'token นี้ไม่มีสิทธิ์เขียนใน repo นี้ ตรวจว่าตั้ง Contents เป็น Read and write และเลือก repo ถูกตัว';
  if(r.status===404)return 'ไม่พบ '+(what||'repo')+' หรือ token นี้เข้าถึง repo นี้ไม่ได้ ตรวจชื่อ repo และสิทธิ์ของ token';
  var m=r.json&&r.json.message?String(r.json.message).slice(0,160):'';
  return 'GitHub ตอบกลับผิดปกติ ('+r.status+')'+(m?': '+m:'');
}
function b64ToText(b64){
  var bin=atob(String(b64).replace(/\s/g,'')),bytes=new Uint8Array(bin.length),i;
  for(i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}
/* อ่าน data/menu.json จาก repo โดยตรง (ไม่ผ่านแคชของ GitHub Pages). resolve {menu,sha} หรือ {error} */
function readRemoteMenu(ref){
  return ghCall('GET','/repos/'+gh.repo+'/contents/data/menu.json?ref='+encodeURIComponent(ref)).then(function(r){
    if(r.status===404)return {menu:null,sha:null};
    if(!r.ok||!r.json||!r.json.sha)return {error:ghMessage(r,'ไฟล์เมนู')};
    var sha=r.json.sha;
    function parse(b64){
      try{return {menu:SS.normalizeMenu(JSON.parse(b64ToText(b64))),sha:sha}}
      catch(e){return {error:'ไฟล์ data/menu.json บน GitHub อ่านไม่ได้ (รูปแบบไม่ถูกต้อง)'}}
    }
    if(r.json.content)return parse(r.json.content);
    return ghCall('GET','/repos/'+gh.repo+'/git/blobs/'+sha).then(function(b){
      if(!b.ok||!b.json||!b.json.content)return {error:ghMessage(b,'ไฟล์เมนู')};
      return parse(b.json.content);
    });
  });
}

/* ---------- เชื่อมต่อ ---------- */
function parseRepo(v){
  v=String(v||'').trim().replace(/^https?:\/\/github\.com\//i,'').replace(/\.git$/i,'').replace(/\/+$/,'');
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(v)?v:null;
}
function guessRepo(){
  var m=/^([a-z0-9-]+)\.github\.io$/i.exec(location.hostname||''),seg=(location.pathname||'').split('/')[1];
  if(m&&seg&&!/\./.test(seg))return m[1]+'/'+seg;
  return m?m[1]+'/'+m[1]+'.github.io':'';
}
function showGh(){
  $('#ghOff').hidden=!!gh;$('#ghOn').hidden=!gh;
  if(gh)$('#ghWho').textContent='เชื่อมต่อกับ '+gh.repo+' (สาขา '+gh.branch+')';
}
function saveGh(){
  var rec={repo:gh.repo,branch:gh.branch,token:gh.token};
  store.sdel(KEY_GH);
  if(gh.remember){store.set(KEY_GH,rec);store.sdel('ss.gh.tmp')}
  else{store.sset('ss.gh.tmp',JSON.stringify(rec));try{localStorage.removeItem(KEY_GH)}catch(e){}}
}
function loadGh(){
  var r=store.get(KEY_GH),remember=true;
  if(!r){try{r=JSON.parse(store.sget('ss.gh.tmp')||'null')}catch(e){r=null};remember=false}
  if(r&&r.repo&&r.token&&r.branch)return {repo:r.repo,branch:r.branch,token:r.token,remember:remember};
  return null;
}
function afterConnect(remote){
  /* ใช้เมนูบน GitHub เป็นฐาน. ถ้ามีฉบับร่างที่แก้ไว้จากเมนูอื่น ให้ถามก่อนเขียนทับ */
  var siteSig=sig(published);
  baseSha=remote.sha;
  if(remote.menu){
    var dirty=isDirty();
    published=remote.menu;
    if(!dirty)draft=clone(published);
    else if(sig(remote.menu)!==siteSig){conflict={menu:remote.menu,sha:remote.sha};showConflict()}
  }
  commit(true);renderAll();showGh();
}
function connect(){
  var repo=parseRepo($('#ghRepo').value),token=$('#ghToken').value.trim();
  if(!repo){say('ghMsg','พิมพ์ชื่อ repo ให้ถูกรูปแบบ เช่น somchai/spice-showdown');return}
  if(!token){say('ghMsg','วาง GitHub token ก่อน');return}
  var btn=$('#ghConnect');btn.disabled=true;say('ghMsg','กำลังตรวจสอบ...');
  gh={repo:repo,branch:'',token:token,remember:$('#ghRemember').checked};
  function fail(msg){gh=null;btn.disabled=false;say('ghMsg',msg)}
  ghCall('GET','/repos/'+repo).then(function(r){
    if(!r.ok)return fail(ghMessage(r));
    if(r.json&&r.json.permissions&&r.json.permissions.push===false)return fail('token นี้อ่านได้อย่างเดียว ต้องตั้ง Contents เป็น Read and write');
    gh.branch=(r.json&&r.json.default_branch)||'main';
    return readRemoteMenu(gh.branch).then(function(rm){
      if(rm.error)return fail(rm.error);
      btn.disabled=false;$('#ghToken').value='';say('ghMsg','');
      saveGh();afterConnect(rm);
      SS.toast('เชื่อมต่อ GitHub แล้ว');
    });
  });
}
$('#ghConnect').addEventListener('click',connect);
$('#ghToken').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();connect()}});
$('#ghOut').addEventListener('click',function(){
  if(saving)return;
  gh=null;baseSha=null;store.sdel(KEY_GH);store.sdel('ss.gh.tmp');
  try{localStorage.removeItem(KEY_GH)}catch(e){}
  showGh();say('saveMsg','');renderStatus();
  SS.toast('ตัดการเชื่อมต่อแล้ว ลบ token ออกจากเครื่องนี้แล้ว');
});

/* ---------- บันทึกและเผยแพร่ ---------- */
function setBusy(b){
  saving=b;
  var btn=$('#saveBtn');btn.disabled=b;btn.classList.toggle('busy',b);
  var g=$('.admin-grid');
  if(b)g.setAttribute('inert','');else g.removeAttribute('inert');
}
function stopWatch(){if(watchT){clearInterval(watchT);watchT=null}}
function showConflict(){
  setStatus('error','เมนูบน GitHub ถูกแก้ไปก่อนแล้ว','เลือกด้านล่างว่าจะเก็บเวอร์ชันไหน');
  $('#conflict').hidden=false;
}
function failSave(title,text){
  setBusy(false);setProg(0);phase='idle';
  setStatus('error',title,text);
  var b=$('#status');b.classList.remove('shake');void b.offsetWidth;b.classList.add('shake');
  $('#saveLabel').textContent='บันทึกและเผยแพร่';
  say('saveMsg',text);
}
function tokenDead(){
  gh=null;baseSha=null;store.sdel(KEY_GH);store.sdel('ss.gh.tmp');
  try{localStorage.removeItem(KEY_GH)}catch(e){}
  showGh();
}
function extOf(data){var m=/^data:image\/(png|jpe?g|webp|gif);base64,/.exec(data);return m?(m[1]==='jpeg'?'jpg':m[1]):null}

function save(force){
  if(saving||!gh)return;
  var out=outputMenu();
  if(out.dishes.length<3){say('saveMsg','เพิ่มเมนูให้ครบอย่างน้อย 3 จานก่อนบันทึก');return}
  stopWatch();phase='saving';
  say('saveMsg','');setBusy(true);$('#saveLabel').textContent='กำลังบันทึก...';
  $('#conflict').hidden=true;
  var repo='/repos/'+gh.repo,branch=gh.branch;
  var photos=out.dishes.filter(function(d){return d.img&&d.img.indexOf('data:')===0});
  var steps=photos.length+6,done=0;
  function tick(text){done++;setProg(done/steps*.95);if(text)$('#statusText').textContent=text}
  setStatus('saving','กำลังบันทึก...','เชื่อมต่อ GitHub');setProg(.04);
  function bad(r,what){
    if(r.status===401){tokenDead();failSave('token ใช้ไม่ได้',ghMessage(r));return null}
    failSave('บันทึกไม่สำเร็จ',ghMessage(r,what));return null;
  }
  var head,tree,newSha;
  ghCall('GET',repo+'/git/ref/heads/'+encodeURIComponent(branch)).then(function(r){
    if(!r.ok)return bad(r,'สาขา '+branch);
    head=r.json.object.sha;tick('ตรวจว่าเมนูบน GitHub ยังเป็นของเดิม');
    return ghCall('GET',repo+'/git/commits/'+head).then(function(c){
      if(!c.ok)return bad(c);
      tree=c.json.tree.sha;
      return readRemoteMenu(head).then(function(rm){
        if(rm.error){failSave('บันทึกไม่สำเร็จ',rm.error);return null}
        tick();
        if(!force&&rm.sha!==baseSha){
          if(rm.menu&&sig(rm.menu)===sig(draft)){      // เนื้อหาเหมือนกันอยู่แล้ว
            setBusy(false);baseSha=rm.sha;published=rm.menu;draft=clone(rm.menu);commit(true);renderAll();
            phase='idle';renderStatus();say('saveMsg','เมนูบน GitHub ตรงกับของคุณอยู่แล้ว');return null;
          }
          conflict={menu:rm.menu,sha:rm.sha};
          setBusy(false);setProg(0);phase='idle';$('#saveLabel').textContent='บันทึกและเผยแพร่';
          showConflict();say('saveMsg','เมนูบน GitHub ต่างจากที่คุณเริ่มแก้');
          return null;
        }
        return upload();
      });
    });
  });

  function upload(){
    var entries=[],made=Object.create(null),ver='v'+Date.now().toString(36);
    function nextPhoto(k){
      if(k>=photos.length)return Promise.resolve(true);
      var d=photos[k],ext=extOf(d.img);
      if(!ext){failSave('รูปใช้ไม่ได้','รูปของ "'+d.name+'" ไม่ใช่ไฟล์ภาพที่รองรับ');return Promise.resolve(false)}
      var name='dish-'+String(d.id).replace(/[^A-Za-z0-9_-]/g,'').slice(0,40)+'-'+Date.now().toString(36)+'.'+ext;
      return ghCall('POST',repo+'/git/blobs',{content:d.img.replace(/^data:[^,]*,/,''),encoding:'base64'}).then(function(r){
        if(!r.ok){bad(r);return false}
        entries.push({path:'images/'+name,mode:'100644',type:'blob',sha:r.json.sha});
        made['images/'+name]=1;d.img='images/'+name;tick('อัปโหลดรูปแล้ว '+(k+1)+'/'+photos.length);
        return nextPhoto(k+1);
      });
    }
    return nextPhoto(0).then(function(ok){
      if(!ok)return;
      out.version=ver;delete out.adminPinHash;
      var text=JSON.stringify(out,null,2)+'\n';
      return ghCall('POST',repo+'/git/blobs',{content:text,encoding:'utf-8'}).then(function(r){
        if(!r.ok)return bad(r);
        newSha=r.json.sha;
        entries.push({path:'data/menu.json',mode:'100644',type:'blob',sha:newSha});tick('ลบรูปเก่าที่ไม่ได้ใช้แล้ว');
        /* ลบรูป dish-*.jpg ที่ระบบเคยอัปโหลดและเมนูใหม่ไม่ได้ใช้ (ไม่แตะรูปอื่นของคุณ) */
        var used=Object.create(null);out.dishes.forEach(function(d){if(d.img)used[d.img.replace(/^\.\//,'')]=1});
        return ghCall('GET',repo+'/contents/images?ref='+encodeURIComponent(head)).then(function(l){
          if(l.ok&&Array.isArray(l.json)){
            l.json.forEach(function(f){
              var p='images/'+f.name;
              if(f.type==='file'&&/^dish-[A-Za-z0-9_-]+\.(jpg|png|webp|gif)$/.test(f.name)&&!used[p]&&!made[p])entries.push({path:p,mode:'100644',type:'blob',sha:null});
            });
          }
          return ghCall('POST',repo+'/git/trees',{base_tree:tree,tree:entries});
        });
      }).then(function(t){
        if(!t)return;
        if(!t.ok)return bad(t);
        tick('สร้างรายการเปลี่ยนแปลง');
        return ghCall('POST',repo+'/git/commits',{message:'อัปเดตเมนูจากหน้าผู้จัด ('+out.dishes.length+' จาน)',tree:t.json.sha,parents:[head]});
      }).then(function(c){
        if(!c)return;
        if(!c.ok)return bad(c);
        tick('เผยแพร่ขึ้นสาขา '+branch);
        return ghCall('PATCH',repo+'/git/refs/heads/'+encodeURIComponent(branch),{sha:c.json.sha,force:false});
      }).then(function(p){
        if(!p)return;
        if(p.status===422||p.status===409){          // มีคน push เข้ามาระหว่างนี้
          failSave('มีการเปลี่ยนแปลงบน GitHub ระหว่างบันทึก','ยังไม่ได้บันทึกอะไร การแก้ไขของคุณยังอยู่ กดบันทึกอีกครั้ง');return;
        }
        if(!p.ok)return bad(p,'สาขา '+branch);
        savedOk(out,newSha,ver);
      });
    });
  }
}

function savedOk(out,sha,ver){
  setBusy(false);
  baseSha=sha;published=SS.normalizeMenu(out);published.version=ver;draft=clone(published);conflict=null;
  commit(true);renderAll();setProg(1);
  $('#saveLabel').textContent='บันทึกและเผยแพร่';
  say('saveMsg','บันทึกลง GitHub แล้วเมื่อ '+new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}));
  watchLive(ver);
  refreshStats();
}

/* รอให้ GitHub Pages อัปเดต แล้วเช็กว่าเว็บจริงเห็นเมนูใหม่แล้ว */
function watchLive(ver){
  var host=location.hostname||'';
  if(!/^https?:$/.test(location.protocol)||!host||host==='localhost'||/^127\./.test(host)||/^\[?::1/.test(host)){
    phase='saved';setStatus('just-saved','บันทึกลง GitHub แล้ว','GitHub Pages จะอัปเดตเว็บให้ภายใน 1 ถึง 2 นาที');return;
  }
  phase='waiting';
  setStatus('waiting','บันทึกแล้ว กำลังรอ GitHub Pages อัปเดตเว็บ','ปกติใช้เวลา 1 ถึง 2 นาที ปิดหน้านี้ได้ ไม่เสียงานที่บันทึกไปแล้ว');
  var t0=Date.now(),busy=false;
  stopWatch();
  watchT=setInterval(function(){
    if(busy)return;
    if(Date.now()-t0>240000){
      stopWatch();phase='saved';
      if(!isDirty())setStatus('just-saved','บันทึกลง GitHub แล้ว','ยังไม่เห็นบนเว็บ ให้รออีกสักครู่แล้วรีเฟรชหน้าผู้เล่น');
      return;
    }
    busy=true;
    fetch(SS.MENU_URL+'?v='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(j){
      busy=false;
      if(j&&j.version===ver){
        stopWatch();phase='saved';
        if(!isDirty())setStatus('just-saved','เผยแพร่แล้ว ผู้เล่นเห็นเมนูใหม่แล้ว','เปิดหน้าผู้เล่นเพื่อลองเล่นได้เลย');
      }
    },function(){busy=false});
  },5000);
}

$('#saveBtn').addEventListener('click',function(){save(false)});
$('#conLoad').addEventListener('click',function(){
  if(!conflict)return;
  if(conflict.menu){published=conflict.menu;draft=clone(published)}
  baseSha=conflict.sha;conflict=null;$('#conflict').hidden=true;
  phase='idle';commit(true);renderAll();
});
$('#conForce').addEventListener('click',function(){
  if(!conflict)return;
  baseSha=conflict.sha;conflict=null;$('#conflict').hidden=true;save(true);
});
window.addEventListener('beforeunload',function(e){
  if(saving||(draft&&published&&isDirty())){e.preventDefault();e.returnValue=''}
});

/* ---------- สถิติรวมทุกคน ---------- */
function paintStats(j){
  var map={};j.rows.forEach(function(r){map[r.id]=r});
  var games=Number(j.games)||0;
  var rows=published.dishes.map(function(d){
    var r=map[d.id]||{picks:0,duels:0,finals:0},pct=games?Math.round(r.finals/games*100):0;
    return {name:d.name,dish:d,picks:r.picks,duels:r.duels,finals:r.finals,score:r.finals,prefix:'จานสุดท้าย ',suffix:' ครั้ง ('+pct+'%) · ชนะดวล '+r.picks+' ครั้ง',badge:'คนชอบที่สุด'};
  }).sort(function(a,b){return b.finals-a.finals||b.picks-a.picks||a.name.localeCompare(b.name)});
  if(!games){
    $('#statBars').innerHTML='';$('#statBars').appendChild(el('li','empty','ยังไม่มีใครเล่น ผลจะขึ้นที่นี่ทันทีที่เกมแรกจบ'));
    $('#statTop').textContent='';
  }else{
    SS.renderBars($('#statBars'),rows);
    $('#statTop').textContent=SS.topLine(rows,'final');
  }
  $('#statNote').textContent='มีคนเล่นแล้ว '+games+' เกม รายการนี้รีเฟรชเองทุก 20 วินาที (ล้างสถิติ: ดูใน docs/STATS.th.md)';
}
function refreshStats(){
  if(statsBusy||!stats.enabled)return;
  statsBusy=true;
  stats.get().then(function(j){statsBusy=false;if(j&&j.ok&&Array.isArray(j.rows)&&published)paintStats(j)},function(){statsBusy=false});
}
function initStats(){
  if(!stats.enabled){
    $('#statBars').innerHTML='';
    $('#statBars').appendChild(el('li','empty','ยังไม่ได้เปิดสถิติรวม ใส่ที่อยู่ Google Apps Script ใน config.js ตามคู่มือ docs/STATS.th.md'));
    return;
  }
  $('#liveTag').hidden=false;
  refreshStats();
  statsT=setInterval(function(){if(!document.hidden)refreshStats()},20000);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)refreshStats()});
}

/* ---------- เริ่มต้น ---------- */
SS.loadPublished().then(function(r){
  published=r.menu;
  var d=store.get(SS.KEY_DRAFT);
  draft=d?SS.normalizeMenu(d):clone(published);
  $('#boot').hidden=true;
  $('#dash').hidden=false;
  var node=$('#dash');node.classList.remove('enter');void node.offsetWidth;node.classList.add('enter');
  $('#ghRepo').value=guessRepo();
  gh=loadGh();
  renderAll();showGh();initStats();
  if(r.source==='sample')SS.toast('โหลด data/menu.json ไม่ได้ จึงแสดงเมนูตัวอย่างแทน ถ้าเปิดไฟล์ในเครื่อง ให้เปิดผ่านเซิร์ฟเวอร์ (ดู README)');
  if(gh){
    readRemoteMenu(gh.branch).then(function(rm){
      if(rm.error){say('saveMsg',rm.error);return}
      afterConnect(rm);
    });
  }
});
})();
