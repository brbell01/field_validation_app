const STORAGE_KEY = 'fieldVerifier.v1';
const SAMPLE = [
  {id:'001',name:'Location 001',latitude:41.0391,longitude:-73.8684,classification:'Category A'},
  {id:'002',name:'Location 002',latitude:41.0402,longitude:-73.8667,classification:'Category B'},
  {id:'003',name:'Location 003',latitude:41.0378,longitude:-73.8701,classification:'Category A'}
];
let data=[]; let index=0; let selectedClass=''; let map; let targetMarker; let userMarker; let accuracyCircle; let watchId=null; let deferredInstallPrompt=null;

const $=id=>document.getElementById(id);
function normalize(r){
  const pick=(...keys)=>{for(const k of keys){if(r[k]!==undefined && String(r[k]).trim()!=='') return r[k]} return ''};
  return {
    id:String(pick('id','ID','Id')).trim(), name:String(pick('name','Name','site','Site')).trim(),
    latitude:Number(pick('latitude','Latitude','lat','Lat')), longitude:Number(pick('longitude','Longitude','lon','Lon','lng','Lng')),
    classification:String(pick('classification','Classification','class','Class','category','Category')).trim(),
    fieldClassification:String(pick('fieldClassification','field_classification')).trim(), notes:String(pick('notes','Notes')).trim(),
    reviewed:String(pick('reviewed','review_status')).toLowerCase()==='true' || ['confirmed','changed'].includes(String(pick('review_status')).toLowerCase()),
    reviewedAt:String(pick('reviewedAt','reviewed_at')).trim()
  };
}
function validRow(r){return Number.isFinite(r.latitude)&&Number.isFinite(r.longitude)}
function saveLocal(){localStorage.setItem(STORAGE_KEY,JSON.stringify({data,index}));updateStats()}
function restoreLocal(){try{const s=JSON.parse(localStorage.getItem(STORAGE_KEY));if(s?.data?.length){data=s.data.map(normalize);index=Math.min(s.index||0,data.length-1);return true}}catch{} return false}

function parseCSV(text){
  const rows=[]; let row=[]; let field=''; let quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++}else quoted=!quoted}
    else if(c===','&&!quoted){row.push(field);field=''}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(v=>v.trim()!==''))rows.push(row);row=[];field=''}
    else field+=c;
  }
  row.push(field);if(row.some(v=>v.trim()!==''))rows.push(row);
  if(rows.length<2)throw new Error('CSV needs a header row and at least one data row.');
  const headers=rows[0].map(h=>h.trim());
  return rows.slice(1).map(vals=>normalize(Object.fromEntries(headers.map((h,i)=>[h,vals[i]??''])))).filter(validRow);
}
function esc(v){const s=String(v??'');return /[",\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
function downloadCSV(){
  const headers=['id','name','latitude','longitude','original_classification','field_classification','review_status','notes','reviewed_at'];
  const rows=data.map(d=>[d.id,d.name,d.latitude,d.longitude,d.classification,d.fieldClassification,d.reviewed?(d.fieldClassification===d.classification?'confirmed':'changed'):'not_reviewed',d.notes,d.reviewedAt]);
  const blob=new Blob([[headers,...rows].map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`field-verification-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)
}
function getClasses(){return [...new Set(data.map(d=>d.classification).filter(Boolean))].sort((a,b)=>a.localeCompare(b))}
function updateStats(){$('totalCount').textContent=data.length;$('reviewedCount').textContent=data.filter(d=>d.reviewed).length;$('changedCount').textContent=data.filter(d=>d.reviewed&&d.fieldClassification!==d.classification).length}
function initMap(){
  if(map)return;
  map=L.map('map',{zoomControl:true});
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:20,attribution:'Tiles © Esri'}).addTo(map);
  L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{maxZoom:20,attribution:'Labels © Esri',pane:'overlayPane'}).addTo(map);
}
function divIcon(cls){return L.divIcon({className:'',html:`<div class="${cls}"></div>`,iconSize:[22,22],iconAnchor:[11,11]})}
function updateMap(){
  initMap(); const d=data[index]; const ll=[d.latitude,d.longitude];
  if(targetMarker)targetMarker.setLatLng(ll);else targetMarker=L.marker(ll,{icon:divIcon('target-marker'),zIndexOffset:1000}).addTo(map);
  map.setView(ll,19); setTimeout(()=>map.invalidateSize(),30);
  $('directionsLink').href=`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(d.latitude+','+d.longitude)}`;
}
function renderClasses(){const box=$('classButtons');box.innerHTML='';getClasses().forEach(c=>{const b=document.createElement('button');b.type='button';b.className='button class-button'+(selectedClass===c?' selected':'');b.textContent=c;b.addEventListener('click',()=>{selectedClass=c;$('customClass').value='';renderClasses()});box.appendChild(b)})}
function render(){
  if(!data.length){$('workspace').classList.add('hidden');updateStats();return}
  $('workspace').classList.remove('hidden'); const d=data[index]; selectedClass=d.fieldClassification||'';
  $('siteName').textContent=d.name||`Location ${d.id||index+1}`;$('siteMeta').textContent=`${d.id?`ID ${d.id} • `:''}${d.latitude.toFixed(6)}, ${d.longitude.toFixed(6)}`;$('originalClass').textContent=d.classification||'Unclassified';
  $('statusPill').textContent=d.reviewed?(d.fieldClassification===d.classification?'Confirmed':'Changed'):'Not reviewed';$('progressLabel').textContent=`${index+1} of ${data.length}`;$('progressBar').style.width=`${((index+1)/data.length)*100}%`;
  $('notes').value=d.notes||'';$('customClass').value=d.fieldClassification&&!getClasses().includes(d.fieldClassification)?d.fieldClassification:'';$('prevBtn').disabled=index===0;$('nextBtn').disabled=index===data.length-1;renderClasses();updateStats();updateMap();
}
function review(value){const d=data[index];d.fieldClassification=value;d.notes=$('notes').value.trim();d.reviewed=true;d.reviewedAt=new Date().toISOString();saveLocal();const next=data.findIndex((x,i)=>i>index&&!x.reviewed);if(next>=0)index=next;render();saveLocal()}
function haversine(lat1,lon1,lat2,lon2){const R=6371000,toRad=x=>x*Math.PI/180;const a=Math.sin(toRad(lat2-lat1)/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(toRad(lon2-lon1)/2)**2;return 2*R*Math.asin(Math.sqrt(a))}
function formatDistance(m){return m<1000?`${Math.round(m)} m from target`:`${(m/1000).toFixed(2)} km from target`}
function startLocation(){
  if(!navigator.geolocation){$('distanceText').textContent='Geolocation unavailable in this browser.';return}
  $('distanceText').textContent='Locating…'; if(watchId!==null)navigator.geolocation.clearWatch(watchId);
  watchId=navigator.geolocation.watchPosition(pos=>{const {latitude,longitude,accuracy}=pos.coords;const d=data[index];const ll=[latitude,longitude];if(userMarker)userMarker.setLatLng(ll);else userMarker=L.marker(ll,{icon:divIcon('user-marker'),zIndexOffset:1100}).addTo(map);if(accuracyCircle){accuracyCircle.setLatLng(ll).setRadius(accuracy)}else accuracyCircle=L.circle(ll,{radius:accuracy,weight:1,opacity:.5,fillOpacity:.08}).addTo(map);$('distanceText').textContent=`${formatDistance(haversine(latitude,longitude,d.latitude,d.longitude))} • accuracy ±${Math.round(accuracy)} m`;},err=>{$('distanceText').textContent=`Location unavailable: ${err.message}`},{enableHighAccuracy:true,maximumAge:3000,timeout:15000})
}

$('fileInput').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const parsed=parseCSV(r.result);if(!parsed.length)throw new Error('No valid latitude/longitude rows found.');data=parsed;index=0;saveLocal();render();$('message').textContent=`Loaded ${data.length} locations from ${f.name}.`}catch(err){$('message').textContent=err.message}};r.readAsText(f)});
$('sampleBtn').addEventListener('click',()=>{data=SAMPLE.map(normalize);index=0;saveLocal();render();$('message').textContent='Sample data loaded.'});
$('resetBtn').addEventListener('click',()=>{if(confirm('Clear all locally saved field-review data?')){localStorage.removeItem(STORAGE_KEY);data=[];index=0;render();$('message').textContent='Saved data cleared.'}});
$('customClass').addEventListener('input',e=>{selectedClass=e.target.value.trim();renderClasses()});$('notes').addEventListener('input',()=>{if(data[index]){data[index].notes=$('notes').value;saveLocal()}});
$('confirmBtn').addEventListener('click',()=>review(data[index].classification));$('saveBtn').addEventListener('click',()=>{const value=$('customClass').value.trim()||selectedClass;if(!value){$('message').textContent='Choose or enter a field classification first.';return}review(value)});
$('prevBtn').addEventListener('click',()=>{if(index>0){index--;render();saveLocal()}});$('nextBtn').addEventListener('click',()=>{if(index<data.length-1){index++;render();saveLocal()}});$('nextUnreviewedBtn').addEventListener('click',()=>{const after=data.findIndex((d,i)=>i>index&&!d.reviewed),any=data.findIndex(d=>!d.reviewed),target=after>=0?after:any;if(target>=0){index=target;render();saveLocal()}else $('message').textContent='All locations have been reviewed.'});
$('locateBtn').addEventListener('click',startLocation);$('exportBtn').addEventListener('click',downloadCSV);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;$('installBtn').classList.remove('hidden')});$('installBtn').addEventListener('click',async()=>{if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;$('installBtn').classList.add('hidden')});
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}))}
if(restoreLocal()){$('message').textContent='Restored your saved review.';render()}else updateStats();
