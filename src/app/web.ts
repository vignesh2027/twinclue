import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { WebSocketServer,WebSocket } from 'ws';
import { z } from 'zod';
import { GameController,type OverlayView } from './controller.js';

const SettingsSchema=z.object({category:z.enum(['general','games','music','science','sport','food','geography','movies']).optional(),difficulty:z.enum(['easy','medium','hard']).optional(),roundLengthSeconds:z.number().int().min(30).max(600).optional()});
export function registerWebRoutes(app:FastifyInstance,controller:GameController):WebSocketServer{
  const wss=new WebSocketServer({noServer:true});
  app.server.on('upgrade',(request,socket,head)=>{const url=new URL(request.url??'/',`http://${request.headers.host??'localhost'}`);const view=url.pathname.match(/^\/overlay\/ws\/(a|b|panel)$/)?.[1];if(!view){socket.destroy();return;}wss.handleUpgrade(request,socket,head,ws=>{const stop=controller.subscribe(view as OverlayView|'panel',message=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(message));});ws.on('close',stop);});});
  app.get('/overlay/a',async(_request,reply)=>reply.type('text/html; charset=utf-8').send(await readFile(resolve('public/overlay.html'),'utf8')));
  app.get('/overlay/b',async(_request,reply)=>reply.type('text/html; charset=utf-8').send(await readFile(resolve('public/overlay.html'),'utf8')));
  app.get('/overlay.css',async(_request,reply)=>reply.type('text/css; charset=utf-8').send(await readFile(resolve('public/overlay.css'),'utf8')));
  app.get('/overlay.js',async(_request,reply)=>reply.type('application/javascript; charset=utf-8').send(await readFile(resolve('public/overlay.js'),'utf8')));
  app.get('/logo.svg',async(_request,reply)=>reply.type('image/svg+xml; charset=utf-8').send(await readFile(resolve('public/logo.svg'),'utf8')));
  app.get('/panel',async(_request,reply)=>reply.type('text/html; charset=utf-8').send(await readFile(resolve('public/panel.html'),'utf8')));
  app.get('/panel.css',async(_request,reply)=>reply.type('text/css; charset=utf-8').send(await readFile(resolve('public/panel.css'),'utf8')));
  app.get('/panel.js',async(_request,reply)=>reply.type('application/javascript; charset=utf-8').send(await readFile(resolve('public/panel.js'),'utf8')));
  app.get('/api/state',async()=>controller.panelState());
  app.post('/api/round/start',async(_request,reply)=>{try{controller.startRound();return controller.panelState();}catch(error){return reply.code(409).send({error:error instanceof Error?error.message:'Could not start round.'});}});
  app.post('/api/round/skip',async()=>{controller.skipRound();return controller.panelState();});
  app.post('/api/settings',async(request,reply)=>{const parsed=SettingsSchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'Invalid settings.'});controller.setSettings(parsed.data);return controller.panelState();});
  app.addHook('onClose',async()=>wss.close());
  return wss;
}
