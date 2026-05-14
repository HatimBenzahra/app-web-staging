import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import { ClientRequest, IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';
import {
  createProxyMiddleware,
  Options as ProxyOptions,
} from 'http-proxy-middleware';
import { NextFunction, Request, Response } from 'express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Fix: Explicitly type the variable so it can be an object or undefined
  let httpsOptions: { key: Buffer; cert: Buffer } | undefined = undefined;

  // On active le HTTPS local seulement si les fichiers existent (Mode Dev)
  if (fs.existsSync('./ssl/key.pem') && fs.existsSync('./ssl/cert.pem')) {
    httpsOptions = {
      key: fs.readFileSync('./ssl/key.pem'),
      cert: fs.readFileSync('./ssl/cert.pem'),
    };
    logger.log('🔒 SSL certificates found - Starting in HTTPS mode');
  } else {
    logger.log('🌐 No SSL certificates - Starting in HTTP mode');
  }

  const app = await NestFactory.create(AppModule, {
    httpsOptions, // Sera 'undefined' en prod -> NestJS démarrera en HTTP simple
  });
  const allowedOrigins = process.env.VITE_FRONTEND_URL?.split(',') || [
    'https://localhost:5173',
    'https://192.168.1.107:5173',
  ];
  // Configuration CORS pour permettre les requêtes du front
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Proxy HTTP vers le service Whisper interne pour but de tester en localhost.
  const whisperLogger = new Logger('WhisperProxy');
  const whisperTarget =
    process.env.WHISPER_INTERNAL_URL || 'http://pro-win-staging-whisper:9010';
  const whisperToken = process.env.WHISPER_PUBLIC_TOKEN; // optionnel: si défini, header requis

  app.use('/transcribe', (req: Request, res: Response, next: NextFunction) => {
    if (whisperToken) {
      const provided = req.headers['x-transcribe-token'];
      if (provided !== whisperToken) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
    }
    next();
  });

  const whisperProxyOptions: ProxyOptions = {
    target: whisperTarget,
    changeOrigin: true,
    pathRewrite: (path: string) => {
      const [pathname, query] = path.split('?', 2);
      const trimmed = pathname === '/' || pathname === '' ? '' : pathname;
      const upstream = `/transcribe${trimmed}`;
      return query !== undefined ? `${upstream}?${query}` : upstream;
    },
    on: {
      proxyReq: (_proxyReq: ClientRequest, req: IncomingMessage) => {
        whisperLogger.log(`→ ${req.method ?? 'UNKNOWN'} ${req.url ?? ''}`);
      },
      error: (
        err: Error,
        _req: IncomingMessage,
        res: ServerResponse | Socket,
      ) => {
        whisperLogger.error(`Proxy error: ${err.message}`);
        if (res instanceof ServerResponse && !res.headersSent) {
          res.statusCode = 502;
          res.setHeader('content-type', 'application/json');
          res.end(
            JSON.stringify({
              error: 'whisper_unreachable',
              detail: err.message,
            }),
          );
        }
      },
    },
  };

  app.use('/transcribe', createProxyMiddleware(whisperProxyOptions));

  // Proxy HTTP vers le service llm.
  const llmLogger = new Logger('LlmProxy');
  const llmTarget = process.env.LLM_INTERNAL_URL || 'http://vllm:8000';
  const llmToken = process.env.LLM_PUBLIC_TOKEN; // optionnel: si défini, header requis

  app.use('/llm', (req: Request, res: Response, next: NextFunction) => {
    if (llmToken) {
      const provided = req.headers['x-llm-token'];
      if (provided !== llmToken) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
    }
    next();
  });

  const llmProxyOptions: ProxyOptions = {
    target: llmTarget,
    changeOrigin: true,
    on: {
      proxyReq: (_proxyReq: ClientRequest, req: IncomingMessage) => {
        llmLogger.log(`→ ${req.method ?? 'UNKNOWN'} ${req.url ?? ''}`);
      },
      error: (
        err: Error,
        _req: IncomingMessage,
        res: ServerResponse | Socket,
      ) => {
        llmLogger.error(`Proxy error: ${err.message}`);
        if (res instanceof ServerResponse && !res.headersSent) {
          res.statusCode = 502;
          res.setHeader('content-type', 'application/json');
          res.end(
            JSON.stringify({
              error: 'llm_unreachable',
              detail: err.message,
            }),
          );
        }
      },
    },
  };

  app.use('/llm', createProxyMiddleware(llmProxyOptions));

  // Proxy WebSocket pour LiveKit
  // Permet de convertir WSS (Front) -> WS (LiveKit)
  const proxyLogger = new Logger('LiveKitProxy');

  app.use(
    '/livekit-proxy',
    createProxyMiddleware({
      target: process.env.LK_HOST || 'http://localhost:7880', // URL du serveur LiveKit
      ws: true, // Active le support WebSocket
      changeOrigin: true,
      pathRewrite: {
        '^/livekit-proxy': '', // Enlever le préfixe lors du transfert
      },
      // @ts-ignore - Type mismatch in library but valid option
      onProxyReqWs: (_proxyReq: any, req: any, _socket: any) => {
        proxyLogger.log(`🔌 WebSocket connection request: ${req.url}`);
        proxyLogger.log(
          `🎯 Target: ${process.env.LK_HOST || 'http://localhost:7880'}`,
        );
        proxyLogger.debug(`📋 Headers: ${JSON.stringify(req.headers)}`);
      },
      onOpen: (_proxySocket: any) => {
        proxyLogger.log('✅ WebSocket connection opened to LiveKit');
      },
      onClose: (_res: any, _socket: any, _head: any) => {
        proxyLogger.log('🔌 WebSocket connection closed');
      },
      onError: (err: any, _req: any, _res: any) => {
        proxyLogger.error(`❌ Proxy Error: ${err.message}`);
        proxyLogger.error(`❌ Error stack: ${err.stack}`);
      },
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
}
void bootstrap();
