import React from 'react';
import { DetectedObject, ObjectStatus } from '../types';

interface BoundingBoxOverlayProps {
  objects: DetectedObject[];
  containerWidth: number;
  containerHeight: number;
  showLabels?: boolean;
}

const BoundingBoxOverlay: React.FC<BoundingBoxOverlayProps> = ({ 
  objects, 
  containerWidth, 
  containerHeight,
  showLabels = true
}) => {
  if (containerWidth === 0 || containerHeight === 0) return null;

  const getColor = (status: ObjectStatus) => {
    switch (status) {
      case ObjectStatus.MISSING: return 'border-status-missing bg-status-missing/10 text-status-missing box-shadow-glow-red';
      case ObjectStatus.NEW: return 'border-status-new bg-status-new/10 text-status-new box-shadow-glow-blue';
      case ObjectStatus.PRESENT: return 'border-status-present bg-status-present/10 text-status-present';
      default: return 'border-fog-accent bg-fog-accent/10 text-fog-accent';
    }
  };

  const getLabelColor = (status: ObjectStatus) => {
    switch (status) {
      case ObjectStatus.MISSING: return 'bg-status-missing text-fog-base';
      case ObjectStatus.NEW: return 'bg-status-new text-fog-base';
      case ObjectStatus.PRESENT: return 'bg-status-present text-fog-base';
      default: return 'bg-fog-accent text-fog-base';
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {objects.map((obj) => {
        if (obj.userHidden) return null;

        const { ymin, xmin, ymax, xmax } = obj.box2d;
        
        // Convert 0-1000 scale to pixels
        const top = (ymin / 1000) * 100;
        const left = (xmin / 1000) * 100;
        const width = ((xmax - xmin) / 1000) * 100;
        const height = ((ymax - ymin) / 1000) * 100;
        
        const colorClasses = getColor(obj.status);
        const labelClasses = getLabelColor(obj.status);

        return (
          <div
            key={obj.id}
            className={`absolute border-2 transition-all duration-500 ease-out rounded-sm ${colorClasses}`}
            style={{
              top: `${top}%`,
              left: `${left}%`,
              width: `${width}%`,
              height: `${height}%`,
            }}
          >
            {showLabels && (
              <div className={`absolute -top-7 left-[-2px] px-2 py-0.5 text-xs font-bold uppercase rounded shadow-lg whitespace-nowrap tracking-wide ${labelClasses}`}>
                 {obj.status === ObjectStatus.MISSING ? 'MISSING: ' : ''}{obj.label}
              </div>
            )}
            
            {/* Status Indicator Icon for Missing/New */}
            {obj.status === ObjectStatus.MISSING && (
              <div className="absolute inset-0 flex items-center justify-center opacity-40">
                <svg className="w-1/2 h-1/2 text-status-missing drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
             {obj.status === ObjectStatus.NEW && (
              <div className="absolute inset-0 flex items-center justify-center opacity-40">
                <svg className="w-1/2 h-1/2 text-status-new drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default BoundingBoxOverlay;