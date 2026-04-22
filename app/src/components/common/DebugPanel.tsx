import { useEffect } from 'react';
import { debugLogger, getStorageInfo } from '@/utils/debug';
import { useStore } from '@/store/useStore';

/**
 * Debug Panel Component - Shows debug info and controls
 * Only rendered in development mode or when debug is enabled
 */
export function DebugPanel() {
  const { currentSession, aosrActs, materials, appendices, templates } = useStore();

  useEffect(() => {
    // Log session changes
    if (currentSession) {
      debugLogger.info('DebugPanel', 'Session changed', {
        name: currentSession.name,
        actsCount: aosrActs.length,
        materialsCount: materials.length,
        appendicesCount: appendices.length,
        templatesCount: templates.length,
      });
    }
  }, [currentSession, aosrActs.length, materials.length, appendices.length, templates.length]);

  const storageInfo = getStorageInfo();

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white p-3 rounded-lg shadow-lg text-xs max-w-sm z-50">
      <div className="font-semibold mb-2 flex items-center justify-between">
        <span>🔧 Отладка</span>
        <button
          onClick={() => {
            debugLogger.downloadLogs();
          }}
          className="text-blue-400 hover:text-blue-300"
          title="Скачать логи"
        >
          📥 Логи
        </button>
      </div>
      
      <div className="space-y-1">
        <div className="flex justify-between">
          <span>localStorage:</span>
          <span className={storageInfo.localStorageSize > 4000 ? 'text-red-400' : 'text-green-400'}>
            {storageInfo.localStorageSize} KB
          </span>
        </div>
        <div className="flex justify-between">
          <span>Элементов:</span>
          <span>{storageInfo.itemCount}</span>
        </div>
        <div className="flex justify-between">
          <span>Режим отладки:</span>
          <span className={debugLogger.isEnabled() ? 'text-green-400' : 'text-yellow-400'}>
            {debugLogger.isEnabled() ? 'ВКЛ' : 'ВЫКЛ'}
          </span>
        </div>
        {currentSession && (
          <>
            <div className="border-t border-gray-700 mt-2 pt-2">
              <div className="font-medium mb-1">Текущая сессия:</div>
              <div className="truncate" title={currentSession.name}>
                {currentSession.name}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>Акты: {aosrActs.length}</div>
              <div>Материалы: {materials.length}</div>
              <div>Приложения: {appendices.length}</div>
              <div>Шаблоны: {templates.length}</div>
            </div>
          </>
        )}
      </div>

      <div className="mt-3 pt-2 border-t border-gray-700 text-gray-400">
        <div className="text-xs">
          Консоль: window.IDDebug
        </div>
        <div className="flex gap-2 mt-1">
          <button
            onClick={() => debugLogger.enable()}
            className="text-green-400 hover:text-green-300"
          >
            Включить
          </button>
          <button
            onClick={() => debugLogger.disable()}
            className="text-red-400 hover:text-red-300"
          >
            Выключить
          </button>
          <button
            onClick={() => debugLogger.clearLogs()}
            className="text-yellow-400 hover:text-yellow-300"
          >
            Очистить
          </button>
        </div>
      </div>
    </div>
  );
}
