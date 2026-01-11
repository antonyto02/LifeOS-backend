import axios, { AxiosRequestConfig } from 'axios';

const BINANCE_HOSTS = new Set(['api.binance.com']);
let loggerRegistered = false;

const buildRequestUrl = (config: AxiosRequestConfig): string => {
  if (config.baseURL) {
    try {
      return new URL(config.url ?? '', config.baseURL).toString();
    } catch {
      return `${config.baseURL}${config.url ?? ''}`;
    }
  }

  return config.url ?? '';
};

const isBinanceRequest = (url: string): boolean => {
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return BINANCE_HOSTS.has(parsed.host);
  } catch {
    return url.includes('api.binance.com');
  }
};

export const registerBinanceRequestLogger = (): void => {
  if (loggerRegistered) {
    return;
  }

  axios.interceptors.request.use((config) => {
    const requestUrl = buildRequestUrl(config);

    if (isBinanceRequest(requestUrl)) {
      const method = config.method?.toUpperCase() ?? 'GET';
      console.log(`[binance] ${method} ${requestUrl}`);
    }

    return config;
  });

  loggerRegistered = true;
};
