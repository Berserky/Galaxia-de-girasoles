(()=>{
const TILE=256,MAX_LAT=85.05112878;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const project=(lat,lon,z)=>{
  const size=TILE*Math.pow(2,z),x=(Number(lon)+180)/360*size;
  const r=clamp(Number(lat),-MAX_LAT,MAX_LAT)*Math.PI/180;
  const y=(1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*size;
  return{x,y};
};
const unproject=(x,y,z)=>{
  const size=TILE*Math.pow(2,z),lon=x/size*360-180,n=Math.PI-2*Math.PI*y/size;
  return{lat:180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n))),lon};
};
const pascal=name=>String(name).split('-').map(x=>x?x[0].toUpperCase()+x.slice(1):'').join('');
const lucideNode=(name,size=18)=>{
  const api=window.lucide,definition=api?.icons?.[pascal(name)];
  if(!api?.createElement||!definition)return document.createTextNode('');
  return api.createElement(definition,{width:size,height:size,'stroke-width':1.8,'aria-hidden':'true'});
};

class GalaxyMap{
  constructor(element,options={}){
    this.el=element;this.zoom=clamp(Math.round(options.zoom||13),3,19);
    const c=options.center||[4.711,-74.0721];this.center={lat:Number(c[0]),lon:Number(c[1])};
    this.markers=[];this.lines=[];this.destroyed=false;this.tileNodes=new Map();this.renderFrame=0;
    this.el.innerHTML='<div class="gmap-tiles"></div><svg class="gmap-lines" aria-hidden="true"></svg><div class="gmap-markers"></div><div class="gmap-controls"><button type="button" data-gmap="in" aria-label="Acercar"></button><button type="button" data-gmap="out" aria-label="Alejar"></button></div><div class="gmap-attrib">© OpenStreetMap</div>';
    this.tiles=this.el.querySelector('.gmap-tiles');this.svg=this.el.querySelector('.gmap-lines');this.markerLayer=this.el.querySelector('.gmap-markers');
    this.el.querySelector('[data-gmap="in"]').appendChild(lucideNode('zoom-in',20));
    this.el.querySelector('[data-gmap="out"]').appendChild(lucideNode('zoom-out',20));
    this.bind();this.render();
    this.resizeObserver=new ResizeObserver(()=>this.scheduleRender());this.resizeObserver.observe(this.el);
  }
  bind(){
    this.click=e=>{const b=e.target.closest('[data-gmap]');if(!b)return;this.setZoom(this.zoom+(b.dataset.gmap==='in'?1:-1));};
    this.el.addEventListener('click',this.click);
    this.down=e=>{if(e.target.closest('button'))return;this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,center:project(this.center.lat,this.center.lon,this.zoom)};this.el.setPointerCapture?.(e.pointerId);};
    this.move=e=>{if(!this.drag||e.pointerId!==this.drag.id)return;const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y,p={x:this.drag.center.x-dx,y:this.drag.center.y-dy},c=unproject(p.x,p.y,this.zoom);this.center=c;this.scheduleRender();};
    this.up=e=>{if(this.drag&&e.pointerId===this.drag.id)this.drag=null;};
    this.el.addEventListener('pointerdown',this.down);this.el.addEventListener('pointermove',this.move);this.el.addEventListener('pointerup',this.up);this.el.addEventListener('pointercancel',this.up);
    this.dbl=e=>{if(!e.target.closest('button')){e.preventDefault();this.setZoom(this.zoom+1);}};
    this.el.addEventListener('dblclick',this.dbl);
  }
  scheduleRender(){
    if(this.destroyed||this.renderFrame)return;
    this.renderFrame=requestAnimationFrame(()=>{this.renderFrame=0;this.render();});
  }
  setZoom(z){this.zoom=clamp(Math.round(z),3,19);this.scheduleRender();}
  setView(center,z=this.zoom){this.center={lat:Number(center[0]),lon:Number(center[1])};this.zoom=clamp(Math.round(z),3,19);this.scheduleRender();}
  fitBounds(points,{maxZoom=16}={}){
    if(!points?.length){this.scheduleRender();return;}
    if(points.length===1){this.setView(points[0],Math.min(maxZoom,15));return;}
    const w=Math.max(160,this.el.clientWidth-70),h=Math.max(200,this.el.clientHeight-70);
    let chosen=3,cx=0,cy=0;
    for(let z=maxZoom;z>=3;z--){
      const ps=points.map(p=>project(p[0],p[1],z)),xs=ps.map(p=>p.x),ys=ps.map(p=>p.y);
      if(Math.max(...xs)-Math.min(...xs)<=w&&Math.max(...ys)-Math.min(...ys)<=h){chosen=z;cx=(Math.max(...xs)+Math.min(...xs))/2;cy=(Math.max(...ys)+Math.min(...ys))/2;break;}
    }
    const c=unproject(cx,cy,chosen);this.center=c;this.zoom=chosen;this.scheduleRender();
  }
  addMarker({lat,lon,label='',icon='',className='',popup=''}){this.markers.push({lat:Number(lat),lon:Number(lon),label,icon,className,popup});return this;}
  addPolyline(points,{className='',dashed=false}={}){this.lines.push({points:points.map(p=>[Number(p[0]),Number(p[1])]),className,dashed});return this;}
  screen(lat,lon){
    const rect=this.el.getBoundingClientRect(),c=project(this.center.lat,this.center.lon,this.zoom),p=project(lat,lon,this.zoom);
    return{x:rect.width/2+(p.x-c.x),y:rect.height/2+(p.y-c.y)};
  }
  renderTiles({z,n,left,top,w,h}){
    const minX=Math.floor(left/TILE)-1,maxX=Math.floor((left+w)/TILE)+1,minY=Math.floor(top/TILE)-1,maxY=Math.floor((top+h)/TILE)+1;
    const needed=new Set();
    for(let tx=minX;tx<=maxX;tx++)for(let ty=minY;ty<=maxY;ty++){
      if(ty<0||ty>=n)continue;
      const wrapped=((tx%n)+n)%n,key=z+'/'+tx+'/'+ty;needed.add(key);
      let img=this.tileNodes.get(key);
      if(!img){
        img=document.createElement('img');img.className='gmap-tile';img.alt='';img.draggable=false;img.decoding='async';
        img.src='https://tile.openstreetmap.org/'+z+'/'+wrapped+'/'+ty+'.png';
        this.tileNodes.set(key,img);this.tiles.appendChild(img);
      }
      img.style.left=(tx*TILE-left)+'px';img.style.top=(ty*TILE-top)+'px';
    }
    for(const [key,img] of this.tileNodes){if(!needed.has(key)){img.remove();this.tileNodes.delete(key);}}
  }
  render(){
    if(this.destroyed||!this.el.clientWidth||!this.el.clientHeight)return;
    const w=this.el.clientWidth,h=this.el.clientHeight,z=this.zoom,n=Math.pow(2,z),c=project(this.center.lat,this.center.lon,z),left=c.x-w/2,top=c.y-h/2;
    this.renderTiles({z,n,left,top,w,h});
    this.svg.setAttribute('viewBox','0 0 '+w+' '+h);this.svg.setAttribute('width',w);this.svg.setAttribute('height',h);this.svg.replaceChildren();
    for(const line of this.lines){
      if(line.points.length<2)continue;
      const poly=document.createElementNS('http://www.w3.org/2000/svg','polyline');
      poly.setAttribute('points',line.points.map(p=>{const s=this.screen(p[0],p[1]);return s.x+','+s.y;}).join(' '));
      poly.setAttribute('class','gmap-line '+line.className+(line.dashed?' dashed':''));poly.setAttribute('fill','none');this.svg.appendChild(poly);
    }
    const markers=document.createDocumentFragment();
    for(const m of this.markers){
      const p=this.screen(m.lat,m.lon),wrap=document.createElement('div');wrap.className='gmap-marker '+m.className;wrap.style.left=p.x+'px';wrap.style.top=p.y+'px';
      const button=document.createElement('button');button.type='button';
      if(m.icon)button.appendChild(lucideNode(m.icon,18));else button.textContent=m.label;
      button.setAttribute('aria-label',m.popup||m.label||'Marcador');
      wrap.appendChild(button);
      if(m.popup){const pop=document.createElement('div');pop.className='gmap-popup';pop.textContent=m.popup;wrap.appendChild(pop);button.addEventListener('click',ev=>{ev.stopPropagation();wrap.classList.toggle('open');});}
      markers.appendChild(wrap);
    }
    this.markerLayer.replaceChildren(markers);
  }
  remove(){
    this.destroyed=true;if(this.renderFrame)cancelAnimationFrame(this.renderFrame);
    this.resizeObserver?.disconnect();this.el.removeEventListener('click',this.click);this.el.removeEventListener('pointerdown',this.down);this.el.removeEventListener('pointermove',this.move);this.el.removeEventListener('pointerup',this.up);this.el.removeEventListener('pointercancel',this.up);this.el.removeEventListener('dblclick',this.dbl);
    this.tileNodes.clear();this.el.innerHTML='';
  }
}
window.GalaxyMap=GalaxyMap;
})();