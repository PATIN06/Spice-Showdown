/* Spice Showdown: player. Loads data/menu.json and runs the duel game.
   Open index.html#draft to play the admin's unpublished draft instead. */
(function(){
'use strict';
var SS=window.SS,$=SS.$,$$=SS.$$,RM=SS.RM,store=SS.store,stats=SS.stats;
var shared=stats.enabled,statsToken=0;
var menu=null,dishes=[],scene='start',isDraft=false;
var G={pool:[],queue:[],L:null,R:null,round:0,total:0,picks:{},duels:{},streak:0,defender:null,log:[],locked:true,champ:null,totals:null,submitP:null};
var cardL=$('#cardL'),cardR=$('#cardR');

/* ---------- scenes ---------- */
function show(name){
  scene=name;
  $$('.scene').forEach(function(s){s.hidden=s.id!=='scene-'+name});
  var el=$('#scene-'+name);el.classList.remove('enter');void el.offsetWidth;el.classList.add('enter');
  window.scrollTo(0,0);
}
function byId(id){for(var i=0;i<G.pool.length;i++){if(G.pool[i].id===id)return G.pool[i]}return null}

/* ---------- start screen ---------- */
function applyMenu(m,draftMode){
  menu=m;dishes=m.dishes;isDraft=!!draftMode;
  document.title=m.title;
  $('#brandName').textContent=m.title;
  $('#draftPill').hidden=!isDraft;
  var h1=$('#title');h1.innerHTML='';
  var words=m.title.split(' ');var last=words.pop();
  if(words.length)h1.appendChild(document.createTextNode(words.join(' ')+' '));
  h1.appendChild(SS.el('span','hot',last));
  $('#tagline').textContent=m.tagline;
  var how=$('#howTo');how.innerHTML='';
  (m.howTo||[]).forEach(function(t){how.appendChild(SS.el('li',null,t))});
  var shelf=$('#shelf');shelf.innerHTML='';shelf.removeAttribute('aria-busy');
  dishes.forEach(function(f,i){
    var li=document.createElement('li');li.style.animationDelay=(i*40)+'ms';
    var im=document.createElement('img');im.alt='';SS.setImg(im,f);
    li.appendChild(im);
    li.appendChild(SS.el('span','n',f.name));
    var hw=document.createElement('span');hw.innerHTML=SS.heatHTML(f.heat);li.appendChild(hw);
    shelf.appendChild(li);
  });
  var n=dishes.length;
  $('#menuCount').textContent=n+' จาน'+(n>1?' · '+(n-1)+' รอบ':'');
  var ready=n>=3;
  $('#startBtn').disabled=!ready;
  $('#startMsg').textContent=ready?'':'เมนูนี้ต้องมีอย่างน้อย 3 จาน ให้ผู้จัดเพิ่มเมนูก่อน';
}

/* ---------- duel ---------- */
function setCard(el,food,role){
  var im=$('img',el);im.alt='';SS.setImg(im,food);
  $('.name',el).textContent=food.name;
  $('.heat-slot',el).innerHTML=SS.heatHTML(food.heat);
  $('.role',el).textContent=role;
  el.setAttribute('aria-label','เลือก '+food.name);
}
function setMercury(p){$('#mercury').style.clipPath='inset(0 '+Math.round((1-p)*1000)/10+'% 0 0)'}
function renderQueue(){
  var q=$('#queue');q.innerHTML='';
  for(var i=0;i<G.queue.length;i++){var c=document.createElement('i');c.className='chip';c.innerHTML=SS.CHILI;c.style.animationDelay=(i*30)+'ms';q.appendChild(c)}
}
function meta(){
  var last=G.queue.length===0;
  $('#roundLabel').textContent=last?'รอบชิงสุดท้าย':'รอบที่ '+G.round+' จาก '+G.total;
  $('#queueLabel').textContent=last?'เมนูหมดแล้ว':'รอลงสนามอีก '+G.queue.length+' จาน';
  renderQueue();
}
function enter(el,cls){el.classList.remove('win','lose','enterL','enterR');void el.offsetWidth;el.classList.add(cls)}
function lock(on){G.locked=on;$('#arena').classList.toggle('locked',on)}

function startGame(){
  if(!menu||dishes.length<3)return;
  var pool=dishes.slice();
  if(menu.shuffle)SS.shuffle(pool);
  G.pool=pool;
  G.L=pool[0];G.R=pool[1];
  G.queue=pool.slice(2).map(function(f){return f.id});
  G.total=pool.length-1;G.round=1;G.streak=0;G.defender=null;G.log=[];G.champ=null;
  G.picks={};G.duels={};
  pool.forEach(function(f){G.picks[f.id]=0;G.duels[f.id]=0});
  G.duels[G.L.id]++;G.duels[G.R.id]++;
  show('duel');
  setCard(cardL,G.L,'ผู้เข้าชิง');setCard(cardR,G.R,'ผู้เข้าชิง');
  enter(cardL,'enterL');enter(cardR,'enterR');
  setMercury(0);meta();
  lock(true);
  setTimeout(function(){lock(false)},RM?0:600);
}
function choose(side){
  if(G.locked||scene!=='duel')return;
  lock(true);
  var win=side==='L'?G.L:G.R,lose=side==='L'?G.R:G.L;
  var wEl=side==='L'?cardL:cardR,lEl=side==='L'?cardR:cardL;
  G.picks[win.id]++;
  G.streak=(G.defender===win.id)?G.streak+1:1;
  G.defender=win.id;
  G.log.push({round:G.round,win:win.id,lose:lose.id});
  wEl.classList.remove('enterL','enterR');lEl.classList.remove('enterL','enterR');
  wEl.classList.add('win');lEl.classList.add('lose');
  SS.fx.burst(wEl);
  setMercury(G.round/G.total);
  setTimeout(function(){
    if(G.queue.length===0){finish(win);return}
    var next=byId(G.queue.shift());
    if(!next){finish(win);return}
    if(side==='L'){G.R=next}else{G.L=next}
    G.duels[next.id]++;G.duels[win.id]++;
    G.round++;
    wEl.classList.remove('win');
    setCard(wEl,win,'ผู้ป้องกัน · ชนะ '+G.streak+' ครั้ง');
    setCard(lEl,next,'ตัวท้าชิง');
    enter(lEl,side==='L'?'enterR':'enterL');
    meta();
    setTimeout(function(){lock(false)},RM?0:520);
  },RM?350:1050);
}

/* ---------- verdict ---------- */
/* แท็บสถิติที่สอง: 'everyone' (ทุกคน ผ่าน Google Sheet) หรือ 'device' (เฉพาะเครื่องนี้) หรือ null (ดูตัวอย่างฉบับร่าง) */
function secondTab(){
  if(isDraft)return null;
  if(shared)return 'everyone';
  return store.ok?'device':null;
}
function addTotals(){
  if(!store.ok)return null;
  var t=SS.getTotals();
  t.games=(t.games||0)+1;
  G.pool.forEach(function(f){
    var k=f.name.trim().toLowerCase();
    var it=t.items[k]||(t.items[k]={name:f.name,picks:0,duels:0});
    it.name=f.name;it.picks+=G.picks[f.id]||0;it.duels+=G.duels[f.id]||0;
  });
  store.set(SS.KEY_TOTALS,t);
  return t;
}
function finish(champ){
  G.champ=champ;
  G.totals=null;
  G.submitP=null;
  var mode=secondTab();
  if(mode==='device')G.totals=addTotals();
  if(mode==='everyone'){
    var names={};G.pool.forEach(function(f){names[f.id]=f.name});
    G.submitP=stats.submit({gameId:SS.gameId(),rounds:G.log.map(function(l){return [l.win,l.lose]}),names:names});
  }
  show('result');
  renderResult();
  setTimeout(SS.fx.confetti,RM?0:250);
}
function renderResult(){
  var c=G.champ;
  SS.setImg($('#champImg'),c);$('#champImg').alt=c.name;
  $('#champName').textContent=c.name;
  $('#champHeat').innerHTML=SS.heatHTML(c.heat).replace('class="heat"','class="heat lg"');
  var p=G.picks[c.id]||0,d=G.duels[c.id]||0;
  $('#champLine').textContent='ถูกเลือก '+p+' ครั้ง จากที่ลงสนาม '+d+' รอบ';
  var mode=secondTab();
  $('#seg').hidden=!mode;
  $('#tabAll').textContent=mode==='everyone'?'ทุกคน':'เครื่องนี้';
  var ss=$('#saveState');
  if(G.submitP){
    var mine=G.submitP;
    ss.hidden=false;ss.className='save-state pending';ss.textContent='กำลังบันทึกผลของคุณเข้าสถิติรวม...';
    mine.then(function(r){
      if(G.submitP!==mine)return;
      if(r&&r.ok){ss.className='save-state ok';ss.textContent='บันทึกผลของคุณเข้าสถิติรวมแล้ว'}
      else{ss.className='save-state warn';ss.textContent='ตอนนี้เน็ตมีปัญหา ผลของคุณจะถูกส่งให้เองเมื่อกลับมาออนไลน์'}
    });
  }else{ss.hidden=true}
  setTab(mode==='everyone'?'all':'game');
  var log=$('#log');log.innerHTML='';
  G.log.forEach(function(l){
    var li=document.createElement('li');
    var tx=SS.el('span','lg');
    var w=byId(l.win),lo=byId(l.lose);
    tx.appendChild(SS.el('strong',null,w?w.name:'?'));
    tx.appendChild(SS.el('em',null,' ชนะ '));
    tx.appendChild(SS.el('span',null,lo?lo.name:'?'));
    li.appendChild(SS.el('span','rn',l.round));li.appendChild(tx);log.appendChild(li);
  });
  $('#champName').focus({preventScroll:true});
}
function sortRows(rows){
  rows.sort(function(a,b){return b.picks-a.picks||b.duels-a.duels||a.name.localeCompare(b.name)});
  return rows;
}
function gameRows(){
  return sortRows(G.pool.map(function(f){return {name:f.name,dish:f,picks:G.picks[f.id]||0,duels:G.duels[f.id]||0}}));
}
function deviceRows(){
  var rows=[];
  if(G.totals){
    Object.keys(G.totals.items).forEach(function(k){
      var it=G.totals.items[k],m=null;
      for(var i=0;i<dishes.length;i++){if(dishes[i].name.trim().toLowerCase()===k){m=dishes[i];break}}
      rows.push({name:it.name,dish:m||{name:it.name},picks:it.picks,duels:it.duels});
    });
  }
  return sortRows(rows);
}
function draw(rows,note,mode){
  SS.renderBars($('#bars'),rows);
  $('#topLine').textContent=SS.topLine(rows,mode);
  $('#statsNote').textContent=note;
}
function setState(text,retry,loading){
  var box=$('#statsState');
  box.hidden=false;box.classList.toggle('loading',!!loading);
  $('#statsStateText').textContent=text;
  $('#statsRetry').hidden=!retry;
}
function showEveryone(){
  var tok=++statsToken;
  $('#bars').innerHTML='';$('#topLine').textContent='';$('#statsNote').textContent='';
  setState('กำลังโหลดสถิติของทุกคน...',false,true);
  var ready=G.submitP?G.submitP.then(function(){},function(){}):Promise.resolve();
  ready.then(function(){return stats.get()}).then(function(j){
    if(tok!==statsToken)return;
    if(!j||!j.ok||!Array.isArray(j.rows))throw new Error('stats');
    var map={};j.rows.forEach(function(r){map[r.id]=r});
    var rows=dishes.map(function(d){
      var r=map[d.id]||{picks:0,duels:0,finals:0};
      return {name:d.name,dish:d,picks:r.picks,duels:r.duels,finals:r.finals};
    });
    var games=Number(j.games)||0;
    rows.forEach(function(r){
      var pct=games?Math.round(r.finals/games*100):0;
      r.score=r.finals;r.prefix='เลือกเป็นจานสุดท้าย ';r.suffix=' ครั้ง ('+pct+'%) · ชนะดวลรวม '+r.picks+' ครั้ง';r.badge='คนชอบที่สุด';
    });
    rows.sort(function(a,b){return b.finals-a.finals||b.picks-a.picks||a.name.localeCompare(b.name)});
    $('#statsState').hidden=true;
    draw(rows,'มีคนเล่นแล้ว '+games+' เกม แท่งแสดงจำนวนครั้งที่แต่ละจานถูกเลือกเป็นจานสุดท้ายของเกม','final');
  }).catch(function(){
    if(tok!==statsToken)return;
    setState('โหลดสถิติรวมไม่ได้ในตอนนี้',true,false);
  });
}
function setTab(mode){
  statsToken++;
  $('#tabGame').setAttribute('aria-selected',String(mode==='game'));
  $('#tabAll').setAttribute('aria-selected',String(mode==='all'));
  $('#statsState').hidden=true;
  $('#resetDevice').hidden=true;
  $('#statsTitle').textContent=mode==='all'&&secondTab()==='everyone'?'ทุกคนเลือกจานไหนเป็นจานสุดท้าย':'จานที่ถูกเลือกมากสุด';
  if(mode==='game'){
    draw(gameRows(),'นับหนึ่งครั้งทุกครั้งที่คุณเลือกจานนั้นในการดวลแต่ละรอบ');
    return;
  }
  if(secondTab()==='everyone'){showEveryone();return}
  var g=G.totals?G.totals.games:0;
  draw(deviceRows(),'เล่นไปแล้ว '+g+' เกมในเครื่องนี้ (เก็บแยกตามเครื่อง)');
  $('#resetDevice').hidden=false;
}

/* ---------- wiring ---------- */
cardL.addEventListener('click',function(){choose('L')});
cardR.addEventListener('click',function(){choose('R')});
document.addEventListener('keydown',function(e){
  if(scene!=='duel')return;
  if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName||''))return;
  if(e.key==='ArrowLeft'||e.key==='1'){e.preventDefault();choose('L')}
  else if(e.key==='ArrowRight'||e.key==='2'){e.preventDefault();choose('R')}
});
$('#startBtn').addEventListener('click',startGame);
$('#quit').addEventListener('click',function(){lock(true);show('start')});
$('#again').addEventListener('click',startGame);
$('#home').addEventListener('click',function(){show('start')});
$('#tabGame').addEventListener('click',function(){setTab('game')});
$('#tabAll').addEventListener('click',function(){setTab('all')});
$('#statsRetry').addEventListener('click',showEveryone);
SS.twoStep($('#resetDevice'),'แตะอีกครั้งเพื่อล้าง',function(){
  if(!store.ok)return;
  store.set(SS.KEY_TOTALS,{games:0,items:{}});
  G.totals={games:0,items:{}};
  setTab('all');
});
window.addEventListener('hashchange',function(){window.location.reload()});

/* Pointer parallax on the duel photos (mouse only, off for reduced motion). */
if(!RM&&window.matchMedia&&window.matchMedia('(hover: hover)').matches){
  [cardL,cardR].forEach(function(c){
    c.addEventListener('pointermove',function(e){
      var b=c.getBoundingClientRect();
      c.style.setProperty('--px',(((e.clientX-b.left)/b.width-.5)*14).toFixed(1)+'px');
      c.style.setProperty('--py',(((e.clientY-b.top)/b.height-.5)*10).toFixed(1)+'px');
    });
    c.addEventListener('pointerleave',function(){c.style.setProperty('--px','0px');c.style.setProperty('--py','0px')});
  });
}

/* ---------- boot ---------- */
(function boot(){
  var draft=window.location.hash==='#draft'?store.get(SS.KEY_DRAFT):null;
  if(draft){applyMenu(SS.normalizeMenu(draft),true);return}
  SS.loadPublished().then(function(r){
    applyMenu(r.menu,false);
    if(shared){
      stats.get().then(function(j){
        var g=j&&j.ok?Number(j.games)||0:0;
        if(g>0){$('#gamesLine').hidden=false;$('#gamesText').textContent='มีคนเล่นแล้ว '+g+' เกม'}
      });
    }
  });
})();
})();
