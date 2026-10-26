import 'dotenv/config';
import Fastify from 'fastify';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { Session } from './game/session.js';
import { puzzlePack } from './puzzle/pack.js';
import {demoPuzzlePack} from './puzzle/demo-pack.js';
import { parseCommand } from './app/commands.js';
import { GameController } from './app/controller.js';
import { registerWebRoutes } from './app/web.js';
import { registerAuthRoutes } from './twitch/auth.js';
import { EventSubClient } from './twitch/eventsub.js';
import { TwitchChat } from './twitch/chat.js';
import { TwitchHelix } from './twitch/helix.js';

const EnvSchema=z.object({TWITCH_CLIENT_ID:z.string().min(1),TWITCH_CLIENT_SECRET:z.string().min(1),PUBLIC_URL:z.string().url(),CHANNEL_A:z.string().min(1),CHANNEL_B:z.string().min(1),PORT:z.string().optional(),COMMAND_PREFIX:z.string().min(1).max(20).default('!g')});
async function createServer(demo:boolean,env:NodeJS.ProcessEnv){
  const config=demo?undefined:EnvSchema.parse(env);const app=Fastify();const session=demo?new Session():await Session.load().catch(()=>new Session());const controller=new GameController(session,demo&&!puzzlePack.length?demoPuzzlePack:puzzlePack,demo,Date.now,!demo);let eventsub:EventSubClient|undefined;
  if(config){
    let startEventSub:()=>Promise<void>=async()=>{};
    const auth=registerAuthRoutes(app,{clientId:config.TWITCH_CLIENT_ID,clientSecret:config.TWITCH_CLIENT_SECRET,publicUrl:config.PUBLIC_URL,onAuthorized:()=>startEventSub()});
    const helix=new TwitchHelix({clientId:config.TWITCH_CLIENT_ID,clientSecret:config.TWITCH_CLIENT_SECRET,tokens:auth.store});
    startEventSub=async()=>{if(eventsub||!auth.store.get('bot')||!auth.store.get('a')||!auth.store.get('b'))return;const [a,b,bot]=await Promise.all([helix.userId(config.CHANNEL_A,'a'),helix.userId(config.CHANNEL_B,'b'),helix.userId(undefined,'bot')]);const chat=new TwitchChat({clientId:config.TWITCH_CLIENT_ID,clientSecret:config.TWITCH_CLIENT_SECRET,tokens:auth.store,channelA:a,channelB:b,botUserId:bot});
      eventsub=new EventSubClient({clientId:config.TWITCH_CLIENT_ID,clientSecret:config.TWITCH_CLIENT_SECRET,channelA:a,channelB:b,botUserId:bot,tokens:auth.store,helix,onConnection:connected=>{controller.setChannelStatus('a',connected);controller.setChannelStatus('b',connected);},onChat:message=>{const side=message.channel==='a'?'A':'B';const command=parseCommand({channel:side,user:message.user,text:message.text,badges:message.badges},{A:a,B:b},config.COMMAND_PREFIX);const send=(channel:'a'|'b',text:string)=>{void chat.send(channel,text).catch(()=>undefined);};
        if(command.type==='start'){try{controller.startRound();send(message.channel,'A new Twinclue round has started.');}catch{send(message.channel,'A round is already running.');}}
        else if(command.type==='skip'){controller.skipRound();send(message.channel,'Round skipped.');}
        else if(command.type==='lock'){controller.lockRound();send(message.channel,'Votes locked.');}
        else if(command.type==='score'){const score=session.scoreboard;send(message.channel,`Score: ${score.wins} ${score.wins===1?'win':'wins'} and a ${score.streak} round streak.`);}
        else if(command.type==='denied')send(message.channel,'Only a broadcaster or moderator can use that command.');
        else if(command.type==='guess'){controller.vote(command.channel,command.user,command.text);}
      }});eventsub.connect();};
    await auth.load();if(auth.store.get('bot')&&auth.store.get('a')&&auth.store.get('b'))await startEventSub();
  }
  registerWebRoutes(app,controller);app.get('/health',async()=>({ok:true}));app.addHook('onClose',async()=>{eventsub?.stop();controller.close();});
  return {app,session,controller,listen:()=>app.listen({host:'0.0.0.0',port:Number(config?.PORT??env.PORT??3000)})};
}
export function buildServer(env:NodeJS.ProcessEnv=process.env){return createServer(false,env);}
export function buildDemoServer(env:NodeJS.ProcessEnv=process.env){return createServer(true,env);}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const server=await buildServer();await server.listen();}
