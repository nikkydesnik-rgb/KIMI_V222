import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/store/useStore';
import { extractKeysFromDocx, arrayBufferToBase64, isAOSRKey, getKeyHint, toSnakeCase } from '@/utils/docxParser';
import { parseSPList } from '@/utils/spRules';
import { Upload, FileText, X, Calendar, BookOpen, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { toast } from 'sonner';

export function PermanentDataTab() {
  const {
    permanentData,
    templates,
    dateStart,
    dateEnd,
    spList,
    setPermanentData,
    setDateStart,
    setDateEnd,
    addTemplate,
    removeTemplate,
    setSPList,
  } = useStore();

  const [isDragging, setIsDragging] = useState(false);
  const [showKeyFormatHelp, setShowKeyFormatHelp] = useState(false);

  // Extract all unique keys from templates, excluding AOSR-specific keys
  const allKeys = useMemo(() => {
    const keys = new Set<string>();
    templates.forEach((template) => {
      const isAOSRTemplate = template.name.toLowerCase().includes('аоср') || 
                            template.name.toLowerCase().includes('aosr');
      template.keys.forEach((key) => {
        // Skip AOSR-specific keys only for AOSR templates
        if (isAOSRTemplate && isAOSRKey(key)) {
          return;
        }
        keys.add(key);
      });
    });
    return Array.from(keys).sort();
  }, [templates]);

  // Categorize keys
  const categorizedKeys = useMemo(() => {
    const categories: Record<string, string[]> = {
      'Объект': [],
      'Организация': [],
      'Действующие лица': [],
      'Прочее': [],
    };

    allKeys.forEach((key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('object') || lowerKey.includes('obj') || lowerKey.includes('объект')) {
        categories['Объект'].push(key);
      } else if (lowerKey.includes('org') || lowerKey.includes('организац') || lowerKey.includes('застройщик') || lowerKey.includes('подрядчик') || lowerKey.includes('заказчик') || lowerKey.includes('строитель') || lowerKey.includes('проектировщик')) {
        categories['Организация'].push(key);
      } else if (lowerKey.includes('должн') || lowerKey.includes('фио') || lowerKey.includes('предст') || lowerKey.includes('расп') || lowerKey.includes('субподр')) {
        categories['Действующие лица'].push(key);
      } else {
        categories['Прочее'].push(key);
      }
    });

    return categories;
  }, [allKeys]);

  // Check if any keys have spaces (potential reliability issues)
  const keysWithSpaces = useMemo(() => {
    return allKeys.filter(key => key.includes(' '));
  }, [allKeys]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      for (const file of files) {
        if (!file.name.endsWith('.docx')) {
          toast.error(`${file.name} - не DOCX файл`);
          continue;
        }

        try {
          const arrayBuffer = await file.arrayBuffer();
          const keys = extractKeysFromDocx(arrayBuffer);
          const base64 = arrayBufferToBase64(arrayBuffer);

          const type = file.name.toLowerCase().includes('аоср') || file.name.toLowerCase().includes('aosr')
            ? 'aosr'
            : 'other';

          addTemplate({
            id: crypto.randomUUID(),
            name: file.name.replace('.docx', ''),
            fileName: file.name,
            fileData: base64,
            keys,
            type,
          });

          const spaceWarning = keys.some(k => k.includes(' '))
            ? ' (Обнаружены ключи с пробелами — рекомендуется snake_case)'
            : '';

          toast.success(`Шаблон ${file.name} загружен (${keys.length} ключей)${spaceWarning}`);
        } catch {
          toast.error(`Ошибка загрузки ${file.name}`);
        }
      }

      e.target.value = '';
    },
    [addTemplate]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.name.endsWith('.docx')
      );

      for (const file of files) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const keys = extractKeysFromDocx(arrayBuffer);
          const base64 = arrayBufferToBase64(arrayBuffer);

          const type = file.name.toLowerCase().includes('аоср') || file.name.toLowerCase().includes('aosr')
            ? 'aosr'
            : 'other';

          addTemplate({
            id: crypto.randomUUID(),
            name: file.name.replace('.docx', ''),
            fileName: file.name,
            fileData: base64,
            keys,
            type,
          });

          toast.success(`Шаблон ${file.name} загружен (${keys.length} ключей)`);
        } catch {
          toast.error(`Ошибка загрузки ${file.name}`);
        }
      }
    },
    [addTemplate]
  );

  const handleSPFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const newSPList = parseSPList(text);
        if (newSPList.length === 0) {
          toast.error('Файл пуст или не содержит СП');
          return;
        }
        // Merge with existing, avoiding duplicates
        const merged = [...new Set([...spList, ...newSPList])];
        setSPList(merged);
        toast.success(`Загружено ${newSPList.length} СП`);
      } catch {
        toast.error('Ошибка чтения файла');
      }
      e.target.value = '';
    },
    [spList, setSPList]
  );

  const handleDateEndChange = (value: string) => {
    if (dateStart && value && new Date(value) < new Date(dateStart)) {
      toast.error('Дата окончания не может быть раньше даты начала');
      return;
    }
    setDateEnd(value);
  };

  const handleDateStartChange = (value: string) => {
    if (dateEnd && value && new Date(dateEnd) < new Date(value)) {
      toast.error('Дата начала не может быть позже даты окончания');
      return;
    }
    setDateStart(value);
  };

  return (
    <div className="space-y-6">
      {/* Session Info */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Постоянные данные</h2>
        <p className="text-sm text-gray-500">
          Заполните общие данные для всех актов
        </p>
      </div>

      {/* Date Range */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-blue-600" />
            Период выполнения работ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date-start">Дата начала работ</Label>
              <Input
                id="date-start"
                type="date"
                value={dateStart}
                onChange={(e) => handleDateStartChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-end">Дата окончания работ</Label>
              <Input
                id="date-end"
                type="date"
                value={dateEnd}
                onChange={(e) => handleDateEndChange(e.target.value)}
              />
            </div>
          </div>
          {dateStart && dateEnd && (
            <p className="text-xs text-gray-500 mt-2">
              Период: {new Date(dateStart).toLocaleDateString('ru-RU')} — {new Date(dateEnd).toLocaleDateString('ru-RU')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Template Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Upload className="h-5 w-5 text-blue-600" />
            Шаблоны документов
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-600 mb-2">
              Перетащите DOCX шаблоны сюда или
            </p>
            <label className="cursor-pointer">
              <span className="text-blue-600 hover:text-blue-700 font-medium">
                выберите файлы
              </span>
              <input
                type="file"
                multiple
                accept=".docx"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <p className="text-xs text-gray-400 mt-2">
              Поддерживаются ключи в форматах {'{{ключ}}'} и {'<ключ>'}
            </p>
          </div>

          {/* Key Format Help Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowKeyFormatHelp(!showKeyFormatHelp)}
            className="text-xs gap-1"
          >
            <Info className="h-3 w-3" />
            {showKeyFormatHelp ? 'Скрыть' : 'Показать'} рекомендации по формату ключей
          </Button>

          {/* Key Format Help Panel */}
          {showKeyFormatHelp && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-blue-900 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Рекомендуемые форматы ключей (100% надёжность)
              </h4>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <Badge variant="default" className="shrink-0 mt-0.5">Лучший</Badge>
                  <div>
                    <code className="bg-white px-2 py-0.5 rounded text-blue-700 font-mono">{'{{Объект_строительства}}'}</code>
                    <p className="text-blue-700 mt-0.5">snake_case — подчёркивания вместо пробелов</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <Badge variant="secondary" className="shrink-0 mt-0.5">Хороший</Badge>
                  <div>
                    <code className="bg-white px-2 py-0.5 rounded text-blue-700 font-mono">{'{{ОбъектСтроительства}}'}</code>
                    <p className="text-blue-700 mt-0.5">CamelCase — без пробелов и разделителей</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <Badge variant="secondary" className="shrink-0 mt-0.5">Хороший</Badge>
                  <div>
                    <code className="bg-white px-2 py-0.5 rounded text-blue-700 font-mono">{'{{obj_stroyka}}'}</code>
                    <p className="text-blue-700 mt-0.5">Латинская транслитерация с подчёркиванием</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-blue-200 pt-3">
                <h5 className="text-sm font-semibold text-amber-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Форматы с осторожностью
                </h5>
                <div className="mt-2 space-y-2 text-sm">
                  <div>
                    <code className="bg-white px-2 py-0.5 rounded text-amber-700 font-mono">{'{{Объект строительства}}'}</code>
                    <p className="text-amber-700 mt-0.5">
                      Пробелы внутри ключа могут вызвать разделение на части в Word. 
                      Работает в большинстве случаев, но не 100%.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-blue-200 pt-3 text-xs text-blue-600">
                <p>
                  <strong>Почему пробелы problematic:</strong> Word может разбить текст 
                  {'{{Объект строительства}}'} на несколько фрагментов в XML, 
                  и тогда ключ не будет найден. Подчёркивания Word не разбивает.
                </p>
                <p className="mt-1">
                  <strong>Таблицы:</strong> Ключи в таблицах поддерживаются во всех форматах.
                </p>
              </div>
            </div>
          )}

          {/* Warning for keys with spaces */}
          {keysWithSpaces.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-amber-800 font-medium">
                  Обнаружены ключи с пробелами ({keysWithSpaces.length}):
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {keysWithSpaces.map(key => (
                    <Badge key={key} variant="outline" className="text-amber-700 border-amber-300">
                      {key}
                    </Badge>
                  ))}
                </div>
                <p className="text-amber-600 mt-1 text-xs">
                  Рекомендуется заменить пробелы на подчёркивания в шаблоне Word.
                </p>
              </div>
            </div>
          )}

          {/* Templates List */}
          {templates.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700">
                Загруженные шаблоны ({templates.length})
              </h3>
              <div className="space-y-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium">{template.name}</p>
                        <p className="text-xs text-gray-500">
                          {template.keys.length} ключей |{' '}
                          {template.type === 'aosr' ? 'АОСР' : 'Иной акт'}
                        </p>
                        {/* Show extracted keys */}
                        {template.keys.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {template.keys.slice(0, 5).map((key) => (
                              <Badge 
                                key={key} 
                                variant="outline" 
                                className={`text-xs ${key.includes(' ') ? 'border-amber-300 text-amber-700' : 'text-gray-600'}`}
                              >
                                {key}
                              </Badge>
                            ))}
                            {template.keys.length > 5 && (
                              <Badge variant="outline" className="text-xs text-gray-400">
                                +{template.keys.length - 5}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        removeTemplate(template.id);
                        toast.success('Шаблон удален');
                      }}
                    >
                      <X className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Key Input Fields */}
      {allKeys.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-blue-600" />
              Значения ключей
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(categorizedKeys).map(
              ([category, keys]) =>
                keys.length > 0 && (
                  <div key={category} className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      {category}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {keys.map((key) => (
                        <div key={key} className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Label className="text-sm flex-1">
                              {key}
                              {key.includes(' ') && (
                                <span className="text-amber-500 ml-1" title="Ключ с пробелом — может быть ненадёжным">
                                  ⚠
                                </span>
                              )}
                            </Label>
                            {getKeyHint(key) && (
                              <span className="text-xs text-gray-400">
                                {getKeyHint(key)}
                              </span>
                            )}
                          </div>
                          <Input
                            value={permanentData[key] || ''}
                            onChange={(e) =>
                              setPermanentData(key, e.target.value)
                            }
                            placeholder={`Введите ${key}...`}
                            className={key.includes(' ') ? 'border-amber-300 focus-visible:ring-amber-200' : ''}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
