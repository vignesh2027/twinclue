import 'dotenv/config';
import { buildDemoServer } from './server.js';

const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const server=await buildDemoServer();
const address=await server.listen();
console.log(`Twinclue DEMO is running at ${address}`);
console.log(`Overlay A: ${address}/overlay/a`);
console.log(`Overlay B: ${address}/overlay/b`);
console.log(`Control panel: ${address}/panel`);
server.controller.setSettings({category:'general',difficulty:'medium',roundLengthSeconds:45});

while(true){
  await pause(3000);
  const cooperative=server.controller.startRound();
  await pause(4000);server.controller.guess('A','DemoViewerA','maybe a map');
  await pause(2000);server.controller.guess('B','DemoViewerB','maybe a clock');
  await pause(5000);server.controller.guess('A','DemoViewerA','perhaps a sign');
  await pause(19_000);server.controller.guess('A','DemoViewerA',cooperative.puzzle.answer);
  await pause(3000);server.controller.guess('B','DemoViewerB','one more idea');
  await pause(7000);server.controller.guess('B','DemoViewerB',cooperative.puzzle.answer);
  await pause(8000);server.controller.clearRoundDisplay();await pause(3000);

  server.controller.setSettings({category:'games',difficulty:'easy',roundLengthSeconds:40});
  server.controller.startRound();
  for(const [after,text] of [[5000,'a wrong guess'],[7000,'another try'],[8000,'one more guess'],[8000,'still thinking']] as const){
    await pause(after);server.controller.guess('A','DemoTimeoutA',text);server.controller.guess('B','DemoTimeoutB',text);
  }
  await pause(12_000);server.controller.clearRoundDisplay();await pause(3000);
}
