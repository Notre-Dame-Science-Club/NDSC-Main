"use client";

import { useEffect, useRef } from "react";

export function QuantumOrbitalCanvas({ size = 460 }: { size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const sz = size;
    canvas.width  = sz * dpr;
    canvas.height = sz * dpr;
    canvas.style.width  = sz + "px";
    canvas.style.height = sz + "px";
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    const cx = sz / 2, cy = sz / 2;
    let t = 0, animId: number;

    /* ── 3-D math ───────────────────────────────── */
    const rotX = (x:number,y:number,z:number,a:number):[number,number,number]=>[x,y*Math.cos(a)-z*Math.sin(a),y*Math.sin(a)+z*Math.cos(a)];
    const rotY = (x:number,y:number,z:number,a:number):[number,number,number]=>[x*Math.cos(a)+z*Math.sin(a),y,-x*Math.sin(a)+z*Math.cos(a)];
    const rotZ = (x:number,y:number,z:number,a:number):[number,number,number]=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a),z];
    const proj  = (x:number,y:number,z:number):[number,number,number]=>{ const s=700/(700+z); return [cx+x*s,cy+y*s,s]; };

    /* ── Orbital point cloud sampler ────────────── */
    type Pt={x:number;y:number;z:number;col:string};
    const sample=(type:"s"|"px"|"py"|"pz"|"dz2"|"dxy"|"dx2y2",col:string,R:number,N=500):Pt[]=>{
      const pts:Pt[]=[];
      for(let i=0;i<N;i++){
        const phi=Math.acos(1-2*(i+0.5)/N);
        const theta=Math.PI*(1+Math.sqrt(5))*i;
        const sP=Math.sin(phi),cP=Math.cos(phi),sT=Math.sin(theta),cT=Math.cos(theta);
        let r=0;
        if(type==="s")     r=R*0.55;
        else if(type==="px") r=R*Math.abs(sP*cT)*1.1;
        else if(type==="py") r=R*Math.abs(sP*sT)*1.1;
        else if(type==="pz") r=R*Math.abs(cP)*1.1;
        else if(type==="dz2") r=R*Math.abs(3*cP*cP-1)*0.6;
        else if(type==="dxy") r=R*Math.abs(sP*sP*Math.sin(2*theta))*1.0;
        else if(type==="dx2y2") r=R*Math.abs(sP*sP*Math.cos(2*theta))*1.0;
        if(r<1) continue;
        pts.push({x:r*sP*cT,y:r*sP*sT,z:r*cP,col});
      }
      return pts;
    };

    const R = sz*0.37;
    const orbs:[Pt[],(t:number)=>[number,number,number],number][]=[
      [sample("s",    "0,212,255",  R*0.30,300), t=>[ t*0.07,   t*0.05,  0],          1.3],
      [sample("px",   "60,150,255", R*0.78,460), t=>[ t*0.09+.3, t*0.13,  Math.PI/6], 1.6],
      [sample("py",   "130,90,255", R*0.78,460), t=>[ t*0.11+.8,-t*0.08,  Math.PI/3], 1.6],
      [sample("pz",   "0,210,170",  R*0.78,460), t=>[ t*0.06,    t*0.15, -Math.PI/5], 1.6],
      [sample("dz2",  "190,130,255",R*0.95,500), t=>[ t*0.08-.5,  t*0.10,  Math.PI/4], 1.5],
      [sample("dxy",  "0,225,255",  R*0.88,480), t=>[ t*0.05+.8,  t*0.12,  t*0.03],   1.4],
      [sample("dx2y2","255,155,70", R*0.88,460), t=>[-t*0.07+1.2, t*0.09, -t*0.04],   1.4],
    ];

    const draw=()=>{
      ctx.clearRect(0,0,sz,sz);
      type PP={px:number;py:number;z:number;sz:number;col:string;a:number};
      const all:PP[]=[];
      for(const [pts,rotFn,dotSz] of orbs){
        const [rx,ry,rz]=rotFn(t);
        for(const p of pts){
          let [x,y,z]=rotZ(p.x,p.y,p.z,rz);
          [x,y,z]=rotX(x,y,z,rx);
          [x,y,z]=rotY(x,y,z,ry);
          const [ppx,ppy,ps]=proj(x,y,z);
          const da=Math.max(0,Math.min(1,(ps-0.45)*1.8));
          all.push({px:ppx,py:ppy,z,sz:dotSz*ps,col:p.col,a:0.7*da});
        }
      }
      all.sort((a,b)=>a.z-b.z);
      for(const p of all){
        if(p.a<0.025) continue;
        ctx.beginPath();
        ctx.arc(p.px,p.py,Math.max(0.3,p.sz),0,Math.PI*2);
        ctx.fillStyle=`rgba(${p.col},${p.a.toFixed(2)})`;
        ctx.fill();
      }
      t+=0.013;
      animId=requestAnimationFrame(draw);
    };
    draw();
    return ()=>cancelAnimationFrame(animId);
  }, [size]);

  return (
    <canvas
      ref={ref}
      className="absolute pointer-events-none"
      style={{ top:"50%", left:"50%", transform:"translate(-50%,-50%)", opacity:0.88, zIndex:0 }}
    />
  );
}

