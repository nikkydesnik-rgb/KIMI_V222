import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStore } from '@/store/useStore';
import { fillDocxTemplate, base64ToArrayBuffer, getKeyHint } from '@/utils/docxParser';
import { Plus, Trash2, FileDown, ExternalLink, Upload, X, Eye } from 'lucide-react';
import { toast } from 'sonner';

export function OtherActsTab() {
  const {
    templates,
    otherActs,
    permanentData,
    addOtherAct,
    updateOtherAct,
    removeOtherAct,
  } = useStore();

  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [previewAct, setPreviewAct] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Get non-AOSR templates
  const otherTemplates = templates.filter((t) => t.type === 'other');

  const handleAddAct = () => {
    if (!selectedTemplateId) {
      toast.error('Выберите шаблон');
      return;
    }

    addOtherAct({
      id: crypto.randomUUID(),
      templateId: selectedTemplateId,
      templateName: otherTemplates.find((t) => t.id === selectedTemplateId)?.name || '',
      values: {},
      file: null,
      fileName: '',
    });

    setSelectedTemplateId('');
    toast.success('Акт добавлен');
  };

  const handlePreview = (actId: string) => {
    const act = otherActs.find((a) => a.id === actId);
    if (!act) return;

    const template = templates.find((t) => t.id === act.templateId);
    if (!template) {
      toast.error('Шаблон не найден');
      return;
    }

    try {
      const templateData = base64ToArrayBuffer(template.fileData);
      const data = {
        ...permanentData,
        ...act.values,
      };
      const filled = fillDocxTemplate(templateData, data);

      const blob = new Blob([filled], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewAct(actId);
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

  const handleFillTemplate = (actId: string) => {
    const act = otherActs.find((a) => a.id === actId);
    if (!act) return;

    const template = templates.find((t) => t.id === act.templateId);
    if (!template) {
      toast.error('Шаблон не найден');
      return;
    }

    try {
      const templateData = base64ToArrayBuffer(template.fileData);
      const data = {
        ...permanentData,
        ...act.values,
      };
      const filled = fillDocxTemplate(templateData, data);

      // Create blob and download
      const blob = new Blob([filled], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${template.name}_${act.id}.docx`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('Акт сформирован и скачан');
    } catch (error) {
      toast.error('Ошибка формирования акта');
    }
  };

  const handleFileUpload = (actId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    updateOtherAct(actId, { file, fileName: file.name });
    toast.success('Файл загружен');
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Иные акты</h2>
          <p className="text-sm text-gray-500">
            Акты по шаблонам, отличным от АОСР
          </p>
        </div>
        <span className="text-sm text-gray-500">({otherActs.length} актов)</span>
      </div>

      {/* Add Act */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Добавить акт</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="template-select">Шаблон акта</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger id="template-select">
                  <SelectValue placeholder="Выберите шаблон" />
                </SelectTrigger>
                <SelectContent>
                  {otherTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} ({template.keys.length} ключей)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddAct} className="gap-2">
              <Plus className="h-4 w-4" />
              Добавить
            </Button>
          </div>
          {otherTemplates.length === 0 && (
            <p className="text-sm text-gray-500 mt-2">
              Загрузите шаблоны на вкладке "Постоянные данные" (тип "Иной акт")
            </p>
          )}
        </CardContent>
      </Card>

      {/* Preview Modal */}
      {previewUrl && previewAct && (
        <Card className="border-blue-300 shadow-lg">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-600" />
              Предпросмотр: {otherActs.find(a => a.id === previewAct)?.templateName || 'Акт'}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleFillTemplate(previewAct)}
              >
                <FileDown className="h-4 w-4 mr-1" />
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

      {/* Acts */}
      {otherActs.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileDown className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Нет актов. Добавьте первый акт выше.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {otherActs.map((act) => {
          const template = templates.find((t) => t.id === act.templateId);
          if (!template) return null;

          // Get keys that are not in permanent data
          const actOnlyKeys = template.keys.filter(
            (key) => !permanentData.hasOwnProperty(key)
          );

          return (
            <Card key={act.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePreview(act.id)}
                      className="gap-1"
                      title="Предпросмотр"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFillTemplate(act.id)}
                      className="gap-1"
                      title="Сформировать и скачать"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        removeOtherAct(act.id);
                        toast.success('Акт удален');
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-gray-500">{template.keys.length} ключей</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Permanent data values */}
                {template.keys
                  .filter((key) => permanentData.hasOwnProperty(key))
                  .length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-gray-500 uppercase">
                      Постоянные данные (заполнены)
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {template.keys
                        .filter((key) => permanentData.hasOwnProperty(key))
                        .map((key) => (
                          <div key={key} className="text-xs">
                            <span className="text-gray-500">{key}:</span>{' '}
                            <span className="text-gray-700">{permanentData[key]}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Act-specific keys */}
                {actOnlyKeys.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-gray-500 uppercase">
                      Ключи акта
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                      {actOnlyKeys.map((key) => (
                        <div key={key} className="space-y-1">
                          <Label className="text-xs" title={getKeyHint(key)}>
                            {key}
                            {getKeyHint(key) && (
                              <span className="text-gray-400 ml-1">(?)</span>
                            )}
                          </Label>
                          <Input
                            value={act.values[key] || ''}
                            onChange={(e) =>
                              updateOtherAct(act.id, {
                                values: { ...act.values, [key]: e.target.value },
                              })
                            }
                            placeholder={getKeyHint(key) || `Введите ${key}...`}
                            className="h-8 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* File upload */}
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-gray-500 uppercase">
                    Прикрепленный файл
                  </h4>
                  {act.file ? (
                    <div className="flex items-center gap-2">
                      <FileDown className="h-4 w-4 text-blue-600" />
                      <span className="text-sm text-gray-600 truncate max-w-[200px]">
                        {act.fileName}
                      </span>
                      <button
                        onClick={() =>
                          updateOtherAct(act.id, { file: null, fileName: '' })
                        }
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1">
                      <Upload className="h-3 w-3" />
                      Загрузить файл
                      <input
                        type="file"
                        onChange={(e) => handleFileUpload(act.id, e)}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
