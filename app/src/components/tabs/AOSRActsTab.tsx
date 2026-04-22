import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { useStore } from '@/store/useStore';
import { calculateActDates, formatDateRu } from '@/utils/dateCalc';
import { suggestSP } from '@/utils/spRules';
import { fillDocxTemplate, base64ToArrayBuffer, formatMaterialForAct } from '@/utils/docxParser';
import { Plus, Trash2, Calculator, Eye, Calendar, ChevronDown, X } from 'lucide-react';
import { toast } from 'sonner';
import type { AOSRAct } from '@/types';

export function AOSRActsTab() {
  const {
    aosrActs,
    templates,
    materials,
    appendices,
    spList,
    dateStart,
    dateEnd,
    permanentData,
    addAOSRAct,
    updateAOSRAct,
    removeAOSRAct,
  } = useStore();

  const [previewRange, setPreviewRange] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; actId: string } | null>(null);
  const [previewAct, setPreviewAct] = useState<AOSRAct | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Get AOSR templates
  const aosrTemplates = templates.filter((t) => t.type === 'aosr');

  const handleAddRow = () => {
    const newNumber = aosrActs.length > 0
      ? Math.max(...aosrActs.map((a) => a.actNumber)) + 1
      : 1;

    addAOSRAct({
      id: crypto.randomUUID(),
      actNumber: newNumber,
      workName: '',
      startDate: '',
      endDate: '',
      materials: [],
      includeMaterialDocs: false,
      appendices: [],
      sp: '',
      templateId: aosrTemplates[0]?.id || '',
      notes: '',
    });
  };

  const handleCalculateDates = () => {
    if (!dateStart || !dateEnd) {
      toast.error('Установите даты начала и окончания работ на вкладке "Постоянные данные"');
      return;
    }

    if (aosrActs.length === 0) {
      toast.error('Добавьте акты для расчета дат');
      return;
    }

    // Validate: end date must be >= start date
    if (new Date(dateEnd) < new Date(dateStart)) {
      toast.error('Дата окончания работ не может быть раньше даты начала');
      return;
    }

    const dates = calculateActDates(dateStart, dateEnd, aosrActs.length);

    dates.forEach((dateRange, index) => {
      const act = aosrActs[index];
      if (act) {
        updateAOSRAct(act.id, {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        });
      }
    });

    toast.success('Даты рассчитаны');
  };

  const handleWorkNameChange = (actId: string, value: string) => {
    const act = aosrActs.find((a) => a.id === actId);
    if (act) {
      const sp = suggestSP(value);
      updateAOSRAct(actId, {
        workName: value,
        sp: sp || act.sp,
      });
    }
  };

  const handleContextMenu = (e: React.MouseEvent, actId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, actId });
  };

  const handleDeleteRow = (actId: string) => {
    removeAOSRAct(actId);
    setContextMenu(null);
    toast.success('Строка удалена');
  };

  const handleDateChange = (actId: string, field: 'startDate' | 'endDate', value: string) => {
    const act = aosrActs.find((a) => a.id === actId);
    if (!act) return;

    if (field === 'endDate' && act.startDate && value) {
      if (new Date(value) < new Date(act.startDate)) {
        toast.error('Дата окончания не может быть раньше даты начала');
        return;
      }
    }
    if (field === 'startDate' && act.endDate && value) {
      if (new Date(act.endDate) < new Date(value)) {
        toast.error('Дата начала не может быть позже даты окончания');
        return;
      }
    }

    updateAOSRAct(actId, { [field]: value });
  };

  // Get highlighted dates
  const highlightedDates = (() => {
    const dates = new Set<string>();
    aosrActs.forEach((act) => {
      if (act.startDate) dates.add(act.startDate);
      if (act.endDate) dates.add(act.endDate);
    });
    return dates;
  })();

  const handlePreview = () => {
    const range = previewRange.trim();
    if (!range) {
      toast.error('Укажите диапазон (например 1-3)');
      return;
    }

    const [start, end] = range.split('-').map(s => parseInt(s.trim()));
    if (isNaN(start) || isNaN(end) || start > end) {
      toast.error('Неверный диапазон');
      return;
    }

    const act = aosrActs[start - 1];
    if (!act) {
      toast.error('Акт не найден');
      return;
    }

    const template = templates.find(t => t.id === act.templateId);
    if (!template) {
      toast.error('Шаблон не найден');
      return;
    }

    try {
      const templateData = base64ToArrayBuffer(template.fileData);
      
      // Build material strings with quantity, unit, optional docs
      const materialObjects = act.materials
        .map((id) => materials.find((m) => m.id === id))
        .filter(Boolean);
      
      const materialStrings = materialObjects.map((m) =>
        m ? formatMaterialForAct(m, act.includeMaterialDocs) : ''
      ).filter(Boolean);

      // Build appendix strings
      const appendixObjects = act.appendices
        .map((id) => appendices.find((a) => a.id === id))
        .filter(Boolean);
      const appendixStrings = appendixObjects.map((a) => a?.name || '').filter(Boolean);

      const data = {
        ...permanentData,
        act_number: act.actNumber.toString(),
        work_name: act.workName,
        start_date: formatDateRu(act.startDate),
        end_date: formatDateRu(act.endDate),
        materials: materialStrings.join(', '),
        appendices: appendixStrings.join(', '),
        sp: act.sp,
        notes: act.notes,
      };

      const filled = fillDocxTemplate(templateData, data);

      const blob = new Blob([filled], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewAct(act);
    } catch (error) {
      console.error('Preview error:', error);
      toast.error('Ошибка формирования предпросмотра');
    }
  };

  const closePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setPreviewAct(null);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold text-gray-900">Акты АОСР</h2>
          <span className="text-sm text-gray-500">({aosrActs.length} актов)</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleAddRow} className="gap-2" size="sm">
            <Plus className="h-4 w-4" />
            Добавить строку
          </Button>
          <Button
            onClick={handleCalculateDates}
            variant="outline"
            className="gap-2"
            size="sm"
          >
            <Calculator className="h-4 w-4" />
            Рассчитать даты
          </Button>
          <Button
            onClick={() => setShowCalendar(!showCalendar)}
            variant="outline"
            className="gap-2"
            size="sm"
          >
            <Calendar className="h-4 w-4" />
            Календарь
          </Button>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Диапазон (1-3)"
              value={previewRange}
              onChange={(e) => setPreviewRange(e.target.value)}
              className="w-28 h-8 text-sm"
            />
            <Button onClick={handlePreview} variant="outline" size="sm" className="gap-1">
              <Eye className="h-4 w-4" />
              Предпросмотр
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar */}
      {showCalendar && (
        <CalendarView
          highlightedDates={highlightedDates}
          acts={aosrActs}
        />
      )}

      {/* Preview Modal */}
      {previewUrl && previewAct && (
        <Card className="border-blue-300 shadow-lg">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-600" />
              Предпросмотр: Акт АОСР №{previewAct.actNumber}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = previewUrl!;
                  a.download = `АОСР_${previewAct.actNumber}_${previewAct.workName.substring(0, 30)}.docx`;
                  a.click();
                }}
              >
                Скачать
              </Button>
              <Button variant="ghost" size="sm" onClick={closePreview}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <iframe
              src={previewUrl}
              className="w-full h-[600px] border rounded-lg"
              title="Предпросмотр акта"
            />
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card ref={tableRef}>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="px-3 py-2 text-left font-medium text-gray-700 w-16">№ акта</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700 min-w-[200px]">Наименование работ</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700 w-32">Начало</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700 w-32">Конец</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700 min-w-[180px]">Материалы</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700 min-w-[150px]">Приложения</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700 min-w-[200px]">СП</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700 w-36">Шаблон</th>
              </tr>
            </thead>
            <tbody>
              {aosrActs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                    Нет актов. Нажмите "Добавить строку" для создания.
                  </td>
                </tr>
              )}
              {aosrActs.map((act) => (
                <tr
                  key={act.id}
                  className="border-b hover:bg-gray-50 transition-colors"
                  onContextMenu={(e) => handleContextMenu(e, act.id)}
                >
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      value={act.actNumber}
                      onChange={(e) =>
                        updateAOSRAct(act.id, { actNumber: parseInt(e.target.value) || 0 })
                      }
                      className="h-8 w-14 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={act.workName}
                      onChange={(e) => handleWorkNameChange(act.id, e.target.value)}
                      placeholder="Наименование работ"
                      className="h-8 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="date"
                      value={act.startDate}
                      onChange={(e) => handleDateChange(act.id, 'startDate', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="date"
                      value={act.endDate}
                      onChange={(e) => handleDateChange(act.id, 'endDate', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <MaterialsDropdown
                      act={act}
                      materials={materials}
                      onChange={(materials, includeDocs) => {
                        updateAOSRAct(act.id, { 
                          materials,
                          includeMaterialDocs: includeDocs !== undefined ? includeDocs : act.includeMaterialDocs 
                        });
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <AppendicesDropdown
                      act={act}
                      appendices={appendices}
                      onChange={(appendices) =>
                        updateAOSRAct(act.id, { appendices })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <SPDropdown
                      value={act.sp}
                      spList={spList}
                      onChange={(sp) => updateAOSRAct(act.id, { sp })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={act.templateId}
                      onValueChange={(value) =>
                        updateAOSRAct(act.id, { templateId: value })
                      }
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Шаблон" />
                      </SelectTrigger>
                      <SelectContent>
                        {aosrTemplates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-50 bg-white border rounded-lg shadow-lg py-1 min-w-[150px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => handleDeleteRow(contextMenu.actId)}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Удалить строку
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Materials Dropdown Component
function MaterialsDropdown({
  act,
  materials,
  onChange,
}: {
  act: AOSRAct;
  materials: Array<{ id: string; name: string; quantity: string; unit: string; qualityDoc: string; expiryDate: string }>;
  onChange: (materials: string[], includeDocs?: boolean) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedMaterials = act.materials
    .map((id) => materials.find((m) => m.id === id))
    .filter(Boolean);

  const toggleMaterial = (materialId: string) => {
    const newMaterials = act.materials.includes(materialId)
      ? act.materials.filter((id) => id !== materialId)
      : [...act.materials, materialId];
    onChange(newMaterials);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left px-2 py-1.5 border rounded-md text-sm hover:border-gray-400 transition-colors flex items-center justify-between min-h-[32px] bg-white"
      >
        <span className="truncate text-gray-700">
          {selectedMaterials.length > 0
            ? `${selectedMaterials.length} материалов`
            : 'Выбрать...'}
        </span>
        <ChevronDown className="h-3 w-3 text-gray-400 flex-shrink-0" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 mt-1 w-80 bg-white border rounded-lg shadow-lg max-h-72 overflow-auto">
            <div className="p-2 border-b flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">Материалы</span>
              <button onClick={() => setIsOpen(false)}>
                <X className="h-3 w-3 text-gray-400" />
              </button>
            </div>
            {/* Include docs toggle */}
            <div className="p-2 border-b bg-gray-50">
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch
                  checked={act.includeMaterialDocs}
                  onCheckedChange={(checked) => onChange(act.materials, checked)}
                  className="data-[state=checked]:bg-blue-600"
                />
                <span className="text-xs text-gray-700">С документами о качестве</span>
              </label>
              <p className="text-[10px] text-gray-500 mt-1">
                Вкл: добавляет документ в скобках
              </p>
            </div>
            {materials.length === 0 && (
              <div className="p-3 text-sm text-gray-500 text-center">
                Нет материалов. Добавьте на вкладке "Материалы".
              </div>
            )}
            {materials.map((material) => (
              <label
                key={material.id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100"
              >
                <Checkbox
                  checked={act.materials.includes(material.id)}
                  onCheckedChange={() => toggleMaterial(material.id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{material.name}</p>
                  <p className="text-xs text-gray-500">
                    {material.quantity} {material.unit}
                    {material.qualityDoc ? ` | ${material.qualityDoc}` : ''}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </>
      )}

      {/* Selected materials display */}
      {selectedMaterials.length > 0 && (
        <div className="mt-1 text-xs text-gray-500 truncate max-w-[200px]">
          {selectedMaterials.map((m) =>
            m ? `${m.name} - ${m.quantity} ${m.unit}` : ''
          ).join(', ')}
        </div>
      )}
    </div>
  );
}

// Appendices Dropdown Component
function AppendicesDropdown({
  act,
  appendices,
  onChange,
}: {
  act: AOSRAct;
  appendices: Array<{ id: string; name: string; number: string }>;
  onChange: (appendices: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedAppendices = act.appendices
    .map((id) => appendices.find((a) => a.id === id))
    .filter(Boolean);

  const toggleAppendix = (appendixId: string) => {
    const newAppendices = act.appendices.includes(appendixId)
      ? act.appendices.filter((id) => id !== appendixId)
      : [...act.appendices, appendixId];
    onChange(newAppendices);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left px-2 py-1.5 border rounded-md text-sm hover:border-gray-400 transition-colors flex items-center justify-between min-h-[32px] bg-white"
      >
        <span className="truncate text-gray-700">
          {selectedAppendices.length > 0
            ? `${selectedAppendices.length} приложений`
            : 'Выбрать...'}
        </span>
        <ChevronDown className="h-3 w-3 text-gray-400 flex-shrink-0" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 mt-1 w-72 bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
            <div className="p-2 border-b flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">Приложения</span>
              <button onClick={() => setIsOpen(false)}>
                <X className="h-3 w-3 text-gray-400" />
              </button>
            </div>
            {appendices.length === 0 && (
              <div className="p-3 text-sm text-gray-500 text-center">
                Нет приложений. Добавьте на вкладке "Приложения".
              </div>
            )}
            {appendices.map((appendix) => (
              <label
                key={appendix.id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
              >
                <Checkbox
                  checked={act.appendices.includes(appendix.id)}
                  onCheckedChange={() => toggleAppendix(appendix.id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{appendix.name}</p>
                  <p className="text-xs text-gray-500">{appendix.number}</p>
                </div>
              </label>
            ))}
          </div>
        </>
      )}

      {selectedAppendices.length > 0 && (
        <div className="mt-1 text-xs text-gray-500 truncate">
          {selectedAppendices.map((a) => a?.name).join(', ')}
        </div>
      )}
    </div>
  );
}

// SP Dropdown Component with multi-select
function SPDropdown({
  value,
  spList,
  onChange,
}: {
  value: string;
  spList: string[];
  onChange: (sp: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [customSP, setCustomSP] = useState('');

  const selectedSPs = value ? value.split(', ').filter(Boolean) : [];

  const toggleSP = (sp: string) => {
    const newSPs = selectedSPs.includes(sp)
      ? selectedSPs.filter((s) => s !== sp)
      : [...selectedSPs, sp];
    onChange(newSPs.join(', '));
  };

  const addCustomSP = () => {
    if (!customSP.trim()) return;
    const newSPs = [...selectedSPs, customSP.trim()];
    onChange(newSPs.join(', '));
    setCustomSP('');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left px-2 py-1.5 border rounded-md text-sm hover:border-gray-400 transition-colors flex items-center justify-between min-h-[32px] bg-white"
      >
        <span className="truncate text-gray-700">
          {selectedSPs.length > 0
            ? `${selectedSPs.length} СП`
            : 'Выбрать СП...'}
        </span>
        <ChevronDown className="h-3 w-3 text-gray-400 flex-shrink-0" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 mt-1 w-80 bg-white border rounded-lg shadow-lg max-h-72 overflow-auto">
            <div className="p-2 border-b flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">Строительные правила (СП)</span>
              <button onClick={() => setIsOpen(false)}>
                <X className="h-3 w-3 text-gray-400" />
              </button>
            </div>
            {/* Custom SP input */}
            <div className="p-2 border-b bg-gray-50 flex gap-1">
              <Input
                value={customSP}
                onChange={(e) => setCustomSP(e.target.value)}
                placeholder="Добавить СП вручную"
                className="h-7 text-xs"
                onKeyDown={(e) => e.key === 'Enter' && addCustomSP()}
              />
              <Button size="sm" className="h-7 px-2" onClick={addCustomSP}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            {spList.length === 0 && (
              <div className="p-3 text-sm text-gray-500 text-center">
                СП не загружены.
              </div>
            )}
            {spList.map((sp) => (
              <label
                key={sp}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100"
              >
                <Checkbox
                  checked={selectedSPs.includes(sp)}
                  onCheckedChange={() => toggleSP(sp)}
                />
                <span className="text-xs truncate">{sp}</span>
              </label>
            ))}
          </div>
        </>
      )}

      {selectedSPs.length > 0 && (
        <div className="mt-1 text-xs text-gray-500 truncate max-w-[200px]">
          {selectedSPs.join(', ')}
        </div>
      )}
    </div>
  );
}

// Calendar View Component
function CalendarView({
  highlightedDates,
  acts,
}: {
  highlightedDates: Set<string>;
  acts: AOSRAct[];
}) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  const daysInMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0
  ).getDate();

  const firstDayOfWeek = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    1
  ).getDay();

  const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const getActsForDate = (dateStr: string) => {
    return acts.filter((act) => act.startDate === dateStr || act.endDate === dateStr);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Календарь работ</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={prevMonth}>&lt;</Button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </span>
            <Button variant="outline" size="sm" onClick={nextMonth}>&gt;</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
            <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
              {day}
            </div>
          ))}
          {Array.from({ length: adjustedFirstDay }, (_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isHighlighted = highlightedDates.has(dateStr);
            const dayActs = getActsForDate(dateStr);
            const isWeekend = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).getDay() === 0 ||
              new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).getDay() === 6;

            return (
              <div
                key={day}
                className={`text-center py-1.5 text-sm rounded-md relative ${
                  isWeekend ? 'bg-gray-100 text-gray-400' : ''
                } ${isHighlighted ? 'bg-blue-100 text-blue-800 font-medium' : ''}`}
                title={dayActs.map((a) => `Акт ${a.actNumber}: ${a.workName}`).join('\n')}
              >
                {day}
                {dayActs.length > 0 && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-0.5">
                    {dayActs.map((_, i) => (
                      <div key={i} className="w-1 h-1 rounded-full bg-blue-500" />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-blue-100" />
            <span>Дата работы</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-gray-100" />
            <span>Выходной</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
