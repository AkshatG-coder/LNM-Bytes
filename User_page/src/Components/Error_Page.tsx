import { AlertTriangle, Home, RefreshCcw } from "lucide-react";

export default function ErrorPage({
  code = 404,
  title = "Page Not Found",
  message = "The page you’re looking for doesn’t exist or may have been moved.",
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="max-w-lg w-full text-center bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="bg-blue-50 p-4 rounded-full">
            <AlertTriangle className="w-10 h-10 text-blue-600" />
          </div>
        </div>

        {/* Error Code */}
        <h1 className="text-7xl font-extrabold tracking-tight text-blue-700">
          {code}
        </h1>

        {/* Title */}
        <h2 className="mt-2 text-2xl font-semibold text-slate-800">
          {title}
        </h2>

        {/* Message */}
        <p className="mt-3 text-slate-600">
          {message}
        </p>

        {/* Divider */}
        <div className="h-px bg-slate-200 my-6" />

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
          >
            <RefreshCcw className="w-4 h-4" />
            Retry
          </button>

          <a
            href="/"
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition"
          >
            <Home className="w-4 h-4" />
            Go to Home
          </a>
        </div>

        {/* Footer */}
        <p className="mt-6 text-xs text-slate-400">
          LNMIIT Canteen Services • {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
