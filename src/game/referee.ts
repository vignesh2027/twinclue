export type RefereeResult = 'accepted' | 'rejected' | 'unclear';
const fillers=['is it','could it be','maybe','perhaps','possibly','i think','i believe','i guess','the answer is'];
export function normaliseGuess(value:string):string {
  let normalized=value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  let changed=true;while(changed&&normalized){changed=false;for(const filler of fillers){if(normalized===filler){normalized='';changed=true;break;}if(normalized.startsWith(`${filler} `)){normalized=normalized.slice(filler.length).trim();changed=true;break;}}if(/^(the|a|an)\s+/.test(normalized)){normalized=normalized.replace(/^(the|a|an)\s+/,'');changed=true;}}
  return normalized;
}
function distance(a:string,b:string):number {let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]!+1,row[j]!+1,row[j-1]!+(a[i-1]===b[j-1]?0:1));row=next;}return row[b.length]!;}
export function guessBucketKey(guess:string,answer:string,aliases:string[]=[]):string {return judgeGuess(guess,answer,aliases)==='accepted'?'__answer__':normaliseGuess(guess);}
export function judgeGuess(guess:string,answer:string,aliases:string[]=[]):RefereeResult {
  const candidate=normaliseGuess(guess);if(!candidate)return 'rejected';const targets=[answer,...aliases].map(normaliseGuess).filter(Boolean);if(targets.includes(candidate))return 'accepted';let closest=Infinity;
  for(const target of targets){const threshold=target.length<=4?1:target.length<=8?2:3;closest=Math.min(closest,distance(candidate,target));if(distance(candidate,target)<=threshold)return 'accepted';}
  return closest<=5?'unclear':'rejected';
}
