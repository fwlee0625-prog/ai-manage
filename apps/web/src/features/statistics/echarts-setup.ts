import { ComposeOption } from 'echarts/core';
import * as echarts from 'echarts/core';
import { LineChart, PieChart, LineSeriesOption, PieSeriesOption } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
  GridComponentOption,
  LegendComponentOption,
  TooltipComponentOption,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

/** 本页实际用到的 ECharts 能力集合，按需组合以控制打包体积。 */
export type EchartsOption = ComposeOption<
  LineSeriesOption | PieSeriesOption | GridComponentOption | LegendComponentOption | TooltipComponentOption
>;

// 模块加载即按需注册（幂等），保证任何入口 import 本文件后 echarts.init 可用。
echarts.use([LineChart, PieChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

export { echarts };
