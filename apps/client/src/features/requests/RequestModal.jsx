import { useNavigate } from 'react-router';
import { Send } from 'lucide-react';
import { LIMITS, matchRequestCreateSchema } from '@skillbridge/shared';
import { Modal, Button, Select, TextArea, FormErrorSummary, Alert, levelLabel } from '../../components/ui/index.js';
import { requestsApi } from '../api.js';
import { useForm } from '../../hooks/useForm.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatDateTime } from '../../utils/format.js';

/**
 * "Request a learning session" form (SB2/US12, US24, US31).
 * The mentor's teaching skills are the only choices; a skill the learner already
 * wants to learn is pre-selected. A duplicate request takes the learner to the
 * request that is already open instead of showing an error.
 */
export function RequestModal({ open, onClose, mentor, skills, preselectId, nextSlot, viewerTimezone }) {
  const toast = useToast();
  const navigate = useNavigate();
  const form = useForm({
    initialValues: {
      mode: 'direct',
      mentorId: mentor.id,
      skillId: preselectId ?? skills[0]?.skill?.id ?? '',
      message: '',
    },
    schema: matchRequestCreateSchema,
    onSubmit: async (values) => {
      try {
        const { data } = await requestsApi.create({ ...values, message: values.message.trim() || undefined });
        toast.success(`Request sent. ${mentor.name} will be notified as soon as it is processed.`);
        navigate(`/requests/${data.request.id}`);
      } catch (err) {
        if (err.code === 'DUPLICATE_REQUEST' && err.details?.requestId) {
          toast.info('You already have an open request with this mentor for that skill.');
          navigate(`/requests/${err.details.requestId}`);
          return;
        }
        throw err;
      }
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Request a session with ${mentor.name}`}
      description="Choose what you want to learn and add a short note. The mentor can accept or decline."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="request-form" leftIcon={Send} loading={form.submitting}>
            Send request
          </Button>
        </>
      }
    >
      <form id="request-form" onSubmit={form.handleSubmit} noValidate aria-label="Learning request">
        <FormErrorSummary
          ref={form.summaryRef}
          errors={form.errors}
          formError={form.formError}
          labels={{ skillId: 'Skill', message: 'Message', mentorId: 'Mentor' }}
        />
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <Select
            label="Skill"
            required
            options={skills.map((s) => ({
              value: s.skill.id,
              label: `${s.skill.name} · ${levelLabel('teach', s.proficiency)}`,
            }))}
            {...form.field('skillId')}
          />
          <TextArea
            label="Message (optional)"
            rows={4}
            maxLength={LIMITS.REQUEST_MESSAGE_MAX}
            placeholder="What would you like to learn, and what do you already know?"
            {...form.field('message')}
          />
          {nextSlot ? (
            <Alert tone="info" title="Suggested first session">
              {formatDateTime(nextSlot.startsAt, viewerTimezone)} your time (30 minutes). It is confirmed when the
              mentor accepts.
            </Alert>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
