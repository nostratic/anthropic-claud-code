export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface ConflictParticipant {
  id: string;
  conflictId: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: User;
}

export interface Conflict {
  id: string;
  title: string;
  description: string;
  status: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy: User;
  participants: ConflictParticipant[];
  roadmaps: Roadmap[];
  _count?: { roadmaps: number; notes: number };
}

export interface RoadmapNode {
  id: string;
  roadmapId: string;
  title: string;
  description: string | null;
  type: string;
  positionX: number;
  positionY: number;
  order: number;
  status: string;
  parentId: string | null;
  cost: number | null;
  timeEstimate: string | null;
  points: number;
  consequences: string | null;
  prerequisites: string | null;
  assumptions: string | null;
  kpis: string | null;
  createdAt: string;
  updatedAt: string;
  children?: RoadmapNode[];
  statusHistory?: NodeStatusHistory[];
  files?: NodeFile[];
}

export interface Roadmap {
  id: string;
  conflictId: string;
  createdById: string;
  title: string;
  type: string;
  isActive: boolean;
  isPersonal: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdBy: User;
  nodes: RoadmapNode[];
  shares?: RoadmapShare[];
  _count?: { nodes: number };
}

export interface NodeStatusHistory {
  id: string;
  nodeId: string;
  userId: string;
  oldStatus: string;
  newStatus: string;
  comment: string | null;
  changedAt: string;
  user: User;
}

export interface NodeFile {
  id: string;
  nodeId: string;
  uploadedById: string;
  name: string;
  url: string;
  fileType: string;
  visibility: string;
  uploadedAt: string;
}

export interface Note {
  id: string;
  userId: string;
  conflictId: string;
  content: string;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
  user: User;
}

export interface RoadmapShare {
  id: string;
  roadmapId: string;
  sharedById: string;
  sharedToId: string;
  status: string;
  sharedAt: string;
  sharedBy: User;
  sharedTo: User;
  roadmap?: Roadmap & { conflict?: { title: string } };
}
