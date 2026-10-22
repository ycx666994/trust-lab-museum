<script>
/* ============================================================
   tl-bg-gl.js — 零依赖 WebGL 程序化背景引擎（博物馆厅堂版 v2）
   单全屏三角形 + 一支 fragment shader，12 个程序化「厅堂」场景按 u_scene 切换。
   v2 思路：不再画抽象氛围，而是对每个场景做真实的一点透视求交
   （地面 / 天花 / 左右墙 / 尽头墙 / 穹顶 / 圆柱壁），
   再用材质（大理石、木饰面、金箔、玻璃、水、铜锈）与灯光逐厅区分。
   不用 three.js / 不用模块 —— file:// 双击可用；WebGL 不可用时
   由 06-bg.js 回退到 CSS 图层方案。
   暴露：window.TLBG = { supported, booting, onReady(fn), apply(id), thumbs(), snap(id,w,h), pause(b) }
   ============================================================ */
(function () {
  "use strict";
  const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";

  const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_scene;
uniform vec2 u_mouse;

/* 平滑阶跃：显式实现，允许 edge0 > edge1（降序），避免驱动对反序 smoothstep 的未定义行为 */
float sstep(float a,float b,float x){
  float t=clamp((x-a)/(b-a),0.,1.);
  return t*t*(3.-2.*t);
}

/* ================= 公共库 ================= */
float hash21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float hash11(float x){ return fract(sin(x*127.1)*43758.5453); }
float vnoise(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  float a=hash21(i), b=hash21(i+vec2(1.,0.)), c=hash21(i+vec2(0.,1.)), d=hash21(i+vec2(1.,1.));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}
float fbm(vec2 p){
  float v=0., a=.5; mat2 r=mat2(.8,.6,-.6,.8);
  for(int i=0;i<4;i++){ v+=a*vnoise(p); p=r*p*2.03; a*=.5; }
  return v;
}
vec2 rot(vec2 p,float a){ float c=cos(a),s=sin(a); return mat2(c,-s,s,c)*p; }

/* 细线：x 接近整数处返回 1（用于格线 / 分格） */
float ln(float x,float w){ return sstep(w,0.,abs(fract(x+.5)-.5)); }
float gline(vec2 q,vec2 n,float w){
  vec2 f=abs(fract(q*n+.5)-.5);
  return sstep(w,0.,max(f.x,f.y));
}
/* 屏幕空间光斑 */
float spot(vec2 uv,vec2 c,float r){ vec2 d=uv-c; return exp(-dot(d,d)/(r*r)); }
/* 体积光带（竖直方向） */
float shaft(vec2 uv,float x,float w,float top,float bot){
  float k=mix(w*2.6,w,clamp((uv.y-bot)/(top-bot),0.,1.));
  return exp(-pow((uv.x-x)/k,2.)) * sstep(bot-.1,top,uv.y);
}
/* 星点层 */
vec3 starLayer(vec2 uv,float dens,float sz,float tw){
  vec2 g=uv*dens; vec2 id=floor(g); vec2 f=fract(g)-.5;
  float h=hash21(id);
  float d=length(f*(1.5+h*2.5));
  float s=sstep(sz,0.,d)*step(.80,h);
  float t=.55+.45*sin(u_time*(1.+h*3.)+h*40.)*tw;
  return vec3(s*t);
}
/* 上升粒子层（尘 / 火星 / 气泡） */
vec3 riseDots(vec2 uv,float dens,float speed,vec3 tint,float glow){
  vec2 g=vec2(uv.x*dens, uv.y*dens*.62 - u_time*speed);
  g.x += sin(g.y*.7+u_time)*.35;
  vec2 id=floor(g); vec2 f=fract(g)-.5;
  float h=hash21(id);
  float d=length(f);
  float s=sstep(.12+h*.1,0.,d)*step(.72,h);
  float fade=sstep(1.2,.4,uv.y+.5);
  return tint*s*(glow+(.5+.5*sin(u_time*(1.+h*4.)+h*30.)))*fade;
}
vec3 fogc(vec3 c,float t,vec3 f,float k){ return mix(c,f,1.-exp(-t*k)); }

/* 一点透视盒：相机在原点朝 +z，hs=(半宽,半高,进深)
   返回 (命中点 xyz, 面 id)  id: 0 地面 / 1 天花 / 2 左墙 / 3 右墙 / 4 尽头 */
vec4 boxRoom(vec3 rd,vec3 hs){
  float tx=hs.x/max(abs(rd.x),1e-4);
  float ty=hs.y/max(abs(rd.y),1e-4);
  float tz=hs.z/max(abs(rd.z),1e-4);
  float t=min(min(tx,ty),tz);
  vec3 p=rd*t;
  float id=4.;
  if(t==ty) id = p.y>0.?1.:0.;
  else if(t==tx) id = p.x>0.?3.:2.;
  return vec4(p,id);
}
/* 大理石纹 */
float marble(vec2 p){
  float n=fbm(p*1.3);
  float v=abs(sin((p.x*1.15+p.y*.42+n*2.4)*3.1416));
  float vein=sstep(.58,.96,1.-v);
  float base=.34+.22*fbm(p*2.2+5.3);
  return clamp(base+vein*.62,0.,1.);
}
/* 木纹（沿 x 走向的板） */
float woodg(vec2 p){
  float n=fbm(vec2(p.x*2.4,p.y*22.));
  return .5+.5*sin(p.y*46.+n*7.);
}
/* 山脊：三组正弦叠出峰峦（0~1） */
float mtn(float x,float seed){
  float v=.52*pow(abs(sin(x*1.15+seed)),1.5);
  v+=.30*pow(abs(sin(x*2.30+seed*1.7+1.3)),2.0);
  v+=.18*pow(abs(sin(x*4.10+seed*2.9+2.7)),2.4);
  return v;
}

/* ================= 1 · 金碧辉煌 ================= */
vec3 scJinbi(vec2 uv,float t){
  vec3 rd=normalize(vec3(uv.x,uv.y-.17,1.15));
  vec4 h=boxRoom(rd,vec3(3.1,1.62,15.));
  vec3 p=h.xyz; float id=h.w; float d=length(p);
  vec3 col=vec3(.90,.86,.78);
  if(id<.5){
    /* — 地面：象牙大理石 + 嵌金线 + 浅红毯 — */
    vec2 q=p.xz;
    float m=marble(q*1.9);
    col=mix(vec3(.79,.75,.67),vec3(.93,.89,.81),m*.80);
    col+=vec3(.62,.46,.16)*gline(q,vec2(.85),.010)*.55;
    col+=vec3(.55,.42,.18)*gline(q,vec2(1.7),.007)*.24;
    float cp=sstep(1.22,1.08,abs(p.x));
    vec3 carp=vec3(.82,.42,.38)*(.78+.24*marble(q*2.6));
    carp+=vec3(.72,.50,.14)*ln(p.x*1.6,.028)*.65;
    carp+=vec3(.66,.44,.16)*gline(q,vec2(1.4,.5),.010)*.25;
    col=mix(col,carp,cp*.92);
    col+=vec3(1.,.94,.78)*exp(-abs(p.x)*1.3)*sstep(15.,5.,p.z)*.07;
  } else if(id<1.5){
    /* — 天花：金箔藻井 — */
    vec2 q=p.xz;
    float cf=gline(q,vec2(.85),.028);
    col=mix(vec3(.88,.82,.70),vec3(.97,.91,.76),cf);
    col+=vec3(.70,.53,.20)*gline(q,vec2(.85),.007)*.85;
    col+=vec3(.62,.48,.22)*ln(q.x*1.7,.02)*ln(q.y*1.7,.02)*.45;
    col*=.95+.09*fbm(q*1.7);
  } else if(id<3.5){
    /* — 墙：象牙护壁 + 金线 + 壁灯 — */
    vec2 q=vec2(p.z,p.y);
    float pz=fract(p.z/2.4);
    float pil=exp(-pow((pz-.5)*2./.13,2.));
    col=mix(vec3(.85,.80,.71),vec3(.94,.89,.79),(.5+.5*sin(p.y*2.2))*.65);
    float pn=gline(vec2(p.z*.62,p.y*.62),vec2(1.),.012);
    col+=vec3(.70,.52,.18)*pn*.55;
    col+=vec3(.58,.45,.20)*ln(p.y*7.,.02)*.25;
    col=mix(col,vec3(.99,.95,.85),pil*.85);
    col+=vec3(.76,.58,.22)*gline(q,vec2(.6,1.),.010)*.65;
    col+=vec3(.82,.64,.28)*exp(-pow((p.y-1.10)*16.,2.))*.45;
    float sc=exp(-pow((pz-.5)*13.,2.))*exp(-pow((p.y-.55)*4.5,2.));
    col+=vec3(1.,.88,.54)*sc*.40;
    col+=vec3(.96,.80,.44)*exp(-pow((p.y-.55)*1.8,2.))*exp(-pow((pz-.5)*3.2,2.))*.20;
  } else {
    /* — 尽头：金色拱门 + 透光 — */
    vec2 dq=vec2(p.x,max(0.,p.y-.72));
    float door=sstep(1.32,1.18,length(dq));
    col=mix(vec3(.90,.86,.78),vec3(.98,.94,.86),.5);
    col+=vec3(1.,.96,.84)*door*.50;
    float rim=sstep(1.50,1.40,length(dq))-sstep(1.40,1.31,length(dq));
    col+=vec3(.86,.66,.26)*rim*.85;
    col+=vec3(.72,.56,.22)*gline(vec2(p.x,p.y),vec2(.5),.012)*.45;
  }
  col=fogc(col,d,vec3(.95,.92,.85),.05);
  col+=vec3(1.,.96,.82)*spot(uv,vec2(0.,.64),.28)*.055;
  col+=vec3(1.,.98,.90)*spot(uv,vec2(0.,.64),.07)*.10;
  col+=vec3(1.,.95,.80)*riseDots(uv+vec2(0.,.3),10.,.06,vec3(1.),.5)*.07;
  return col;
}

/* ================= 2 · 古典穹顶 ================= */
vec3 scGudian(vec2 uv,float t){
  vec3 rd=normalize(vec3(uv.x,uv.y+.06,1.05));
  float R=6.4, Ry=2.60, Hh=1.30, FY=-.72;
  float tw=R/max(length(rd.xz),1e-4);
  vec3 pw=rd*tw;
  float tf=(rd.y<-1e-4)?(FY/rd.y):1e9;
  float A=rd.x*rd.x/(R*R)+rd.y*rd.y/(Ry*Ry)+rd.z*rd.z/(R*R);
  float B=-2.*Hh*rd.y/(Ry*Ry);
  float C=Hh*Hh/(Ry*Ry)-1.;
  float td=(-B+sqrt(max(B*B-4.*A*C,0.)))/(2.*A);
  float th; float id;
  if(tf<tw){ th=tf; id=0.; }
  else if(pw.y<Hh){ th=tw; id=1.; }
  else { th=td; id=2.; }
  vec3 p=rd*th; float d=th;
  float ang=atan(p.z,p.x);
  float ca=ang/6.2832*20.+.5;
  float cf=fract(ca);
  float dc=abs(cf-.5);
  vec3 col=vec3(.86,.84,.80);

  if(id<.5){
    /* — 地面：白大理石 + 放射铺装 + 光池 — */
    float r=length(p.xz);
    col=mix(vec3(.80,.78,.74),vec3(.95,.94,.91),marble(p.xz*.85));
    col-=vec3(.30,.29,.26)*(ln(r*1.3,.014)+ln(r*2.6,.009)*.5)*.35;
    col-=vec3(.22,.21,.19)*ln(ang/6.2832*40.,.008)*.20;
    col*= 1.-.10*sstep(.5,0.,dc);                 /* 柱列落影 */
    col+=vec3(1.,.98,.92)*exp(-pow(r*.50,2.))*.14;
  } else if(id<1.5){
    /* — 鼓座：柱廊 + 壁龛 + 高窗 — */
    float cw=.360;
    cw-=.055*sstep(.78,.86,p.y);
    cw-=.048*sstep(-.54,-.62,p.y);
    float colm=sstep(cw-.014,cw+.014,dc);
    float baseM=1.-sstep(-.60,-.58,p.y);
    float entM=sstep(.82,.84,p.y)*(1.-sstep(.94,.96,p.y));
    vec3 wall=mix(vec3(.74,.72,.68),vec3(.84,.82,.77),(.5+.5*sin(p.y*1.6))*.70);
    wall-=vec3(.10,.10,.09)*marble(vec2(ang*4.,p.y*1.6))*.60;
    wall*= .97-.05*fbm(vec2(ang*9.,p.y*2.2));
    /* 壁龛：略暗的凹处 + 暖光 */
    float nch=1.-sstep(.0,.255,dc);
    float arch=.14-.58*dc*dc;
    float inN=nch*(1.-sstep(arch-.02,arch+.02,p.y));
    wall=mix(wall,vec3(.60,.58,.55),inN*.80);
    wall+=vec3(1.,.92,.74)*inN*exp(-pow((p.y+.22)*2.0,2.))*.42;
    /* 柱身：白大理石，柱心受光、两侧落影 */
    vec3 cm=mix(vec3(.80,.78,.74),vec3(1.02,.99,.94),sstep(.5,.24,dc));
    cm-=vec3(.16,.15,.14)*ln(dc*20.,.055)*.55;
    cm*= .97-.05*sstep(-.72,.92,p.y);
    col=mix(wall,cm,colm*(1.-baseM)*(1.-entM));
    col=mix(col,vec3(.86,.84,.80),baseM*.95);
    col=mix(col,vec3(.92,.90,.86),entM*.92);
    col-=vec3(.10,.09,.08)*ln(p.y*24.,.05)*entM*.60;
    /* 鼓座拱窗：透出的天光 */
    float wn=dc/.125;
    float wtop=1.04+.24*(1.-wn*wn);
    float win=(1.-sstep(.0,.125,dc))*sstep(1.00,1.03,p.y)*(1.-sstep(wtop-.05,wtop,p.y));
    col=mix(col,vec3(.99,.97,.92),win*.75);
    col+=vec3(1.,.98,.90)*win*(.30+.25*exp(-pow((p.y-1.02)*6.,2.)));
  } else {
    /* — 穹顶：放射肋 + 环向藻井，向顶心汇聚 — */
    float rr=length(p.xz)/R;
    float hgt=clamp((p.y-Hh)/Ry,0.,1.);
    float ribW=ln(ang/6.2832*16.,.034);
    float ribN=ln(ang/6.2832*16.,.018);
    float bndW=ln(rr*7.,.022);
    float bndN=ln(rr*7.,.009);
    float grout=max(ribN,bndN);
    float edge=max(ribW,bndW)-grout;
    vec3 panel=mix(vec3(.84,.82,.78),vec3(1.,.99,.95),pow(hgt,.55));
    panel*=.98+.03*fbm(vec2(ang*9.,rr*7.));
    col=panel;
    col-=vec3(.20,.19,.17)*clamp(grout,0.,1.)*.62;              /* 深缝 */
    col+=vec3(.90,.78,.52)*clamp(edge,0.,1.)*.55;               /* 描金肋 */
    col+=vec3(1.,.99,.94)*pow(hgt,3.4)*.16;                     /* 顶部天光 */
    col-=vec3(.10,.10,.09)*exp(-pow((1.-rr)*28.,2.))*.8;        /* 起拱檐圈 */
  }
  col=fogc(col,d,vec3(.95,.94,.90),.03);
  col+=vec3(1.,.98,.90)*spot(uv,vec2(0.,.86),.42)*.11;
  col+=vec3(1.,.98,.92)*shaft(uv,.0,.085,1.30,-.75)*.05;
  col+=vec3(1.,.99,.94)*exp(-pow(uv.x*2.2,2.))*exp(-pow((uv.y+.55)*2.0,2.))*.12;
  col+=vec3(1.,.98,.92)*riseDots(uv+vec2(0.,.30),9.,.05,vec3(1.),.4)*.08;
  return col;
}

/* ================= 3 · 复古画廊 ================= */
vec3 scFugu(vec2 uv,float t){
  vec3 rd=normalize(vec3(uv.x,uv.y-.12,1.2));
  vec4 h=boxRoom(rd,vec3(2.2,1.7,13.));
  vec3 p=h.xyz; float id=h.w; float d=length(p);
  vec3 col=vec3(.86,.82,.74);
  if(id<.5){
    /* — 地面：橡木地板 + 红毯 — */
    vec2 q=p.xz;
    float wd=woodg(vec2(p.z,p.x));
    col=mix(vec3(.62,.48,.34),vec3(.78,.64,.46),wd);
    col-=vec3(.12,.09,.06)*gline(q,vec2(2.6,1.),.02)*.55;
    float cp=sstep(.85,.72,abs(p.x));
    vec3 rug=vec3(.72,.38,.32)*(.82+.18*marble(q*3.2));
    rug+=vec3(.66,.46,.16)*gline(q,vec2(1.2,.4),.02)*.45;
    col=mix(col,rug,cp*.90);
  } else if(id<1.5){
    vec2 q=p.xz;
    col=mix(vec3(.88,.85,.79),vec3(.94,.92,.87),fbm(q*1.4));
    col-=vec3(.10,.09,.08)*gline(q,vec2(.7),.02)*.40;
  } else if(id<3.5){
    vec2 q=vec2(p.z,p.y);
    float cell=2.2;
    float fz=fract(p.z/cell);
    float wall=woodg(vec2(p.y,p.z))*.5;
    col=mix(vec3(.80,.76,.69),vec3(.90,.86,.79),wall);
    col-=vec3(.10,.09,.08)*gline(vec2(p.z,p.y),vec2(1.,2.),.02)*.55;
    /* 画框 */
    float dx=abs(fz-.5)/.30, dy=abs(p.y-.14)/.52;
    float fm=max(dx,dy);
    float art=sstep(1.,.94,fm);
    float gilt=sstep(1.18,1.08,fm)-sstep(1.08,1.0,fm);
    float idx=floor(p.z/cell);
    float hs=hash11(idx*3.7+1.9);
    vec3 pc=mix(vec3(.52,.44,.32),vec3(.78,.68,.50),sstep(-.30,.60,p.y));
    pc*= .88+.20*fbm(p.zy*2.2+idx*3.1);
    pc+=vec3(.10,.08,.05)*exp(-pow((p.y-.60)*3.0,2.))*(.5+.5*hs);
    float hz=-.06+.14*(fbm(vec2(p.z*1.5+idx*5.3,1.1))-.5);
    pc=mix(pc,vec3(.40,.34,.25),1.-sstep(hz-.02,hz+.02,p.y));
    float fgx=.5+(hs-.5)*.34;
    float fig=exp(-pow((fz-fgx)*5.5,2.))*exp(-pow((p.y-.02)*3.0,2.));
    pc-=vec3(.18,.15,.10)*fig*(.55+.45*hs);
    pc-=vec3(.12,.10,.07)*exp(-pow((fz-.5)*2.6,2.))*exp(-pow((p.y-.62)*4.0,2.))*.6;
    col=mix(col,pc,art*.95);
    col+=vec3(.92,.74,.34)*gilt*.55;
    col-=vec3(.10,.08,.05)*art*(1.-sstep(0.,.12,fm))*.5;
    /* 壁灯 */
    float dc=abs(fract(p.z/cell+.5)-.5);
    float sc=exp(-pow(dc*15.,2.))*exp(-pow((p.y-.62)*4.2,2.));
    col+=vec3(1.,.90,.66)*sc*.52;
    col+=vec3(.96,.84,.58)*exp(-pow((p.y-.62)*1.4,2.))*exp(-pow(dc*2.4,2.))*.24;
  } else {
    col=mix(vec3(.86,.82,.74),vec3(.92,.89,.82),.5);
    col+=vec3(1.,.96,.86)*exp(-pow(p.x*.9,2.))*exp(-pow((p.y-.2)*.7,2.))*.20;
  }
  col=fogc(col,d,vec3(.93,.90,.83),.06);
  col+=vec3(1.,.95,.80)*spot(uv,vec2(-.5,.5),.26)*.09;
  col+=vec3(1.,.95,.80)*spot(uv,vec2(.55,.45),.26)*.08;
  col+=vec3(1.,.96,.86)*riseDots(uv+vec2(0.,.3),12.,.04,vec3(1.),.4)*.06;
  return col;
}

/* ================= 4 · 梦幻云厅 ================= */
vec3 scMenghuan(vec2 uv,float t){
  vec3 rd=normalize(vec3(uv.x,uv.y-.10,1.05));
  vec4 h=boxRoom(rd,vec3(2.65,1.95,13.));
  vec3 p=h.xyz; float id=h.w; float d=length(p);
  vec3 col=vec3(.80,.79,.87);
  if(id<.5){
    /* — 淡紫镜面地砖 — */
    vec2 q=p.xz;
    float tr=hash21(floor(q*.8));
    col=vec3(.62,.61,.71)+vec3(.055,.055,.062)*tr;
    col*=.965+.06*fbm(q*7.0);
    col=mix(col,vec3(.44,.43,.55),gline(q,vec2(.8),.009)*.78);
    col+=vec3(.50,.46,.72)*gline(q,vec2(.8),.0032)*.16;
    col+=vec3(.88,.86,.98)*exp(-pow(p.x*.42,2.))*sstep(11.,1.,p.z)*.18;
  } else if(id<1.5){
    /* — 玻璃天窗：深梃方格 + 柔光 — */
    vec2 q=p.xz;
    col=vec3(.66,.65,.79);
    float rib=gline(q,vec2(.78),.030);
    col=mix(col,vec3(.46,.44,.60),rib*.95);
    col+=vec3(.72,.68,.94)*gline(q,vec2(.78),.008)*.30;
    col+=vec3(.90,.89,.99)*exp(-pow(p.x*.50,2.))*.16;
  } else if(id<3.5){
    /* — 侧墙：墙裙 + 柱列 + 拱形壁龛 + 檐口 — */
    vec2 q=vec2(p.z,p.y);
    col=mix(vec3(.60,.59,.72),vec3(.79,.78,.88),(.5+.5*sin(p.y*1.7))*.62);
    col=mix(col,vec3(.62,.61,.72),1.-sstep(-1.10,-1.02,p.y));      /* 墙裙 */
    col-=vec3(.06,.06,.09)*sstep(-1.04,-1.00,p.y);
    col=mix(col,vec3(.86,.85,.94),sstep(.82,.87,p.y));             /* 檐口 */
    col-=vec3(.12,.12,.16)*sstep(.74,.78,p.y)*(1.-sstep(.80,.84,p.y));
    /* 柱列 */
    float pz=fract(p.z/3.2);
    float pil=exp(-pow((pz-.5)*2.2/.11,2.));
    col=mix(col,vec3(.93,.92,1.),pil*.85);
    col-=vec3(.16,.15,.21)*exp(-pow((pz-.5)*2.2/.038,2.));
    col+=vec3(.03)*pil*exp(-pow((p.y-.30)*1.1,2.));
    /* 拱形发光壁龛：axn/nd 描述"拱形凹腔"的有向距离 */
    float axn=abs((pz-.5)*3.2);
    float archTop=.62-.34*(axn/.86)*(axn/.86);
    float nd=max(axn-.86,p.y-archTop);
    float inN=1.-sstep(-.015,.015,nd);
    float rimN=exp(-pow(nd*26.,2.));
    col=mix(col,vec3(.42,.41,.56),inN*.90);                       /* 凹腔 */
    col+=vec3(.92,.90,1.)*inN*(.08+.20*exp(-pow((p.y-.10)*1.9,2.)));
    col+=vec3(.40,.38,.52)*inN*exp(-pow((p.y-archTop+.03)*18.,2.))*.9;
    col+=vec3(.94,.92,1.)*rimN*.30;                               /* 龛边亮线 */
    col-=vec3(.10,.10,.14)*exp(-pow((nd+.035)*26.,2.))*.55;       /* 龛外暗影 */
  } else {
    /* — 尽头：柔光门洞 + 环框 — */
    col=vec3(.80,.79,.90);
    col+=vec3(1.,1.,1.)*exp(-pow(p.x*.55,2.))*exp(-pow((p.y+.20)*.55,2.))*.10;
    col+=vec3(.90,.84,1.)*exp(-pow(p.x*.90,2.))*exp(-pow((p.y+.20)*.90,2.))*.11;
    col-=vec3(.16,.16,.22)*exp(-pow((abs(p.x)-1.10)*3.0,2.))*.55;
  }
  col=fogc(col,d,vec3(.84,.83,.93),.035);
  /* 极淡云缕 */
  float cl=fbm(vec2(uv.x*1.7-t*.03,uv.y*2.4+3.1));
  col=mix(col,vec3(.94,.93,.99),sstep(.44,.82,cl)*.18);
  /* 漂浮光球：小核 + 柔晕 + 地面倒影 */
  for(int i=0;i<6;i++){
    float fi=float(i);
    float h1=hash11(fi*7.1+1.3), h2=hash11(fi*3.7+5.1);
    vec2 c=vec2((h1-.5)*2.2+sin(t*.19+fi)*.10, .10+(h2-.5)*.85+sin(t*.27+fi*2.)*.04);
    float r=.028+h1*.026;
    vec3 oc=mix(vec3(1.,.86,.94),vec3(.82,.92,1.),h2);
    col+=oc*spot(uv,c,r*3.4)*.06;
    col+=oc*spot(uv,c,r*1.6)*.09;
    col+=vec3(1.)*spot(uv,c,r*.32)*.14;
    vec2 rc=vec2(c.x,-.30-(c.y+.30)*.55);
    col+=oc*spot(uv,rc,r*3.6)*.05;
  }
  col+=vec3(.98,.96,1.)*exp(-pow((uv.y+.06)*2.0,2.))*(.05+.04*fbm(vec2(uv.x*1.4-t*.03,t*.04)));
  col+=vec3(1.,.99,1.)*riseDots(uv+vec2(0.,.4),8.,.07,vec3(1.),.5)*.05;
  col+=vec3(1.,.98,1.)*starLayer(uv*1.2+3.3,30.,.10,.8)*.08;
  return col;
}

/* ================= 5 · 水墨长卷 ================= */
vec3 scShuimo(vec2 uv,float t){
  /* 展墙：宣纸灰 */
  vec3 col=mix(vec3(.80,.78,.74),vec3(.88,.86,.82),fbm(uv*vec2(2.2,1.6)+3.1));
  col*= .99+.02*vnoise(uv*80.);
  float wr=.30+.16*(fbm(vec2(uv.x*1.5+4.2,.7))-.5);
  col-=vec3(.05,.05,.05)*(1.-sstep(wr-.05,wr+.05,uv.y));
  col=mix(col,vec3(.70,.68,.64),1.-sstep(-.88,-.82,uv.y));   /* 墙裙 */
  /* 长卷：横幅手卷 */
  float hw=1.42, hh=.50, cy=-.02;
  float dxo=abs(uv.x)/hw, dyo=abs(uv.y-cy)/hh;
  float md=max(dxo,dyo);
  float m=1.-sstep(.985,1.0,md);
  if(m>.002){
    /* 绫绢裱边 */
    vec3 mount=mix(vec3(.70,.67,.62),vec3(.78,.75,.70),fbm(uv*vec2(7.,11.)+1.7));
    mount-=vec3(.05,.05,.05)*ln(uv.y*46.,.05)*.55;
    /* 画心 */
    float ax=uv.x/1.355, ay=(uv.y-cy)/.435;
    float art=1.-sstep(.985,1.0,max(abs(ax),abs(ay)));
    vec3 paperBase=mix(vec3(.93,.92,.89),vec3(.97,.96,.93),fbm(vec2(ax*3.2,ay*2.2)+1.3));
    paperBase*= .99+.02*vnoise(uv*70.);
    vec3 paper=paperBase;
    /* 三层山：淡墨递进 */
    float r1=.16+.40*mtn(ax*1.00,1.1);
    paper=mix(paper,vec3(.64,.63,.61),1.-sstep(r1-.014,r1+.014,ay));
    float r2=-.02+.28*mtn(ax*1.35,4.7);
    paper=mix(paper,vec3(.47,.46,.45),1.-sstep(r2-.011,r2+.011,ay));
    float r3=-.24+.24*mtn(ax*1.90,9.3);
    paper=mix(paper,vec3(.27,.27,.27),1.-sstep(r3-.009,r3+.009,ay));
    paper-=vec3(.03)*(fbm(vec2(ax*22.,ay*22.))-.5)*(1.-sstep(r3+.02,r3-.28,ay));
    /* 山脚云气 */
    float lowMist=exp(-pow((ay+.52)*2.6,2.))*(.45+.55*fbm(vec2(ax*3.1,7.7)));
    paper=mix(paper,paperBase,lowMist*.62);
    /* 水面：留白 + 横波 */
    float water=1.-sstep(-.72,-.62,ay);
    paper=mix(paper,paperBase,water);
    paper-=vec3(.045)*ln(ay*17.,.05)*water*.70;
    /* 云气 */
    float mist=exp(-pow((ay+.02)*3.2,2.))*(.35+.65*fbm(vec2(ax*2.4+t*.02,4.4)));
    paper=mix(paper,vec3(.96,.95,.93),mist*.55);
    /* 淡月 */
    float mo=length(vec2((ax+.58)*1.355,(ay-.60)*.435));
    paper=mix(paper,vec3(.99,.99,.97),1.-sstep(.070,.090,mo));
    paper-=vec3(.10)*(1.-sstep(.0010,.0035,abs(mo-.090)));
    /* 一叶扁舟 */
    vec2 bt=vec2(ax-.28,(ay+.62)*.435/1.355);
    float boat=sstep(.048,.0,length(bt*vec2(1.,3.2)));
    float mast=(1.-sstep(.0016,.0045,abs(bt.x)))*sstep(-.70,-.64,ay)*(1.-sstep(-.46,-.40,ay));
    paper=mix(paper,vec3(.18,.18,.18),max(boat,mast*.5)*.85);
    /* 朱砂印 */
    vec2 sd=vec2((ax-.86)*1.355,(ay+.82)*.435);
    float seal=1.-sstep(.020,.026,max(abs(sd.x),abs(sd.y)));
    float sealIn=1.-sstep(.0035,.0055,abs(max(abs(sd.x),abs(sd.y))-.013));
    paper=mix(paper,vec3(.74,.28,.24),seal*.92);
    paper=mix(paper,vec3(.58,.18,.15),sealIn*seal*.85);

    col=mix(col,mix(mount,paper,art),m);
    /* 两端木轴 */
    float rod=sstep(1.330,1.352,abs(uv.x))*(1.-sstep(1.408,1.420,abs(uv.x)));
    vec3 wood=vec3(.52,.38,.26)+vec3(.06,.04,.03)*fbm(vec2(uv.x*90.,uv.y*5.));
    wood+=vec3(.30,.24,.14)*exp(-pow((abs(uv.x)-1.340)*70.,2.))*.9;
    col=mix(col,wood,rod*.95);
    /* 卷边描线 + 落影 */
    float edgeL=(1.-sstep(.0,.0030,abs(dxo-.988)))+(1.-sstep(.0,.0030,abs(dyo-.988)));
    col-=vec3(.10,.10,.09)*edgeL*.55;
  }
  col-=vec3(.06,.06,.055)*exp(-pow((md-1.045)*16.,2.));
  col+=vec3(.01)*vnoise(uv*95.);
  return col;
}

/* ================= 6 · 未来白盒 ================= */
vec3 scBaihe(vec2 uv,float t){
  vec3 rd=normalize(vec3(uv.x,uv.y-.05,1.05));
  vec4 h=boxRoom(rd,vec3(2.9,2.05,14.));
  vec3 p=h.xyz; float id=h.w; float d=length(p);
  vec3 col=vec3(.86,.87,.90);
  if(id<.5){
    /* — 抛光水泥地面：灯带倒影 + 中央光池 — */
    vec2 q=p.xz;
    col=mix(vec3(.74,.75,.78),vec3(.86,.87,.90),marble(q*.55)*.85);
    col-=vec3(.06,.06,.06)*gline(q,vec2(1.15),.005)*.8;
    col+=vec3(1.,1.,1.)*exp(-pow(abs(abs(p.x)-2.74)*2.2,2.))*sstep(13.,1.,p.z)*.12;
    col+=vec3(1.,1.,1.)*exp(-pow(p.x*.70,2.))*sstep(12.,0.,p.z)*.07;
  } else if(id<1.5){
    /* — 天花：条形灯槽 + 天窗 — */
    vec2 q=p.xz;
    col=vec3(.94,.95,.97);
    float strip=ln(p.x*1.05,.030);
    col+=vec3(1.,1.,1.)*strip*.55;
    col-=vec3(.05,.05,.06)*gline(q,vec2(.62),.008)*.9;
    col+=vec3(1.,1.,1.)*exp(-pow(p.x*.30,2.))*.10;
  } else if(id<3.5){
    /* — 墙：白色挂板 + 竖向灯槽 + 低位展台 — */
    vec2 q=vec2(p.z,p.y);
    col=mix(vec3(.90,.91,.93),vec3(.96,.97,.98),(.5+.5*sin(p.y*2.4))*.55);
    col-=vec3(.06,.06,.07)*gline(q,vec2(1.5,1.),.004)*1.0;
    float slot=ln(p.z/2.0,.010);
    col+=vec3(1.,1.,1.)*slot*sstep(2.0,.4,p.y)*.20;
    col-=vec3(.10,.11,.13)*slot*sstep(2.0,-1.0,p.y)*.45;
    col=mix(col,vec3(.80,.82,.85),1.-sstep(-.98,-.82,p.y));
    col+=vec3(1.,1.,1.)*exp(-pow((p.y+.62)*5.5,2.))*ln(p.z/2.0,.05)*.18;
  } else {
    /* — 尽头：整面发光门洞 — */
    col=vec3(.94,.95,.97);
    col+=vec3(1.,1.,1.)*exp(-pow(p.x*.62,2.))*exp(-pow((p.y+.22)*.55,2.))*.26;
    col-=vec3(.05,.05,.06)*gline(vec2(p.x,p.y),vec2(1.1),.012)*.8;
  }
  col=fogc(col,d,vec3(.95,.96,.98),.03);
  col+=vec3(1.,1.,1.)*exp(-pow(uv.x*2.4,2.))*exp(-pow((uv.y+.52)*3.0,2.))*.10;
  col+=vec3(1.,1.,1.)*shaft(uv,-.55,.05,1.1,-.70)*.06;
  col+=vec3(1.,1.,1.)*shaft(uv,.55,.05,1.1,-.70)*.06;
  return col;
}

/* ================= 7 · 深海展厅 ================= */
vec3 scShenhai(vec2 uv,float t){
  vec3 rd=normalize(vec3(uv.x,uv.y-.10,1.1));
  vec4 h=boxRoom(rd,vec3(3.0,2.2,13.));
  vec3 p=h.xyz; float id=h.w; float d=length(p);
  vec3 col=vec3(.90,.92,.91);
  if(id<.5){
    vec2 q=p.xz;
    float ca=fbm(q*.9+vec2(t*.12,-t*.06));
    float ca2=fbm(q*1.7-vec2(t*.09,t*.11)+4.2);
    float caustic=pow(ca*ca2*1.9,2.2);
    col=mix(vec3(.82,.84,.83),vec3(.91,.93,.92),marble(q*.7));
    col+=vec3(.42,.66,.68)*caustic*.22;
    col-=vec3(.06,.05,.05)*gline(q,vec2(1.1),.02)*.8;
  } else if(id<1.5){
    vec2 q=p.xz;
    float ca=fbm(q*.7+vec2(-t*.1,t*.05));
    col=mix(vec3(.91,.93,.92),vec3(.97,.98,.98),ca);
    col+=vec3(.52,.72,.74)*pow(ca,2.4)*.14;
    col-=vec3(.05,.05,.05)*gline(q,vec2(.8),.02)*.7;
  } else if(id<3.5){
    /* 右墙 = 玻璃水族窗；左墙 = 石材 */
    if(id>2.5){
      vec2 q=vec2(p.z,p.y);
      float wv=fbm(vec2(q.x*.6+t*.09,q.y*.9+t*.05));
      col=mix(vec3(.72,.88,.90),vec3(.86,.96,.97),wv);
      /* 水体中的鱼群剪影 */
      for(int i=0;i<3;i++){
        float fi=float(i);
        vec2 fc=vec2(p.z*.55 - t*(.25+fi*.12)+fi*7., p.y*.6+ (hash11(fi*3.1)-.5)*1.4 + sin(t*.8+fi)*.12);
        vec2 fd=vec2(fract(fc.x)-.5, fc.y*.5);
        float fish=sstep(.055,.0,length(fd*vec2(1.,2.2)))*step(.55,hash11(floor(fc.x*1.4)+fi));
        col=mix(col,vec3(.36,.52,.56),fish*.80);
      }
      col-=vec3(.10,.10,.10)*ln(p.z/2.4,.012)*.9;
      col+=vec3(1.,1.,1.)*exp(-pow((p.y-.6)*.9,2.))*.10;
      col+=vec3(.95,1.,1.)*sstep(.35,.9,p.y)*sstep(2.2,1.4,p.y)*.10;
    } else {
      vec2 q=vec2(p.z,p.y);
      col=mix(vec3(.84,.83,.80),vec3(.93,.92,.89),(.5+.5*sin(p.y*2.4))*.6);
      col-=vec3(.07,.07,.07)*gline(q,vec2(1.2,1.),.014)*.75;
      col-=vec3(.05,.05,.05)*ln(p.z/2.4,.02)*.5;
    }
  } else {
    vec2 dq=vec2(p.x,max(0.,p.y-.5));
    col=mix(vec3(.84,.86,.85),vec3(.91,.93,.92),.5);
    col+=vec3(.80,.92,.94)*sstep(2.0,1.6,length(dq))*.24;
  }
  col=fogc(col,d,vec3(.90,.92,.91),.050);
  for(int i=0;i<3;i++){
    float fi=float(i);
    col+=vec3(.90,.99,1.)*shaft(uv,(fi-1.)*.55,.09,1.15,-.4)*(.09+.03*sin(t*.5+fi));
  }
  col+=riseDots(uv+vec2(0.,.4),13.,.35,vec3(1.,1.,1.),.6)*.15;
  col+=riseDots(uv*1.3+3.1+vec2(0.,.4),19.,.5,vec3(1.,1.,1.),.4)*.11;
  return col;
}

/* ================= 8 · 星空穹幕 ================= */
vec3 scXingkong(vec2 uv,float t){
  vec3 rd=normalize(vec3(uv.x,uv.y+.02,1.0));
  float R=5.2,Hh=1.35;
  vec3 oc=vec3(0.,Hh,0.);
  float b=dot(rd,oc), c=dot(oc,oc)-R*R;
  float td=b+sqrt(max(b*b-c,0.));
  vec3 p=rd*td;
  vec3 dir=normalize(p-oc);
  float lat=asin(clamp(dir.y,-1.,1.))/1.5708;
  float lon=atan(dir.z,dir.x)/6.2832;
  vec2 sp=vec2(lon*7.0, lat*3.2);
  /* 穹顶：地平浅、天顶深，让星点有对比空间 */
  vec3 col=mix(vec3(.84,.87,.92),vec3(.58,.66,.82),sstep(-.10,.75,lat));
  col+=vec3(.02,.02,.03)*fbm(sp*2.2+vec2(t*.01,0.))*sstep(.05,.60,lat);
  /* 银河带：亮底上读作一条暗尘带 + 更密的细星 */
  float mw=exp(-pow((lat-.24-.07*sin(lon*18.))/.16,2.));
  col-=vec3(.075,.085,.115)*mw*(.55+.45*fbm(sp*3.4+1.7));
  /* 星点：细密暗点打底，白色亮星点睛 */
  col-=starLayer(sp,9.,.17,1.)*vec3(.26,.30,.42)*1.6;
  col-=starLayer(sp*2.6+vec2(7.7,4.2),24.,.25,1.)*vec3(.22,.26,.38)*1.2;
  col-=starLayer(sp*4.2+vec2(11.2,8.6),36.,.27,1.)*vec3(.16,.20,.32)*.9;
  col-=starLayer(sp*1.4+vec2(2.1,.7),13.,.19,1.)*vec3(.28,.32,.44)*1.3*mw;
  col+=starLayer(sp*1.7+vec2(3.3,1.1),15.,.21,1.)*vec3(1.)*.62;
  col+=starLayer(sp*3.1+vec2(5.9,2.8),28.,.24,1.)*vec3(1.)*.34;
  /* 亮星十字光芒 */
  vec2 hg=sp*9.; vec2 hid=floor(hg); vec2 hf=fract(hg)-.5;
  float hh=hash21(hid);
  float hero=step(.93,hh)*exp(-pow(length(hf)*16.,2.));
  float cr=(exp(-pow(abs(hf.x)*20.,2.))*exp(-pow(abs(hf.y)*150.,2.))
           +exp(-pow(abs(hf.y)*20.,2.)))*exp(-pow(abs(hf.x)*150.,2.));
  col+=vec3(1.,1.,1.)*hero*.75+vec3(.98,.99,1.)*cr*step(.93,hh)*.40;
  /* 星座连线 */
  float net=gline(sp,vec2(2.6,1.7),.006)+gline(sp+vec2(.5,.3),vec2(1.7,2.4),.005);
  col-=vec3(.18,.22,.34)*net*sstep(.46,.10,lat)*.75;
  /* 经纬接缝 */
  col-=vec3(.06,.07,.10)*(ln(lon*24.,.004)+ln(lat*10.,.004))*.8;
  /* 地平提亮 */
  col+=vec3(1.,1.,1.)*sstep(.28,-.05,lat)*.08;
  col=fogc(col,td,vec3(.90,.93,.97),.03);
  /* 投影光束 + 光斑 */
  col+=vec3(1.,1.,1.)*shaft(uv,0.,.055,1.0,-.25)*.045;
  col+=vec3(1.,1.,1.)*spot(uv,vec2(0.,-.26),.045)*.14;
  /* 观众席（浅灰蓝，不再是黑色剪影） */
  float seatTop=-.46+.09*uv.x*uv.x;
  float seat=1.-sstep(seatTop-.02,seatTop+.02,uv.y);
  float rows=fract((uv.y-seatTop)*7.5);
  vec3 seatC=mix(vec3(.66,.69,.75),vec3(.78,.80,.85),sstep(.0,.5,rows));
  seatC-=vec3(.05,.05,.06)*ln((uv.y-seatTop)*7.5,.03)*1.6;
  col=mix(col,seatC,seat);
  col+=vec3(1.,1.,1.)*exp(-pow((uv.y-seatTop+.015)*30.,2.))*.14;
  return col;
}

/* ================= 9 · 青铜古殿 ================= */
vec3 scQingtong(vec2 uv,float t){
  vec3 rd=normalize(vec3(uv.x,uv.y-.14,1.15));
  vec4 h=boxRoom(rd,vec3(3.0,2.3,12.));
  vec3 p=h.xyz; float id=h.w; float d=length(p);
  vec3 bronze=vec3(.58,.46,.31), patina=vec3(.44,.60,.55);
  vec3 col=vec3(.74,.70,.62);
  if(id<.5){
    /* — 青铜地砖：暗铜 + 拼缝 + 中央反光 — */
    vec2 q=p.xz;
    float tr=hash21(floor(q*.8));
    col=vec3(.50,.45,.37)+vec3(.060,.054,.044)*tr;
    col*=.96+.08*fbm(q*6.0);
    col=mix(col,vec3(.34,.30,.24),gline(q,vec2(.8),.014)*.85);
    col+=vec3(.30,.24,.15)*gline(q,vec2(.8),.0038)*.60;
    col+=vec3(.80,.68,.44)*sstep(.62,.86,fbm(q*3.4))*.10;      /* 极淡铜绿斑 */
    col+=vec3(.90,.82,.62)*exp(-pow(p.x*.40,2.))*sstep(11.,1.,p.z)*.14;
  } else if(id<1.5){
    /* — 藻井天花：方格梁 + 井心 — */
    vec2 q=p.xz;
    col=mix(vec3(.60,.54,.44),vec3(.72,.65,.53),fbm(q*.9));
    float beam=gline(q,vec2(.55),.050);
    col=mix(col,vec3(.40,.34,.25),beam*.92);
    col+=vec3(.90,.78,.52)*gline(q,vec2(.55),.010)*.55;
    col=mix(col,vec3(.50,.43,.32),gline(q,vec2(.18),.010)*.55);
    col+=vec3(.90,.80,.58)*gline(q,vec2(.18),.0030)*.35;
  } else if(id<3.5){
    /* — 铜墙：拼板 + 铜绿只长凹处 + 浮雕带 — */
    vec2 q=vec2(p.z,p.y);
    float gr=fbm(vec2(p.z*22.,p.y*22.));
    col=mix(bronze*1.08,bronze*.80,gr);
    /* 铜绿：块状 + 竖向流痕（不再按高度整条变色） */
    float pv=sstep(.58,.80,fbm(vec2(p.z*3.4,p.y*4.0)+2.3));
    pv=clamp(pv*.80+(gr-.5)*.45,0.,1.);
    col=mix(col,patina,pv*.42);
    float drip=ln(p.z*3.6,.045)*sstep(.90,.05,p.y);
    col=mix(col,patina*.92,drip*.22);
    /* 拼板：凹缝 + 亮边（3.2 × 1.15 铜板） */
    vec2 pq=vec2(p.z/3.2,p.y/1.15);
    col-=vec3(.20,.16,.11)*gline(pq,vec2(1.),.013);
    col+=vec3(.28,.22,.13)*gline(pq,vec2(1.),.0030);
    /* 浮雕带：凹进去的一圈回纹板 */
    /* 凸起浮雕板（每 3.2 一组，板上带回纹） */
    float pz=fract(p.z/3.2);
    float axn=abs((pz-.5)*3.2);
    float pd=max(axn-.84,abs(p.y-.52)-.60);
    float inP=1.-sstep(-.015,.015,pd);
    float rimP=exp(-pow(pd*24.,2.));
    col=mix(col,bronze*1.22,inP*.60);                              /* 板面受光 */
    col-=vec3(.20,.16,.11)*rimP*.85;                               /* 板边凹槽 */
    col+=vec3(.30,.24,.14)*exp(-pow((pd+.055)*24.,2.))*.55;        /* 上缘高光 */
    col+=vec3(.20,.16,.10)*inP*gline(vec2(p.z*2.4,p.y*2.4),vec2(1.),.013);
    col-=vec3(.10,.08,.05)*inP*(1.-gline(vec2(p.z*2.4,p.y*2.4),vec2(1.),.028))*.40;
    /* 板心高光 */
    col=mix(col,col*1.14,(1.-inP)*exp(-pow((p.y-1.02)*1.7,2.))*.55);
    /* 火把 */
    float tc=abs(fract(p.z/3.2+.5)-.5);
    float fl=.75+.25*sin(t*7.+p.z*3.)+.12*sin(t*17.+p.z);
    float torch=exp(-pow(tc*14.,2.))*exp(-pow((p.y-.45)*4.5,2.));
    col+=vec3(1.,.88,.62)*torch*.60*fl;
    col+=vec3(1.,.92,.72)*exp(-pow((p.y-.45)*1.6,2.))*exp(-pow(tc*2.6,2.))*.20*fl;
  } else {
    /* — 尽头：青铜门 + 环框 — */
    vec2 dq=vec2(p.x,max(0.,p.y-.3));
    col=mix(bronze,patina,.35)*1.05;
    col+=vec3(1.,.94,.78)*sstep(2.4,1.9,length(dq))*.16;
    col-=vec3(.16,.13,.09)*gline(vec2(p.x,p.y),vec2(1.4),.030)*.80;
    col-=vec3(.12,.10,.07)*exp(-pow((abs(p.x)-1.5)*3.2,2.))*.60;
  }
  col=fogc(col,d,vec3(.82,.78,.70),.055);
  col+=vec3(1.,.90,.66)*spot(uv,vec2(-.62,.28),.18)*.10;
  col+=vec3(1.,.90,.66)*spot(uv,vec2(.62,.28),.18)*.10;
  col+=vec3(1.,.93,.72)*riseDots(uv+vec2(0.,.4),11.,.42,vec3(1.),.7)*.07;
  return col;
}

/* ================= 10 · 玻璃温室 ================= */
vec3 scWenshi(vec2 uv,float t){
  vec3 rd=normalize(vec3(uv.x,uv.y-.10,1.1));
  vec4 h=boxRoom(rd,vec3(3.2,2.2,12.));
  vec3 p=h.xyz; float id=h.w; float d=length(p);
  vec3 col=vec3(.90,.94,.89);
  if(id<.5){
    /* — 地面：夯土 + 苔痕 + 湿反光 — */
    vec2 q=p.xz;
    col=mix(vec3(.78,.76,.68),vec3(.85,.83,.75),marble(q*.8)*.55);
    col*=.98+.04*fbm(q*9.0);
    col-=vec3(.08,.08,.07)*gline(q,vec2(1.2),.020)*.95;
    col+=vec3(.52,.62,.46)*sstep(.66,.90,fbm(q*4.4))*.13;
    col+=vec3(.94,.98,.92)*exp(-abs(p.x)*1.1)*sstep(12.,3.,p.z)*.08;
    col=mix(col,vec3(.70,.65,.54),sstep(2.6,2.9,abs(p.x))*.55);
  } else if(id<1.5){
    /* — 玻璃天窗：透进来的亮绿天光 — */
    vec2 q=p.xz;
    float g=gline(q,vec2(.72),.040);
    col=mix(vec3(.90,.96,.88),vec3(.99,1.,.96),1.-g);
    col=mix(col,vec3(.60,.68,.58),g*.94);
    col+=vec3(1.,1.,1.)*(1.-g)*.16;
    col+=vec3(.96,1.,.92)*sstep(1.2,.0,abs(p.x))*.10;
  } else if(id<3.5){
    /* — 侧墙：白玻 + 爬藤 + 挂灯 — */
    vec2 q=vec2(p.z,p.y);
    col=mix(vec3(.88,.92,.87),vec3(.94,.97,.92),(.5+.5*sin(p.y*2.2))*.60);
    col-=vec3(.07,.07,.06)*gline(q,vec2(1.0,1.),.012)*.85;
    col-=vec3(.05,.05,.04)*ln(p.z*1.1,.010)*.7;
    /* 爬藤：竖直茎 + 叶簇 */
    float stem=ln(p.z*1.4+.12*fbm(vec2(p.z*3.,p.y*2.)),.018);
    float leaf=sstep(.55,.85,fbm(vec2(p.z*7.,p.y*5.)));
    col=mix(col,vec3(.36,.50,.34),stem*.55);
    col=mix(col,vec3(.46,.62,.38),leaf*stem*1.15);
    /* 挂灯 */
    float dc=abs(fract(p.z/2.6+.5)-.5);
    float lamp=exp(-pow(dc*13.,2.))*exp(-pow((p.y-.55)*5.,2.));
    col+=vec3(1.,.95,.80)*lamp*.30;
    col+=vec3(1.,.96,.84)*exp(-pow((p.y-.55)*2.4,2.))*exp(-pow(dc*4.2,2.))*.09;
  } else {
    /* — 尽头：透亮的温室玻璃 — */
    col=mix(vec3(.86,.94,.85),vec3(.95,.99,.93),.5);
    col-=vec3(.10,.10,.09)*gline(vec2(p.x,p.y),vec2(.8),.022)*.9;
    col+=vec3(1.,1.,1.)*sstep(2.4,1.6,abs(p.x))*.22;
    col+=vec3(1.,1.,1.)*exp(-pow(p.x*.7,2.))*exp(-pow((p.y-.1)*.7,2.))*.20;
  }
  col=fogc(col,d,vec3(.93,.96,.90),.055);
  for(int i=0;i<3;i++){
    float fi=float(i);
    col+=vec3(1.,1.,.96)*shaft(uv,(fi-1.)*.62,.10,1.2,-.5)*(.06+.02*sin(t*.4+fi));
  }
  col+=vec3(1.,1.,.96)*riseDots(uv+vec2(0.,.3),10.,.10,vec3(1.),.5)*.05;
  col+=vec3(.96,1.,.92)*exp(-pow((uv.y+.55)*2.4,2.))*(.06+.04*fbm(vec2(uv.x*2.-t*.05,t*.06)));
  return col;
}

/* ================= 11 · 赛博展柜 ================= */
vec3 scSaibo(vec2 uv,float t){
  vec3 rd=normalize(vec3(uv.x,uv.y-.08,1.05));
  vec4 h=boxRoom(rd,vec3(2.6,1.9,13.));
  vec3 p=h.xyz; float id=h.w; float d=length(p);
  vec3 col=vec3(.93,.94,.96);
  vec3 mag=vec3(.90,.18,.55), cya=vec3(.10,.72,.92);
  if(id<.5){
    vec2 q=p.xz;
    col=mix(vec3(.88,.89,.92),vec3(.95,.96,.98),marble(q*.7));
    float zc=ln(p.z/2.0,.03);
    col+=mix(mag,cya,.5+.5*sin(p.z*.7))*(zc*.20+exp(-abs(p.x)*.8)*.04);
    col-=vec3(.05,.05,.06)*gline(q,vec2(.8),.01)*.9;
  } else if(id<1.5){
    vec2 q=p.xz;
    col=vec3(.94,.95,.97);
    col-=vec3(.06,.06,.07)*ln(p.x*.6,.02)*.9;
    col-=vec3(.04,.04,.05)*gline(q,vec2(.6),.01)*.8;
  } else if(id<3.5){
    vec2 q=vec2(p.z,p.y);
    col=mix(vec3(.91,.92,.94),vec3(.96,.97,.98),(.5+.5*sin(p.y*2.6))*.5);
    /* 展柜：每 2.0 一组，柜体带完整发光边框 */
    float fz=fract(p.z/2.0);
    float dx=abs(fz-.5);
    vec3 cyc=mix(mag,cya,.5+.5*sin(p.z*1.1+t*.4));
    float vEdge=exp(-pow((dx-.30)*34.,2.))*sstep(1.35,-1.05,p.y);
    float hEdge=(exp(-pow((p.y-1.10)*30.,2.))+exp(-pow((p.y+.92)*30.,2.)))*sstep(.34,.30,dx);
    col+=cyc*(vEdge*.80+hEdge*.70);
    float inner=sstep(.30,.27,dx)*sstep(1.10,-.92,p.y);
    float scan=.5+.5*sin(p.y*34.-t*3.0);
    col=mix(col,vec3(.80,.85,.92),inner*.85);
    col+=cyc*(inner*(.14+.12*scan));
    float core=exp(-pow((fz-.5)*22.,2.))*exp(-pow((p.y-.32)*4.6,2.));
    col+=vec3(1.,1.,1.)*core*.45;
    float ped=exp(-pow((p.y+.90)*14.,2.))*sstep(.28,.22,dx);
    col+=cyc*ped*.35;
    col+=cyc*exp(-pow((p.y+.92)*3.0,2.))*sstep(.34,.26,dx)*.22;
  } else {
    col=vec3(.95,.96,.98);
    col+=mix(mag,cya,.5)*exp(-pow(p.x*.8,2.))*exp(-pow(p.y*.6,2.))*.16;
    col-=vec3(.05,.05,.06)*gline(vec2(p.x,p.y),vec2(1.0),.02)*.9;
  }
  col=fogc(col,d,vec3(.94,.95,.97),.05);
  col+=mix(mag,cya,.5)*shaft(uv,0.,.07,1.2,-.7)*.07;
  col+=vec3(1.,1.,1.)*riseDots(uv+vec2(0.,.3),14.,.18,vec3(1.),.4)*.07;
  return col;
}

/* ================= 12 · 夜巡长廊 ================= */
vec3 scYexun(vec2 uv,float t){
  vec3 rd=normalize(vec3(uv.x,uv.y-.13,1.2));
  vec4 h=boxRoom(rd,vec3(1.9,1.6,16.));
  vec3 p=h.xyz; float id=h.w; float d=length(p);
  vec3 col=vec3(.84,.83,.80);
  if(id<.5){
    /* — 木地板：细条纹 + 画下光池 — */
    vec2 q=p.xz;
    col=mix(vec3(.68,.63,.55),vec3(.80,.75,.66),fbm(q*vec2(1.2,6.0)));
    col-=vec3(.07,.06,.05)*gline(q,vec2(2.2,1.0),.010)*.9;
    col+=vec3(.10,.09,.07)*ln(p.x*3.0,.02)*.35;
    float pz2=fract(p.z/2.6);
    float pool=exp(-pow((pz2-.5)*2.6/.34,2.))*exp(-pow((abs(p.x)-1.1)*1.1,2.));
    col+=vec3(1.,.96,.86)*pool*.20;
    col+=vec3(.96,.95,.90)*exp(-abs(p.x)*1.6)*sstep(16.,3.,p.z)*.10;
  } else if(id<1.5){
    /* — 天花：浅灰拱顶 + 一排筒灯 — */
    vec2 q=p.xz;
    col=mix(vec3(.82,.81,.78),vec3(.90,.89,.86),fbm(q*.8));
    col-=vec3(.05,.05,.05)*gline(q,vec2(.8),.015)*.7;
    float lz=fract(p.z/2.6);
    float lamp=exp(-pow((lz-.5)*2.6/.16,2.))*exp(-pow(p.x*.9,2.));
    col+=vec3(1.,.97,.90)*lamp*.34;
  } else if(id<3.5){
    /* — 侧墙：成排镀金画框，每 2.6 一幅，两侧都有 — */
    vec2 q=vec2(p.z,p.y);
    col=mix(vec3(.80,.79,.76),vec3(.89,.88,.85),(.5+.5*sin(p.y*2.6))*.5);
    col-=vec3(.05,.05,.05)*gline(q,vec2(1.2,1.),.012)*.8;
    float pz=fract(p.z/2.6);
    float axn=abs((pz-.5)*2.6);
    float pd=max(axn-.84,abs(p.y-.16)-.60);
    float inP=1.-sstep(-.018,.018,pd);
    /* 画心：按索引取不同构图 */
    float idx=floor(p.z/2.6)+step(2.5,id)*7.;
    float hs=hash11(idx*3.7+1.1);
    vec3 pc=mix(vec3(.40,.36,.29),vec3(.70,.62,.47),fbm(p.zy*3.0+idx));
    pc+=vec3(.16,.13,.09)*exp(-pow((p.y-hs*.9-.10)*2.4,2.));
    pc-=vec3(.13,.11,.08)*sstep(hs,hs+.55,fbm(p.zy*6.0+idx*2.3));
    pc+=vec3(.09,.08,.05)*exp(-pow((p.y-.52)*3.4,2.))*.8;
    col=mix(col,pc,inP*.95);
    /* 镀金画框 */
    float gilt=exp(-pow(pd*20.,2.));
    col=mix(col,vec3(.76,.60,.27),gilt*.85);
    col-=vec3(.10,.09,.07)*exp(-pow((pd+.06)*20.,2.))*.8;
    /* 画上顶光 */
    col+=vec3(1.,.97,.88)*exp(-pow((p.y-.95)*3.0,2.))*exp(-pow(axn*1.1,2.))*.24;
  } else {
    /* — 尽头：拱形门 + 暖光 — */
    col=vec3(.82,.81,.78);
    col+=vec3(1.,.97,.90)*exp(-pow(p.x*.75,2.))*exp(-pow((p.y-.05)*.75,2.))*.30;
    col-=vec3(.10,.09,.08)*exp(-pow((abs(p.x)-1.05)*3.4,2.))*.55;
    col-=vec3(.06,.06,.06)*gline(vec2(p.x,p.y),vec2(1.1),.018)*.7;
  }
  col=fogc(col,d,vec3(.88,.87,.84),.045);
  col+=vec3(1.,.98,.90)*shaft(uv,.04,.055,1.1,-.4)*.06;
  col+=vec3(1.,.99,.94)*spot(uv,vec2(.04,-.42),.22)*.06;
  col+=vec3(1.,.98,.92)*riseDots(uv+vec2(0.,.5),9.,.05,vec3(1.),.5)*.06;
  return col;
}

vec3 scene(vec2 uv,float t){
  int s=int(u_scene+.5);
  if(s==1)  return scJinbi(uv,t);
  if(s==2)  return scGudian(uv,t);
  if(s==3)  return scFugu(uv,t);
  if(s==4)  return scMenghuan(uv,t);
  if(s==5)  return scShuimo(uv,t);
  if(s==6)  return scBaihe(uv,t);
  if(s==7)  return scShenhai(uv,t);
  if(s==8)  return scXingkong(uv,t);
  if(s==9)  return scQingtong(uv,t);
  if(s==10) return scWenshi(uv,t);
  if(s==11) return scSaibo(uv,t);
  if(s==12) return scYexun(uv,t);
  return vec3(.04,.045,.06);
}

void main(){
  vec2 uv=(gl_FragCoord.xy*2.-u_res)/min(u_res.x,u_res.y);
  uv+=u_mouse*.03;                       /* 视差 */
  vec3 col=scene(uv,u_time);
  /* —— 亮色厅堂统一调色：压中间调拉对比 + 略提饱和，避免糊成一片白 —— */
  col=clamp(col,0.,1.);
  col=1.-pow(1.-col,vec3(.58));
  float lum=dot(col,vec3(.299,.587,.114));
  col=mix(vec3(lum),col,1.22);
  col*=1.-dot(uv*.40,uv*.40)*.10;
  gl_FragColor=vec4(clamp(col,0.,1.),1.);
}`;

  /* 场景名 → u_scene（顺序即编号） */
  const SCENE = {
    jinbi: 1, gudian: 2, fugu: 3, menghuan: 4, shuimo: 5, baihe: 6,
    shenhai: 7, xingkong: 8, qingtong: 9, wenshi: 10, saibo: 11, yexun: 12,
  };
  const NAMES = Object.keys(SCENE);

  let gl = null, prog = null, canvas = null, raf = 0;
  let t0 = performance.now(), sceneId = 0, paused = 0;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const U = {};

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn("[TLBG]", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  function init() {
    try {
      canvas = document.createElement("canvas");
      canvas.id = "bgGL";
      const z = (typeof window.TLBG_Z === "number") ? window.TLBG_Z : 0;
      canvas.setAttribute("style",
        `position:fixed;inset:0;width:100%;height:100%;z-index:${z};pointer-events:none;opacity:0;transition:opacity .9s ease`);
      gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false })
        || canvas.getContext("experimental-webgl");
      if (!gl) return false;
      const vs = compile(gl.VERTEX_SHADER, VERT);
      const fs = compile(gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) return false;
      prog = gl.createProgram();
      gl.attachShader(prog, vs); gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn("[TLBG]", gl.getProgramInfoLog(prog)); return false; }
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      ["u_res", "u_time", "u_scene", "u_mouse"].forEach(n => U[n] = gl.getUniformLocation(prog, n));
      document.body.insertBefore(canvas, document.body.firstChild);
      resize();
      addEventListener("resize", resize);
      addEventListener("mousemove", e => {
        mouse.tx = (e.clientX / innerWidth) * 2 - 1;
        mouse.ty = 1 - (e.clientY / innerHeight) * 2;
      }, { passive: true });
      document.addEventListener("visibilitychange", () => { if (!document.hidden && !paused) loop(); });
      /* 舱室打开时自动休眠（监视 #room 的 class） */
      const room = document.getElementById("room");
      if (room) new MutationObserver(() => {
        TLBG.pause(room.classList.contains("on"));
      }).observe(room, { attributes: true, attributeFilter: ["class"] });
      return true;
    } catch (e) { console.warn("[TLBG] init fail", e); return false; }
  }

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function frame() {
    mouse.x += (mouse.tx - mouse.x) * .04;
    mouse.y += (mouse.ty - mouse.y) * .04;
    gl.uniform2f(U.u_res, canvas.width, canvas.height);
    gl.uniform1f(U.u_time, (performance.now() - t0) / 1000);
    gl.uniform1f(U.u_scene, sceneId);
    gl.uniform2f(U.u_mouse, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function loop() {
    cancelAnimationFrame(raf);
    if (paused || document.hidden || state !== "ok") return;
    frame();
    raf = requestAnimationFrame(loop);
  }

  /* ---- 异步启动：GL 上下文 + 巨型 shader 编译可能阻塞主线程数秒
          （软件光栅化尤其严重），绝不能在解析期同步执行。 ---- */
  let state = "booting";
  let pendingScene = null;
  const readyCbs = [];

  function boot() {
    let ok = false;
    try { ok = init(); } catch { ok = false; }
    state = ok ? "ok" : "fail";
    TLBG.supported = ok;
    TLBG.booting = false;
    if (ok && pendingScene !== null) {
      const id = pendingScene; pendingScene = null;
      try { const st = document.getElementById("bgStage"); if (st) st.innerHTML = ""; } catch {}
      TLBG.apply(id);
    }
    readyCbs.splice(0).forEach(fn => { try { fn(); } catch {} });
  }

  /* 离屏渲染一帧到指定尺寸，返回 dataURL（缩略图 / 调试都用它） */
  function renderTo(id, w, h, time) {
    const ow = canvas.width, oh = canvas.height, oc = sceneId, oop = canvas.style.opacity;
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(U.u_res, w, h);
    gl.uniform1f(U.u_time, time);
    gl.uniform1f(U.u_scene, SCENE[id] || 0);
    gl.uniform2f(U.u_mouse, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const url = canvas.toDataURL("image/png");
    canvas.width = ow; canvas.height = oh;
    gl.viewport(0, 0, ow, oh);
    sceneId = oc;
    canvas.style.opacity = oop;
    return url;
  }

  const TLBG = {
    supported: false,
    booting: true,
    onReady(fn) { if (state !== "booting") fn(); else readyCbs.push(fn); },
    apply(id) {
      if (state === "booting") { pendingScene = id; return true; }
      if (state !== "ok") return false;
      sceneId = SCENE[id] || 0;
      canvas.style.opacity = sceneId ? "1" : "0";
      if (sceneId && !paused) loop();
      return true;
    },
    /* 用同一份 shader 逐场景渲小图，返回 {id: dataURL} */
    thumbs(w, h) {
      if (state !== "ok") return {};
      const out = {};
      NAMES.forEach((n, i) => { out[n] = renderTo(n, w || 168, h || 104, 12.3 + i * 1.7); });
      if (sceneId && !paused) loop();
      return out;
    },
    /* 单张高分辨率快照（调试 / 大图预览） */
    snap(id, w, h) { return state === "ok" ? renderTo(id, w || 480, h || 300, 14.0) : ""; },
    pause(b) { paused = b ? 1 : 0; if (!b && state === "ok" && !document.hidden) loop(); },
  };
  window.TLBG = TLBG;
  setTimeout(boot, 60);
})();
</script>
