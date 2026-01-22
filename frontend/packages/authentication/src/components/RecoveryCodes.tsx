import { useState } from "react";

interface RecoveryCodesProps {
  codes: string[];
  onAcknowledge: () => void;
}

export default function RecoveryCodes({ codes, onAcknowledge }: RecoveryCodesProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const codesText = codes.join('\n');
    navigator.clipboard.writeText(codesText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const codesText = `AEGIS RECOVERY CODES
======================
Save these codes in a secure location.
You'll need them if you forget your password.

${codes.map((code, idx) => `${idx + 1}. ${code}`).join('\n')}

⚠️ IMPORTANT:
- Each code can only be used once
- Store these codes securely (not in your browser)
- Never share these codes with anyone
`;
    
    const blob = new Blob([codesText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aegis-recovery-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Save Your Recovery Codes
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>These codes will only be shown once. You'll need them to recover your account if you forget your password.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-100 p-4 rounded-lg">
        <h4 className="font-semibold mb-3 text-gray-700">Your Recovery Codes:</h4>
        <div className="bg-white p-4 rounded border border-gray-300 font-mono text-sm space-y-2">
          {codes.map((code, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-gray-500 w-6">{idx + 1}.</span>
              <span className="font-semibold tracking-wider">{code}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          className="btn btn-teal flex-1 flex items-center justify-center gap-2"
          onClick={handleDownload}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </button>
        <button
          className={`btn ${copied ? 'bg-green-500' : 'bg-gray-500'} text-white flex-1 flex items-center justify-center gap-2`}
          onClick={handleCopy}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {copied ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            )}
          </svg>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <div className="bg-white border border-gray-300 rounded p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm text-gray-700">
            I have saved my recovery codes in a secure location and understand that I won't be able to see them again.
          </span>
        </label>
      </div>

      <button
        className={`btn btn-teal auth-button w-full ${!acknowledged ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={onAcknowledge}
        disabled={!acknowledged}
      >
        Continue to Extension
      </button>
    </div>
  );
}
