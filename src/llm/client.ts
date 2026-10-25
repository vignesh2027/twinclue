import { z } from 'zod';

export interface ChatMessage { role:'system'|'user'|'assistant'; content:string; }
export interface LlmConfig { baseUrl:string; apiKey:string; model:string; timeoutMs?:number; retries?:number; minimumIntervalMs?:number; maxCompletionTokens?:number; reasoningEffort?:'none'|'low'|'medium'|'high'; responseFormat?:unknown; fetcher?:typeof fetch; sleep?:(ms:number)=>Promise<void>; }
const CompletionSchema=z.object({choices:z.array(z.object({message:z.object({content:z.string()})})).min(1)});
export class LlmClient {
  private lastRequestAt=0;
  constructor(private readonly config:LlmConfig){}
  async chatJson<T>(messages:ChatMessage[],schema:z.ZodType<T>):Promise<T>{
    const fetcher=this.config.fetcher??fetch;const pause=this.config.sleep??((ms:number)=>new Promise(resolve=>setTimeout(resolve,ms)));const retries=this.config.retries??3;
    for(let attempt=0;attempt<=retries;attempt++){
      const wait=(this.config.minimumIntervalMs??0)-(Date.now()-this.lastRequestAt);if(this.lastRequestAt&&wait>0)await pause(wait);this.lastRequestAt=Date.now();
      const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),this.config.timeoutMs??60_000);
      try{
        const response=await fetcher(`${this.config.baseUrl.replace(/\/+$/,'')}/chat/completions`,{method:'POST',headers:{authorization:`Bearer ${this.config.apiKey}`,'content-type':'application/json'},body:JSON.stringify({model:this.config.model,messages,max_completion_tokens:this.config.maxCompletionTokens??512,...(this.config.reasoningEffort?{reasoning_effort:this.config.reasoningEffort}:{}),response_format:this.config.responseFormat??{type:'json_object'}}),signal:abort.signal});
        if((response.status===429||response.status>=500)&&attempt<retries){await pause(this.backoff(attempt,response.headers.get('retry-after')));continue;}
        if(!response.ok){const body=await response.json().catch(()=>undefined) as {error?:{message?:unknown}}|undefined;const raw=typeof body?.error?.message==='string'?body.error.message:'';if(response.status===400&&/failed to validate json/i.test(raw)&&attempt<retries){await pause(this.backoff(attempt));continue;}const detail=raw?raw.replaceAll(this.config.apiKey,'[REDACTED]').slice(0,240):undefined;throw new Error(`LLM request failed (${response.status})${detail?`: ${detail}`:''}.`);}
        const completion=CompletionSchema.parse(await response.json());const content=completion.choices[0]!.message.content;
        return schema.parse(JSON.parse(content));
      }catch(error){if(attempt<retries&&this.isRetryable(error)){await pause(this.backoff(attempt));continue;}throw error;}finally{clearTimeout(timer);}
    }
    throw new Error('LLM request exhausted retries.');
  }
  private backoff(attempt:number,retryAfter:string|null=null):number{const seconds=retryAfter===null?NaN:Number(retryAfter);return Number.isFinite(seconds)?Math.min(seconds*1000,30_000):Math.min(500*2**attempt,8_000);}
  private isRetryable(error:unknown):boolean{return error instanceof TypeError||(error instanceof DOMException&&error.name==='AbortError');}
}
