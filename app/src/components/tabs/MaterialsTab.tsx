import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStore } from '@/store/useStore';
import { Upload, Plus, Trash2, FileText, X, FileCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { Material } from '@/types';
import { cn } from '@/lib/utils';

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
        checked ? "bg-green-600" : "bg-gray-300"
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}

export function MaterialsTab() {
  const { materials, addMaterial, updateMaterial, removeMaterial, includeMaterialDocs, setIncludeMaterialDocs } = useStore();

  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    quantity: '',
    unit: '',
    qualityDoc: '',
    expiryDate: '',
  });

  const handleAdd = () => {
    if (!formData.name.trim()) {
      toast.error('Введите наименование материала');
      return;
    }
    if (!formData.quantity.trim()) {
      toast.error('Введите количество');
      return;
    }
    if (!formData.unit.trim()) {
      toast.error('Введите единицы измерения');
      return;
    }

    addMaterial({
      id: crypto.randomUUID(),
      name: formData.name,
      quantity: formData.quantity,
      unit: formData.unit,
      qualityDoc: formData.qualityDoc,
      expiryDate: formData.expiryDate,
      file: null,
      fileName: '',
    });

    setFormData({ name: '', quantity: '', unit: '', qualityDoc: '', expiryDate: '' });
    toast.success('Материал добавлен');
  };

  const handleUpdate = () => {
    if (!editingMaterial) return;
    if (!formData.name.trim()) {
      toast.error('Введите наименование материала');
      return;
    }
    updateMaterial(editingMaterial.id, formData);
    setEditingMaterial(null);
    setFormData({ name: '', quantity: '', unit: '', qualityDoc: '', expiryDate: '' });
    toast.success('Материал обновлен');
  };

  const handleEdit = (material: Material) => {
    setEditingMaterial(material);
    setFormData({
      name: material.name,
      quantity: material.quantity,
      unit: material.unit,
      qualityDoc: material.qualityDoc,
      expiryDate: material.expiryDate,
    });
  };

  const handleCancel = () => {
    setEditingMaterial(null);
    setFormData({ name: '', quantity: '', unit: '', qualityDoc: '', expiryDate: '' });
  };

  const handleFileUpload = useCallback(
    async (materialId: string, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.name.toLowerCase().endsWith('.pdf')) {
        toast.error('Требуется PDF файл');
        return;
      }

      updateMaterial(materialId, { file, fileName: file.name });
      toast.success('Файл загружен');
      e.target.value = '';
    },
    [updateMaterial]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent, materialId: string) => {
      e.preventDefault();

      const file = e.dataTransfer.files[0];
      if (!file) return;

      if (!file.name.toLowerCase().endsWith('.pdf')) {
        toast.error('Требуется PDF файл');
        return;
      }

      updateMaterial(materialId, { file, fileName: file.name });
      toast.success('Файл загружен');
    },
    [updateMaterial]
  );

  const handleRemoveFile = (materialId: string) => {
    updateMaterial(materialId, { file: null, fileName: '' });
    toast.success('Файл удален');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Материалы</h2>
          <p className="text-sm text-gray-500">
            Управление материалами, количеством и документами о качестве ({materials.length} записей)
          </p>
        </div>
        <div className="flex items-center gap-3 bg-gray-50 px-3 py-2 rounded-lg">
          <FileCheck className="w-5 h-5 text-gray-600" />
          <span className="text-sm font-medium">Экспорт док:</span>
          <Toggle checked={includeMaterialDocs} onChange={setIncludeMaterialDocs} />
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {editingMaterial ? 'Редактировать материал' : 'Добавить материал'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="material-name">Наименование материала</Label>
              <Input
                id="material-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Например: Труба ПНД Ду32"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="material-quantity">Количество</Label>
              <Input
                id="material-quantity"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                placeholder="Например: 100"
                type="text"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="material-unit">Ед. измерения</Label>
              <Input
                id="material-unit"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="Например: м.п., шт, кг"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quality-doc">Документ о качестве</Label>
              <Input
                id="quality-doc"
                value={formData.qualityDoc}
                onChange={(e) => setFormData({ ...formData, qualityDoc: e.target.value })}
                placeholder="Например: Сертификат №123"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiry-date">Срок действия</Label>
              <Input
                id="expiry-date"
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            {editingMaterial ? (
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
                <th className="px-4 py-3 text-left font-medium text-gray-700">Наименование</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 w-24">Кол-во</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 w-28">Ед. изм.</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Документ о качестве</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 w-32">Срок действия</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Файл</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 w-24">Действия</th>
              </tr>
            </thead>
            <tbody>
              {materials.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Нет материалов. Добавьте первый материал выше.
                  </td>
                </tr>
              )}
              {materials.map((material) => (
                <tr
                  key={material.id}
                  className="border-b hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 font-medium">{material.name}</td>
                  <td className="px-4 py-3 text-gray-600">{material.quantity}</td>
                  <td className="px-4 py-3 text-gray-600">{material.unit}</td>
                  <td className="px-4 py-3 text-gray-600">{material.qualityDoc || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {material.expiryDate
                      ? new Date(material.expiryDate).toLocaleDateString('ru-RU')
                      : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {material.file ? (
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <span className="text-sm text-gray-600 truncate max-w-[150px]">
                          {material.fileName}
                        </span>
                        <button
                          onClick={() => handleRemoveFile(material.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, material.id)}
                        className="flex items-center gap-2"
                      >
                        <label className="cursor-pointer text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1">
                          <Upload className="h-3 w-3" />
                          Загрузить PDF
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={(e) => handleFileUpload(material.id, e)}
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
                        onClick={() => handleEdit(material)}
                      >
                        <FileText className="h-4 w-4 text-blue-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          removeMaterial(material.id);
                          toast.success('Материал удален');
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
