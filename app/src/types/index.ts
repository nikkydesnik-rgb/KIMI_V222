export interface Material {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  qualityDoc: string;
  expiryDate: string;
  file: File | null;
  fileName: string;
}

export interface Appendix {
  id: string;
  name: string;
  number: string;
  file: File | null;
  fileName: string;
}

export interface AOSRAct {
  id: string;
  actNumber: number;
  workName: string;
  startDate: string;
  endDate: string;
  materials: string[];
  includeMaterialDocs: boolean;
  appendices: string[];
  sp: string;
  templateId: string;
  notes: string;
}

export interface OtherAct {
  id: string;
  templateId: string;
  templateName: string;
  values: Record<string, string>;
  file: File | null;
  fileName: string;
}

export interface Template {
  id: string;
  name: string;
  fileName: string;
  fileData: string;
  keys: string[];
  type: 'aosr' | 'other';
}

export interface RegistryEntry {
  id: string;
  order: number;
  documentName: string;
  drawingNumber: string;
  docNumber: string;
  organization: string;
  pageCount: string;
  pageInList: string;
  status: 'green' | 'yellow' | 'red';
  fileType: 'act' | 'appendix' | 'material';
  sourceId: string;
  linkedFile: File | null;
  linkedFileName: string;
  endDate?: string;
}

export interface Session {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  permanentData: Record<string, string>;
  templates: Template[];
  materials: Material[];
  appendices: Appendix[];
  aosrActs: AOSRAct[];
  otherActs: OtherAct[];
  registry: RegistryEntry[];
  dateStart: string;
  dateEnd: string;
  spList: string[];
}

export interface AppState {
  // Session
  currentSession: Session | null;
  sessions: Session[];
  sessionName: string;

  // UI
  activeTab: string;

  // Data
  permanentData: Record<string, string>;
  templates: Template[];
  materials: Material[];
  appendices: Appendix[];
  aosrActs: AOSRAct[];
  otherActs: OtherAct[];
  registry: RegistryEntry[];
  dateStart: string;
  dateEnd: string;
  spList: string[];
  includeMaterialDocs: boolean;

  // Actions
  setActiveTab: (tab: string) => void;
  setSessionName: (name: string) => void;
  createSession: () => void;
  saveSession: () => void;
  loadSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;

  // Permanent Data
  setPermanentData: (key: string, value: string) => void;
  setDateStart: (date: string) => void;
  setDateEnd: (date: string) => void;

  // Templates
  addTemplate: (template: Template) => void;
  removeTemplate: (id: string) => void;

  // Materials
  addMaterial: (material: Material) => void;
  updateMaterial: (id: string, material: Partial<Material>) => void;
  removeMaterial: (id: string) => void;

  // Appendices
  addAppendix: (appendix: Appendix) => void;
  updateAppendix: (id: string, appendix: Partial<Appendix>) => void;
  removeAppendix: (id: string) => void;

  // AOSR Acts
  addAOSRAct: (act: AOSRAct) => void;
  updateAOSRAct: (id: string, act: Partial<AOSRAct>) => void;
  removeAOSRAct: (id: string) => void;
  reorderAOSRActs: (acts: AOSRAct[]) => void;

  // Other Acts
  addOtherAct: (act: OtherAct) => void;
  updateOtherAct: (id: string, act: Partial<OtherAct>) => void;
  removeOtherAct: (id: string) => void;

  // Registry
  setRegistry: (entries: RegistryEntry[]) => void;
  updateRegistryEntry: (id: string, entry: Partial<RegistryEntry>) => void;
  reorderRegistry: (entries: RegistryEntry[]) => void;
  autoPopulateRegistry: () => void;

  // SP
  setSPList: (list: string[]) => void;
  addSPToList: (sp: string) => void;
  removeSPFromList: (sp: string) => void;

  // Materials
  setIncludeMaterialDocs: (include: boolean) => void;
}
