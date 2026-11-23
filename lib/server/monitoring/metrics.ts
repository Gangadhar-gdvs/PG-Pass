import 'server-only';
import { logger } from './logger';

export function recordMetric(
  name: string,
  value: number,
  tags?: Record<string, string>
): void {
  logger.info(`Metric: ${name}`, {
    metric: name,
    value,
    tags,
    type: 'metric',
  });
}
