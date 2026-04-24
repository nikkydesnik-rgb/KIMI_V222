import React, { useState, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { base64ToArrayBuffer, fillDocxTemplate } from '@/utils/docxParser';
import { createDocxPreviewUrl } from '@/utils/docxPreview';
import { Calculator, Eye, Plus, Trash2, X, Maximize2, Minimize2, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const AOSRActsTab: React.FC = () => {
  const { 
    aosrActs, 
    updateAOSRAct, 
    addAOSRAct, 
    removeAOSRAct, 
    templates,
    materials,
    appendices,
    spList,
    permanentData,
    dateStart,
    dateEnd,
    includeMaterialDocs,
  } = useStore();

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editingActId, setEditingActId] = useState<string | null>(null);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showAppendixModal, setShowAppendixModal] = useState(false);
  const [showSPModal, setShowSPModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [deleteActId, setDeleteActId] = useState<string | null>(null);
  const [expandedCell, setExpandedCell] = useState<{actId: string, field: string} | null>(null);

  const acts = aosrActs;

  const handleAddRow = () => {
    const newNumber = acts.length > 0 ? Math.max(...acts.map(a => parseInt(a.act_number) || 0)) + 1 : 1;
    addAOSRAct({
      id: crypto.randomUUID(),
      act_number: newNumber.toString(),
      work_name: '',
      start_date: '',
      end_date: '',
      materials: [],
      appendices: [],
      sp: [],
      notes: '',
    });
  };

  const handleCalculateDates = () => {
    if (!dateStart || !dateEnd) {
      toast.error('Укажите даты начала и окончания работ');
      return;
    }
    
    const startDate = new Date(dateStart);
    const endDate = new Date(dateEnd);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const actsCount = acts.length;
    
    if (actsCount === 0) {
      toast.error('Добавьте хотя бы один акт');
      return;
    }

    const daysPerAct = Math.floor(totalDays / actsCount);
    
    acts.forEach((act, index) => {
      const actStart = new Date(startDate);
      actStart.setDate(actStart.getDate() + (index * daysPerAct));
      const actEnd = new Date(actStart);
      actEnd.setDate(actEnd.getDate() + daysPerAct - 1);
      
      updateAOSRAct(act.id, {
        start_date: actStart.toISOString().split('T')[0],
        end_date: actEnd.toISOString().split('T')[0],
      });
    });
    
    toast.success(`Даты рассчитаны для ${actsCount} актов`);
  };

  const handlePreview = async (actId: string) => {
    const act = acts.find(a => a.id === actId);
    if (!act) return;

    const template = templates.find(t => t.type === 'aosr');
    if (!template) {
      toast.error('Шаблон АОСР не найден');
      return;
    }

    try {
      const templateData = base64ToArrayBuffer(template.fileData);
      const materialTexts = act.materials?.map(id => {
        const m = materials.find(m => m.id === id);
        return m ? `${m.name} - ${m.quantity}${m.unit}` : '';
      }).filter(Boolean).join(', ');

      const appendixTexts = act.appendices?.map(id => {
        const a = appendices.find(a => a.id === id);
        return a?.name || '';
      }).filter(Boolean).join(', ');

      const data = {
        ...permanentData,
        act_number: act.act_number,
        work_name: act.work_name,
        start_date: act.start_date,
        end_date: act.end_date,
        materials: materialTexts || '',
        appendices: appendixTexts || '',
        sp: act.sp?.join(', ') || '',
        notes: act.notes || '',
      };

      const filled = fillDocxTemplate(templateData, data);
      const url = createDocxPreviewUrl(filled);
      setPreviewUrl(url);
      setShowPreview(true);
      toast.success('Предпросмотр готов');
    } catch (error) {
      console.error('Preview error:', error);
      toast.error('Ошибка формирования предпросмотра');
    }
  };

  const confirmDelete = (actId: string) => {
    setDeleteActId(actId);
  };

  const handleDelete = () => {
    if (deleteActId) {
      removeAOSRAct(deleteActId);
      setDeleteActId(null);
      toast.success('Акт удалён');
    }
  };

  const handleMaterialSelect = (actId: string, materialId: string) => {
    const act = acts.find(a => a.id === actId);
    if (!act) return;
    
    const currentMaterials = act.materials || [];
    const newMaterials = currentMaterials.includes(materialId)
      ? currentMaterials.filter(id => id !== materialId)
      : [...currentMaterials, materialId];
    
    updateAOSRAct(actId, { materials: newMaterials });
  };

  const handleAppendixSelect = (actId: string, appendixId: string) => {
    const act = acts.find(a => a.id === actId);
    if (!act) return;
    
    const currentAppendices = act.appendices || [];
    const newAppendices = currentAppendices.includes(appendixId)
      ? currentAppendices.filter(id => id !== appendixId)
      : [...currentAppendices, appendixId];
    
    updateAOSRAct(actId, { appendices: newAppendices });
  };

  const handleSPSelect = (actId: string, sp: string) => {
    const act = acts.find(a => a.id === actId);
    if (!act) return;
    
    const currentSP = act.sp || [];
    const newSP = currentSP.includes(sp)
      ? currentSP.filter(s => s !== sp)
      : [...currentSP, sp];
    
    updateAOSRAct(actId, { sp: newSP });
  };

  const getMaterialDisplay = (act: typeof acts[0]): string => {
    if (!act.materials?.length) return '—';
    return act.materials.map(id => {
      const m = materials.find(m => m.id === id);
      if (!m) return '';
      
      let result = `${m.name} - ${m.quantity}${m.unit}`;
      
      if (includeMaterialDocs && m.qualityDoc) {
        const prefix = m.qualityDoc.toLowerCase().includes('паспорт') ? 'от' : 'c/д';
        const datePart = m.expiryDate 
          ? ` ${prefix} ${new Date(m.expiryDate).toLocaleDateString('ru-RU')}г.` 
          : '';
        result += ` (${m.qualityDoc}${datePart})`;
      }
      
      return result;
    }).filter(Boolean).join(', ');
  };

  const getAppendixDisplay = (act: typeof acts[0]): string => {
    if (!act.appendices?.length) return '—';
    return act.appendices.map(id => {
      const a = appendices.find(a => a.id === id);
      return a?.name || '';
    }).filter(Boolean).join(', ');
  };

  const getSPDisplay = (act: typeof acts[0]): string => {
    if (!act.sp?.length) return '—';
    return act.sp.join(', ');
  };

  const closePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setShowPreview(false);
  };

  const adjustZoom = (delta: number) => {
    setZoom(prev => Math.max(50, Math.min(150, prev + delta)));
  };

  const toggleCellExpand = (actId: string, field: string) => {
    if (expandedCell?.actId === actId && expandedCell?.field === field) {
      setExpandedCell(null);
    } else {
      setExpandedCell({ actId, field });
    }
  };

  return (
    <div className={cn("p-2", fullscreen && "fixed inset-0 z-40 bg-gray-50")}>
      <div className="flex justify-between mb-2 gap-2 flex-wrap items-center">
        <h2 className="text-lg font-bold">Акты АОСР</h2>
        
        {fullscreen && (
          <div className="flex items-center gap-2 bg-white rounded px-2 py-1 shadow">
            <button onClick={() => adjustZoom(-10)} className="p-1 hover:bg-gray-100 rounded" title="Уменьшить">
              <ZoomOut size={16} />
            </button>
            <span className="text-sm min-w-[50px] text-center">{zoom}%</span>
            <button onClick={() => adjustZoom(10)} className="p-1 hover:bg-gray-100 rounded" title="Увеличить">
              <ZoomIn size={16} />
            </button>
            <button onClick={() => setZoom(100)} className="p-1 hover:bg-gray-100 rounded text-xs" title="Сброс">
              100%
            </button>
          </div>
        )}
        
        <div className="flex gap-2 flex-wrap">
          <button 
            onClick={handleCalculateDates}
            className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1 text-xs"
          >
            <Calculator size={14} />
            Даты
          </button>
          <button 
            onClick={handleAddRow}
            className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1 text-xs"
          >
            <Plus size={14} />
            Добавить
          </button>
          <button 
            onClick={() => setFullscreen(!fullscreen)}
            className={cn("px-2 py-1 rounded flex items-center gap-1 text-xs", fullscreen ? "bg-red-600 hover:bg-red-700 text-white" : "bg-gray-600 hover:bg-gray-700 text-white")}
          >
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      <div 
        className="overflow-auto"
        style={fullscreen ? { height: 'calc(100vh - 80px)' } : {}}
      >
        <div 
          style={fullscreen ? { transform: `scale(${zoom / 100})`, transformOrigin: 'top left' } : {}}
        >
          <table className="min-w-full bg-white border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-1 px-1 border text-xs w-10">#</th>
                <th className="py-1 px-1 border text-xs w-10">★</th>
                <th className="py-1 px-1 border text-xs w-12">№</th>
                <th className="py-1 px-1 border text-xs w-20">Начало</th>
                <th className="py-1 px-1 border text-xs w-20">Конец</th>
                <th className="py-1 px-1 border text-xs w-auto min-w-[200px]">Работы</th>
                <th className="py-1 px-1 border text-xs w-auto min-w-[200px]">Материалы</th>
                <th className="py-1 px-1 border text-xs w-32">Прилож.</th>
                <th className="py-1 px-1 border text-xs w-24">СП</th>
                <th className="py-1 px-1 border text-xs w-10">✕</th>
              </tr>
            </thead>
            <tbody>
              {acts.map((act, index) => (
                <tr key={act.id}>
                  <td className="py-1 px-1 border text-center text-xs">{index + 1}</td>
                  <td className="py-1 px-1 border text-center">
                    <button 
                      onClick={() => handlePreview(act.id)}
                      className="text-green-600 hover:text-green-800 p-1"
                      title="Предпросмотр"
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                  <td className="py-1 px-1 border">
                    <input 
                      type="text" 
                      value={act.act_number}
                      onChange={(e) => updateAOSRAct(act.id, { act_number: e.target.value })}
                      className="w-full p-1 border rounded text-xs"
                    />
                  </td>
                  <td className="py-1 px-1 border">
                    <input 
                      type="date" 
                      value={act.start_date}
                      onChange={(e) => updateAOSRAct(act.id, { start_date: e.target.value })}
                      className="w-full p-1 border rounded text-xs"
                    />
                  </td>
                  <td className="py-1 px-1 border">
                    <input 
                      type="date" 
                      value={act.end_date}
                      onChange={(e) => updateAOSRAct(act.id, { end_date: e.target.value })}
                      className="w-full p-1 border rounded text-xs"
                    />
                  </td>
                  <td className="py-1 px-1 border relative">
                    <div className="flex">
                      <textarea 
                        value={act.work_name}
                        onChange={(e) => updateAOSRAct(act.id, { work_name: e.target.value })}
                        className="w-full p-1 border rounded text-xs resize-none"
                        rows={expandedCell?.actId === act.id && expandedCell?.field === 'work' ? 4 : 2}
                        onClick={() => toggleCellExpand(act.id, 'work')}
                      />
                      {act.work_name.length > 50 && (
                        <button 
                          onClick={() => toggleCellExpand(act.id, 'work')}
                          className="absolute right-1 top-1 text-gray-400 hover:text-gray-600"
                        >
                          <Maximize size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="py-1 px-1 border relative">
                    <div className="flex">
                      <textarea 
                        value={getMaterialDisplay(act)}
                        onClick={() => { setEditingActId(act.id); setShowMaterialModal(true); }}
                        readOnly
                        className="w-full p-1 border rounded text-xs resize-none cursor-pointer bg-blue-50 hover:bg-blue-100"
                        rows={expandedCell?.actId === act.id && expandedCell?.field === 'materials' ? 4 : 2}
                        onFocus={() => toggleCellExpand(act.id, 'materials')}
                      />
                      {getMaterialDisplay(act).length > 30 && (
                        <button 
                          onClick={() => toggleCellExpand(act.id, 'materials')}
                          className="absolute right-1 top-1 text-gray-400 hover:text-gray-600"
                          title="Увеличить"
                        >
                          <Maximize size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="py-1 px-1 border">
                    <textarea 
                      value={getAppendixDisplay(act)}
                      onClick={() => { setEditingActId(act.id); setShowAppendixModal(true); }}
                      readOnly
                      className="w-full p-1 border rounded text-xs resize-none cursor-pointer bg-blue-50 hover:bg-blue-100"
                      rows={2}
                      title="Нажмите для выбора приложений"
                    />
                  </td>
                  <td className="py-1 px-1 border">
                    <textarea 
                      value={getSPDisplay(act)}
                      onClick={() => { setEditingActId(act.id); setShowSPModal(true); }}
                      readOnly
                      className="w-full p-1 border rounded text-xs resize-none cursor-pointer bg-blue-50 hover:bg-blue-100"
                      rows={2}
                      title="Нажмите для выбора СП"
                    />
                  </td>
                  <td className="py-1 px-1 border text-center">
                    {deleteActId === act.id ? (
                      <div className="flex gap-1 justify-center">
                        <button 
                          onClick={handleDelete}
                          className="text-green-600 hover:text-green-800 text-xs px-1 font-bold"
                          title="Подтвердить"
                        >
                          ✓
                        </button>
                        <button 
                          onClick={() => setDeleteActId(null)}
                          className="text-gray-500 hover:text-gray-700 text-xs px-1"
                          title="Отмена"
                        >
                          ✗
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => confirmDelete(act.id)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Удалить"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && previewUrl && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-3 rounded-lg w-full max-w-5xl max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold">Предпросмотр</h3>
              <button onClick={closePreview} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <iframe src={previewUrl} className="w-full h-[70vh]" title="Preview" />
          </div>
        </div>
      )}

      {/* Material Selection Modal */}
      {showMaterialModal && editingActId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg max-w-md w-full max-h-[80vh] overflow-auto">
            <h3 className="font-bold mb-2">Выберите материалы</h3>
            <div className="space-y-1 max-h-60 overflow-auto">
              {materials.length === 0 ? (
                <p className="text-gray-500">Нет материалов</p>
              ) : (
                materials.map(m => {
                  const act = acts.find(a => a.id === editingActId);
                  const isSelected = act?.materials?.includes(m.id);
                  return (
                    <label key={m.id} className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleMaterialSelect(editingActId, m.id)}
                      />
                      <span className="text-sm">{m.name} — {m.quantity}{m.unit}</span>
                    </label>
                  );
                })
              )}
            </div>
            <button 
              onClick={() => { setShowMaterialModal(false); setEditingActId(null); }}
              className="mt-3 px-3 py-1 bg-gray-200 rounded text-sm"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {/* Appendix Selection Modal */}
      {showAppendixModal && editingActId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg max-w-md w-full max-h-[80vh] overflow-auto">
            <h3 className="font-bold mb-2">Выберите приложения</h3>
            <div className="space-y-1 max-h-60 overflow-auto">
              {appendices.length === 0 ? (
                <p className="text-gray-500">Нет приложений</p>
              ) : (
                appendices.map(a => {
                  const act = acts.find(ac => ac.id === editingActId);
                  const isSelected = act?.appendices?.includes(a.id);
                  return (
                    <label key={a.id} className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleAppendixSelect(editingActId, a.id)}
                      />
                      <span className="text-sm">{a.name}</span>
                    </label>
                  );
                })
              )}
            </div>
            <button 
              onClick={() => { setShowAppendixModal(false); setEditingActId(null); }}
              className="mt-3 px-3 py-1 bg-gray-200 rounded text-sm"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {/* SP Selection Modal */}
      {showSPModal && editingActId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg max-w-md w-full max-h-[80vh] overflow-auto">
            <h3 className="font-bold mb-2">Выберите СП</h3>
            <div className="space-y-1 max-h-60 overflow-auto">
              {spList.map(sp => {
                const act = acts.find(a => a.id === editingActId);
                const isSelected = act?.sp?.includes(sp);
                return (
                  <label key={sp} className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSPSelect(editingActId, sp)}
                    />
                    <span className="text-sm">{sp}</span>
                  </label>
                );
              })}
            </div>
            <button 
              onClick={() => { setShowSPModal(false); setEditingActId(null); }}
              className="mt-3 px-3 py-1 bg-gray-200 rounded text-sm"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
};