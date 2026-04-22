import React, { useState } from 'react';
import { useStore } from '../../store/useStore';

export const AOSRActsTab: React.FC = () => {
  const { acts, updateAct, addAct, removeAct, globalData } = useStore();

  const handleAddRow = () => {
    const newNumber = acts.length > 0 ? Math.max(...acts.map(a => parseInt(a.act_number) || 0)) + 1 : 1;
    addAct({
      id: Date.now().toString(),
      act_number: newNumber.toString(),
      work_name: '',
      start_date: '',
      end_date: '',
      materials: [],
      appendices: [],
      sp: [],
      notes: '',
      // Убедитесь, что эти поля соответствуют ключам в шаблоне без пробелов
      Object_building: globalData.Object_building || '', 
      Developer_org: globalData.Developer_org || '',
      // ... остальные поля
    });
  };

  return (
    <div className="p-4">
      <div className="flex justify-between mb-4">
        <h2 className="text-xl font-bold">Акты АОСР</h2>
        <button 
          onClick={handleAddRow}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Добавить акт
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="py-2 px-4 border">#</th>
              <th className="py-2 px-4 border">Номер акта</th>
              <th className="py-2 px-4 border">Наименование работ</th>
              <th className="py-2 px-4 border">Дата начала</th>
              <th className="py-2 px-4 border">Дата окончания</th>
              <th className="py-2 px-4 border">Материалы</th>
              <th className="py-2 px-4 border">Приложения</th>
              <th className="py-2 px-4 border">СП</th>
              <th className="py-2 px-4 border">Действия</th>
            </tr>
          </thead>
          <tbody>
            {acts.map((act, index) => (
              <tr key={act.id} className="hover:bg-gray-50">
                <td className="py-2 px-4 border text-center">{index + 1}</td>
                <td className="py-2 px-4 border">
                  <input 
                    type="text" 
                    value={act.act_number}
                    onChange={(e) => updateAct(act.id, { act_number: e.target.value })}
                    className="w-full p-1 border rounded"
                  />
                </td>
                <td className="py-2 px-4 border">
                  <input 
                    type="text" 
                    value={act.work_name}
                    onChange={(e) => updateAct(act.id, { work_name: e.target.value })}
                    className="w-full p-1 border rounded"
                  />
                </td>
                <td className="py-2 px-4 border">
                  <input 
                    type="date" 
                    value={act.start_date}
                    onChange={(e) => updateAct(act.id, { start_date: e.target.value })}
                    className="w-full p-1 border rounded"
                  />
                </td>
                <td className="py-2 px-4 border">
                  <input 
                    type="date" 
                    value={act.end_date}
                    onChange={(e) => updateAct(act.id, { end_date: e.target.value })}
                    className="w-full p-1 border rounded"
                  />
                </td>
                {/* Ячейки для материалов, приложений и СП можно реализовать через модальные окна или выпадающие списки */}
                <td className="py-2 px-4 border text-sm text-gray-500">
                  {act.materials?.length || 0} выбр.
                </td>
                <td className="py-2 px-4 border text-sm text-gray-500">
                  {act.appendices?.length || 0} выбр.
                </td>
                <td className="py-2 px-4 border text-sm text-gray-500">
                  {act.sp?.join(', ') || '-'}
                </td>
                <td className="py-2 px-4 border text-center">
                  <button 
                    onClick={() => removeAct(act.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Здесь можно добавить кнопки "Рассчитать даты" и "Предпросмотр" */}
    </div>
  );
};