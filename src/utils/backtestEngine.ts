import type { Candle } from '../types';
import { analyzeConfluence } from './confluenceEngine';
export type BacktestTrade={index:number;side:'LONG'|'SHORT';entry:number;stop:number;target:number;exit:number;pnlR:number;bars:number;result:'WIN'|'LOSS'|'TIMEOUT';score:number};
export type BacktestResult={trades:BacktestTrade[];totalTrades:number;wins:number;losses:number;winRate:number;profitFactor:number;netR:number;maxDrawdownR:number;averageR:number};
const atr=(c:Candle[],n=14)=>{const x=c.slice(-(n+1));if(x.length<2)return 0;let s=0;for(let i=1;i<x.length;i++)s+=Math.max(x[i].high-x[i].low,Math.abs(x[i].high-x[i-1].close),Math.abs(x[i].low-x[i-1].close));return s/(x.length-1)};
export function backtestConfluence(candles:Candle[],minScore=65,maxBars=24):BacktestResult{
 const trades:BacktestTrade[]=[];let equity=0,peak=0,maxDD=0;
 for(let i=60;i<candles.length-maxBars-1;i++){
  const history=candles.slice(0,i),cf=analyzeConfluence(history);if(cf.score<minScore||cf.bias==='NEUTRAL')continue;
  const entry=candles[i].close,a=Math.max(atr(history),entry*.001),risk=a*1.25,side=cf.bias==='BULLISH'?'LONG':'SHORT';
  const stop=side==='LONG'?entry-risk:entry+risk,target=side==='LONG'?entry+risk*2:entry-risk*2;
  let exit=entry,result:BacktestTrade['result']='TIMEOUT',bars=0;
  for(let j=1;j<=maxBars&&i+j<candles.length;j++){bars=j;const x=candles[i+j];if(side==='LONG'&&x.low<=stop){exit=stop;result='LOSS';break}if(side==='SHORT'&&x.high>=stop){exit=stop;result='LOSS';break}if(side==='LONG'&&x.high>=target){exit=target;result='WIN';break}if(side==='SHORT'&&x.low<=target){exit=target;result='WIN';break}exit=x.close}
  const pnlR=side==='LONG'?(exit-entry)/risk:(entry-exit)/risk;equity+=pnlR;peak=Math.max(peak,equity);maxDD=Math.max(maxDD,peak-equity);trades.push({index:i,side,entry,stop,target,exit,pnlR,bars,result,score:cf.score});
 }
 const wins=trades.filter(t=>t.result==='WIN').length,losses=trades.filter(t=>t.result==='LOSS').length,grossWin=trades.filter(t=>t.pnlR>0).reduce((a,t)=>a+t.pnlR,0),grossLoss=Math.abs(trades.filter(t=>t.pnlR<0).reduce((a,t)=>a+t.pnlR,0));
 return{trades,totalTrades:trades.length,wins,losses,winRate:trades.length?wins/trades.length*100:0,profitFactor:grossLoss?grossWin/grossLoss:0,netR:equity,maxDrawdownR:maxDD,averageR:trades.length?equity/trades.length:0};
}
