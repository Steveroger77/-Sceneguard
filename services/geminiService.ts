import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { DetectedObject, ObjectStatus, BoundingBox } from "../types";

// --- Model and TF.js Initialization ---
let modelPromise: Promise<cocoSsd.ObjectDetection>;
let tfReadyPromise: Promise<void>;

// Initializes the TF.js backend.
function initializeTf(): Promise<void> {
    if (!tfReadyPromise) {
        console.log("Waiting for TensorFlow.js backend to be ready...");
        // tf.ready() returns a promise that resolves when the backend is ready.
        // This relies on TFJS's automatic backend selection, avoiding redundant setup.
        tfReadyPromise = tf.ready();
        tfReadyPromise.then(() => {
            console.log(`TensorFlow.js backend (${tf.getBackend()}) is initialized and ready.`);
        }).catch(err => {
            console.error("TensorFlow.js failed to initialize:", err);
        });
    }
    return tfReadyPromise;
}

// Loads the COCO-SSD model, ensuring TF.js is ready first.
function loadModel(): Promise<cocoSsd.ObjectDetection> {
    if (!modelPromise) {
        modelPromise = new Promise(async (resolve, reject) => {
            try {
                await initializeTf(); // Ensure backend is ready
                console.log("Loading local object detection model...");
                const model = await cocoSsd.load();
                console.log("Model loaded successfully.");
                resolve(model);
            } catch (error) {
                console.error("Failed to load COCO-SSD model:", error);
                reject(error);
            }
        });
    }
    return modelPromise;
}

// Eagerly start the loading process. Functions that use the model will await the promise.
loadModel();


// --- Core Detection Function ---
export const detectObjectsInScene = async (base64Image: string): Promise<DetectedObject[]> => {
  try {
    const model = await loadModel();
    const img = new Image();

    // Promisify image loading from base64 string
    const imageLoadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = (err) => reject("Failed to load image from base64 string: " + err);
        img.src = base64Image;
    });

    const imageElement = await imageLoadPromise;
    const predictions = await model.detect(imageElement);

    // Convert predictions to the application's standard DetectedObject format
    return predictions.map((p, index) => {
        const [x, y, width, height] = p.bbox;
        const imgWidth = imageElement.width;
        const imgHeight = imageElement.height;

        return {
            id: `det-${Date.now()}-${index}`,
            label: p.class.charAt(0).toUpperCase() + p.class.slice(1), // Capitalize label
            box2d: {
                xmin: (x / imgWidth) * 1000,
                ymin: (y / imgHeight) * 1000,
                xmax: ((x + width) / imgWidth) * 1000,
                ymax: ((y + height) / imgHeight) * 1000,
            },
            status: ObjectStatus.PRESENT,
            confidence: p.score
        };
    });
  } catch (error) {
    console.error("TF.js Detection Error:", error);
    return []; // Return empty array on error
  }
};


// --- Scene Comparison Logic ---

// Helper function to calculate Intersection over Union (IoU)
const calculateIoU = (boxA: BoundingBox, boxB: BoundingBox): number => {
    const xA = Math.max(boxA.xmin, boxB.xmin);
    const yA = Math.max(boxA.ymin, boxB.ymin);
    const xB = Math.min(boxA.xmax, boxB.xmax);
    const yB = Math.min(boxA.ymax, boxB.ymax);
  
    const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
    const boxAArea = (boxA.xmax - boxA.xmin) * (boxA.ymax - boxA.ymin);
    const boxBArea = (boxB.xmax - boxB.xmin) * (boxB.ymax - boxB.ymin);
  
    const iou = interArea / (boxAArea + boxBArea - interArea);
    return isNaN(iou) ? 0 : iou;
};

export const compareScenes = async (
  referenceBase64: string,
  liveBase64: string,
  // knownObjects is no longer needed for context with this basic model
  knownObjects: DetectedObject[] 
): Promise<DetectedObject[]> => {
  try {
    const [refObjects, liveObjects] = await Promise.all([
        detectObjectsInScene(referenceBase64),
        detectObjectsInScene(liveBase64)
    ]);
    
    const matchedLiveIndices = new Set<number>();
    const matchedRefIndices = new Set<number>();
    const results: DetectedObject[] = [];
    const IOU_THRESHOLD = 0.4; // A reasonable threshold for matching the same object

    // First pass: Find PRESENT objects by matching live objects to reference objects
    liveObjects.forEach((liveObj, liveIdx) => {
        let bestMatch: { refIdx: number; score: number } | null = null;
        
        refObjects.forEach((refObj, refIdx) => {
            // If reference object is already matched, skip it
            if (matchedRefIndices.has(refIdx)) return;

            // Match if labels are the same
            if (liveObj.label === refObj.label) {
                const iou = calculateIoU(liveObj.box2d, refObj.box2d);
                // If this is a better match than any previous one for this live object
                if (iou > IOU_THRESHOLD && (!bestMatch || iou > bestMatch.score)) {
                    bestMatch = { refIdx, score: iou };
                }
            }
        });

        if (bestMatch) {
            matchedLiveIndices.add(liveIdx);
            matchedRefIndices.add(bestMatch.refIdx);
            // This object is present in both, use the live object's data
            results.push({
                ...liveObj,
                id: `comp-${liveObj.id}`,
                status: ObjectStatus.PRESENT,
            });
        }
    });

    // Second pass: Add NEW objects from unmatched live detections
    liveObjects.forEach((liveObj, liveIdx) => {
        if (!matchedLiveIndices.has(liveIdx)) {
            results.push({
                ...liveObj,
                id: `comp-${liveObj.id}`,
                status: ObjectStatus.NEW,
            });
        }
    });

    // Third pass: Add MISSING objects from unmatched reference detections
    refObjects.forEach((refObj, refIdx) => {
        if (!matchedRefIndices.has(refIdx)) {
            // This object was in the reference but not found in live
            results.push({
                ...refObj,
                id: `comp-${refObj.id}`,
                status: ObjectStatus.MISSING,
            });
        }
    });
    
    return results;
  } catch (error) {
    console.error("Comparison Error:", error);
    return []; // Return empty array on failure
  }
};