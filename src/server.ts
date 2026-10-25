import 'dotenv/config';
import Fastify from 'fastify';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { Session } from './game/session.js';
import { Round } from './game/round.js';
import { puzzlePack } from './puzzle/pack.js';
import { parseCommand } from './app/commands.js';
import { registerAuthRoutes, type AuthRole } from './twitch/auth.js';
import { EventSubClient } from './twitch/eventsub.js';
import { TwitchChat } from './twitch/chat.js';
import { TwitchHelix } from './twitch/helix.js';

const EnvSchema=z.object({TWITCH_CLIENT_ID:z.string().min(1),TWITCH_CLIENT_SECRET:z.string().min(1),PUBLIC_URL:z.string().url(),CHANNEL_A:z.string().min(1),CHANNEL_B:z.string().min(1),PORT:z.string().optional()});
export async function buildServer(env:NodeJS.ProcessEnv=process.env){
  const config=EnvSchema.parse(env);const app=Fastify();
  const auth=registerAuthRoutes(app,{clientId:config.TWITCH_CLIENT_ID,clientSecret:config.TWITCH_CLIENT_SECRET,publicUrl:config.PUBLIC_URL,onAuthorized:()=>startEventSub()});
  const realHelix=new TwitchHelix({clientId:config.TWITCH_CLIENT_ID,clientSecret:config.TWITCH_CLIENT_SECRET,tokens:auth.store});
  const session=await Session.load().catch(()=>new Session());let active:Round|undefined=[...session.rounds].reverse().find(round=>round.status==='active');let puzzleIndex=session.rounds.length;let eventsub:EventSubClient|undefined;
  async function startEventSub():Promise<void>{if(eventsub||!auth.store.get('bot')||!auth.store.get('a')||!auth.store.get('b'))return;const [a,b,bot]=await Promise.all([realHelix.userId(config.CHANNEL_A,'a'),realHelix.userId(config.CHANNEL_B,'b'),realHelix.userId(undefined,'bot')]);
    const wiredChat=new TwitchChat({clientId:config.TWITCH_CLIENT_ID,clientSecret:config.TWITCH_CLIENT_SECRET,tokens:auth.store,channelA:a,channelB:b,botUserId:bot});
    eventsub=new EventSubClient({clientId:config.TWITCH_CLIENT_ID,clientSecret:config.TWITCH_CLIENT_SECRET,channelA:a,channelB:b,botUserId:bot,tokens:auth.store,helix:realHelix,onChat:(message)=>{const cmd=parseCommand({channel:message.channel==='a'?'A':'B',user:message.user,text:message.text,badges:message.badges},{A:a,B:b});const send=(ch:'a'|'b',text:string)=>{void wiredChat.send(ch,text).catch(()=>undefined);};
      if(cmd.type==='start'){if(active?.status==='active'){send(message.channel,'A round is already running.');return;}active=new Round(puzzlePack[puzzleIndex++%puzzlePack.length]!);active.start();session.addRound(active);void session.save();send(message.channel,'A new Twinclue round has started.');}
      else if(cmd.type==='skip'){active?.timeout();if(active)session.recordResult(active);active=undefined;void session.save();send(message.channel,'Round skipped.');}
      else if(cmd.type==='score'){const score=session.scoreboard;send(message.channel,`Score: ${score.wins} wins and a ${score.streak} round streak.`);}
      else if(cmd.type==='denied')send(message.channel,'Only a broadcaster or moderator can use that command.');
      else if(cmd.type==='guess'){const result=active?.guess(cmd.channel,cmd.user,cmd.text);if(result==='accepted'){if(active?.status==='won'){session.recordResult(active);send('a',`${active.firstSolver.A} and ${active.firstSolver.B} solved it together!`);send('b',`${active.firstSolver.A} and ${active.firstSolver.B} solved it together!`);}else send(message.channel,'Correct. The other community still needs to solve it.');void session.save();}else if(result==='unclear')send(message.channel,'That is close. Try another spelling.');}
    }});eventsub.connect();}
  await auth.load();if(auth.store.get('bot')&&auth.store.get('a')&&auth.store.get('b'))await startEventSub();
  app.get('/health',async()=>({ok:true}));app.addHook('onClose',async()=>eventsub?.stop());
  return {app,session,auth,listen:()=>app.listen({host:'0.0.0.0',port:Number(config.PORT??3000)})};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const server=await buildServer();await server.listen();}
