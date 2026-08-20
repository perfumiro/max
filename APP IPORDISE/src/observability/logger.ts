type Context = Record<string, unknown>;

const sanitize = (context?: Context) => {
  if (!context) return undefined;
  return Object.fromEntries(Object.entries(context).map(([key, value]) => {
    if (/token|secret|password|authorization|apikey/i.test(key)) return [key, '[redacted]'];
    if (value instanceof Error) return [key, { name: value.name, message: value.message }];
    return [key, value];
  }));
};

export const logger = {
  info(event: string, context?: Context) {
    if (__DEV__) console.info(`[IPORDISE] ${event}`, sanitize(context));
  },
  warn(event: string, context?: Context) {
    if (__DEV__) console.warn(`[IPORDISE] ${event}`, sanitize(context));
  },
  error(event: string, error: unknown, context?: Context) {
    console.error(`[IPORDISE] ${event}`, sanitize({ ...context, error: error instanceof Error ? error : String(error) }));
  },
};
