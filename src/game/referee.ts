export type RefereeResult = 'accepted' | 'rejected' | 'unclear';
export function normaliseGuess(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/^(the|a|an)\s+/, '');
}
function distance(a: string, b: string): number {
  let row = Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){ const next=[i]; for(let j=1;j<=b.length;j++) next[j]=Math.min(next[j-1]!+1,row[j]!+1,row[j-1]!+(a[i-1]===b[j-1]?0:1)); row=next; }
  return row[b.length]!;
}
export function judgeGuess(guess: string, answer: string, aliases: string[] = []): RefereeResult {
  const candidate=normaliseGuess(guess); if(!candidate) return 'rejected';
  const targets=[answer,...aliases].map(normaliseGuess).filter(Boolean);
  if(targets.includes(candidate)) return 'accepted';
  let closest=Infinity;
  for(const target of targets) {
    const threshold=target.length<=4?1:target.length<=8?2:3;
    const parts=candidate.split(' ');
    closest=Math.min(closest,distance(candidate,target),...parts.map(p=>distance(p,target)));
    if(distance(candidate,target)<=threshold || parts.some(p=>distance(p,target)<=threshold)) return 'accepted';
  }
  return closest<=3?'unclear':'rejected';
}
