import type { Candle } from '../types';
import { analyzeSMC } from './smcAnalysis';
import { analyzeConfluence } from './confluenceEngine';
export type SetupSide='LONG'|'SHORT'|'WAIT';
export interface ScalpSetup{side:SetupSide;score:number;confluence:number;entry:number;stop:number;tp1:number;tp2:number;tp3:number;riskReward:number;timeframe:string;confirmations:string[];invalidations:string[];}
const atr=(c:Candle[],n=14)=>{const x=c.slice(-(n+1));if(x.length<2)return 0;let s=0;for(let i=1;i<x.length;i++)s+=Math.max(x[i].high-x[i].low,Math.abs(x[i].high-x[i-1].close),Math.abs(x[i].low-x[i-1].close));return s/(x.length-1)};
export function detectScalpSetup(c15:Candle[],c1h:Candle[],c4h:Candle[]):ScalpSetup{
 const a=analyzeSMC(c15),b=analyzeSMC(c1h),d=analyzeSMC(c4h),cf=analyzeConfluence(c15),last=c15.at(-1);
 if(!last)return{side:'WAIT',score:0,confluence:50,entry:0,stop:0,tp1:0,tp2:0,tp3:0,riskReward:0,timeframe:'15m',confirmations:[],invalidations:['Sem candles']};
 let long=0,short=0;const confirmations:string[]=[];
 const arr=[a,b,d];long+=arr.filter(x=>x.bias==='BULLISH').length*14;short+=arr.filter(x=>x.bias==='BEARISH').length*14;
 if(cf.bias==='BULLISH'){long+=Math.round(cf.score*.35);confirmations.push(`Confluência institucional ${cf.score}`)}
 if(cf.bias==='BEARISH'){short+=Math.round((100-cf.score)*.35);confirmations.push(`Confluência institucional ${cf.score}`)}
 if(a.sweep==='SSL'){long+=12;confirmations.push('SSL sweep 15m')}if(a.sweep==='BSL'){short+=12;confirmations.push('BSL sweep 15m')}
 if(a.fvg&&!a.fvg.filled){if(a.fvg.type==='BULLISH'){long+=8;confirmations.push('FVG bullish ativo')}else{short+=8;confirmations.push('FVG bearish ativo')}}
 if(a.premiumDiscount==='DISCOUNT')long+=7;if(a.premiumDiscount==='PREMIUM')short+=7;
 const side:SetupSide=long>=65&&long>short+10?'LONG':short>=65&&short>long+10?'SHORT':'WAIT',score=Math.min(100,Math.round(Math.max(long,short))),risk=Math.max(atr(c15)*1.25,last.close*.0025),entry=last.close;
 if(side==='LONG'){const stop=entry-risk;return{side,score,confluence:cf.score,entry,stop,tp1:entry+risk*1.5,tp2:entry+risk*2.5,tp3:entry+risk*4,riskReward:4,timeframe:'15m',confirmations,invalidations:['Perda do swing low / invalidação SMC']}}
 if(side==='SHORT'){const stop=entry+risk;return{side,score,confluence:cf.score,entry,stop,tp1:entry-risk*1.5,tp2:entry-risk*2.5,tp3:entry-risk*4,riskReward:4,timeframe:'15m',confirmations,invalidations:['Rompimento do swing high / invalidação SMC']}}
 return{side,score,confluence:cf.score,entry,stop:entry-risk,tp1:entry+risk*1.5,tp2:entry+risk*2.5,tp3:entry+risk*4,riskReward:0,timeframe:'15m',confirmations,invalidations:['Confluência insuficiente entre timeframes']};
}
