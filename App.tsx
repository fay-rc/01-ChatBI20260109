
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import FileUploader from './components/FileUploader';
import DataDashboard from './components/DataDashboard';
import ChatPanel from './components/ChatPanel';
import Sidebar from './components/Sidebar';
import { FileData, StepAnalysis, SheetData } from './types';
import { analyzeSingleStep } from './services/geminiService';

const App: React.FC = () => {
  const [fileDatas, setFileDatas] = useState<FileData[] | null>(null);
  const [stepAnalyses, setStepAnalyses] = useState<StepAnalysis[]>([]);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  
  const [leftWidth, setLeftWidth] = useState(300);
  const [rightWidth, setRightWidth] = useState(380);
  
  const isResizingLeft = useRef(false);
  const isResizingRight = useRef(false);
  
  const [selectedSheetsMap, setSelectedSheetsMap] = useState<Map<number, Set<number>>>(new Map());

  const handleDataLoaded = useCallback((dataArray: FileData[]) => {
    setFileDatas(dataArray);
    const initialMap = new Map<number, Set<number>>();
    if (dataArray.length > 0) {
      initialMap.set(0, new Set([0]));
    }
    setSelectedSheetsMap(initialMap);
    setStepAnalyses([]);
  }, []);

  const activeSheets = useMemo(() => {
    if (!fileDatas) return [];
    const result: SheetData[] = [];
    selectedSheetsMap.forEach((indices, fIdx) => {
      indices.forEach(sIdx => {
        if (fileDatas[fIdx]) result.push(fileDatas[fIdx].sheets[sIdx]);
      });
    });
    return result;
  }, [fileDatas, selectedSheetsMap]);

  const executeStep = async (index: number, currentSteps: StepAnalysis[]) => {
    if (activeSheets.length === 0) return;

    const step = currentSteps[index];
    setStepAnalyses(prev => prev.map((s, i) => i === index ? { ...s, status: 'analyzing' } : s));

    try {
      const combinedSample = activeSheets.flatMap(s => s.rows.slice(0, 50));
      // FIX: Explicitly type combinedColumns as string[] to resolve inference issues where it might be seen as unknown[]
      const combinedColumns: string[] = Array.from(new Set(activeSheets.flatMap(s => s.columns)));
      
      const result = await analyzeSingleStep(step.title, step.description, combinedSample, combinedColumns);
      
      setStepAnalyses(prev => prev.map((s, i) => i === index ? { ...s, status: 'done', result } : s));
    } catch (error) {
      console.error(`Step ${index} analysis failed:`, error);
      setStepAnalyses(prev => prev.map((s, i) => i === index ? { ...s, status: 'error' } : s));
    }
  };

  const runAnalysis = async (customSteps?: string[]) => {
    if (!customSteps || customSteps.length === 0) return;

    // 解析 "Title: Description" 格式
    const initialSteps: StepAnalysis[] = customSteps.map((s, idx) => {
      const parts = s.split(':');
      const title = parts[0]?.trim() || `分析步骤 ${idx + 1}`;
      const description = parts.slice(1).join(':').trim() || s;
      return {
        id: `step-${Date.now()}-${idx}`,
        title,
        description,
        status: 'pending'
      };
    });

    setStepAnalyses(initialSteps);

    // 串行执行分析
    for (let i = 0; i < initialSteps.length; i++) {
      await executeStep(i, initialSteps);
    }
  };

  const handleReAnalyzeStep = async (id: string, newTitle: string, newDescription: string) => {
    const index = stepAnalyses.findIndex(s => s.id === id);
    if (index === -1) return;

    const updatedSteps = [...stepAnalyses];
    updatedSteps[index] = { 
      ...updatedSteps[index], 
      title: newTitle, 
      description: newDescription, 
      status: 'analyzing' 
    };
    setStepAnalyses(updatedSteps);

    await executeStep(index, updatedSteps);
  };

  const handleToggleSheet = (fileIdx: number, sheetIdx: number) => {
    const newMap = new Map<number, Set<number>>(selectedSheetsMap);
    const set = new Set<number>(newMap.get(fileIdx) || []);
    if (set.has(sheetIdx)) set.delete(sheetIdx);
    else set.add(sheetIdx);

    if (set.size === 0) newMap.delete(fileIdx);
    else newMap.set(fileIdx, set);
    
    setSelectedSheetsMap(newMap);
  };

  const handleToggleFile = (fileIdx: number) => {
    if (!fileDatas) return;
    const file = fileDatas[fileIdx];
    const newMap = new Map<number, Set<number>>(selectedSheetsMap);
    const currentlySelected = newMap.get(fileIdx) || new Set<number>();

    if (currentlySelected.size === file.sheets.length) {
      newMap.delete(fileIdx);
    } else {
      const allIndices = new Set<number>(file.sheets.map((_, i) => i));
      newMap.set(fileIdx, allIndices);
    }
    setSelectedSheetsMap(newMap);
  };

  const reset = () => {
    setFileDatas(null);
    setStepAnalyses([]);
    setSelectedSheetsMap(new Map());
    setSidebarVisible(true);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isResizingLeft.current) {
      const newWidth = e.clientX;
      if (newWidth > 150 && newWidth < 600) setLeftWidth(newWidth);
    }
    if (isResizingRight.current) {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 250 && newWidth < 800) setRightWidth(newWidth);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isResizingLeft.current = false;
    isResizingRight.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50 font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 h-16 flex-shrink-0 z-50">
        <div className="max-w-[1920px] mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 cursor-pointer group" onClick={reset}>
              <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2 rounded-xl transition-all group-hover:rotate-6 shadow-lg shadow-blue-200">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <h1 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 tracking-tight">数据分析师</h1>
            </div>
          </div>
          {fileDatas && (
            <button onClick={reset} className="text-xs font-bold text-slate-500 hover:text-blue-600 flex items-center gap-2 transition-all py-2 px-4 hover:bg-blue-50 rounded-xl border border-transparent hover:border-blue-100">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              重新上传
            </button>
          )}
        </div>
      </header>

      <main className="flex-grow flex overflow-hidden relative">
        {!fileDatas ? (
          <div className="w-full flex flex-col items-center justify-center px-4 py-10 text-center overflow-y-auto bg-white">
            <div className="space-y-6 mb-12 animate-in slide-in-from-bottom-8 duration-700 fill-mode-both">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-sm font-bold border border-blue-100">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                智能分析智能体
              </div>
              <h2 className="text-5xl sm:text-6xl font-black text-slate-900 tracking-tighter leading-tight">
                自然语言问数据，<br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">智能分析出结果</span>
              </h2>
              <p className="text-slate-500 text-xl max-w-2xl mx-auto font-medium">实时查询、智能解读、可视化呈现，一站式搞定</p>
            </div>
            <div className="w-full max-w-5xl bg-white rounded-[2.5rem] p-8 sm:p-14 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.12)] border border-slate-100 animate-in fade-in zoom-in duration-500 delay-300 fill-mode-both">
              <FileUploader onDataLoaded={handleDataLoaded} />
            </div>
          </div>
        ) : (
          <div className="w-full flex h-full overflow-hidden">
            <div className="flex shrink-0 relative h-full">
              {!sidebarVisible && (
                <div 
                  onClick={() => setSidebarVisible(true)}
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-20 bg-blue-600 text-white flex items-center justify-center rounded-r-lg cursor-pointer shadow-lg hover:w-8 transition-all z-40"
                  title="展开数据展示"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                </div>
              )}
              
              <Sidebar 
                fileDatas={fileDatas} 
                selectedSheets={selectedSheetsMap} 
                onToggleSheet={handleToggleSheet}
                onToggleFile={handleToggleFile}
                isVisible={sidebarVisible}
                onToggleVisibility={() => setSidebarVisible(!sidebarVisible)}
                width={leftWidth}
              />
              
              {sidebarVisible && (
                <div 
                  onMouseDown={() => { isResizingLeft.current = true; document.body.style.cursor = 'col-resize'; }}
                  className="w-1.5 h-full hover:bg-blue-400/30 cursor-col-resize transition-colors z-20 flex-shrink-0"
                />
              )}
            </div>

            <div className="flex-grow flex flex-col h-full overflow-hidden min-w-0">
              {stepAnalyses.length > 0 ? (
                <div className="w-full h-full overflow-y-auto bg-slate-50 animate-in fade-in duration-700">
                  <DataDashboard 
                    activeSheets={activeSheets} 
                    stepAnalyses={stepAnalyses} 
                    onReAnalyzeStep={handleReAnalyzeStep}
                  />
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-white">
                  <div className="p-12 bg-slate-50 rounded-[3rem] border border-dashed border-slate-200 max-w-md">
                    <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                       <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                    </div>
                    <p className="text-xl font-black text-slate-800">等待分析指令</p>
                    <p className="text-sm mt-3 text-slate-400 font-medium leading-relaxed">
                      请在左侧选择想要分析的数据，并在右侧对话框输入您的指令
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div 
              onMouseDown={() => { isResizingRight.current = true; document.body.style.cursor = 'col-resize'; }}
              className="w-1.5 h-full hover:bg-blue-400/30 cursor-col-resize transition-colors z-20 flex-shrink-0"
            />
            <div style={{ width: `${rightWidth}px` }} className="flex-shrink-0 h-full bg-white border-l border-slate-200">
              <ChatPanel 
                activeSheets={activeSheets} 
                onTriggerAnalysis={runAnalysis}
                hasAnalysis={stepAnalyses.length > 0}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
