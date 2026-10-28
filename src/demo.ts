import 'dotenv/config';
import { buildDemoServer, installShutdown } from './server.js';

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const server = await buildDemoServer();
installShutdown(server);
const address = await server.listen();
console.log(`Twinclue DEMO is running at ${address}`);
// The demo's admin token is random per run and printed once, here, inside the panel link (the part after # never reaches the server).
console.log(`Control panel: ${address}/panel#token=${server.demoAdminToken}`);
console.log('Copy the overlay links (each with its own key) from the panel.');

const { controller } = server;
const vote = (side: 'A' | 'B', user: string, text: string) => controller.vote(side, user, text, { displayName: user });
controller.setSettings({ category: 'games', difficulty: 'medium', roundLengthSeconds: 40 });
while (true) {
  await pause(5000);
  const round = controller.startRound();
  const answer = round.puzzle.answer;
  const [a1, a2] = round.puzzle.alsoFitsA ?? round.puzzle.halfAAlsoFits;
  const [b1] = round.puzzle.alsoFitsB ?? round.puzzle.halfBAlsoFits;
  await pause(2500); vote('A', 'DemoA1', a1 ?? 'a guess'); vote('A', 'DemoA2', a2 ?? 'another guess'); vote('B', 'DemoB1', b1 ?? 'a guess');
  await pause(3500); vote('A', 'DemoA3', a1 ?? 'a guess'); vote('B', 'DemoB2', 'maybe a console game');
  // Community A is stuck: three viewers ask for the hint, which unlocks A's extra line.
  await pause(1500); for (const viewer of ['DemoA1', 'DemoA2', 'DemoA3']) controller.requestHint('A', viewer);
  await pause(4500); vote('A', 'DemoA1', answer); vote('A', 'DemoA2', answer);
  await pause(4500); vote('B', 'DemoB1', answer); vote('B', 'DemoB2', answer);
  await pause(6000); if (round.status === 'active') controller.lockRound();
  await pause(10_000); controller.clearRoundDisplay();
  await pause(5000);
  controller.setSettings({ category: 'food', difficulty: 'medium', roundLengthSeconds: 40 });
  const timeout = controller.startRound();
  const wrong = [...(timeout.puzzle.alsoFitsA ?? timeout.puzzle.halfAAlsoFits)];
  for (const [index, delay] of [4000, 6000, 7000, 6000].entries()) {
    await pause(delay);
    vote('A', `DemoWrongA${index}`, wrong[index % wrong.length] ?? 'a guess');
    vote('B', `DemoWrongB${index}`, wrong[(index + 1) % wrong.length] ?? 'a guess');
  }
  if (timeout.status === 'active') await pause(12_000);
  controller.timeout();
  await pause(10_000);
  controller.clearRoundDisplay();
  // A round with one voter per side ends as "not enough voters" and does not count.
  await pause(5000);
  controller.setSettings({ category: 'games', difficulty: 'medium', roundLengthSeconds: 30 });
  const thin = controller.startRound();
  await pause(4000); vote('A', 'DemoSoloA', thin.puzzle.answer); vote('B', 'DemoSoloB', thin.puzzle.answer);
  await pause(5000); controller.timeout();
  await pause(10_000); controller.clearRoundDisplay();
  controller.setSettings({ category: 'games', difficulty: 'medium', roundLengthSeconds: 40 });
}
