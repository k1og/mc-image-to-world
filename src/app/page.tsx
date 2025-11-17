"use client";

import {
  type ChangeEventHandler,
  type FormEventHandler,
  useState,
  useEffect,
} from "react";
import Image from "next/image";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isWorldGenLoading, setWorldGenIsLoading] = useState<boolean>(false);
  const [isImgGenLoading, setImgGenIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFormSubmit: FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setError(null);

    if (!file) {
      setError("Please select an image file");
      return;
    }

    setWorldGenIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("img", file);
      formData.append("version", "1.20.1");

      const res = await fetch("/api/gen", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to generate map");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "map.zip";
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setWorldGenIsLoading(false);
    }
  };

  const handleFileChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    setFile(event.target.files?.[0] || null);
    setError(null);
    setPreviewUrl(null); // Clear preview when file changes
  };

  const handlePreview = async () => {
    if (!file) {
      setError("Please select an image file first");
      return;
    }

    setImgGenIsLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("img", file);
      formData.append("version", "1.20.1");

      const res = await fetch("/api/preview-image", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({
          error: "Unknown error",
        }));
        throw new Error(errorData.error || "Failed to generate preview");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      
      // Clean up previous preview URL if exists
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      
      setPreviewUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setImgGenIsLoading(false);
    }
  };

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <div className="font-sans min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-8 max-w-7xl mx-auto w-full">
        <div className="max-w-md mx-auto w-full">
          <h1 className="text-3xl font-bold text-center">Minecraft Image Map Generator</h1>
          <p className="text-center text-gray-600 dark:text-gray-400">
            Convert your images into Minecraft world
          </p>
        </div>

        <form onSubmit={handleFormSubmit} className="flex flex-col gap-4 max-w-md mx-auto w-full">
          <div>
            <label
              htmlFor="file"
              className="block text-sm font-medium mb-2"
            >
              Select Image
            </label>
            <input
              type="file"
              id="file"
              name="file"
              accept="image/*"
              onChange={handleFileChange}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300"
              disabled={isWorldGenLoading}
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePreview}
              disabled={isWorldGenLoading || isImgGenLoading || !file}
              className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              {isWorldGenLoading ? "Generating Preview..." : "Preview"}
            </button>
            <button
              type="submit"
              disabled={isWorldGenLoading || isImgGenLoading || !file}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              {isImgGenLoading ? "Generating..." : "Generate Map"}
            </button>
          </div>
        </form>

        {previewUrl && (
          <div className="mt-8 w-full">
            <h2 className="text-xl font-semibold mb-4 text-center">Preview</h2>
            <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 shadow-lg">
              <Image
                src={previewUrl}
                alt="Minecraft world preview"
                width={1920}
                height={1080}
                className="w-full h-auto max-h-[80vh] object-contain"
                unoptimized
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
