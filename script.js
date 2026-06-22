/* ============================================================
   CONFIGURATION
   ============================================================
   1. Get a free key at https://aistudio.google.com/apikey
   For Vercel deployment, keep API_KEY empty and add GEMINI_API_KEY
   in Vercel's Environment Variables. The app will call /api/gemini.
   ============================================================ */

const CONFIG = {
  API_KEY: typeof env !== 'undefined' ? env.API_KEY : "",
  MODEL: typeof env !== 'undefined' ? env.MODEL : "gemini-2.5-flash-lite"
};
// ... rest of your Nutrix application logic (Chart.js, page switching, etc.) ...

if(!CONFIG.API_KEY && location.protocol === 'file:'){
  document.getElementById('setup-banner').classList.add('show');
}

function geminiUrl(){
  return 'https://generativelanguage.googleapis.com/v1beta/models/'+CONFIG.MODEL+':generateContent?key='+CONFIG.API_KEY;
}

function toGeminiParts(content){
  if(typeof content === 'string') return [{text: content}];
  var parts = [];
  content.forEach(function(part){
    if(part.type === 'text') parts.push({text: part.text});
    if(part.type === 'image') parts.push({inline_data: {mime_type: part.source.media_type, data: part.source.data}});
  });
  return parts;
}

function toGeminiContents(messages){
  return messages.map(function(m){
    return {
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: toGeminiParts(m.content)
    };
  });
}

async function callGemini(opts){
  var body = {
    contents: opts.contents,
    generationConfig: {maxOutputTokens: opts.maxTokens || 1000}
  };
  if(opts.system) body.systemInstruction = {parts: [{text: opts.system}]};
  var r;
  if(CONFIG.API_KEY){
    r = await fetch(geminiUrl(), {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    });
  }else{
    r = await fetch('/api/gemini', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({model: CONFIG.MODEL, payload: body})
    });
  }
  var d = await r.json();
  if(d.error) return {error: d.error.message || 'Gemini API error'};
  var text = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts;
  text = text && text.map(function(p){ return p.text || ''; }).join('').trim();
  if(!text) return {error: 'No response from Gemini'};
  return {text: text};
}

async function apiFetch(path, options){
  var response = await fetch(path, Object.assign({
    headers: {'Content-Type': 'application/json'}
  }, options || {}));
  var data = null;
  try{
    data = await response.json();
  }catch(e){
    data = {};
  }
  if(!response.ok){
    throw new Error(data && data.error && data.error.message ? data.error.message : 'Request failed');
  }
  return data;
}

async function getOrCreateUserId(){
  if(state.userId) return state.userId;
  if(location.protocol === 'file:') return null;

  var stored = '';
  try{
    stored = localStorage.getItem('nutrix_user_id') || '';
  }catch(e){}

  var data = await apiFetch('/api/users/anonymous', {
    method: 'POST',
    body: JSON.stringify({userId: stored})
  });

  state.userId = data.user && data.user.id;
  if(state.userId){
    try{localStorage.setItem('nutrix_user_id', state.userId);}catch(e){}
  }
  return state.userId;
}

var state={userId:null,calories:0,protein:0,carbs:0,fat:0,fiber:0,calTarget:2200,protTarget:165,carbTarget:248,fatTarget:61,fiberTarget:30,
  meals:[],
  chatHistory:[{role:'assistant',content:"Hey! I'm your Nutrix AI — powered by Gemini. Ask me anything about your nutrition, log meals by description, or share a food photo for instant analysis."}],
  chatPhotoB64:null,chatPhotoMime:null,pendingFoodPhotoB64:null,pendingFoodPhotoMime:null,pendingFoodPhotoName:null};

function showPage(id,btn){
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  document.querySelectorAll('.nav-btn').forEach(function(b){b.classList.remove('active');});
  document.getElementById('page-'+id).classList.add('active');
  if(btn){btn.classList.add('active');}
  if(id==='trends'){setTimeout(loadTrendData,80);}
  if(id==='today'){setTimeout(animateRings,100);}
}

function animateRings(){
  var r=163.4;
  document.getElementById('ring-cal').style.strokeDashoffset=r-(r*Math.min(state.calories/state.calTarget,1));
  document.getElementById('ring-prot').style.strokeDashoffset=r-(r*Math.min(state.protein/state.protTarget,1));
  document.getElementById('disp-cal').textContent=state.calories;
  document.getElementById('disp-cal-target').textContent='/ '+state.calTarget+' kcal';
  document.getElementById('disp-prot').textContent=state.protein+'g';
  document.getElementById('disp-prot-target').textContent='/ '+state.protTarget+'g';
  document.getElementById('disp-carbs').innerHTML=state.carbs+'<span class="macro-unit">g</span>';
  document.getElementById('disp-fat').innerHTML=state.fat+'<span class="macro-unit">g</span>';
  document.getElementById('disp-fiber').innerHTML=state.fiber+'<span class="macro-unit">g</span>';
  setTimeout(function(){
    document.getElementById('bar-carbs').style.width=Math.min(state.carbs/state.carbTarget*100,100)+'%';
    document.getElementById('bar-fat').style.width=Math.min(state.fat/state.fatTarget*100,100)+'%';
    document.getElementById('bar-fiber').style.width=Math.min(state.fiber/state.fiberTarget*100,100)+'%';
  },200);
}

var trendChart=null,macroChart=null,donutActual=null,donutIdeal=null,trendMode='weekly';
var trendData={
  daily:{labels:['12am','4am','8am','12pm','4pm','8pm'],cal:[0,0,0,0,0,0],target:2200,macros:{p:[0,0,0,0,0,0],c:[0,0,0,0,0,0],f:[0,0,0,0,0,0]}},
  weekly:{labels:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],cal:[0,0,0,0,0,0,0],target:2200,macros:{p:[0,0,0,0,0,0,0],c:[0,0,0,0,0,0,0],f:[0,0,0,0,0,0,0]}},
  monthly:{labels:['Week 1','Week 2','Week 3','Week 4','Week 5'],cal:[0,0,0,0,0],target:2200,macros:{p:[0,0,0,0,0],c:[0,0,0,0,0],f:[0,0,0,0,0]}}
};

function emptyTrend(period){
  var labels={
    daily:['12am','4am','8am','12pm','4pm','8pm'],
    weekly:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    monthly:['Week 1','Week 2','Week 3','Week 4','Week 5']
  }[period];
  return {
    labels:labels,
    cal:labels.map(function(){return 0;}),
    target:state.calTarget || 2200,
    macros:{
      p:labels.map(function(){return 0;}),
      c:labels.map(function(){return 0;}),
      f:labels.map(function(){return 0;})
    }
  };
}

function startOfDay(date){
  var next=new Date(date);
  next.setHours(0,0,0,0);
  return next;
}

function addDays(date,days){
  var next=new Date(date);
  next.setDate(next.getDate()+days);
  return next;
}

function addMonths(date,months){
  var next=new Date(date);
  next.setMonth(next.getMonth()+months);
  return next;
}

function getWeekStart(date){
  var start=startOfDay(date);
  var day=start.getDay();
  var diff=day===0 ? -6 : 1-day;
  return addDays(start,diff);
}

function getTrendRange(period){
  var now=new Date();
  if(period==='daily'){
    var dayStart=startOfDay(now);
    return {start:dayStart,end:addDays(dayStart,1)};
  }
  if(period==='monthly'){
    var monthStart=new Date(now.getFullYear(),now.getMonth(),1);
    return {start:monthStart,end:addMonths(monthStart,1)};
  }
  var weekStart=getWeekStart(now);
  return {start:weekStart,end:addDays(weekStart,7)};
}

function getTrendBucket(period,date,rangeStart){
  if(period==='daily') return Math.min(Math.floor(date.getHours()/4),5);
  if(period==='monthly') return Math.min(Math.floor((date.getDate()-1)/7),4);
  return Math.floor((startOfDay(date).getTime()-rangeStart.getTime())/86400000);
}

function refreshLocalTrendData(period){
  var data=emptyTrend(period);
  var range=getTrendRange(period);
  state.meals.forEach(function(meal){
    var date=new Date(meal.eatenAt || meal.eaten_at || meal.createdAt || meal.created_at || Date.now());
    if(isNaN(date.getTime()) || date<range.start || date>=range.end) return;
    var bucket=getTrendBucket(period,date,range.start);
    if(bucket<0 || bucket>=data.labels.length) return;
    data.cal[bucket]+=Number(meal.calories)||0;
    data.macros.p[bucket]+=Number(meal.protein)||0;
    data.macros.c[bucket]+=Number(meal.carbs)||0;
    data.macros.f[bucket]+=Number(meal.fat)||0;
  });
  trendData[period]=data;
}

function switchTrend(mode,btn){
  trendMode=mode;
  document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active');});
  btn.classList.add('active');
  var titles={daily:'Today by hour',weekly:'This week',monthly:'This month'};
  var subs={daily:'Cumulative calorie intake',weekly:'Daily calories vs target',monthly:'Weekly averages'};
  document.getElementById('trend-title').textContent=titles[mode];
  document.getElementById('trend-sub').textContent=subs[mode];
  loadTrendData();
}

function normalizeTrendData(data){
  if(!data || !data.labels || !data.cal || !data.macros) return null;
  return {
    labels: data.labels,
    cal: data.cal,
    target: data.target || state.calTarget || 2200,
    macros: {
      p: data.macros.p || data.macros.protein || [],
      c: data.macros.c || data.macros.carbs || [],
      f: data.macros.f || data.macros.fat || []
    }
  };
}

async function loadTrendData(){
  refreshLocalTrendData(trendMode);

  if(location.protocol === 'file:'){
    initCharts();
    return;
  }

  try{
    state.trendsLoading=true;
    var userId=await getOrCreateUserId();
    if(!userId){
      initCharts();
      return;
    }
    var data=await apiFetch('/api/trends?userId='+encodeURIComponent(userId)+'&period='+encodeURIComponent(trendMode));
    var normalized=normalizeTrendData(data);
    if(normalized) trendData[trendMode]=normalized;
  }catch(e){
    console.warn('Could not load trends from database:', e.message);
  }finally{
    state.trendsLoading=false;
    initCharts();
  }
}

function initCharts(){
  var d=trendData[trendMode];
  var gc='rgba(255,255,255,0.06)',tc='#636366';
  var baseOpts={responsive:true,maintainAspectRatio:false,animation:{duration:700,easing:'easeInOutQuart'},plugins:{legend:{display:false},tooltip:{backgroundColor:'#1c1c1e',titleColor:'#fff',bodyColor:'#aeaeb2',borderColor:'rgba(255,255,255,0.1)',borderWidth:0.5,padding:10,cornerRadius:10}},scales:{x:{grid:{color:gc},ticks:{color:tc,font:{family:'Inter',size:11}}},y:{grid:{color:gc},ticks:{color:tc,font:{family:'Inter',size:11}}}}};
  if(trendChart){trendChart.destroy();}
  trendChart=new Chart(document.getElementById('trend-chart').getContext('2d'),{type:'line',data:{labels:d.labels,datasets:[{label:'Calories',data:d.cal,borderColor:'#0a84ff',borderWidth:2,pointBackgroundColor:'#0a84ff',pointRadius:4,pointHoverRadius:6,tension:0.4,fill:true,backgroundColor:'rgba(10,132,255,0.08)'},{label:'Target',data:d.labels.map(function(){return d.target;}),borderColor:'#636366',borderWidth:1.5,borderDash:[5,4],pointRadius:0,tension:0}]},options:Object.assign({},baseOpts,{scales:Object.assign({},baseOpts.scales,{y:Object.assign({},baseOpts.scales.y,{suggestedMin:0,suggestedMax:Math.round(d.target*1.15)})})})});
  if(macroChart){macroChart.destroy();}
  macroChart=new Chart(document.getElementById('macro-bar-chart').getContext('2d'),{type:'bar',data:{labels:d.labels,datasets:[{label:'Protein',data:d.macros.p,backgroundColor:'rgba(94,92,230,0.85)',borderRadius:4,borderSkipped:false},{label:'Carbs',data:d.macros.c,backgroundColor:'rgba(48,209,88,0.85)',borderRadius:4,borderSkipped:false},{label:'Fat',data:d.macros.f,backgroundColor:'rgba(255,159,10,0.85)',borderRadius:4,borderSkipped:false}]},options:Object.assign({},baseOpts,{scales:{x:Object.assign({},baseOpts.scales.x,{stacked:true}),y:Object.assign({},baseOpts.scales.y,{stacked:true})}})});
  var totalP=state.protein*4,totalC=state.carbs*4,totalF=state.fat*9,totalCal=totalP+totalC+totalF;
  var actualSplit = totalCal>0 ? [Math.round(totalP/totalCal*100),Math.round(totalC/totalCal*100),Math.round(totalF/totalCal*100)] : [33,34,33];
  if(donutActual){donutActual.destroy();}
  donutActual=new Chart(document.getElementById('donut-actual').getContext('2d'),{type:'doughnut',data:{labels:['Protein','Carbs','Fat'],datasets:[{data:actualSplit,backgroundColor:['#5e5ce6','#30d158','#ff9f0a'],borderWidth:0,hoverOffset:4}]},options:{responsive:true,maintainAspectRatio:false,cutout:'72%',animation:{animateRotate:true,duration:900,easing:'easeInOutQuart'},plugins:{legend:{display:false},tooltip:{backgroundColor:'#1c1c1e',bodyColor:'#aeaeb2',padding:8,cornerRadius:8}}}});
  var idealP=state.protTarget*4, idealC=state.carbTarget*4, idealF=state.fatTarget*9, idealTotal=idealP+idealC+idealF;
  var idealSplit = idealTotal>0 ? [Math.round(idealP/idealTotal*100),Math.round(idealC/idealTotal*100),Math.round(idealF/idealTotal*100)] : [35,40,25];
  if(donutIdeal){donutIdeal.destroy();}
  donutIdeal=new Chart(document.getElementById('donut-ideal').getContext('2d'),{type:'doughnut',data:{labels:['Protein','Carbs','Fat'],datasets:[{data:idealSplit,backgroundColor:['rgba(94,92,230,0.5)','rgba(48,209,88,0.5)','rgba(255,159,10,0.5)'],borderColor:['#5e5ce6','#30d158','#ff9f0a'],borderWidth:1.5,hoverOffset:4}]},options:{responsive:true,maintainAspectRatio:false,cutout:'72%',animation:{animateRotate:true,duration:900,easing:'easeInOutQuart'},plugins:{legend:{display:false},tooltip:{backgroundColor:'#1c1c1e',bodyColor:'#aeaeb2',padding:8,cornerRadius:8}}}});
}

function checkKey(){
  if(!CONFIG.API_KEY && location.protocol === 'file:'){
    alert("AI needs either a local Gemini key in env.js, or a Vercel deployment with GEMINI_API_KEY set. For local proxy testing, run vercel dev.");
    return false;
  }
  return true;
}

var NUTRITION_PROMPT_SUFFIX = 'Reply in this exact format — no extra text:\nAction: [add or update_last]\nFood: [name]\nCalories: [N]\nProtein: [N]g\nCarbs: [N]g\nFat: [N]g\nFiber: [N]g\nNote: [1 sentence tip]';

function clampNumber(value,min,max,fallback){
  var n=parseFloat(value);
  if(!isFinite(n)) n=fallback;
  return Math.min(Math.max(n,min),max);
}

function parseNutritionNumber(value){
  var n=parseFloat(String(value || '').replace(/[^\d.-]/g,''));
  if(!isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function getNutritionLine(lines,key){
  key=key.toLowerCase();
  return lines.find(function(x){return x.trim().toLowerCase().indexOf(key+':')===0;}) || '';
}

function renderNutritionResult(foodName,cal,prot,carbs,fat,note){
  return '<strong>'+foodName+'</strong><br><span class="result-cal">'+cal+' kcal</span> &nbsp;·&nbsp; Protein <span class="result-protein">'+prot+'g</span> &nbsp;·&nbsp; Carbs <span class="result-carbs">'+carbs+'g</span> &nbsp;·&nbsp; Fat <span class="result-fat">'+fat+'g</span>'+(note?'<br><span class="result-note">'+note+'</span>':'');
}

function recalculateTotals(){
  state.calories=0;state.protein=0;state.carbs=0;state.fat=0;state.fiber=0;
  state.meals.forEach(function(meal){
    state.calories+=meal.calories;
    state.protein+=meal.protein;
    state.carbs+=meal.carbs;
    state.fat+=meal.fat;
    state.fiber+=meal.fiber;
  });
}

function renderMealList(){
  var list=document.getElementById('meal-list');
  list.innerHTML='';
  state.meals.forEach(function(meal){
    var item=document.createElement('div');item.className='meal-item';
    item.innerHTML='<div><div class="meal-name">'+meal.foodName+'</div><div class="meal-macros">Carbs '+meal.carbs+'g · Protein '+meal.protein+'g · Fat '+meal.fat+'g</div></div><div class="meal-cal">'+meal.calories+'</div>';
    list.appendChild(item);
  });
}

function getMealId(meal){
  return meal && (meal.id || meal._id);
}

function isTrendsPageActive(){
  var page=document.getElementById('page-trends');
  return page && page.classList.contains('active');
}

async function persistMealNutrition(action,meal){
  if(location.protocol === 'file:') return;

  try{
    var userId=await getOrCreateUserId();
    if(!userId) return;

    var mealId=getMealId(meal);
    var payload={
      userId:userId,
      foodName:meal.foodName,
      calories:meal.calories,
      protein:meal.protein,
      carbs:meal.carbs,
      fat:meal.fat,
      fiber:meal.fiber,
      source:'ai'
    };
    var saved;

    if(action==='update_last' && mealId){
      saved=await apiFetch('/api/meals/'+encodeURIComponent(mealId), {
        method:'PATCH',
        body:JSON.stringify(payload)
      });
    }else{
      saved=await apiFetch('/api/meals', {
        method:'POST',
        body:JSON.stringify(payload)
      });
    }

    if(saved && saved.meal && saved.meal.id){
      meal.id=saved.meal.id;
    }
    if(isTrendsPageActive()) loadTrendData();
  }catch(e){
    console.warn('Could not save meal to database:', e.message);
  }
}

function saveMealNutrition(action,meal){
  if(action==='update_last' && state.meals.length){
    state.meals[state.meals.length-1]=meal;
  }else{
    state.meals.push(meal);
  }
  recalculateTotals();
  renderMealList();
  animateRings();
  persistMealNutrition(action,meal);
}

function applyManualCorrectionRequest(text,res){
  if(!state.meals.length || state.pendingFoodPhotoB64) return false;
  if(!/(change|set|make|correct|update|actually|should be)/i.test(text)) return false;
  var fields={
    calories:['calories','calorie','kcal'],
    protein:['protein','protien'],
    carbs:['carbs','carbohydrates','carb'],
    fat:['fat'],
    fiber:['fiber','fibre']
  };
  var meal=Object.assign({}, state.meals[state.meals.length-1]);
  var changed=false;
  Object.keys(fields).forEach(function(field){
    fields[field].forEach(function(label){
      var after=new RegExp(label+'[^\\d-]{0,30}(-?\\d+(?:\\.\\d+)?)','i').exec(text);
      var before=new RegExp('(-?\\d+(?:\\.\\d+)?)\\s*(?:g|grams|kcal|calories)?\\s*(?:of\\s+)?'+label,'i').exec(text);
      var match=after || before;
      if(match){
        meal[field]=parseNutritionNumber(match[1]);
        changed=true;
      }
    });
  });
  if(!changed) return false;
  saveMealNutrition('update_last',meal);
  res.style.display='block';
  res.innerHTML=renderNutritionResult(meal.foodName,meal.calories,meal.protein,meal.carbs,meal.fat,'Updated the last meal.');
  return true;
}

function applyNutritionText(text, res, fallbackName){
  var lines=text.split('\n');
  var parse=function(k){var l=getNutritionLine(lines,k);return l?parseNutritionNumber(l.split(':').slice(1).join(':')):0;};
  var action=(getNutritionLine(lines,'Action').split(':').slice(1).join(':').trim() || 'add').toLowerCase();
  action=action==='update_last' ? 'update_last' : 'add';
  var cal=parse('Calories'),prot=parse('Protein'),carbs=parse('Carbs'),fat=parse('Fat'),fiber=parse('Fiber');
  var foodName=getNutritionLine(lines,'Food').replace(/^Food:/i,'').trim()||fallbackName;
  var note=getNutritionLine(lines,'Note').replace(/^Note:/i,'').trim();
  saveMealNutrition(action,{foodName:foodName,calories:cal,protein:prot,carbs:carbs,fat:fat,fiber:fiber});
  res.innerHTML=renderNutritionResult(foodName,cal,prot,carbs,fat,note);
}

async function logFoodAI(){
  var txt=document.getElementById('food-input').value.trim();
  if(!txt&&!state.pendingFoodPhotoB64)return;
  var res=document.getElementById('ai-result');
  if(txt && applyManualCorrectionRequest(txt,res)){
    document.getElementById('food-input').value='';
    return;
  }
  if(!checkKey())return;
  document.getElementById('food-input').value='';
  res.style.display='block';res.innerHTML='<span class="ai-muted">Analysing with Gemini...</span>';
  try{
    var previous=state.meals.length ? JSON.stringify(state.meals[state.meals.length-1]) : 'none';
    var prompt='You are a precise nutrition analyst. The user logged: "'+(txt || 'food photo')+'". Last logged meal: '+previous+'. If the user is correcting the last meal, return Action: update_last and the full corrected totals for that meal, not the difference. Otherwise return Action: add. Estimate calories, protein (g), carbs (g), fat (g), fiber (g). '+NUTRITION_PROMPT_SUFFIX;
    var parts=[];
    if(state.pendingFoodPhotoB64) parts.push({inline_data:{mime_type:state.pendingFoodPhotoMime,data:state.pendingFoodPhotoB64}});
    parts.push({text:prompt});
    var d=await callGemini({contents:[{role:'user',parts:parts}]});
    if(d.error){res.innerHTML='<span class="ai-error">API error: '+d.error+'</span>';return;}
    applyNutritionText(d.text, res, txt || 'Analysed meal');
    clearPendingFoodPhoto();
  }catch(e){res.innerHTML='<span class="ai-error">Error: '+e.message+'</span>';}
}

function handlePhoto(input){
  var file=input.files[0];if(!file)return;
  var prev=document.getElementById('preview-img');
  var reader=new FileReader();
  reader.onload=function(e){
    prev.src=e.target.result;prev.style.display='block';
    state.pendingFoodPhotoB64=e.target.result.split(',')[1];
    state.pendingFoodPhotoMime=file.type;
    state.pendingFoodPhotoName=file.name;
    var label=document.getElementById('today-photo-preview');
    label.style.display='block';
    label.textContent='Photo attached: '+file.name;
  };
  reader.readAsDataURL(file);
}

function clearPendingFoodPhoto(){
  state.pendingFoodPhotoB64=null;
  state.pendingFoodPhotoMime=null;
  state.pendingFoodPhotoName=null;
  document.getElementById('photo-upload').value='';
  document.getElementById('preview-img').style.display='none';
  var label=document.getElementById('today-photo-preview');
  label.style.display='none';
  label.textContent='';
}

function handleChatPhoto(input){
  var file=input.files[0];if(!file)return;
  var reader=new FileReader();
  reader.onload=function(e){state.chatPhotoB64=e.target.result.split(',')[1];state.chatPhotoMime=file.type;document.getElementById('chat-preview').textContent='Photo attached: '+file.name;};
  reader.readAsDataURL(file);
}

async function sendChat(){
  var inp=document.getElementById('chat-input');
  var msg=inp.value.trim();if(!msg&&!state.chatPhotoB64)return;
  if(!checkKey())return;
  inp.value='';
  addChatMsg(msg||'(Photo attached)','user');
  var userContent=[];
  if(state.chatPhotoB64){userContent.push({type:'image',source:{type:'base64',media_type:state.chatPhotoMime,data:state.chatPhotoB64}});state.chatPhotoB64=null;state.chatPhotoMime=null;document.getElementById('chat-preview').textContent='';}
  if(msg)userContent.push({type:'text',text:msg});
  state.chatHistory.push({role:'user',content:userContent.length===1&&userContent[0].type==='text'?msg:userContent});
  var typing=document.getElementById('typing-indicator');typing.style.display='flex';
  var sys='You are the Nutrix AI — a knowledgeable, concise nutrition coach. User targets: '+state.calTarget+' kcal, Protein '+state.protTarget+'g, Carbs '+state.carbTarget+'g, Fat '+state.fatTarget+'g. Today consumed: '+state.calories+' kcal, Protein '+state.protein+'g, Carbs '+state.carbs+'g. Give evidence-based, practical advice. Be warm but concise (3–4 sentences max unless explaining something complex).';
  try{
    var d=await callGemini({
      system: sys,
      contents: toGeminiContents(state.chatHistory.slice(-10))
    });
    typing.style.display='none';
    if(d.error){addChatMsg('API error: '+d.error,'ai');return;}
    addChatMsg(d.text,'ai');
    state.chatHistory.push({role:'assistant',content:d.text});
  }catch(e){typing.style.display='none';addChatMsg('Connection error: '+e.message,'ai');}
}

function addChatMsg(text,role){
  var area=document.getElementById('chat-area');
  var div=document.createElement('div');div.className='chat-msg '+role;div.textContent=text;
  area.appendChild(div);area.scrollTop=area.scrollHeight;
}

function quickAsk(q){document.getElementById('chat-input').value=q;sendChat();}

function bindEvents(){
  document.querySelectorAll('.nav-btn[data-page]').forEach(function(btn){
    btn.addEventListener('click',function(){showPage(btn.dataset.page,btn);});
  });
  document.querySelectorAll('.tab[data-trend]').forEach(function(btn){
    btn.addEventListener('click',function(){switchTrend(btn.dataset.trend,btn);});
  });
  document.getElementById('photo-upload-btn').addEventListener('click',function(){
    document.getElementById('photo-upload').click();
  });
  document.getElementById('photo-upload').addEventListener('change',function(){
    handlePhoto(this);
  });
  document.getElementById('log-food-btn').addEventListener('click',logFoodAI);
  document.getElementById('chat-photo-btn').addEventListener('click',function(){
    document.getElementById('chat-photo').click();
  });
  document.getElementById('chat-photo').addEventListener('change',function(){
    handleChatPhoto(this);
  });
  document.getElementById('chat-input').addEventListener('keydown',function(event){
    if(event.key==='Enter'){sendChat();}
  });
  document.getElementById('send-chat-btn').addEventListener('click',sendChat);
  document.querySelectorAll('[data-question]').forEach(function(btn){
    btn.addEventListener('click',function(){quickAsk(btn.dataset.question);});
  });
  document.getElementById('calc-targets-btn').addEventListener('click',calcTargets);
}

function calcTargets(){
  var age=Math.round(clampNumber(document.getElementById('p-age').value,13,100,25));
  var gender=document.getElementById('p-gender').value;
  var h=clampNumber(document.getElementById('p-height').value,100,250,175);
  var w=clampNumber(document.getElementById('p-weight').value,30,300,70);
  document.getElementById('p-age').value=age;
  document.getElementById('p-height').value=h;
  document.getElementById('p-weight').value=w;
  var act=parseFloat(document.getElementById('p-activity').value)||1.55;
  var goal=document.getElementById('p-goal').value;
  var bmr=gender==='male'?(10*w)+(6.25*h)-(5*age)+5:(10*w)+(6.25*h)-(5*age)-161;
  var tdee=Math.round(bmr*act);
  var adj={cut:-500,maintain:0,bulk:300,lean:150};
  var cal=tdee+(adj[goal]||0);
  var pm={cut:2.2,maintain:1.8,bulk:2.0,lean:2.1};
  var prot=Math.round(w*pm[goal]);
  var fat=Math.round(cal*0.25/9);
  var carbs=Math.round((cal-(prot*4)-(fat*9))/4);
  state.calTarget=cal;state.protTarget=prot;state.carbTarget=carbs;state.fatTarget=fat;
  document.getElementById('t-cal').innerHTML=cal+'<span class="target-unit">kcal</span>';
  document.getElementById('t-prot').innerHTML=prot+'<span class="target-unit">g</span>';
  document.getElementById('t-carbs').innerHTML=carbs+'<span class="target-unit">g</span>';
  document.getElementById('t-fat').innerHTML=fat+'<span class="target-unit">g</span>';
  document.getElementById('targets-grid').style.display='grid';
  document.getElementById('targets-label').style.display='block';
  document.getElementById('insight-label').style.display='block';
  document.getElementById('insight-area').innerHTML='<div class="insight-card"><div class="insight-icon insight-icon-cal">⚡</div><div class="insight-text"><strong>Mifflin-St Jeor equation</strong> — the gold standard for BMR estimation, accurate within ±10% for most adults. Your TDEE is <strong>'+tdee+' kcal/day</strong>.</div></div><div class="insight-card"><div class="insight-icon insight-icon-protein">💪</div><div class="insight-text">Protein set at <strong>'+pm[goal]+'g/kg</strong> body weight per ISSN guidelines — optimised for your '+goal+' phase to maximise muscle protein synthesis.</div></div>';
  animateRings();
}

bindEvents();
setTimeout(animateRings,350);
// export default app;
