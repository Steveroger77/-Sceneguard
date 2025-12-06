import { GoogleGenAI, Type } from "@google/genai";
import { DetectedObject, ObjectStatus } from "../types";

// Helper to clean JSON string
const cleanJsonString = (str: string): string => {
  let cleaned = str.trim();
  
  // Remove markdown code blocks if present
  if (cleaned.includes('```')) {
    cleaned = cleaned.replace(/^```json/g, '').replace(/^```/g, '').replace(/```$/g, '');
  }
  
  // Find first { or [ to handle chatty prefixes
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  
  let startIndex = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    startIndex = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    startIndex = firstBrace;
  } else if (firstBracket !== -1) {
    startIndex = firstBracket;
  }

  if (startIndex !== -1) {
      cleaned = cleaned.substring(startIndex);
      // Find last } or ]
      const lastBrace = cleaned.lastIndexOf('}');
      const lastBracket = cleaned.lastIndexOf(']');
      const endIndex = Math.max(lastBrace, lastBracket);
      
      if (endIndex !== -1) {
          cleaned = cleaned.substring(0, endIndex + 1);
      }
  }
  
  return cleaned;
};


// Schema for object detection
const detectionSchema = {
  type: Type.OBJECT,
  properties: {
    objects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING, description: "Specific name of the object" },
          ymin: { type: Type.NUMBER, description: "Top (0-1000)" },
          xmin: { type: Type.NUMBER, description: "Left (0-1000)" },
          ymax: { type: Type.NUMBER, description: "Bottom (0-1000)" },
          xmax: { type: Type.NUMBER, description: "Right (0-1000)" },
        },
        required: ["label", "ymin", "xmin", "ymax", "xmax"],
      },
    },
  },
};

// Schema for comparison
const comparisonSchema = {
  type: Type.OBJECT,
  properties: {
    objects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING, description: "Name of the object" },
          status: { 
            type: Type.STRING, 
            description: "Status: 'present', 'missing', or 'new'." 
          },
          ymin: { type: Type.NUMBER, description: "Current Top (0-1000)" },
          xmin: { type: Type.NUMBER, description: "Current Left (0-1000)" },
          ymax: { type: Type.NUMBER, description: "Current Bottom (0-1000)" },
          xmax: { type: Type.NUMBER, description: "Current Right (0-1000)" },
        },
        required: ["label", "status", "ymin", "xmin", "ymax", "xmax"],
      },
    },
  },
};

const IGNORED_TERMS = ['camo', 'watermark', 'logo', 'ui', 'text', 'overlay', 'timestamp', 'recording', 'date', 'rec'];

export const detectObjectsInScene = async (base64Image: string, retryCount = 0): Promise<DetectedObject[]> => {
  try {
    const apiKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : undefined;
    if (!apiKey) throw new Error("API Key not found");
    const ai = new GoogleGenAI({ apiKey });
    
    let response;

    // STRATEGY: 
    // Attempt 0: High Precision (Gemini 3 Pro + Thinking)
    // Attempt 1+: Fallback to Speed (Gemini 2.5 Flash) to avoid timeouts/RPC errors
    if (retryCount === 0) {
        response = await ai.models.generateContent({
            model: "gemini-3-pro-preview", 
            contents: {
                parts: [
                { inlineData: { mimeType: "image/jpeg", data: base64Image } },
                { text: "Identify every single distinct physical object in this image. Be extremely granular. Return a JSON list with bounding boxes." },
                ],
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: detectionSchema,
                // Increased budget to 2048 for better reasoning stability
                thinkingConfig: { thinkingBudget: 2048 },
                systemInstruction: "You are a state-of-the-art computer vision model. Your goal is high recall detection of physical objects. Ignore textual overlays or watermarks, but detect everything else.",
            },
        });
    } else {
        console.log("Using fallback model (Gemini 2.5 Flash) for stability...");
        response = await ai.models.generateContent({
            model: "gemini-2.5-flash", 
            contents: {
                parts: [
                { inlineData: { mimeType: "image/jpeg", data: base64Image } },
                { text: "Identify all distinct physical objects in this image. Return a JSON list with bounding boxes." },
                ],
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: detectionSchema,
                systemInstruction: "Identify physical objects. Ignore watermarks.",
            },
        });
    }

    const text = response.text || "{}";
    const jsonStr = cleanJsonString(text);
    
    let result;
    try {
        result = JSON.parse(jsonStr);
    } catch (e) {
        console.warn("JSON parse failed, retrying...", e);
        if (retryCount < 2) return detectObjectsInScene(base64Image, retryCount + 1);
        return [];
    }

    let objects = result.objects || [];

    // Filter watermarks in post-processing
    objects = objects.filter((obj: any) => {
       const label = obj.label?.toLowerCase() || '';
       return !IGNORED_TERMS.some(term => label.includes(term));
    });

    // If result is empty, force a retry with the fallback model
    if (objects.length === 0 && retryCount < 2) {
      console.log("Empty result, retrying with fallback...");
      return detectObjectsInScene(base64Image, retryCount + 1);
    }

    return objects.map((obj: any, index: number) => ({
      id: `det-${Date.now()}-${index}`,
      label: obj.label,
      box2d: {
        ymin: obj.ymin,
        xmin: obj.xmin,
        ymax: obj.ymax,
        xmax: obj.xmax,
      },
      status: ObjectStatus.PRESENT,
    }));
  } catch (error) {
    console.error("Detection Error (Attempt " + retryCount + "):", error);
    
    // Critical Fallback: If 3-Pro crashes (RPC error/timeout), retry with 2.5-Flash
    if (retryCount < 2) {
        return detectObjectsInScene(base64Image, retryCount + 1);
    }
    
    // On error, return empty rather than crash
    return [];
  }
};

export const compareScenes = async (
  referenceBase64: string,
  liveBase64: string,
  knownObjects: DetectedObject[] // Pass context if available
): Promise<DetectedObject[]> => {
  try {
    const apiKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : undefined;
    if (!apiKey) throw new Error("API Key not found");
    const ai = new GoogleGenAI({ apiKey });

    const isBlindComparison = knownObjects.length === 0;
    
    let systemInstruction = "You are a precise object tracker.";
    let promptParts: any[] = [];
    let modelName = "gemini-2.5-flash";

    if (isBlindComparison) {
        // Photo Compare Mode: Use Gemini 3 Pro for high-level reasoning
        modelName = "gemini-3-pro-preview"; 
        systemInstruction = "You are an expert computer vision analyst specializing in spotting differences between two images (Reference vs Live).";
        promptParts = [
          { text: "Analyze these two images to detect changes." },
          { text: "Reference Image (The Baseline):" },
          { inlineData: { mimeType: "image/jpeg", data: referenceBase64 } },
          { text: "Live Image (The New State):" },
          { inlineData: { mimeType: "image/jpeg", data: liveBase64 } },
          { text: `Compare the images and identify distinct physical objects.
                   1. If an object is in the Reference but NOT in the Live image, mark it as 'missing'. Use the coordinates from the Reference Image for the box.
                   2. If an object is in the Live image but NOT in the Reference, mark it as 'new'. Use the coordinates from the Live Image.
                   3. If an object is in BOTH (even if moved), mark it as 'present'. Use the coordinates from the Live Image.
                   
                   Be strict. Only report distinct, clear objects. Ignore small lighting changes.` }
        ];
    } else {
        // Monitor Mode: Use Gemini 2.5 Flash for speed with context
        const knownLabels = knownObjects.map(o => o.label).join(', ');
        promptParts = [
          { text: "Reference Image:" },
          { inlineData: { mimeType: "image/jpeg", data: referenceBase64 } },
          { text: "Live Scene:" },
          { inlineData: { mimeType: "image/jpeg", data: liveBase64 } },
          { text: `The Reference Image contains these objects: [${knownLabels}]. Find them in the Live Scene. 
                   1. If an object is visible (even if moved), mark as 'present' and update its bounding box.
                   2. Only mark 'missing' if it is clearly gone.
                   3. Mark unexpected new items as 'new'.` }
        ];
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts: promptParts },
      config: {
        responseMimeType: "application/json",
        responseSchema: comparisonSchema,
        systemInstruction: systemInstruction,
      },
    });

    const text = response.text || "{}";
    const jsonStr = cleanJsonString(text);
    let result;
    
    try {
        result = JSON.parse(jsonStr);
    } catch (e) {
        console.error("Comparison JSON Parse Error", e);
        return [];
    }

    if (!result.objects) return [];

    return result.objects
      .filter((obj: any) => {
         const label = obj.label?.toLowerCase() || '';
         return !IGNORED_TERMS.some(term => label.includes(term));
      })
      .map((obj: any, index: number) => {
        let status = ObjectStatus.UNKNOWN;
        const s = obj.status?.toLowerCase() || '';
        if (s === 'present') status = ObjectStatus.PRESENT;
        else if (s === 'missing') status = ObjectStatus.MISSING;
        else if (s === 'new') status = ObjectStatus.NEW;
        else status = ObjectStatus.PRESENT; // Default fallback

        return {
          id: `comp-${Date.now()}-${index}`,
          label: obj.label,
          box2d: {
            ymin: obj.ymin,
            xmin: obj.xmin,
            ymax: obj.ymax,
            xmax: obj.xmax,
          },
          status: status,
        };
    });
  } catch (error) {
    console.error("Comparison Error:", error);
    throw error;
  }
};