import { useState } from 'react';
import { Check, X, RotateCcw, Ban } from 'lucide-react';
import { LIMITS } from '@skillbridge/shared';
import { Button, ConfirmDialog, TextArea } from '../../components/ui/index.js';
import { requestsApi } from '../api.js';
import { useToast } from '../../context/ToastContext.jsx';
import styles from './Requests.module.css';

/**
 * Accept / Decline (mentor), Cancel / Retry (learner) for one request
 * (SB2/US14–16, US45). Which buttons appear comes from `request.actions`,
 * which the API computes from the state machine – the server re-checks every click.
 */
export function RequestActions({ request, onChanged, size = 'md' }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [reason, setReason] = useState('');
  const { actions } = request;
  const who = request.partner?.name ?? 'the other person';

  async function run(kind, fn, message) {
    setBusy(kind);
    try {
      const { data } = await fn();
      toast.success(message);
      setConfirm(null);
      setReason('');
      onChanged?.(data.request ?? data);
    } catch (err) {
      toast.error(err.message);
      if (err.code === 'INVALID_TRANSITION') onChanged?.(null);
    } finally {
      setBusy(null);
    }
  }

  if (!Object.values(actions ?? {}).some(Boolean)) return null;

  return (
    <div className={styles.actions}>
      {actions.canAccept ? (
        <Button
          size={size}
          leftIcon={Check}
          loading={busy === 'accept'}
          onClick={() =>
            run('accept', () => requestsApi.accept(request.id), `Accepted. Your session with ${who} is booked.`)
          }
        >
          Accept
        </Button>
      ) : null}
      {actions.canDecline ? (
        <Button size={size} variant="secondary" leftIcon={X} onClick={() => setConfirm('decline')}>
          Decline
        </Button>
      ) : null}
      {actions.canCancel ? (
        <Button size={size} variant="secondary" leftIcon={Ban} onClick={() => setConfirm('cancel')}>
          Cancel request
        </Button>
      ) : null}
      {actions.canRetry ? (
        <Button
          size={size}
          leftIcon={RotateCcw}
          loading={busy === 'retry'}
          onClick={() => run('retry', () => requestsApi.retry(request.id), 'Sent again. We are matching it now.')}
        >
          Retry
        </Button>
      ) : null}

      <ConfirmDialog
        open={confirm === 'decline'}
        title={`Decline ${who}'s request?`}
        message={`${who} will be told. You can add a short reason to help them.`}
        confirmLabel="Decline request"
        busy={busy === 'decline'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => run('decline', () => requestsApi.decline(request.id, reason.trim()), 'Request declined.')}
      >
        <TextArea
          id={`decline-reason-${request.id}`}
          label="Reason (optional)"
          rows={3}
          maxLength={LIMITS.DECLINE_REASON_MAX}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. I'm fully booked this month"
        />
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === 'cancel'}
        title="Cancel this request?"
        message={
          request.status === 'pending'
            ? `${who} will be told that you withdrew it.`
            : 'It has not been sent to a mentor yet.'
        }
        confirmLabel="Cancel request"
        cancelLabel="Keep request"
        busy={busy === 'cancel'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => run('cancel', () => requestsApi.cancel(request.id), 'Request cancelled.')}
      />
    </div>
  );
}
