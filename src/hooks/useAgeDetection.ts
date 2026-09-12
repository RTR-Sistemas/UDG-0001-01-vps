import { useState, useRef, useCallback } from "react";
import * as faceapi from "@vladmandic/face-api";

export interface AgeDetectionResult {
  age: number;
  gender: string;
  genderProbability: number;
  isAdult: boolean;
  confidence: number;
  faceBox: { x: number; y: number; width: number; height: number } | null;
}

const MODELS_PATH = "/models";

export function useAgeDetection() {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const loadModels = useCallback(async () => {
    if (loadedRef.current) {
      setIsModelLoaded(true);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_PATH),
        faceapi.nets.ageGenderNet.loadFromUri(MODELS_PATH),
      ]);
      loadedRef.current = true;
      setIsModelLoaded(true);
    } catch (err: any) {
      console.error("Erro ao carregar modelos face-api:", err);
      setError(err.message || "Falha ao carregar modelos de detecção facial");
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Detect age from a video element (camera feed) or HTMLImageElement/HTMLCanvasElement.
   * Returns the best detection or null if no face found.
   */
  const detectAge = useCallback(
    async (
      input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
    ): Promise<AgeDetectionResult | null> => {
      if (!loadedRef.current) {
        console.warn("Modelos não carregados. Chame loadModels() primeiro.");
        return null;
      }

      try {
        const options = new faceapi.SsdMobilenetv1Options({
          minConfidence: 0.5,
        });

        const detections = await faceapi
          .detectAllFaces(input, options)
          .withAgeAndGender();

        if (!detections || detections.length === 0) {
          return null;
        }

        // Get the largest face (closest to camera)
        const best = detections.reduce((prev, curr) =>
          curr.detection.box.area > prev.detection.box.area ? curr : prev
        );

        const box = best.detection.box;

        return {
          age: Math.round(best.age),
          gender: best.gender,
          genderProbability: best.genderProbability,
          isAdult: best.age >= 18,
          confidence: best.detection.score,
          faceBox: {
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
          },
        };
      } catch (err: any) {
        console.error("Erro na detecção facial:", err);
        return null;
      }
    },
    []
  );

  /**
   * Detect age from an image file (document upload).
   * Creates a temporary Image element and runs detection.
   */
  const detectAgeFromImage = useCallback(
    async (imageFile: File): Promise<AgeDetectionResult | null> => {
      if (!loadedRef.current) {
        console.warn("Modelos não carregados. Chame loadModels() primeiro.");
        return null;
      }

      return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(imageFile);
        img.onload = async () => {
          const result = await detectAge(img);
          URL.revokeObjectURL(url);
          resolve(result);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(null);
        };
        img.src = url;
      });
    },
    [detectAge]
  );

  return {
    loadModels,
    detectAge,
    detectAgeFromImage,
    isModelLoaded,
    isLoading,
    error,
  };
}
