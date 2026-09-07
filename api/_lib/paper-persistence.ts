export type PersistentPaperStore={equity:number;startingEquity:number;peakEquity:number;maxDrawdown:number;positions:any[];trades:any[];updatedAt:number};
const key=process.env.UPSTASH_REDIS_REST_KEY||'bottrade:paper:state';
const url=process.env.UPSTASH_REDIS_REST_URL;
const token=process.env.UPSTASH_REDIS_REST_TOKEN;
export function persistenceEnabled(){return Boolean(url&&token)}
export async function loadPaperStore():Promise<PersistentPaperStore|null>{if(!url||!token)return null;try{const r=await fetch(`${url}/get/${encodeURIComponent(key)}`,{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)return null;const j=await r.json() as any;return j?.result?JSON.parse(j.result):null}catch{return null}}
export async function savePaperStore(store:PersistentPaperStore){if(!url||!token)return false;try{const r=await fetch(`${url}/set/${encodeURIComponent(key)}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(JSON.stringify(store))});return r.ok}catch{return false}}
