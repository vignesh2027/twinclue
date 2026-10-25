import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

export type AuthRole='bot'|'a'|'b';
export interface TwitchToken { access_token:string; refresh_token:string; expires_at:number; scope:string[]; token_type:string; }
const TokenMapSchema=z.record(z.string(),z.object({access_token:z.string(),refresh_token:z.string(),expires_at:z.number(),scope:z.array(z.string()),token_type:z.string()}));
export interface AuthConfig { clientId:string; clientSecret:string; publicUrl:string; tokenPath?:string; fetcher?:typeof fetch; now?:()=>number; onAuthorized?:()=>void|Promise<void>; }
export class TokenStore {
  private tokens:Record<string,TwitchToken>={};
  constructor(private readonly path='data/tokens.json',private readonly fetcher:typeof fetch=fetch,private readonly now=Date.now){}
  async load():Promise<void>{try{this.tokens=TokenMapSchema.parse(JSON.parse(await readFile(this.path,'utf8')));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
  get(role:AuthRole):TwitchToken|undefined{return this.tokens[role];}
  async put(role:AuthRole,token:TwitchToken):Promise<void>{this.tokens[role]=token;await mkdir(dirname(this.path),{recursive:true});await writeFile(this.path,JSON.stringify(this.tokens,null,2),'utf8');}
  async valid(role:AuthRole,clientId:string,clientSecret:string):Promise<TwitchToken>{
    const token=this.tokens[role];if(!token)throw new Error(`No Twitch token for ${role}.`);
    if(token.expires_at-this.now()>60_000)return token;
    const response=await this.fetcher('https://id.twitch.tv/oauth2/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:token.refresh_token,client_id:clientId,client_secret:clientSecret}).toString()});
    if(!response.ok)throw new Error(`Twitch token refresh failed (${response.status}).`);
    const data=z.object({access_token:z.string(),refresh_token:z.string(),expires_in:z.number(),scope:z.array(z.string()).optional(),token_type:z.string()}).parse(await response.json());
    const refreshed={access_token:data.access_token,refresh_token:data.refresh_token,expires_at:this.now()+data.expires_in*1000,scope:data.scope??token.scope,token_type:data.token_type};await this.put(role,refreshed);return refreshed;
  }
}
const scopes:Record<AuthRole,string[]>={bot:['user:read:chat','user:write:chat','user:bot'],a:['channel:bot','channel:read:redemptions'],b:['channel:bot','channel:read:redemptions']};
export function registerAuthRoutes(app:FastifyInstance,config:AuthConfig,store=new TokenStore(config.tokenPath,config.fetcher,config.now)):{store:TokenStore;load:()=>Promise<void>} {
  const states=new Map<string,AuthRole>();const fetcher=config.fetcher??fetch;const callbackUrl=`${config.publicUrl.replace(/\/$/,'')}/auth/callback`;
  app.get('/auth/start',async(request,reply)=>{const role=(request.query as {role?:string}).role;if(role!=='bot'&&role!=='a'&&role!=='b')return reply.code(400).send({error:'role must be bot, a, or b'});const state=randomUUID();states.set(state,role);return reply.redirect(`https://id.twitch.tv/oauth2/authorize?${new URLSearchParams({client_id:config.clientId,redirect_uri:callbackUrl,response_type:'code',scope:scopes[role].join(' '),state})}`);});
  app.get('/auth/callback',async(request,reply)=>{const query=request.query as {code?:string;state?:string;error?:string};if(query.error||!query.code||!query.state)return reply.code(400).send({error:'Twitch authorization was not completed.'});const role=states.get(query.state);if(!role)return reply.code(400).send({error:'Invalid or expired authorization state.'});states.delete(query.state);const response=await fetcher('https://id.twitch.tv/oauth2/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,code:query.code,grant_type:'authorization_code',redirect_uri:callbackUrl}).toString()});if(!response.ok)return reply.code(502).send({error:'Twitch token exchange failed.'});const data=z.object({access_token:z.string(),refresh_token:z.string(),expires_in:z.number(),scope:z.array(z.string()),token_type:z.string()}).parse(await response.json());await store.put(role,{access_token:data.access_token,refresh_token:data.refresh_token,expires_at:(config.now??Date.now)()+data.expires_in*1000,scope:data.scope,token_type:data.token_type});await config.onAuthorized?.();return {ok:true,role};});
  return {store,load:()=>store.load()};
}
