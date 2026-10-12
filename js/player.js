/* Spice Showdown: player. Reads the published menu (data/menu.json) and runs the duel game.
   Open index.html#draft to play the admin's unpublished draft instead. */
(function(){
'use strict';
var SS=window.SS,$=SS.$,$$=SS.$$,RM=SS.RM,store=SS.store;
var menu=null,dishes=[],scene='start';
var G={pool:[],queue:[],L:null,R:null,round:0,total:0,picks:{},duels:{},streak:0,defender:null,log:[],locked:true,champ:null,totals:null};
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
function applyMenu(m,isDraft){
  menu=m;dishes=m.dishes;
  document.title=m.title;
  $('#brandName').textContent=m.title;
  $('#draftPill').hidden=!isDraft;
  var h1=$('#title');h1.innerHTML='';
  var words=m.title.split(' ');var last=words.pop();
  if(words.length)h1.appendChild(document.createTextNode(words.join(' ')+' '));
  h1.appendChild(SS.el('span','hot',last));
  $('#tagline').textContent=m.tagline;
  var shelf=$('#shelf');shelf.innerHTML='';
  dishes.forEach(function(f,i){
    var li=document.createElement('li');li.style.animationDelay=(i*40)+'ms';
    var im=document.createElement('img');im.src=SS.imgSrc(f);im.alt='';
    li.appendChild(im);
    li.appendChild(SS.el('span','n',f.name));
    var hw=document.createElement('span');hw.innerHTML=SS.heatHTML(f.heat);li.appendChild(hw);
    shelf.appendChild(li);
  });
  var n=dishes.length;
  $('#menuCount').textContent=n+(n===1?' dish':' dishes')+(n>1?' · '+(n-1)+' duels':'');
  var ready=n>=3;
  $('#startBtn').disabled=!ready;
  $('#startMsg').textContent=ready?'':'This menu needs at least 3 dishes. Ask the host to add more.';
}

/* ---------- duel ---------- */
function setCard(el,food,role){
  var im=$('img',el);im.src=SS.imgSrc(food);im.alt='';
  $('.name',el).textContent=food.name;
  $('.heat-slot',el).innerHTML=SS.heatHTML(food.heat);
  $('.role',el).textContent=role;
  el.setAttribute('aria-label','Pick '+food.name);
}
function setMercury(p){$('#mercury').style.clipPath='inset(0 '+Math.round((1-p)*1000)/10+'% 0 0)'}
function renderQueue(){
  var q=$('#queue');q.innerHTML='';
  for(var i=0;i<G.queue.length;i++){var c=document.createElement('i');c.className='chip';c.innerHTML=SS.CHILI;c.style.animationDelay=(i*30)+'ms';q.appendChild(c)}
}
function meta(){
  var last=G.queue.length===0;
  $('#roundLabel').textContent=last?'Final duel':'Round '+G.round+' of '+G.total;
  $('#queueLabel').textContent=last?'Menu used up':G.queue.length+' waiting';
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
  setCard(cardL,G.L,'Contender');setCard(cardR,G.R,'Contender');
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
    setCard(wEl,win,'Defender · '+G.streak+(G.streak===1?' win':' wins'));
    setCard(lEl,next,'Challenger');
    enter(lEl,side==='L'?'enterR':'enterL');
    meta();
    setTimeout(function(){lock(false)},RM?0:520);
  },RM?350:1050);
}

/* ---------- verdict ---------- */
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
  G.totals=addTotals();
  show('result');
  renderResult();
  setTimeout(SS.fx.confetti,RM?0:250);
}
function renderResult(){
  var c=G.champ;
  $('#champImg').src=SS.imgSrc(c);$('#champImg').alt=c.name;
  $('#champName').textContent=c.name;
  $('#champHeat').innerHTML=SS.heatHTML(c.heat).replace('class="heat"','class="heat lg"');
  var p=G.picks[c.id]||0,d=G.duels[c.id]||0;
  $('#champLine').textContent='Picked '+p+(p===1?' time':' times')+' across '+d+(d===1?' duel.':' duels.');
  $('#seg').hidden=!(store.ok&&G.totals);
  setTab('game');
  var log=$('#log');log.innerHTML='';
  G.log.forEach(function(l){
    var li=document.createElement('li');
    var tx=SS.el('span','lg');
    var w=byId(l.win),lo=byId(l.lose);
    tx.appendChild(SS.el('strong',null,w?w.name:'?'));
    tx.appendChild(SS.el('em',null,' beat '));
    tx.appendChild(SS.el('span',null,lo?lo.name:'?'));
    li.appendChild(SS.el('span','rn',l.round));li.appendChild(tx);log.appendChild(li);
  });
  $('#champName').focus({preventScroll:true});
}
function rowsFor(mode){
  var rows=[];
  if(mode==='game'){
    G.pool.forEach(function(f){rows.push({name:f.name,img:SS.imgSrc(f),picks:G.picks[f.id]||0,duels:G.duels[f.id]||0})});
  }else if(G.totals){
    Object.keys(G.totals.items).forEach(function(k){
      var it=G.totals.items[k],m=null;
      for(var i=0;i<dishes.length;i++){if(dishes[i].name.trim().toLowerCase()===k){m=dishes[i];break}}
      rows.push({name:it.name,img:m?SS.imgSrc(m):SS.placeholderURI(it.name),picks:it.picks,duels:it.duels});
    });
  }
  rows.sort(function(a,b){return b.picks-a.picks||b.duels-a.duels||a.name.localeCompare(b.name)});
  return rows;
}
function setTab(mode){
  $('#tabGame').setAttribute('aria-selected',String(mode==='game'));
  $('#tabAll').setAttribute('aria-selected',String(mode==='all'));
  var rows=rowsFor(mode);
  SS.renderBars($('#bars'),rows);
  $('#topLine').textContent=SS.topLine(rows);
  if(mode==='game'){$('#statsNote').textContent='A pick is counted each time you chose a dish in a duel.'}
  else{var g=G.totals?G.totals.games:0;$('#statsNote').textContent=g+(g===1?' game':' games')+' played on this device.'}
  $('#resetDevice').hidden=mode!=='all';
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
SS.twoStep($('#resetDevice'),'Tap again to reset',function(){
  if(!store.ok)return;
  store.set(SS.KEY_TOTALS,{games:0,items:{}});
  G.totals={games:0,items:{}};
  setTab('all');
});
window.addEventListener('hashchange',function(){window.location.reload()});

/* ---------- boot ---------- */
(function boot(){
  var draft=window.location.hash==='#draft'?store.get(SS.KEY_DRAFT):null;
  if(draft){applyMenu(SS.normalizeMenu(draft),true);return}
  SS.loadPublished().then(function(r){applyMenu(r.menu,false)});
})();
})();
