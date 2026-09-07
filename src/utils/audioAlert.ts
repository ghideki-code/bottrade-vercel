export type AppAudioSettings={masterEnabled:boolean;masterVolume:number;infoVolume:number;systemStatus:{infoTone:string}};
const KEY='bottrade-audio-settings';
export const getAudioSettings=():AppAudioSettings=>{try{return JSON.parse(localStorage.getItem(KEY)||'')}catch{return {masterEnabled:true,masterVolume:.7,infoVolume:.5,systemStatus:{infoTone:'880'}}}};
export const saveAudioSettings=(s:AppAudioSettings)=>{try{localStorage.setItem(KEY,JSON.stringify(s))}catch{}};
const tone=(f:number,d=120,v=.08)=>{try{const C=window.AudioContext||((window as any).webkitAudioContext);const c=new C();const o=c.createOscillator();const g=c.createGain();o.frequency.value=f;g.gain.value=v;o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+d/1000)}catch{}};
export const playTone=(f:string|number,v=.2)=>tone(Number(f)||880,140,v);
export const playSignalAudio=()=>tone(1100,180,.08);
export const playNotificationAudio=()=>tone(660,140,.06);
export const testAudioAlert=(t:string)=>tone(t==='EXPLOSION_SIREN'?1200:880,220,.1);
