import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStore } from '@/store/useStore';
import { SessionManager } from '@/components/common/SessionManager';
import { PermanentDataTab } from '@/components/tabs/PermanentDataTab';
import { AOSRActsTab } from '@/components/tabs/AOSRActsTab';
import { MaterialsTab } from '@/components/tabs/MaterialsTab';
import { AppendicesTab } from '@/components/tabs/AppendicesTab';
import { OtherActsTab } from '@/components/tabs/OtherActsTab';
import { RegistryTab } from '@/components/tabs/RegistryTab';
import { DebugPanel } from '@/components/common/DebugPanel';
import { FileText, ClipboardList, Hammer, Paperclip, FolderOpen, BookOpen } from 'lucide-react';
import { Toaster } from 'sonner';

function App() {
  const { activeTab, setActiveTab, currentSession } = useStore();

  if (!currentSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Toaster position="top-right" />
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Система формирования исполнительной документации
            </h1>
            <p className="text-lg text-gray-600">
              Создайте новую сессию или загрузите существующую для начала работы
            </p>
          </div>
          <SessionManager />
        </div>
        {/* Debug panel always available */}
        {import.meta.env.DEV && <DebugPanel />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-900">
              Исполнительная документация
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              Сессия: <span className="font-medium text-gray-700">{currentSession.name}</span>
            </span>
            <SessionManager compact />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-6 h-auto">
            <TabsTrigger value="permanent" className="flex items-center gap-2 py-3">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden lg:inline">Постоянные данные</span>
              <span className="lg:hidden">Данные</span>
            </TabsTrigger>
            <TabsTrigger value="aosr" className="flex items-center gap-2 py-3">
              <Hammer className="h-4 w-4" />
              <span className="hidden lg:inline">Акты АОСР</span>
              <span className="lg:hidden">АОСР</span>
            </TabsTrigger>
            <TabsTrigger value="materials" className="flex items-center gap-2 py-3">
              <FolderOpen className="h-4 w-4" />
              <span className="hidden lg:inline">Материалы</span>
              <span className="lg:hidden">Мат.</span>
            </TabsTrigger>
            <TabsTrigger value="appendices" className="flex items-center gap-2 py-3">
              <Paperclip className="h-4 w-4" />
              <span className="hidden lg:inline">Приложения</span>
              <span className="lg:hidden">Прил.</span>
            </TabsTrigger>
            <TabsTrigger value="other" className="flex items-center gap-2 py-3">
              <FileText className="h-4 w-4" />
              <span className="hidden lg:inline">Иные акты</span>
              <span className="lg:hidden">Иные</span>
            </TabsTrigger>
            <TabsTrigger value="registry" className="flex items-center gap-2 py-3">
              <BookOpen className="h-4 w-4" />
              <span className="hidden lg:inline">Реестр</span>
              <span className="lg:hidden">Реестр</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="permanent" className="space-y-4">
            <PermanentDataTab />
          </TabsContent>

          <TabsContent value="aosr" className="space-y-4">
            <AOSRActsTab />
          </TabsContent>

          <TabsContent value="materials" className="space-y-4">
            <MaterialsTab />
          </TabsContent>

          <TabsContent value="appendices" className="space-y-4">
            <AppendicesTab />
          </TabsContent>

          <TabsContent value="other" className="space-y-4">
            <OtherActsTab />
          </TabsContent>

          <TabsContent value="registry" className="space-y-4">
            <RegistryTab />
          </TabsContent>
        </Tabs>
      </main>

      {/* Debug panel in dev mode */}
      {import.meta.env.DEV && <DebugPanel />}
    </div>
  );
}

export default App;
