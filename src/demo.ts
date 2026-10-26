import 'dotenv/config';
import {buildDemoServer} from './server.js';
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const server=await buildDemoServer();const address=await server.listen();console.log(`Twinclue DEMO is running at ${address}`);console.log(`Overlay A: ${address}/overlay/a`);console.log(`Overlay B: ${address}/overlay/b`);console.log(`Control panel: ${address}/panel`);
server.controller.setSettings({category:'games',difficulty:'medium',roundLengthSeconds:40});
while(true){
 await pause(3000);const round=server.controller.startRound();const answer=round.puzzle.answer;
 await pause(2500);server.controller.vote('A','DemoA1','maybe another game',Date.now());server.controller.vote('A','DemoA2','a game with a hero',Date.now());server.controller.vote('B','DemoB1','maybe a fantasy title',Date.now());
 await pause(3500);server.controller.vote('A','DemoA3','another guess',Date.now());server.controller.vote('B','DemoB2','perhaps a console game',Date.now());
 await pause(4500);server.controller.vote('A','DemoA1',answer,Date.now());server.controller.vote('A','DemoA2',answer,Date.now());
 await pause(4500);server.controller.vote('B','DemoB1',answer,Date.now());server.controller.vote('B','DemoB2',answer,Date.now());
 await pause(6000);if(round.status==='active')server.controller.lockRound();await pause(7000);server.controller.clearRoundDisplay();
 await pause(3000);server.controller.setSettings({category:'food',difficulty:'medium',roundLengthSeconds:40});const timeout=server.controller.startRound();
 for(const [delay,text] of [[4000,'maybe a snack'],[6000,'a dish with rice'],[7000,'could be a dessert'],[6000,'one more guess']] as const){await pause(delay);server.controller.vote('A',`DemoWrongA${delay}`,text,Date.now());server.controller.vote('B',`DemoWrongB${delay}`,text,Date.now());}
 if(timeout.status==='active')await pause(12_000);server.controller.timeout();await pause(7000);server.controller.clearRoundDisplay();server.controller.setSettings({category:'games',difficulty:'medium',roundLengthSeconds:40});
}
