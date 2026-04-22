import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { defaultSPList } from '@/utils/spRules';
import type { AppState, Session, RegistryEntry } from '@/types';

const createEmptySession = (name: string): Session => ({
  id: uuidv4(),
  name,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  permanentData: {},
  templates: [],
  materials: [],
  appendices: [],
  aosrActs: [],
  otherActs: [],
  registry: [],
  dateStart: '',
  dateEnd: '',
  spList: [...defaultSPList],
});

const getTimestamp = (): string => {
  const now = new Date();
  const date = now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
  const time = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentSession: null,
      sessions: [],
      sessionName: '',
      activeTab: 'permanent',
      permanentData: {},
      templates: [],
      materials: [],
      appendices: [],
      aosrActs: [],
      otherActs: [],
      registry: [],
      dateStart: '',
      dateEnd: '',
      spList: [...defaultSPList],

      // Session actions
      setActiveTab: (tab) => set({ activeTab: tab }),
      setSessionName: (name) => set({ sessionName: name }),

      createSession: () => {
        const state = get();
        const name = state.sessionName || 'Сессия';
        const fullName = `${name} ${getTimestamp()}`;
        const newSession = createEmptySession(fullName);
        set({
          currentSession: newSession,
          sessions: [...state.sessions, newSession],
          sessionName: '',
          permanentData: {},
          templates: [],
          materials: [],
          appendices: [],
          aosrActs: [],
          otherActs: [],
          registry: [],
          dateStart: '',
          dateEnd: '',
          spList: [...defaultSPList],
          activeTab: 'permanent',
        });
      },

      saveSession: () => {
        const state = get();
        if (!state.currentSession) return;

        // Extract base name (remove old timestamp if exists)
        const currentName = state.currentSession.name;
        const baseNameMatch = currentName.match(/^(.+) \d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/);
        const baseName = baseNameMatch ? baseNameMatch[1] : currentName;

        // Create new name with updated timestamp
        const newName = `${baseName} ${getTimestamp()}`;

        const updatedSession: Session = {
          ...state.currentSession,
          name: newName,
          updatedAt: new Date().toISOString(),
          permanentData: state.permanentData,
          templates: state.templates,
          materials: state.materials,
          appendices: state.appendices,
          aosrActs: state.aosrActs,
          otherActs: state.otherActs,
          registry: state.registry,
          dateStart: state.dateStart,
          dateEnd: state.dateEnd,
          spList: state.spList,
        };

        const sessions = state.sessions.map((s) =>
          s.id === updatedSession.id ? updatedSession : s
        );

        set({ currentSession: updatedSession, sessions });
      },

      loadSession: (sessionId) => {
        const state = get();
        const session = state.sessions.find((s) => s.id === sessionId);
        if (!session) return;

        set({
          currentSession: session,
          permanentData: session.permanentData,
          templates: session.templates,
          materials: session.materials,
          appendices: session.appendices,
          aosrActs: session.aosrActs,
          otherActs: session.otherActs,
          registry: session.registry,
          dateStart: session.dateStart,
          dateEnd: session.dateEnd,
          spList: session.spList || [...defaultSPList],
          activeTab: 'permanent',
        });
      },

      deleteSession: (sessionId) => {
        const state = get();
        const sessions = state.sessions.filter((s) => s.id !== sessionId);
        set({
          sessions,
          currentSession: state.currentSession?.id === sessionId ? null : state.currentSession,
        });
      },

      // Permanent Data
      setPermanentData: (key, value) => {
        set((state) => ({
          permanentData: { ...state.permanentData, [key]: value },
        }));
      },
      setDateStart: (date) => set({ dateStart: date }),
      setDateEnd: (date) => set({ dateEnd: date }),

      // Templates
      addTemplate: (template) => {
        set((state) => ({
          templates: [...state.templates, template],
        }));
      },
      removeTemplate: (id) => {
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id),
        }));
      },

      // Materials
      addMaterial: (material) => {
        set((state) => ({
          materials: [...state.materials, material],
        }));
      },
      updateMaterial: (id, material) => {
        set((state) => ({
          materials: state.materials.map((m) =>
            m.id === id ? { ...m, ...material } : m
          ),
        }));
      },
      removeMaterial: (id) => {
        set((state) => ({
          materials: state.materials.filter((m) => m.id !== id),
        }));
      },

      // Appendices
      addAppendix: (appendix) => {
        set((state) => ({
          appendices: [...state.appendices, appendix],
        }));
      },
      updateAppendix: (id, appendix) => {
        set((state) => ({
          appendices: state.appendices.map((a) =>
            a.id === id ? { ...a, ...appendix } : a
          ),
        }));
      },
      removeAppendix: (id) => {
        set((state) => ({
          appendices: state.appendices.filter((a) => a.id !== id),
        }));
      },

      // AOSR Acts
      addAOSRAct: (act) => {
        set((state) => ({
          aosrActs: [...state.aosrActs, act],
        }));
      },
      updateAOSRAct: (id, act) => {
        set((state) => ({
          aosrActs: state.aosrActs.map((a) =>
            a.id === id ? { ...a, ...act } : a
          ),
        }));
      },
      removeAOSRAct: (id) => {
        set((state) => ({
          aosrActs: state.aosrActs.filter((a) => a.id !== id),
        }));
      },
      reorderAOSRActs: (acts) => {
        set({ aosrActs: acts });
      },

      // Other Acts
      addOtherAct: (act) => {
        set((state) => ({
          otherActs: [...state.otherActs, act],
        }));
      },
      updateOtherAct: (id, act) => {
        set((state) => ({
          otherActs: state.otherActs.map((a) =>
            a.id === id ? { ...a, ...act } : a
          ),
        }));
      },
      removeOtherAct: (id) => {
        set((state) => ({
          otherActs: state.otherActs.filter((a) => a.id !== id),
        }));
      },

      // Registry
      setRegistry: (entries) => set({ registry: entries }),
      updateRegistryEntry: (id, entry) => {
        set((state) => ({
          registry: state.registry.map((e) =>
            e.id === id ? { ...e, ...entry } : e
          ),
        }));
      },
      reorderRegistry: (entries) => {
        const updatedEntries = entries.map((e, i) => ({
          ...e,
          order: i + 1,
        }));
        set({ registry: updatedEntries });
      },
      autoPopulateRegistry: () => {
        const state = get();
        const entries: RegistryEntry[] = [];

        // Add AOSR acts
        state.aosrActs.forEach((act) => {
          entries.push({
            id: `aosr-${act.id}`,
            order: entries.length + 1,
            documentName: `Акт АОСР №${act.actNumber} - ${act.workName}`,
            drawingNumber: '',
            docNumber: act.actNumber.toString(),
            organization: state.permanentData['Организация - строитель'] || state.permanentData['organization'] || '',
            pageCount: '',
            pageInList: '',
            status: 'yellow',
            fileType: 'act',
            sourceId: act.id,
            linkedFile: null,
            linkedFileName: '',
          });

          // Add linked appendices
          act.appendices.forEach((appId) => {
            const appendix = state.appendices.find((a) => a.id === appId);
            if (appendix) {
              entries.push({
                id: `app-${appId}-${act.id}`,
                order: entries.length + 1,
                documentName: `Приложение: ${appendix.name}`,
                drawingNumber: appendix.number,
                docNumber: '',
                organization: state.permanentData['Организация - строитель'] || state.permanentData['organization'] || '',
                pageCount: '',
                pageInList: '',
                status: 'yellow',
                fileType: 'appendix',
                sourceId: appendix.id,
                linkedFile: appendix.file,
                linkedFileName: appendix.fileName,
              });
            }
          });
        });

        // Add other acts
        state.otherActs.forEach((act) => {
          const template = state.templates.find((t) => t.id === act.templateId);
          entries.push({
            id: `other-${act.id}`,
            order: entries.length + 1,
            documentName: template?.name || 'Иной акт',
            drawingNumber: '',
            docNumber: '',
            organization: state.permanentData['Организация - строитель'] || state.permanentData['organization'] || '',
            pageCount: '',
            pageInList: '',
            status: 'yellow',
            fileType: 'act',
            sourceId: act.id,
            linkedFile: act.file,
            linkedFileName: act.fileName,
          });
        });

        set({ registry: entries });
      },

      // SP List
      setSPList: (list) => set({ spList: list }),
      addSPToList: (sp) => {
        set((state) => ({
          spList: state.spList.includes(sp) ? state.spList : [...state.spList, sp],
        }));
      },
      removeSPFromList: (sp) => {
        set((state) => ({
          spList: state.spList.filter((s) => s !== sp),
        }));
      },
    }),
    {
      name: 'id-documentation-storage',
    }
  )
);
