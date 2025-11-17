# Diagnóstico del stream SYMBOL@trade

## 1) Registro del handler de mensajes
- `openTradeStream` solamente crea un `WebSocket` y lo guarda en `tradeStreams` sin registrar ningún listener (`onmessage`, `on`, `addEventListener`). No hay flujo que conecte ese socket con el algoritmo de trades. 【F:src/trading/trading.service.ts†L296-L308】
- No existe otra función que añada manejadores al `WebSocket` de trades luego de la apertura. Una vez almacenado, no se vuelve a configurar.

## 2) Parseo del mensaje recibido
- Debido a que no hay ningún handler asociado al `WebSocket` de trades, no se ejecuta ningún `JSON.parse` ni acceso a campos `s/p/q/m`. El código nunca intenta leer `msg` porque ningún callback se dispara.

## 3) Ejecución del algoritmo personalizado del trade
- El algoritmo reside en `handleTradeOrder`, que espera recibir un objeto ya parseado y contiene los logs solicitados. 【F:src/trading/trading.service.ts†L119-L156】
- Ninguna parte del código llama a `handleTradeOrder` desde el stream `@trade`. `handleEvent` solo enruta eventos provenientes del user data stream (`executionReport`), no del stream público de trades. Por tanto, el algoritmo nunca se ejecuta.

## 4) Ubicación de los logs
- Los logs están dentro de `handleTradeOrder`. 【F:src/trading/trading.service.ts†L119-L156】
- Como el WebSocket de trades no invoca esta función, los logs no se imprimen aunque el socket figure como conectado.

## 5) Referencias y almacenamiento de WebSocket
- `openTradeStream` guarda la instancia en `tradeStreams` pero no la usa después. No hay riesgo de sobrescritura observado, pero el socket queda sin listeners y sin vínculo con el manejador. 【F:src/trading/trading.service.ts†L296-L308】
- `getStreamsStatus` marca `trades: true` cuando `tradeStreams` tiene un registro, aunque el socket no procese mensajes, por eso `/streams` reporta conexiones sin que haya logs. 【F:src/trading/trading.service.ts†L326-L339】

## Conclusión
Los sockets `SYMBOL@trade` se abren y se reportan como conectados, pero no tienen ningún handler de mensajes registrado ni se enlazan con `handleTradeOrder`. Por ello no se parsean los mensajes, no se ejecuta la lógica personalizada y no aparecen los logs cuando Binance envía trades.
