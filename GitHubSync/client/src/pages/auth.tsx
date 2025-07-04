import { useEffect } from "react";
import { useLocation } from "wouter";
import { Github } from "lucide-react";

export default function Auth() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auth') === 'success') {
      setLocation('/');
    }
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-github-bg">
      <div className="bg-white p-8 rounded-lg border border-github-border shadow-sm max-w-md w-full mx-4">
        <div className="text-center">
          <Github className="h-12 w-12 text-github-blue mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Authenticating...</h1>
          <p className="text-github-gray">
            Please wait while we complete your authentication.
          </p>
        </div>
      </div>
    </div>
  );
}
