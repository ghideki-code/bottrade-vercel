import type { Candle } from '../types';
import { detectScalpSetup } from './setupEngine';
export type BacktestTrade={index:number;side:'LONG'|'SHORT';entry:number;stop:number;tp1:number;tp2:number;tp3:number;exit:number;pnlR:number;bars:number;result:'WIN'|'LOSS'|'TIMEOUT';score:number};
export type BacktestResult={trades:BacktestTrade[];totalTrades:number;wins:number;losses:number;winRate:number;profitFactor:number;netR:number;maxDrawdownR:number;averageR:number};
export function backtestSetup(c15:Candle[],c1h:Candle[],c4h:Candle[],minScore=65,maxBars=32):BacktestResult{
 const trades:BacktestTrade[]=[];let equity=0,peak=0,maxDD=0,nextAvailable=60;
 for(let i=60;i<c15.length-maxBars-1;i++){if(i<nextAvailable)continue;const t=c15[i].timestamp;const h1=c1h.filter(x=>x.timestamp<=t).slice(-200),h4=c4h.filter(x=>x.timestamp<=t).slice(-200);if(h1.length<50||h4.length<50)continue;const setup=detectScalpSetup(c15.slice(0,i),h1,h4);if(setup.side==='WAIT'||setup.score<minScore)continue;
  const entry=c15[i].close,stop=setup.stop,tp1=setup.tp1,tp2=setup.tp2,tp3=setup.tp3,risk=Math.abs(entry-stop)||entry*.001;let exit=entry,result:BacktestTrade['result']='TIMEOUT',bars=0,stage=0;
  for(let j=1;j<=maxBars&&i+j<c15.length;j++){bars=j;const x=c15[i+j];if(setup.side==='LONG'){if(stage<1&&x.low<=stop){exit=stop;result='LOSS';break}if(stage<1&&x.high>=tp1)stage=1;if(stage===1&&x.low<=entry){exit=entry;break}if(stage<2&&x.high>=tp2)stage=2;if(stage===2&&x.low<=tp1){exit=tp1;break}if(stage<3&&x.high>=tp3){exit=tp3;result='WIN';break}}else{if(stage<1&&x.high>=stop){exit=stop;result='LOSS';break}if(stage<1&&x.low<=tp1)stage=1;if(stage===1&&x.high>=entry){exit=entry;break}if(stage<2&&x.low<=tp2)stage=2;if(stage===2&&x.high>=tp1){exit=tp1;break}if(stage<3&&x.low<=tp3){exit=tp3;result='WIN';break}}exit=x.close}
  const pnlR=setup.side==='LONG'?(exit-entry)/risk:(entry-exit)/risk;equity+=pnlR;peak=Math.max(peak,equity);maxDD=Math.max(maxDD,peak-equity);if(result==='TIMEOUT'&&bars>=maxBars)result='TIMEOUT';trades.push({index:i,side:setup.side,entry,stop,tp1,tp2,tp3,exit,pnlR,bars,result,score:setup.score});nextAvailable=i+Math.max(1,bars);
 }
 const wins=trades.filter(t=>t.result==='WIN').length,losses=trades.filter(t=>t.result==='LOSS').length,grossWin=trades.filter(t=>t.pnlR>0).reduce((a,t)=>a+t.pnlR,0),grossLoss=Math.abs(trades.filter(t=>t.pnlR<0).reduce((a,t)=>a+t.pnlR,0));
 return{trades,totalTrades:trades.length,wins,losses,winRate:trades.length?wins/trades.length*100:0,profitFactor:grossLoss?grossWin/grossLoss:0,netR:equity,maxDrawdownR:maxDD,averageR:trades.length?equity/trades.length:0};
}
export const backtestConfluence=backtestSetup;
