import {supabase} from './supabase';

export type DeviceRole='pos'|'scanner';
export type RegisterMessage={type:'barcode';barcode:string;sourceId:string;sentAt:number};
export type RegisterStatus='CONNECTING'|'SUBSCRIBED'|'CLOSED'|'CHANNEL_ERROR'|'TIMED_OUT'|'NO_SUPABASE';

const ROLE_KEY='yn-device-role';
const REGISTER_KEY='yn-register-code';
const DEVICE_KEY='yn-device-id';

type RegisterChannel = ReturnType<NonNullable<typeof supabase>['channel']>;
const channels = new Map<string, RegisterChannel>();

const deviceId=()=>{
  let v=localStorage.getItem(DEVICE_KEY);
  if(!v){v=crypto.randomUUID();localStorage.setItem(DEVICE_KEY,v)}
  return v;
};

const channelName=(c:string)=>`yn-pos-register-${c.toUpperCase()}`;
const notifyConfigChanged=()=>window.dispatchEvent(new Event('yn-device-config-changed'));

export const getSavedDeviceRole=():DeviceRole|null=>{
  const v=localStorage.getItem(ROLE_KEY);
  return v==='pos'||v==='scanner'?v:null;
};
export const setDeviceRole=(v:DeviceRole)=>{localStorage.setItem(ROLE_KEY,v);notifyConfigChanged()};
export const getRegisterCode=()=>localStorage.getItem(REGISTER_KEY)||'';
export const setRegisterCode=(v:string)=>{localStorage.setItem(REGISTER_KEY,v);notifyConfigChanged()};
export const makePairCode=()=>`YN-${Math.floor(1000+Math.random()*9000)}`;

function getChannel(code:string){
  return channels.get(code.toUpperCase());
}

export function subscribeToRegister(
  code:string,
  onMessage:(m:RegisterMessage)=>void,
  onStatus?:(status:RegisterStatus)=>void,
){
  const client=supabase;
  const normalized=code.trim().toUpperCase();
  if(!client){onStatus?.('NO_SUPABASE');return()=>{}};
  if(!normalized){onStatus?.('CLOSED');return()=>{}};

  const existing=getChannel(normalized);
  if(existing){
    onStatus?.('SUBSCRIBED');
    const handler=(payload:any)=>{
      const m=payload?.payload as RegisterMessage;
      if(m?.type==='barcode'&&m.sourceId!==deviceId())onMessage(m);
    };
    existing.on('broadcast',{event:'barcode'},handler);
    return()=>{};
  }

  onStatus?.('CONNECTING');
  const c=client.channel(channelName(normalized),{config:{broadcast:{self:false}}});
  channels.set(normalized,c);
  c.on('broadcast',{event:'barcode'},({payload})=>{
    const m=payload as RegisterMessage;
    if(m?.type==='barcode'&&m.sourceId!==deviceId())onMessage(m);
  });
  c.subscribe(status=>{
    onStatus?.(status as RegisterStatus);
    if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){
      channels.delete(normalized);
    }
    if(status==='CLOSED')channels.delete(normalized);
  });

  return()=>{
    const current=getChannel(normalized);
    if(current===c){
      channels.delete(normalized);
      void client.removeChannel(c);
    }
  };
}

export async function sendBarcode(code:string,barcode:string){
  const client=supabase;
  const normalized=code.trim().toUpperCase();
  if(!client||!normalized||!barcode)return false;

  let c=getChannel(normalized);
  let temporary=false;

  if(!c){
    c=client.channel(channelName(normalized),{config:{broadcast:{self:false}}});
    temporary=true;
    const subscribed=await new Promise<boolean>(resolve=>{
      let settled=false;
      const finish=(value:boolean)=>{if(!settled){settled=true;resolve(value)}};
      c!.subscribe(status=>{
        if(status==='SUBSCRIBED')finish(true);
        else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')finish(false);
      });
      setTimeout(()=>finish(false),5000);
    });
    if(!subscribed){void client.removeChannel(c);return false;}
  }

  try{
    const result=await c.send({
      type:'broadcast',
      event:'barcode',
      payload:{type:'barcode',barcode,sourceId:deviceId(),sentAt:Date.now()},
    });
    if(temporary)void client.removeChannel(c);
    return result==='ok';
  }catch{
    if(temporary)void client.removeChannel(c);
    return false;
  }
}

export async function disconnectRegister(code?:string){
  const client=supabase;
  if(!client)return;
  const normalized=(code||'').trim().toUpperCase();
  if(normalized){
    const c=getChannel(normalized);
    if(c){channels.delete(normalized);await client.removeChannel(c);}
    return;
  }
  for(const [key,c] of channels){channels.delete(key);await client.removeChannel(c)}
}
