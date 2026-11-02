import { mayInstallUpdate } from './domain/appUpdates'

type UpdateDialogProps = {
  currentVersion: string
  version: string
  notes: string
  backupPath: string | null
  backupMessage: string | null
  skipConfirmed: boolean
  confirmingSkip: boolean
  installing: boolean
  progress: string | null
  error: string | null
  onBackup: () => void
  onAskSkip: () => void
  onConfirmSkip: () => void
  onCancelSkip: () => void
  onInstall: () => void
  onClose: () => void
}

export function UpdateDialog({
  currentVersion,
  version,
  notes,
  backupPath,
  backupMessage,
  skipConfirmed,
  confirmingSkip,
  installing,
  progress,
  error,
  onBackup,
  onAskSkip,
  onConfirmSkip,
  onCancelSkip,
  onInstall,
  onClose,
}: UpdateDialogProps) {
  const installAllowed = mayInstallUpdate({ backupPath, skipConfirmed })

  return (
    <div className="confirm-backdrop update-backdrop" role="presentation">
      <section className="confirm-dialog update-dialog" role="dialog" aria-modal="true" aria-labelledby="update-title">
        <p className="eyebrow">Update available</p>
        <h3 id="update-title">Version {version} is ready</h3>
        <p>You are running {currentVersion}. The update installs only after you choose to continue.</p>
        {notes ? <pre className="update-notes">{notes}</pre> : <p>No release notes were published.</p>}
        <div className="update-callout">
          <strong>Back up the full database first.</strong>
          <p>
            This saves every month and year, plus operators, positions, vacations, holidays, and Smart Assign settings.
            A single-month export is not enough.
          </p>
          <button type="button" className="primary" onClick={onBackup} disabled={installing}>
            Back up full database
          </button>
          {backupMessage ? <p className="backup-saved">{backupMessage}</p> : null}
        </div>
        {confirmingSkip ? (
          <div className="update-skip">
            <strong>Continue without backup?</strong>
            <p>If the update fails, you may not have a copy of the schedule to restore.</p>
            <div className="confirm-actions">
              <button type="button" onClick={onCancelSkip} disabled={installing}>Go back</button>
              <button type="button" className="danger" onClick={onConfirmSkip} disabled={installing}>Continue without backup</button>
            </div>
          </div>
        ) : null}
        {progress ? <p>{progress}</p> : null}
        {error ? <p className="update-error">{error}</p> : null}
        <div className="confirm-actions">
          <button type="button" onClick={onClose} disabled={installing}>Not now</button>
          {!confirmingSkip ? (
            <button type="button" onClick={onAskSkip} disabled={installing || Boolean(backupPath)}>
              Continue without backup
            </button>
          ) : null}
          <button type="button" className="primary" onClick={onInstall} disabled={!installAllowed || installing}>
            Download and install
          </button>
        </div>
      </section>
    </div>
  )
}
