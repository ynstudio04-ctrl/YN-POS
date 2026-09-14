export type DeviceRole='pos'|'scanner';
export type RegisterMessage={type:'barcode';barcode:string;sourceId:string;sentAt:number};
export type RegisterStatus='CONNECTING'|'SUBSCRIBED'|'CLOSED'|'CHANNEL_ERROR'|'TIMED_OUT'|'NO_SUPABASE'|'AUTH_ERROR';

export type RealtimeDiagnostics={topic?:string;userId?:string;authenticated:boolean;setAuth:boolean;authError?:string};

// Multi-device pairing intentionally uses WebRTC/PeerJS instead of Supabase Realtime.
// Supabase remains responsible for POS data; barcode traffic goes peer-to-peer.
const ROLE_KEY='yn-device-role';
const REGISTER_KEY='yn-register-code';
const PEER_KEY='yn-peer-id';
const DEVICE_KEY='yn-device-id';

type PeerLike={id:string;on:(event:string,cb:(...args:any[])=>void)=>void;connect:(id:string,opts?:any)=>any;destroy:()=>void};
type DataConn={open:boolean;send:(data:any)=>void;close:()=>void;on:(event:string,cb:(...args:any[])=>void)=>void};
let peer:PeerLike|null=null;
let peerLoad:Promise<any>|null=null;
let activeConnection:DataConn|null=null;
let activeCode='';
const messageHandlers=new Set<(m:RegisterMessage)=>void>();
const statusHandlers=new Set<(s:RegisterStatus,d?:string)=>void>();

const notify=()=>window.dispatchEvent(new Event('yn-device-config-changed'));
const deviceId=()=>{let v=localStorage.getItem(DEVICE_KEY);if(!v){v=crypto.randomUUID();localStorage.setItem(DEVICE_KEY,v)}return v};
export const getSavedDeviceRole=():DeviceRole|null=>{const v=localStorage.getItem(ROLE_KEY);return v==='pos'||v==='scanner'?v:null};
export const setDeviceRole=(v:DeviceRole)=>{localStorage.setItem(ROLE_KEY,v);notify()};
export const getRegisterCode=()=>localStorage.getItem(REGISTER_KEY)||'';
export const setRegisterCode=(v:string)=>{localStorage.setItem(REGISTER_KEY,v);notify()};
export const makePairCode=()=>`YN-${Math.floor(1000+Math.random()*9000)}`;

export function makePeerId(code:string){return `ynpos-${code.replace(/[^a-z0-9]/gi,'').toLowerCase()}-${deviceId().slice(0,8)}`}
export function getPeerId(){return localStorage.getItem(PEER_KEY)||''}

async function loadPeer(){
  if((window as any).Peer)return (window as any).Peer;
  if(peerLoad)return peerLoad;
  peerLoad=new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-yn-peerjs]');
    if(existing){existing.addEventListener('load',()=>resolve((window as any).Peer));existing.addEventListener('error',()=>reject(new Error('Could not load WebRTC connection service.')));return;}
    const s=document.createElement('script');s.src='https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';s.async=true;s.dataset.ynPeerjs='true';
    s.onload=()=>{const P=(window as any).Peer;if(P)resolve(P);else reject(new Error('WebRTC library loaded but Peer is unavailable.'))};
    s.onerror=()=>reject(new Error('Could not load WebRTC connection service.'));
    document.head.appendChild(s);
  });
  return peerLoad;
}

function closeConnection(){try{activeConnection?.close()}catch{}activeConnection=null}
function setStatus(s:RegisterStatus,d?:string){for(const h of statusHandlers)h(s,d)}

export async function startPOSPairing(code:string,onMessage:(m:RegisterMessage)=>void,onStatus?:(s:RegisterStatus,d?:string)=>void){
  const normalized=code.trim().toUpperCase();
  if(peer && activeCode===normalized){ messageHandlers.add(onMessage); if(onStatus)statusHandlers.add(onStatus); if(peer.id) setStatus('SUBSCRIBED'); return peer.id; }
  await disconnectRegister();
  const P=await loadPeer();
  activeCode=normalized;messageHandlers.add(onMessage); if(onStatus)statusHandlers.add(onStatus);
  setRegisterCode(normalized);setDeviceRole('pos');
  const id=makePeerId(normalized);localStorage.setItem(PEER_KEY,id);
  setStatus('CONNECTING');
  peer=new P(id);
  peer.on('open',()=>setStatus('SUBSCRIBED'));
  peer.on('error',(e:any)=>{setStatus('CHANNEL_ERROR',e?.type||e?.message||String(e));});
  peer.on('disconnected',()=>setStatus('CLOSED','Peer disconnected'));
  peer.on('close',()=>setStatus('CLOSED'));
  peer.on('connection',(conn:DataConn)=>{
    closeConnection();activeConnection=conn;
    conn.on('open',()=>setStatus('SUBSCRIBED'));
    conn.on('data',(data:any)=>{const m=data as RegisterMessage;if(m?.type==='barcode'&&m.sourceId!==deviceId())messageHandlers.forEach(h=>h(m))});
    conn.on('close',()=>{if(activeConnection===conn){activeConnection=null;setStatus('CLOSED')}});
    conn.on('error',(e:any)=>setStatus('CHANNEL_ERROR',e?.message||String(e)));
  });
  return id;
}

export async function connectScanner(codeOrPeer:string,onStatus?:(s:RegisterStatus,d?:string)=>void){
  await disconnectRegister();
  const P=await loadPeer();
  const value=codeOrPeer.trim();
  activeCode=value; if(onStatus)statusHandlers.add(onStatus); setStatus('CONNECTING');
  const scannerPeerId=makePeerId(`scanner-${Math.random().toString(36).slice(2,8)}`);
  localStorage.setItem(PEER_KEY,scannerPeerId);setDeviceRole('scanner');
  const normalized=value.toUpperCase().startsWith('YN-')?value.toUpperCase():value;
  peer=new P(scannerPeerId);
  peer.on('open',()=>{
    const conn=peer!.connect(normalized,{reliable:true});
    activeConnection=conn;
    conn.on('open',()=>setStatus('SUBSCRIBED'));
    conn.on('close',()=>setStatus('CLOSED'));
    conn.on('error',(e:any)=>setStatus('CHANNEL_ERROR',e?.message||String(e)));
  });
  peer.on('error',(e:any)=>setStatus('CHANNEL_ERROR',e?.type||e?.message||String(e)));
  peer.on('close',()=>setStatus('CLOSED'));
  return scannerPeerId;
}

export function subscribeToRegister(code:string,onMessage:(m:RegisterMessage)=>void,onStatus?:(s:RegisterStatus,d?:string)=>void){
  void startPOSPairing(code,onMessage,onStatus);
  return ()=>{messageHandlers.delete(onMessage);if(onStatus)statusHandlers.delete(onStatus)};
}

export async function sendBarcode(_code:string,barcode:string){
  if(!activeConnection?.open)return false;
  activeConnection.send({type:'barcode',barcode:barcode.trim(),sourceId:deviceId(),sentAt:Date.now()});
  return true;
}

export async function disconnectRegister(){
  closeConnection();
  messageHandlers.clear(); statusHandlers.clear();
  if(peer){try{peer.destroy()}catch{}peer=null}
  activeCode='';
}

export function qrUrl(peerId:string){
  // The QR contains only the public PeerJS ID, never Supabase credentials or sales data.
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&data=${encodeURIComponent(peerId)}`;
}

export function getRealtimeDiagnostics():RealtimeDiagnostics{return {authenticated:false,setAuth:false,topic:activeCode||undefined,userId:getPeerId()||undefined}};
