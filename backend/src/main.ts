import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import { createProxyMiddleware } from 'http-proxy-middleware';

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

  // Proxy WebSocket pour LiveKit
  // Permet de convertir WSS (Front) -> WS (LiveKit)
  const proxyLogger = new Logger('LiveKitProxy');

  app.use(
    '/livekit-proxy',
    createProxyMiddleware({
      target: process.env.LK_HOST || 'http://100.68.221.26:7880', // URL du serveur LiveKit
      ws: true, // Active le support WebSocket
      changeOrigin: true,
      pathRewrite: {
        '^/livekit-proxy': '', // Enlever le préfixe lors du transfert
      },
      // @ts-ignore - Type mismatch in library but valid option
      onProxyReqWs: (_proxyReq: any, req: any, _socket: any) => {
         proxyLogger.log(`🔌 WebSocket connection request: ${req.url}`);
         proxyLogger.log(`🎯 Target: ${process.env.LK_HOST || 'http://100.68.221.26:7880'}`);
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
      }
    }),
  );

  await app.listen(3000, '0.0.0.0');
}
void bootstrap();
