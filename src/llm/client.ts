import { z } from 'zod';

export interface ChatMessage { role:'system'|'user'|'assistant'; content:string; }
export interface LlmConfig { baseUrl:string; apiKey:string; model:string; timeoutMs?:number; retries?:number; minimumIntervalMs?:number; maxCompletionTokens?:number; reasoningEffort?:'none'|'low'|'medium'|'high'; responseFormat?:unknown; fetcher?:typeof fetch; sleep?:(ms:number)=>Promise<void>; }
export interface TokenUsage {promptTokens:number;completionTokens:number;totalTokens:number;}
export class LlmQuotaError extends Error {constructor(message:string,readonly daily:boolean){super(message);this.name='LlmQuotaError';}}
const CompletionSchema=z.object({choices:z.array(z.object({message:z.object({content:z.string()}),finish_reason:z.string().optional()}).passthrough()).min(1),usage:z.object({prompt_tokens:z.number().optional(),completion_tokens:z.number().optional(),total_tokens:z.number().optional()}).optional()});
export class LlmClient {
  private lastRequestAt=0;
  private reasoningEffortUnsupported=false;
  private responseFormatFallback=0;
  private usageTotals:TokenUsage={promptTokens:0,completionTokens:0,totalTokens:0};
  constructor(private readonly config:LlmConfig){}
  get tokenUsage():TokenUsage{return {...this.usageTotals};}
  restoreTokenUsage(usage:TokenUsage):void{this.usageTotals={promptTokens:usage.promptTokens,completionTokens:usage.completionTokens,totalTokens:usage.totalTokens};}
  async chatJson<T>(messages:ChatMessage[],schema:z.ZodType<T>):Promise<T>{return (await this.chatJsonWithUsage(messages,schema)).value;}
  async chatJsonWithUsage<T>(messages:ChatMessage[],schema:z.ZodType<T>,responseFormat?:unknown):Promise<{value:T;usage:TokenUsage}>{
    const fetcher=this.config.fetcher??fetch;const pause=this.config.sleep??((ms:number)=>new Promise(resolve=>setTimeout(resolve,ms)));const retries=this.config.retries??3;
    for(let attempt=0;attempt<=retries;attempt++){
      const wait=(this.config.minimumIntervalMs??0)-(Date.now()-this.lastRequestAt);if(this.lastRequestAt&&wait>0)await pause(wait);this.lastRequestAt=Date.now();
      const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),this.config.timeoutMs??60_000);
      try{
        const structured=responseFormat??this.config.responseFormat;const outputFormat=this.responseFormatFallback===0?(structured??{type:'json_object'}):this.responseFormatFallback===1?{type:'json_object'}:undefined;const response=await fetcher(`${this.config.baseUrl.replace(/\/+$/,'')}/chat/completions`,{method:'POST',headers:{authorization:`Bearer ${this.config.apiKey}`,'content-type':'application/json'},body:JSON.stringify({model:this.config.model,messages,max_completion_tokens:this.config.maxCompletionTokens??512,...(this.config.reasoningEffort&&!this.reasoningEffortUnsupported?{reasoning_effort:this.config.reasoningEffort}:{}),...(outputFormat?{response_format:outputFormat}:{})}),signal:abort.signal});
        if(response.status===429){const body=await response.clone().json().catch(()=>undefined) as {error?:{message?:unknown}}|undefined;const raw=typeof body?.error?.message==='string'?body.error.message:'';const safe=raw.replaceAll(this.config.apiKey,'[REDACTED]').slice(0,240);if(/TPD|RPD|per day|daily limit/i.test(raw))throw new LlmQuotaError(safe||'Daily model quota exhausted.',true);const named=/try again in\s+([\d.]+)\s*s/i.exec(raw);if(named||/TPM|tokens per minute|requests per minute/i.test(raw)){await pause(named?Math.ceil(Number(named[1])*1000):this.backoff(attempt,response.headers.get('retry-after')));attempt--;continue;}if(attempt<retries){await pause(this.backoff(attempt,response.headers.get('retry-after')));continue;}throw new LlmQuotaError(safe||'Per-minute model quota exhausted.',false);}
        if(response.status>=500&&attempt<retries){await pause(this.backoff(attempt,response.headers.get('retry-after')));continue;}
        if(!response.ok){const body=await response.json().catch(()=>undefined) as {error?:{message?:unknown}}|undefined;const raw=typeof body?.error?.message==='string'?body.error.message:'';if(response.status===400&&/reasoning[_ -]?effort|reasoning.*unsupported/i.test(raw)&&this.config.reasoningEffort&&!this.reasoningEffortUnsupported&&attempt<retries){this.reasoningEffortUnsupported=true;attempt--;continue;}if(response.status===400&&/failed to validate json/i.test(raw)&&this.responseFormatFallback<2&&attempt<retries){this.responseFormatFallback++;attempt--;continue;}if(response.status===400&&/failed to validate json/i.test(raw)&&attempt<retries){await pause(this.backoff(attempt));continue;}const detail=raw?raw.replaceAll(this.config.apiKey,'[REDACTED]').slice(0,240):undefined;throw new Error(`LLM request failed (${response.status})${detail?`: ${detail}`:''}.`);}
        const completion=CompletionSchema.parse(await response.json());const content=completion.choices[0]!.message.content;const usage={promptTokens:completion.usage?.prompt_tokens??0,completionTokens:completion.usage?.completion_tokens??0,totalTokens:completion.usage?.total_tokens??0};this.usageTotals.promptTokens+=usage.promptTokens;this.usageTotals.completionTokens+=usage.completionTokens;this.usageTotals.totalTokens+=usage.totalTokens;if(!content.trim())throw new SyntaxError(`Model returned empty JSON content (finish reason ${completion.choices[0]!.finish_reason??'unknown'}, ${usage.completionTokens} completion tokens).`);const value=schema.parse(JSON.parse(content));return {value,usage};
      }catch(error){if(error instanceof SyntaxError&&this.responseFormatFallback<2&&attempt<retries){this.responseFormatFallback++;continue;}if(attempt<retries&&(this.isRetryable(error)||error instanceof SyntaxError||error instanceof z.ZodError)){await pause(this.backoff(attempt));continue;}throw error;}finally{clearTimeout(timer);}
    }
    throw new Error('LLM request exhausted retries.');
  }
  private backoff(attempt:number,retryAfter:string|null=null):number{const seconds=retryAfter===null?NaN:Number(retryAfter);return Number.isFinite(seconds)?Math.min(seconds*1000,30_000):Math.min(500*2**attempt,8_000);}
  private isRetryable(error:unknown):boolean{return error instanceof TypeError||(error instanceof DOMException&&error.name==='AbortError');}
}
