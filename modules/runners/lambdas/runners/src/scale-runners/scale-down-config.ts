import parser from 'cron-parser';
import moment from 'moment';

export type ScalingDownConfigList = ScalingDownConfig[];
export interface ScalingDownConfig {
  cron: string;
  idleCount: number;
  timeZone: string;
}

function inPeriod(period: ScalingDownConfig): boolean {
  const now = moment(new Date());
  const expr = parser.parseExpression(period.cron, {
    tz: period.timeZone,
  });
  const expr_second = expr.fields.second.toString();
  const expr_minute = expr.fields.minute.toString();
  const expr_hour = expr.fields.hour.toString();
  const expr_dayOfWeek = expr.fields.dayOfWeek.toString();
  const expr_dayOfMonth = expr.fields.dayOfMonth.toString();
  const expr_month = expr.fields.month.toString();

  const now_second = now.second().toString();
  const now_minute = now.minute().toString();
  const now_hour = now.hour().toString();
  const now_day = now.day().toString();
  const now_date = now.date().toString();
  const now_month = now.month().toString();

  return (
    expr_second.includes(now_second) &&
    expr_minute.includes(now_minute) &&
    expr_hour.includes(now_hour) &&
    expr_dayOfWeek.includes(now_day) &&
    expr_dayOfMonth.includes(now_date) &&
    expr_month.includes(now_month)
  );
}

export function getIdleRunnerCount(scalingDownConfigs: ScalingDownConfigList): number {
  for (const scalingDownConfig of scalingDownConfigs) {
    if (inPeriod(scalingDownConfig)) {
      return scalingDownConfig.idleCount;
    }
  }
  return 0;
}
