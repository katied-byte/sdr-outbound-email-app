'use client'

import { GeneratedEmail } from '@/types'
import { getEmailSignature } from '@/config/email-style'

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
  emailFromApi?: boolean
  /** True when server used HubSpot template only (SKIP_GEMINI_PERSONALIZATION). */
  usingStaticTemplate?: boolean
  generateError?: string | null
  /** Signature text for preview (e.g. from getEmailSignature(firstName, lastName)). */
  signatureText?: string
  /** One lead at a time from hub: clearer back / send labels */
  returnToHubLabels?: boolean
  /** Walk every lead: Next without send, Send & next, Back to list */
  previewAllSequential?: boolean
  onNextPreview?: () => void | Promise<void>
  /** True when this is the last contact in the preview-all walk */
  isLastInPreviewQueue?: boolean
  previewRank?: number
  previewTotal?: number
  /** When true (live Smartlead only), Send buttons that enroll leads are disabled. */
  sendToSmartleadBlocked?: boolean
  sendToSmartleadBlockedReason?: string
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
  emailFromApi = true,
  usingStaticTemplate = false,
  generateError = null,
  signatureText = getEmailSignature('', ''),
  returnToHubLabels = false,
  previewAllSequential = false,
  onNextPreview,
  isLastInPreviewQueue = false,
  previewRank = 0,
  previewTotal = 0,
  sendToSmartleadBlocked = false,
  sendToSmartleadBlockedReason = '',
}: EmailEditorProps) {
  const smartleadSendDisabled = !testMode && sendToSmartleadBlocked
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
          Preparing email preview…
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
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Email Preview</h2>
          {previewAllSequential && previewTotal > 0 && (
            <p className="text-xs text-teal-700 font-medium mt-0.5">
              Preview all · {previewRank} of {previewTotal} (with email)
            </p>
          )}
          {usingStaticTemplate && (
            <p className="text-xs text-sky-800 bg-sky-50 border border-sky-100 rounded px-2 py-1 mt-1">
              <strong>No AI:</strong> Gemini is off. Use{' '}
              <code className="text-[10px]">NEXT_PUBLIC_SKIP_GEMINI_PERSONALIZATION=true</code> in{' '}
              <code className="text-[10px]">.env.local</code> (restart dev). HubSpot-based template — edit below before send.
            </p>
          )}
          {testMode && !emailFromApi && (
            <p className="text-xs text-amber-600 mt-0.5">
              Showing preview (API failed). {generateError ? `Reason: ${generateError}` : 'Check Network tab for /api/generate.'}
            </p>
          )}
        </div>
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

        {/* Full First Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            First Email (full body)
          </label>
          <textarea
            value={email.personalizedIntro}
            onChange={handleIntroChange}
            rows={10}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-y"
            placeholder="Hi Name, — then 2 short lines + CTA (greeting is inside this field)…"
          />
          <p className="text-xs text-gray-500 mt-1">
            This field includes the greeting (Hi {'{{first_name}}'}, or Hi there,). In Smartlead use: {`{{personalized_intro}}`} %signature% — do not add another Hi line in the template or it will duplicate.
          </p>
        </div>

        {/* Preview of full email */}
        <div className="bg-gray-50 rounded-lg p-4 text-sm">
          <p className="text-gray-500 mb-2">Preview:</p>
          <div className="text-gray-700 space-y-2 whitespace-pre-wrap">
            <p className="text-primary-600">{email.personalizedIntro || '(email body will appear here)'}</p>
            <p className="text-gray-400 whitespace-pre-wrap">{signatureText}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 pt-4 border-t border-gray-100 space-y-3">
        {smartleadSendDisabled && sendToSmartleadBlockedReason ? (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            {sendToSmartleadBlockedReason}
          </p>
        ) : null}
        {previewAllSequential && onNextPreview ? (
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:justify-between">
            <button
              type="button"
              onClick={onSkip}
              disabled={isSending}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 order-3 sm:order-1"
            >
              Back to list
            </button>
            <div className="flex flex-col sm:flex-row gap-2 order-1 sm:order-2 sm:ml-auto">
              <button
                type="button"
                onClick={() => void onNextPreview()}
                disabled={isSending || isLoading}
                className="px-5 py-2.5 rounded-lg border-2 border-teal-600 text-teal-800 font-medium hover:bg-teal-50 disabled:opacity-50"
              >
                {isLastInPreviewQueue ? 'Finish preview' : 'Next lead →'}
              </button>
              <button
                type="button"
                onClick={onSend}
                disabled={isSending || isLoading || smartleadSendDisabled}
                className={`px-5 py-2.5 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                  testMode
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'bg-primary-600 hover:bg-primary-700'
                }`}
              >
                {isSending ? (
                  <>
                    <span className="animate-spin">⏳</span> {testMode ? 'Working…' : 'Sending…'}
                  </>
                ) : testMode ? (
                  isLastInPreviewQueue ? 'Log & finish' : 'Log & next'
                ) : isLastInPreviewQueue ? (
                  'Send & finish'
                ) : (
                  'Send & next'
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onSkip}
              disabled={returnToHubLabels ? isSending : isLastLead || isSending}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
            >
              {returnToHubLabels ? 'Back to list' : 'Skip Lead'}
            </button>

            <button
              type="button"
              onClick={onSend}
              disabled={isSending || isLoading || smartleadSendDisabled}
              className={`px-6 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                testMode
                  ? 'bg-purple-600 hover:bg-purple-700'
                  : 'bg-primary-600 hover:bg-primary-700'
              }`}
            >
              {isSending ? (
                <>
                  <span className="animate-spin">⏳</span>
                  {testMode ? 'Working…' : 'Sending…'}
                </>
              ) : returnToHubLabels ? (
                <>{testMode ? 'Log to console & return' : 'Send to Smartlead & return'}</>
              ) : (
                <>
                  {testMode ? 'Preview' : 'Send'} & {isLastLead ? 'Finish' : 'Next'}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
