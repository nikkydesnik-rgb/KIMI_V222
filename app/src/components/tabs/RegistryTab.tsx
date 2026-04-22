import { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useStore } from '@/store/useStore';
import { generateFullPackagePDF, exportDOCX } from '@/utils/pdfGenerator';
import {
  BookOpen,
  RefreshCw,
  Package,
  FileText,
  GripVertical,
  Upload,
  X,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import type { RegistryEntry } from '@/types';

type StatusType = 'green' | 'yellow' | 'red';

export function RegistryTab() {
  const {
    registry,
    permanentData,
    currentSession,
    aosrActs,
    updateRegistryEntry,
    reorderRegistry,
    autoPopulateRegistry,
  } = useStore();

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [exportWithAppendices, setExportWithAppendices] = useState(true);

  const objectName = permanentData['Объект строительства'] || permanentData['object_name'] || permanentData['object'] || 'Не указан';

  const handleAutoPopulate = () => {
    autoPopulateRegistry();
    toast.success('Реестр обновлен');
  };

  const handleDragStart = (e: React.DragEvent, entry: RegistryEntry) => {
    setDraggingId(entry.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, entryId: string) => {
    e.preventDefault();
    if (entryId !== draggingId) {
      setDragOverId(entryId);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }

    const newRegistry = [...registry];
    const dragIndex = newRegistry.findIndex((r) => r.id === draggingId);
    const dropIndex = newRegistry.findIndex((r) => r.id === targetId);

    if (dragIndex === -1 || dropIndex === -1) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }

    const [removed] = newRegistry.splice(dragIndex, 1);
    newRegistry.splice(dropIndex, 0, removed);

    reorderRegistry(newRegistry);
    setDraggingId(null);
    setDragOverId(null);

    // Sync dates: for AOSR acts, update dates from registry order
    syncDatesFromRegistry(newRegistry);

    toast.success('Порядок изменен');
  };

  // Sync dates: registry end dates take priority and update AOSR acts
  const syncDatesFromRegistry = (entries: RegistryEntry[]) => {
    entries.forEach((entry) => {
      if (entry.fileType === 'act' && entry.id.startsWith('aosr-')) {
        const actId = entry.sourceId;
        const act = aosrActs.find((a) => a.id === actId);
        if (act && entry.endDate) {
          // Only update if registry has explicit end dates set
        }
      }
    });
  };

  const handleStatusChange = (entryId: string, status: StatusType) => {
    updateRegistryEntry(entryId, { status });
  };

  const handleGeneratePDF = async () => {
    if (!currentSession) return;
    if (registry.length === 0) {
      toast.error('Реестр пуст');
      return;
    }

    try {
      const pdfBytes = await generateFullPackagePDF(currentSession);
      const pdfArray = new Uint8Array(pdfBytes);
      const blob = new Blob([pdfArray.buffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentSession.name}_комплект.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Комплект документации сформирован');
    } catch {
      toast.error('Ошибка формирования PDF');
    }
  };

  const handleExportDOCX = async () => {
    if (!currentSession) return;
    try {
      await exportDOCX(currentSession, exportWithAppendices);
      toast.success('Экспорт завершен');
    } catch {
      toast.error('Ошибка экспорта');
    }
  };

  const handleFileUpload = useCallback(
    (entryId: string, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      updateRegistryEntry(entryId, {
        linkedFile: file,
        linkedFileName: file.name,
      });
      toast.success('Файл прикреплен');
      e.target.value = '';
    },
    [updateRegistryEntry]
  );

  const handleRemoveFile = (entryId: string) => {
    updateRegistryEntry(entryId, {
      linkedFile: null,
      linkedFileName: '',
    });
    toast.success('Файл откреплен');
  };

  const getStatusColor = (status: StatusType) => {
    switch (status) {
      case 'green':
        return 'bg-green-500';
      case 'yellow':
        return 'bg-yellow-500';
      case 'red':
        return 'bg-red-500';
    }
  };

  const getStatusLabel = (status: StatusType) => {
    switch (status) {
      case 'green':
        return 'Готово';
      case 'yellow':
        return 'В процессе';
      case 'red':
        return 'Не готов';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Реестр</h2>
          <span className="text-sm text-gray-500">({registry.length} записей)</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleAutoPopulate}
            variant="outline"
            className="gap-2"
            size="sm"
          >
            <RefreshCw className="h-4 w-4" />
            Обновить из актов
          </Button>
          <Button
            onClick={handleGeneratePDF}
            className="gap-2"
            size="sm"
          >
            <Package className="h-4 w-4" />
            Создать комплект PDF
          </Button>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={exportWithAppendices}
              onCheckedChange={(checked) =>
                setExportWithAppendices(checked === true)
              }
              id="export-appendices"
            />
            <label htmlFor="export-appendices" className="text-sm text-gray-600">
              С приложениями
            </label>
            <Button
              onClick={handleExportDOCX}
              variant="outline"
              className="gap-2"
              size="sm"
            >
              <Download className="h-4 w-4" />
              Экспорт DOCX
            </Button>
          </div>
        </div>
      </div>

      {/* Title */}
      <Card className="text-center py-8">
        <CardContent>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">РЕЕСТР</h1>
          <p className="text-lg text-gray-700">
            Объект: <span className="font-medium">{objectName}</span>
          </p>
        </CardContent>
      </Card>

      {/* Registry Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="px-2 py-3 w-8"></th>
                <th className="px-2 py-3 w-12">Статус</th>
                <th className="px-3 py-3 text-left font-medium text-gray-700 w-12">№ п/п</th>
                <th className="px-3 py-3 text-left font-medium text-gray-700 min-w-[250px]">Наименование документа</th>
                <th className="px-3 py-3 text-left font-medium text-gray-700 w-32">№ и дата</th>
                <th className="px-3 py-3 text-left font-medium text-gray-700 w-40">Организация</th>
                <th className="px-3 py-3 text-left font-medium text-gray-700 w-20">Листов</th>
                <th className="px-3 py-3 text-left font-medium text-gray-700 w-24">Лист по списку</th>
                <th className="px-3 py-3 text-left font-medium text-gray-700 min-w-[150px]">Файл</th>
              </tr>
            </thead>
            <tbody>
              {registry.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-12 text-center text-gray-500">
                    <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p>Реестр пуст. Нажмите "Обновить из актов" для автозаполнения.</p>
                  </td>
                </tr>
              )}
              {registry.map((entry, index) => (
                <tr
                  key={entry.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, entry)}
                  onDragOver={(e) => handleDragOver(e, entry.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, entry.id)}
                  className={`border-b transition-colors cursor-move ${
                    draggingId === entry.id
                      ? 'opacity-50 bg-blue-50'
                      : dragOverId === entry.id
                      ? 'bg-blue-50 border-blue-300'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="px-2 py-2">
                    <GripVertical className="h-4 w-4 text-gray-400" />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-col gap-1">
                      {(['green', 'yellow', 'red'] as StatusType[]).map((status) => (
                        <button
                          key={status}
                          onClick={() => handleStatusChange(entry.id, status)}
                          className={`w-5 h-5 rounded-full border-2 transition-all ${
                            entry.status === status
                              ? `${getStatusColor(status)} border-transparent scale-110`
                              : 'bg-white border-gray-300 hover:border-gray-400'
                          }`}
                          title={getStatusLabel(status)}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={entry.order}
                      onChange={(e) =>
                        updateRegistryEntry(entry.id, {
                          order: parseInt(e.target.value) || index + 1,
                        })
                      }
                      className="h-7 w-12 text-sm text-center"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={entry.documentName}
                      onChange={(e) =>
                        updateRegistryEntry(entry.id, {
                          documentName: e.target.value,
                        })
                      }
                      className="h-8 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={entry.docNumber}
                      onChange={(e) =>
                        updateRegistryEntry(entry.id, {
                          docNumber: e.target.value,
                        })
                      }
                      className="h-8 text-sm"
                      placeholder="№ и дата"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={entry.organization}
                      onChange={(e) =>
                        updateRegistryEntry(entry.id, {
                          organization: e.target.value,
                        })
                      }
                      className="h-8 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={entry.pageCount}
                      onChange={(e) =>
                        updateRegistryEntry(entry.id, {
                          pageCount: e.target.value,
                        })
                      }
                      className="h-8 w-16 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={entry.pageInList}
                      onChange={(e) =>
                        updateRegistryEntry(entry.id, {
                          pageInList: e.target.value,
                        })
                      }
                      className="h-8 w-20 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    {entry.linkedFile ? (
                      <div className="flex items-center gap-1">
                        <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                        <span className="text-xs text-gray-600 truncate max-w-[100px]">
                          {entry.linkedFileName}
                        </span>
                        <button
                          onClick={() => handleRemoveFile(entry.id)}
                          className="text-red-500 hover:text-red-700 flex-shrink-0"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer text-blue-600 hover:text-blue-700 text-xs flex items-center gap-1">
                        <Upload className="h-3 w-3" />
                        Загрузить
                        <input
                          type="file"
                          accept=".pdf,.docx"
                          onChange={(e) => handleFileUpload(entry.id, e)}
                          className="hidden"
                        />
                      </label>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Status Legend */}
      <div className="flex items-center gap-6 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-green-500" />
          <span>Готово</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-yellow-500" />
          <span>В процессе</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-red-500" />
          <span>Не готов</span>
        </div>
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-gray-400" />
          <span>Перетащите для изменения порядка</span>
        </div>
      </div>
    </div>
  );
}
