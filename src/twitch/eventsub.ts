import WebSocket from 'ws';
import type { AuthRole, TokenStore } from './auth.js';

export type ParsedChat={channel:'a'|'b';user:string;text:string;sourceChannel:string;badges?:Array<{set_id:string}>};
export interface SocketLike { on(event:string,listener:(...args:any[])=>void):this; send(data:string):void; close():void; }
export type SocketFactory=(url:string)=>SocketLike;
export interface HelixApi { request(path:string,body:unknown,role:AuthRole):Promise<unknown>; }
export interface EventSubConfig { clientId:string;clientSecret:string;channelA:string;channelB:string;botUserId:string;tokens:TokenStore;helix:HelixApi;socketFactory?:SocketFactory;onChat?:(chat:ParsedChat)=>void;onShared?:(type:string,event:unknown)=>void;onRevocation?:(message:unknown)=>void;onConnection?:(connected:boolean)=>void;reconnectDelayMs?:number; }
export function parseChatMessage(message:any,channelA:string,channelB:string):ParsedChat|undefined {
  const event=message?.payload?.event;if(!event)return undefined;
  const source=event.source_broadcaster_user_id??event.broadcaster_user_id;
  const channel=String(source)===channelA?'a':String(source)===channelB?'b':undefined;
  if(!channel)return undefined;
  return {channel,user:event.chatter_user_name??event.chatter_user_login??'unknown',text:event.message?.text??'',sourceChannel:String(source),badges:event.badges};
}
export class EventSubClient {
  private socket?:SocketLike;private stopped=false;private sessionId?:string;private reconnectUrl='wss://eventsub.wss.twitch.tv/ws';private reconnectTimer?:ReturnType<typeof setTimeout>;private keepaliveTimer?:ReturnType<typeof setTimeout>;private keepaliveMs=0;private reconnectingSession=false;
  constructor(private readonly config:EventSubConfig){}
  connect(url=this.reconnectUrl):void {this.stopped=false;const make=this.config.socketFactory??((address:string)=>new WebSocket(address) as unknown as SocketLike);const socket=make(url);this.socket=socket;socket.on('open',()=>this.config.onConnection?.(true));socket.on('message',(data:unknown)=>{try{this.handle(JSON.parse(typeof data==='string'?data:String((data as {toString:()=>string}).toString())));}catch{}});socket.on('close',()=>{this.config.onConnection?.(false);this.scheduleReconnect();});socket.on('error',()=>this.config.onConnection?.(false));}
  stop():void{this.stopped=true;if(this.reconnectTimer)clearTimeout(this.reconnectTimer);if(this.keepaliveTimer)clearTimeout(this.keepaliveTimer);this.socket?.close();}
  private resetKeepalive():void{if(this.keepaliveTimer)clearTimeout(this.keepaliveTimer);if(this.keepaliveMs>0)this.keepaliveTimer=setTimeout(()=>this.socket?.close(),this.keepaliveMs);}
  private scheduleReconnect(url?:string):void{if(this.stopped||this.reconnectTimer)return;this.reconnectTimer=setTimeout(()=>{this.reconnectTimer=undefined;this.connect(url??this.reconnectUrl);},url?0:this.config.reconnectDelayMs??1000);}
  private handle(message:any):void{
    const type=message?.metadata?.message_type;const payload=message?.payload;
    if(type==='session_welcome'){this.sessionId=payload?.session?.id;this.keepaliveMs=Number(payload?.session?.keepalive_timeout_seconds??0)*1000;this.resetKeepalive();if(this.reconnectingSession)this.reconnectingSession=false;else void this.subscribe();return;}
    if(type==='session_keepalive'){this.resetKeepalive();return;}
    if(type==='session_reconnect'){this.reconnectUrl=payload?.session?.reconnect_url??this.reconnectUrl;this.reconnectingSession=true;this.scheduleReconnect(this.reconnectUrl);return;}
    if(type==='notification')this.resetKeepalive();
    if(type==='revocation'){this.config.onRevocation?.(message);return;}
    if(type!=='notification')return;
    const sub=payload?.subscription?.type;const event=payload?.event;
    if(sub==='channel.chat.message'){const parsed=parseChatMessage(message,this.config.channelA,this.config.channelB);if(parsed)this.config.onChat?.(parsed);}
    if(sub?.startsWith('channel.shared_chat.'))this.config.onShared?.(sub,event);
    if(sub==='channel.channel_points_custom_reward_redemption.add')this.config.onShared?.(sub,event);
  }
  private async subscribe():Promise<void>{if(!this.sessionId)return;
    const subscriptions:{type:string;version:string;condition:Record<string,string>;role:AuthRole}[]=[];
    for(const [id,role] of [[this.config.channelA,'a'],[this.config.channelB,'b']] as const) subscriptions.push({type:'channel.chat.message',version:'1',condition:{broadcaster_user_id:id,user_id:this.config.botUserId},role:'bot'},{type:'channel.shared_chat.begin',version:'1',condition:{broadcaster_user_id:id},role},{type:'channel.shared_chat.update',version:'1',condition:{broadcaster_user_id:id},role},{type:'channel.shared_chat.end',version:'1',condition:{broadcaster_user_id:id},role},{type:'channel.channel_points_custom_reward_redemption.add',version:'1',condition:{broadcaster_user_id:id},role});
    for(const sub of subscriptions) await this.config.helix.request('/eventsub/subscriptions',{type:sub.type,version:sub.version,condition:sub.condition,transport:{method:'websocket',session_id:this.sessionId}},sub.role);
  }
}
