import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStore } from '@/store/useStore';
import { Save, FolderOpen, Plus, Trash2, FilePlus } from 'lucide-react';
import { toast } from 'sonner';

interface SessionManagerProps {
  compact?: boolean;
}

export function SessionManager({ compact = false }: SessionManagerProps) {
  const {
    sessions,
    sessionName,
    setSessionName,
    createSession,
    saveSession,
    loadSession,
    deleteSession,
    currentSession,
  } = useStore();

  const [selectedSessionId, setSelectedSessionId] = useState<string>('');

  const handleCreate = () => {
    if (!sessionName.trim()) {
      toast.error('Введите название сессии');
      return;
    }
    createSession();
    toast.success('Сессия создана');
  };

  const handleNewSession = () => {
    setSessionName('');
    setSelectedSessionId('');
    // Reset current session to null to show create screen
    useStore.setState({ currentSession: null });
    toast.info('Создайте новую сессию');
  };

  const handleSave = () => {
    if (!currentSession) {
      toast.error('Нет активной сессии');
      return;
    }
    saveSession();
    toast.success('Сессия сохранена');
  };

  const handleLoad = () => {
    if (!selectedSessionId) {
      toast.error('Выберите сессию');
      return;
    }
    loadSession(selectedSessionId);
    toast.success('Сессия загружена');
  };

  const handleDelete = (id: string) => {
    deleteSession(id);
    toast.success('Сессия удалена');
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleSave} className="gap-1" title="Сохранить сессию">
          <Save className="h-4 w-4" />
          Сохранить
        </Button>
        <Button variant="outline" size="sm" onClick={handleNewSession} className="gap-1" title="Новая сессия">
          <FilePlus className="h-4 w-4" />
          Новая
        </Button>
        <div className="flex gap-1 items-center">
          <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
            <SelectTrigger className="w-[220px] h-8 text-xs">
              <SelectValue placeholder="Выбрать сессию" />
            </SelectTrigger>
            <SelectContent 
              side="bottom" 
              align="end"
              sideOffset={4}
              avoidCollisions={true}
            >
              {sessions.map((session) => (
                <SelectItem key={session.id} value={session.id} className="text-xs">
                  <div className="flex items-center justify-between w-full gap-2">
                    <span className="truncate max-w-[180px]">{session.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleLoad} className="gap-1" title="Загрузить выбранную сессию">
            <FolderOpen className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">Управление сессиями</h2>
        <p className="text-gray-500">Создайте новую сессию или выберите существующую</p>
      </div>

      {/* Create new session */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-gray-700">Новая сессия</label>
        <div className="flex gap-2">
          <Input
            placeholder="Введите название сессии"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Создать
          </Button>
        </div>
        <p className="text-xs text-gray-500">
          К названию автоматически добавится дата и время
        </p>
      </div>

      {/* Load existing session */}
      {sessions.length > 0 && (
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700">Существующие сессии</label>
          <div className="flex gap-2 items-center">
            <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Выберите сессию" />
              </SelectTrigger>
              <SelectContent
                side="bottom"
                align="start"
                sideOffset={4}
                avoidCollisions={true}
              >
                {sessions.map((session) => (
                  <SelectItem key={session.id} value={session.id}>
                    <div className="flex items-center justify-between w-full gap-2">
                      <span className="truncate max-w-[300px]">{session.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleLoad} className="gap-2">
              <FolderOpen className="h-4 w-4" />
              Загрузить
            </Button>
          </div>
        </div>
      )}

      {/* Saved sessions list */}
      {sessions.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Сохраненные сессии ({sessions.length})</label>
          <div className="border rounded-md divide-y max-h-64 overflow-y-auto">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-3 hover:bg-gray-50"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {session.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    Обновлено: {new Date(session.updatedAt).toLocaleString('ru-RU')}
                  </p>
                </div>
                <div className="flex gap-1 ml-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => loadSession(session.id)}
                  >
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(session.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
