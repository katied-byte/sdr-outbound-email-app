'use client'

import { GeneratedEmail } from '@/types'

interface EmailEditorProps {
  email: GeneratedEmail | null
  isLoading: boolean
  isSending: boolean
  onRegenerate: () => void
  onSend: () => void
  onSkip: () => void
  onEmailChange: (email: GeneratedEmail) => void
  isLastLead: boolean
  testMode?: boolean
}

export default function EmailEditor({
  email,
  isLoading,
  isSending,
  onRegenerate,
  onSend,
  onSkip,
  onEmailChange,
  isLastLead,
  testMode = false,
}: EmailEditorProps) {
  if (isLoading && !email) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-100 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4 mt-6"></div>
          <div className="h-32 bg-gray-100 rounded"></div>
        </div>
        <p className="text-sm text-gray-500 mt-4 text-center">
          Generating personalized email with AI...
        </p>
      </div>
    )
  }

  if (!email) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 flex items-center justify-center">
        <p className="text-gray-500">Select a lead to generate an email</p>
      </div>
    )
  }

  const handleSubjectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onEmailChange({ ...email, subject: e.target.value })
  }

  const handleIntroChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onEmailChange({ ...email, personalizedIntro: e.target.value })
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Email Preview</h2>
        <button
          onClick={onRegenerate}
          disabled={isLoading}
          className="text-sm text-primary-600 hover:text-primary-700 disabled:opacity-50"
        >
          {isLoading ? 'Generating...' : '↻ Regenerate'}
        </button>
      </div>

      <div className="space-y-4">
        {/* Subject Line */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Subject Line
          </label>
          <input
            type="text"
            value={email.subject}
            onChange={handleSubjectChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        {/* Personalized Opening */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Personalized Opening
          </label>
          <textarea
            value={email.personalizedIntro}
            onChange={handleIntroChange}
            rows={5}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            This will be inserted as the opening paragraph. The rest of the email comes from the Smartlead campaign template.
          </p>
        </div>

        {/* Preview of full email structure */}
        <div className="bg-gray-50 rounded-lg p-4 text-sm">
          <p className="text-gray-500 mb-2">Email structure:</p>
          <div className="text-gray-700 space-y-2">
            <p>Hi [First Name],</p>
            <p className="text-primary-600 italic">{email.personalizedIntro.slice(0, 100)}...</p>
            <p className="text-gray-400">[Rest of campaign template]</p>
            <p className="text-gray-400">[Signature]</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
        <button
          onClick={onSkip}
          disabled={isLastLead || isSending}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
        >
          Skip Lead
        </button>
        
        <button
          onClick={onSend}
          disabled={isSending || isLoading}
          className={`px-6 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
            testMode 
              ? 'bg-purple-600 hover:bg-purple-700' 
              : 'bg-primary-600 hover:bg-primary-700'
          }`}
        >
          {isSending ? (
            <>
              <span className="animate-spin">⏳</span>
              {testMode ? 'Previewing...' : 'Sending...'}
            </>
          ) : (
            <>
              {testMode ? 'Preview' : 'Send'} & {isLastLead ? 'Finish' : 'Next'}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
