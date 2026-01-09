
export interface DataRow {
  [key: string]: any;
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'scatter';
  title: string;
  xAxis: string;
  yAxis: string;
}

export interface StepResult {
  summary: string;
  insights: string[];
  charts: ChartConfig[];
}

export interface StepAnalysis {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'analyzing' | 'done' | 'error';
  result?: StepResult;
}

export interface AnalysisResult {
  summary: string;
  insights: string[];
  suggestedCharts: ChartConfig[];
}

export interface FieldCategorization {
  'ID Fields': string[];
  'Content Fields': string[];
  'Category Fields': string[];
  'Time Fields': string[];
  'Numeric Fields': string[];
  'Other Fields': string[];
}

export interface SheetData {
  name: string;
  rows: DataRow[];
  columns: string[];
  fieldCategorization: FieldCategorization;
}

export interface FileData {
  name: string;
  sheets: SheetData[];
  activeSheetIndex: number;
}
