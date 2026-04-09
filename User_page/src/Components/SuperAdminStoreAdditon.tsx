import { useState } from "react";

export function CanteenStoreAddition() {
  const [storeName, setStoreName] = useState("");
  const [openingTime, setOpeningTime] = useState("");
  const [closingTime, setClosingTime] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors: string[] = [];

    if (storeName.trim().length < 3) {
      validationErrors.push("Store name must be at least 3 characters long.");
    }

    if (!openingTime || !closingTime) {
      validationErrors.push("Opening and closing times are required.");
    } else if (closingTime <= openingTime) {
      validationErrors.push("Closing time must be after opening time.");
    }

    // ❗ Set errors ONCE
    setErrors(validationErrors);

    if (validationErrors.length > 0) {
      return;
    }

    const payload = {
      storeName,
      openingTime,
      closingTime,
    };

    console.log("Store Added:", payload);

    // Optional: reset form
    setStoreName("");
    setOpeningTime("");
    setClosingTime("");
  };

  return (
    <section className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white w-full max-w-md rounded-xl shadow-md p-6"
      >
        <h2 className="text-2xl font-bold text-blue-900 mb-6 text-center">
          Add New Canteen Store
        </h2>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3">
            <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
              {errors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Store Name */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Store Name
          </label>
          <input
            type="text"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="e.g. Central Canteen"
            className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Opening Time */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Opening Time
          </label>
          <input
            type="time"
            value={openingTime}
            onChange={(e) => setOpeningTime(e.target.value)}
            className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Closing Time */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Closing Time
          </label>
          <input
            type="time"
            value={closingTime}
            onChange={(e) => setClosingTime(e.target.value)}
            className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded-md font-semibold hover:bg-blue-700 transition"
        >
          Add Store
        </button>
      </form>
    </section>
  );
}
