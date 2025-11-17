"use client";

import { type ChangeEventHandler, type FormEventHandler, useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFormSubmit: FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setError(null);

    if (!file) {
      setError("Please select an image file");
      return;
    }

    setIsLoading(true);
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
      // a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    setFile(event.target.files?.[0] || null);
    setError(null);
  };

  return (
    <div className="font-sans min-h-screen p-8 pb-20 gap-16 sm:p-20 flex items-center justify-center">
      <main className="flex flex-col gap-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-center">Minecraft Image Map Generator</h1>
        <p className="text-center text-gray-600 dark:text-gray-400">
          Convert your images into Minecraft world
        </p>

        <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
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
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !file}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            {isLoading ? "Generating..." : "Generate Map"}
          </button>
        </form>
      </main>
    </div>
  );
}
