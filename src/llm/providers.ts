import 'dotenv/config';
import { LlmClient, type LlmConfig } from './client.js';
export function resolveModel(modelRef:string,env:NodeJS.ProcessEnv=process.env):LlmConfig {
 const colon=modelRef.indexOf(':');const provider=colon>0?modelRef.slice(0,colon):'';const model=colon>0?modelRef.slice(colon+1):modelRef;
 if(provider==='gemini') return {baseUrl:'https://generativelanguage.googleapis.com/v1beta/openai/',apiKey:required(env.GEMINI_API_KEY,'GEMINI_API_KEY'),model,maxCompletionTokens:8192,reasoningEffort:'medium',timeoutMs:90000,retries:4,minimumIntervalMs:4500};
 if(provider==='groq') return {baseUrl:required(env.LLM_BASE_URL,'LLM_BASE_URL'),apiKey:required(env.LLM_API_KEY,'LLM_API_KEY'),model,maxCompletionTokens:8192,reasoningEffort:'low',timeoutMs:90000,retries:4,minimumIntervalMs:4500};
 return {baseUrl:required(env.LLM_BASE_URL,'LLM_BASE_URL'),apiKey:required(env.LLM_API_KEY,'LLM_API_KEY'),model,maxCompletionTokens:8192,reasoningEffort:'medium',timeoutMs:90000,retries:4,minimumIntervalMs:4500};
}
function required(value:string|undefined,name:string):string{if(!value)throw new Error(`${name} is required for this model.`);return value;}
export function clientsForModels(models:string[],env:NodeJS.ProcessEnv=process.env):Record<string,LlmClient>{return Object.fromEntries([...new Set(models)].map(model=>[model,new LlmClient(resolveModel(model,env))]));}
