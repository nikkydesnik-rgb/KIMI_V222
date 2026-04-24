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
import { base64ToArrayBuffer, fillDocxTemplate, getKeyHint, toSnakeCase } from '@/utils/docxParser';
import { createDocxPreviewUrl, downloadDocx } from '@/utils/docxPreview';
import { Plus, Trash2, ExternalLink, Upload, X, Eye, FileDown } from 'lucide-react';
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
  const [previewActId, setPreviewActId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Get non-AOSR templates
  const otherTemplates = templates.filter((t) => t.type === 'other');

  const renderTemplate = async (templateData: ArrayBuffer, data: Record<string, string>) => {
    // Use local render (docxtemplater in browser)
    return fillDocxTemplate(templateData, data);
  };

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

  /**
   * Preview act as HTML (DOCX cannot be displayed directly in browsers)
   */
  const handlePreview = async (actId: string) => {
    // Close previous preview
    closePreview();

    const act = otherActs.find((a) => a.id === actId);
    if (!act) return;

    const template = templates.find((t) => t.id === act.templateId);
    if (!template) {
      toast.error('Шаблон не найден');
      return;
    }

    try {
      const templateData = base64ToArrayBuffer(template.fileData);
      
      // Merge data: permanent data + act-specific values
      const data = {
        ...permanentData,
        ...act.values,
      };
      
      const filled = await renderTemplate(templateData, data);
      
      // Convert to HTML for preview
      const url = createDocxPreviewUrl(filled);
      
      setPreviewUrl(url);
      setPreviewActId(actId);
    } catch (error) {
      console.error('Preview error:', error);
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (message.includes('local-render-server-unavailable')) {
        toast.error('Локальный рендер-сервер не запущен. Запустите: python backend_render.py');
      } else
      if (message.includes('valid zip file')) {
        toast.error('Шаблон повреждён или сохранён в старом формате. Удалите шаблон и загрузите DOCX заново.');
      } else {
        toast.error('Ошибка формирования предпросмотра');
      }
    }
  };

  const closePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setPreviewActId(null);
  };

  /**
   * Fill template and download as DOCX
   */
  const handleFillTemplate = async (actId: string) => {
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
      const filled = await renderTemplate(templateData, data);

      downloadDocx(filled, `${template.name}_${actId.slice(0, 8)}.docx`);
      toast.success('Акт сформирован и скачан');
    } catch (error) {
      console.error('Download error:', error);
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (message.includes('local-render-server-unavailable')) {
        toast.error('Локальный рендер-сервер не запущен. Запустите: python backend_render.py');
      } else
      if (message.includes('valid zip file')) {
        toast.error('Шаблон повреждён или сохранён в старом формате. Удалите шаблон и загрузите DOCX заново.');
      } else {
        toast.error('Ошибка формирования акта');
      }
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
              Загрузите шаблоны на вкладке &quot;Постоянные данные&quot; (тип &quot;Иной акт&quot;)
            </p>
          )}
        </CardContent>
      </Card>

      {/* Preview Panel - shows filled DOCX as HTML */}
      {previewUrl && previewActId && (
        <Card className="border-blue-300 shadow-lg">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-600" />
              Предпросмотр: {otherActs.find(a => a.id === previewActId)?.templateName || 'Акт'}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleFillTemplate(previewActId)}
                className="gap-1"
              >
                <FileDown className="h-4 w-4" />
                Скачать DOCX
              </Button>
              <Button variant="ghost" size="sm" onClick={closePreview}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <iframe
              src={previewUrl}
              className="w-full h-[600px] border rounded-lg bg-white"
              title="Предпросмотр акта"
              sandbox="allow-same-origin"
            />
          </CardContent>
        </Card>
      )}

      {/* Acts List */}
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

                {/* Act-specific fields */}
                {actOnlyKeys.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-medium text-gray-500 uppercase">
                      Поля акта
                    </h4>
                    {actOnlyKeys.map((key) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-xs">
                          {key}
                          {getKeyHint(key) && (
                            <span className="text-gray-400 ml-1">
                              ({getKeyHint(key)})
                            </span>
                          )}
                        </Label>
                        <Input
                          value={act.values[key] || ''}
                          onChange={(e) =>
                            updateOtherAct(act.id, {
                              values: { ...act.values, [key]: e.target.value },
                            })
                          }
                          placeholder={`Введите ${key}...`}
                          className="h-8 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* File upload for completed act */}
                <div className="pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <label className="flex-1">
                      <input
                        type="file"
                        onChange={(e) => handleFileUpload(act.id, e)}
                        className="hidden"
                      />
                      <div className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 cursor-pointer">
                        <Upload className="h-4 w-4" />
                        {act.fileName || 'Загрузить выполненный акт'}
                      </div>
                    </label>
                    {act.fileName && (
                      <span className="text-xs text-gray-500">{act.fileName}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
