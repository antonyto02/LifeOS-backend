import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { WsAdapter } from '@nestjs/platform-ws';
import { SnapshotGateway } from './investments/snapshot/snapshot.gateway';
import placeBuyOrder from './investments/bot/actions/placeBuyOrder';
import { registerBinanceRequestLogger } from './investments/utils/binance-request-logger';

const consoleMethods = ['log', 'info', 'warn', 'error', 'debug'] as const;

const registerConsoleTimestamp = () => {
  const originalConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
  };

  const getTimestamp = () => new Date().toISOString();

  consoleMethods.forEach((method) => {
    console[method] = (...args: unknown[]) => {
      originalConsole[method](`[${getTimestamp()}]`, ...args);
    };
  });
};

async function bootstrap() {
  registerConsoleTimestamp();
  registerBinanceRequestLogger();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  app.useWebSocketAdapter(new WsAdapter(app));

  app.enableCors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  });

  const snapshotGateway = app.get(SnapshotGateway);
  const httpServer = app.getHttpServer();
  snapshotGateway.bindServer(httpServer);

  await app.listen(3000, '0.0.0.0');

  // await placeBuyOrder();
}

bootstrap();
