function darkStar(p){
  function mod(n,m){return((n%m)+m)%m}
  function putPixel(buf,w,h,x,y,r,g,b){
    if(x<0||y<0||x>=w||y>=h)return;
    const i=(y*w+x)*3;
    buf[i]=r;buf[i+1]=g;buf[i+2]=b;
  }
  function drawLine(buf,w,h,x0,y0,x1,y1,r,g,b){
    let dx=Math.abs(x1-x0),sx=x0<x1?1:-1;
    let dy=-Math.abs(y1-y0),sy=y0<y1?1:-1;
    let err=dx+dy;
    while(true){
      putPixel(buf,w,h,x0,y0,r,g,b);
      if(x0===x1&&y0===y1)break;
      const e2=err*2;
      if(e2>=dy){err+=dy;x0+=sx}
      if(e2<=dx){err+=dx;y0+=sy}
    }
  }
  const buf=new Uint8Array(p.width*p.height*3);
  let yl=p.yLeft,yr=p.yRight,dyl=p.dyLeft,dyr=p.dyRight;
  let rr=p.r,gg=p.g,bb=p.b,drr=p.dr,dgg=p.dg,dbb=p.db;
  for(let i=0;i<p.lines;i++){
    drawLine(buf,p.width,p.height,0,mod(yl,p.height),p.width-1,mod(yr,p.height),mod(rr,256),mod(gg,256),mod(bb,256));
    yl+=dyl;yr+=dyr;
    rr=mod(rr+drr,256);gg=mod(gg+dgg,256);bb=mod(bb+dbb,256);
    if(p.slopeEvery>0&&(i+1)%p.slopeEvery===0){dyl+=p.ddyLeft;dyr+=p.ddyRight}
    if(p.colorEvery>0&&(i+1)%p.colorEvery===0){drr+=p.ddr;dgg+=p.ddg;dbb+=p.ddb}
  }
  return buf;
}
