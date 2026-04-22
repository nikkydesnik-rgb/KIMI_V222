import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStore } from '@/store/useStore';
import { Upload, Plus, Trash2, FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Appendix } from '@/types';

export function AppendicesTab() {
  const { appendices, addAppendix, updateAppendix, removeAppendix } = useStore();

  const [editingAppendix, setEditingAppendix] = useState<Appendix | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    number: '',
  });

  const handleAdd = () => {
    if (!formData.name.trim()) {
      toast.error('Введите название приложения');
      return;
    }

    addAppendix({
      id: crypto.randomUUID(),
      name: formData.name,
      number: formData.number,
      file: null,
      fileName: '',
    });

    setFormData({ name: '', number: '' });
    toast.success('Приложение добавлено');
  };

  const handleUpdate = () => {
    if (!editingAppendix) return;
    updateAppendix(editingAppendix.id, formData);
    setEditingAppendix(null);
    setFormData({ name: '', number: '' });
    toast.success('Приложение обновлено');
  };

  const handleEdit = (appendix: Appendix) => {
    setEditingAppendix(appendix);
    setFormData({
      name: appendix.name,
      number: appendix.number,
    });
  };

  const handleCancel = () => {
    setEditingAppendix(null);
    setFormData({ name: '', number: '' });
  };

  const handleFileUpload = useCallback(
    async (appendixId: string, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.name.toLowerCase().endsWith('.pdf')) {
        toast.error('Требуется PDF файл');
        return;
      }

      updateAppendix(appendixId, { file, fileName: file.name });
      toast.success('Файл загружен');
      e.target.value = '';
    },
    [updateAppendix]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent, appendixId: string) => {
      e.preventDefault();

      const file = e.dataTransfer.files[0];
      if (!file) return;

      if (!file.name.toLowerCase().endsWith('.pdf')) {
        toast.error('Требуется PDF файл');
        return;
      }

      updateAppendix(appendixId, { file, fileName: file.name });
      toast.success('Файл загружен');
    },
    [updateAppendix]
  );

  const handleRemoveFile = (appendixId: string) => {
    updateAppendix(appendixId, { file: null, fileName: '' });
    toast.success('Файл удален');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Приложения</h2>
          <p className="text-sm text-gray-500">
            Управление приложениями и схемами
          </p>
        </div>
        <span className="text-sm text-gray-500">({appendices.length} записей)</span>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {editingAppendix ? 'Редактировать приложение' : 'Добавить приложение'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="appendix-name">Название приложения</Label>
              <Input
                id="appendix-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Например: Схема прокладки кабеля"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appendix-number">№ / дата</Label>
              <Input
                id="appendix-number"
                value={formData.number}
                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                placeholder="Например: Сх-001 от 15.03.2026"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            {editingAppendix ? (
              <>
                <Button onClick={handleUpdate} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Обновить
                </Button>
                <Button variant="outline" onClick={handleCancel}>
                  Отмена
                </Button>
              </>
            ) : (
              <Button onClick={handleAdd} className="gap-2">
                <Plus className="h-4 w-4" />
                Добавить
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="px-4 py-3 text-left font-medium text-gray-700">Название</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">№ / дата</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Файл</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 w-24">Действия</th>
              </tr>
            </thead>
            <tbody>
              {appendices.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    Нет приложений. Добавьте первое приложение выше.
                  </td>
                </tr>
              )}
              {appendices.map((appendix) => (
                <tr
                  key={appendix.id}
                  className="border-b hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 font-medium">{appendix.name}</td>
                  <td className="px-4 py-3 text-gray-600">{appendix.number || '-'}</td>
                  <td className="px-4 py-3">
                    {appendix.file ? (
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <span className="text-sm text-gray-600 truncate max-w-[150px]">
                          {appendix.fileName}
                        </span>
                        <button
                          onClick={() => handleRemoveFile(appendix.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, appendix.id)}
                        className="flex items-center gap-2"
                      >
                        <label className="cursor-pointer text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1">
                          <Upload className="h-3 w-3" />
                          Загрузить PDF
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={(e) => handleFileUpload(appendix.id, e)}
                            className="hidden"
                          />
                        </label>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(appendix)}
                      >
                        <FileText className="h-4 w-4 text-blue-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          removeAppendix(appendix.id);
                          toast.success('Приложение удалено');
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
