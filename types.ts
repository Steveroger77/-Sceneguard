
export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export enum ObjectStatus {
  PRESENT = 'present',
  MISSING = 'missing',
  NEW = 'new',
  UNKNOWN = 'unknown' // Before comparison
}

export interface DetectedObject {
  id: string;
  label: string;
  box2d: BoundingBox;
  status: ObjectStatus;
  confidence?: number;
  userHidden?: boolean; // If user wants to ignore this object
}

export interface SceneReference {
  id: string;
  name: string;
  imageData: string; // Base64 string
  createdAt: number;
  objects: DetectedObject[];
}

export interface FeatureItem {
  id: number;
  title: string;
  desc: string;
  img: string; // Base64 or URL
  isDefault?: boolean;
  order?: number;
}

export type ViewMode = 'dashboard' | 'create-reference' | 'monitor' | 'photo-compare' | 'gallery' | 'features';

export type VideoResolution = 'auto' | 'hd' | 'fhd' | '4k';

export interface AppState {
  view: ViewMode;
  references: SceneReference[];
  activeReferenceId: string | null;
}
