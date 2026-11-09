import { useRef, useState } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { AVATAR_MIME_TYPES, LIMITS } from '@skillbridge/shared';
import { Avatar, Button } from '../../components/ui/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { profileApi } from '../api.js';
import styles from './Profile.module.css';

/**
 * Profile photo upload (SB1/US17). The browser checks type and size first for
 * instant feedback; the server checks again, including the real file bytes.
 */
export function AvatarUploader({ name, avatarUrl, onChange }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const toast = useToast();

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    if (!AVATAR_MIME_TYPES.includes(file.type)) {
      setError('Please choose a JPEG, PNG or WebP image.');
      return;
    }
    if (file.size > LIMITS.AVATAR_MAX_MB * 1024 * 1024) {
      setError(`That image is larger than ${LIMITS.AVATAR_MAX_MB} MB. Please choose a smaller one.`);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    setBusy('upload');
    try {
      const { data } = await profileApi.uploadAvatar(file);
      onChange(data.avatarUrl);
      toast.success('Profile photo updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
      setPreview(null);
      URL.revokeObjectURL(url);
    }
  }

  async function remove() {
    setBusy('remove');
    setError(null);
    try {
      await profileApi.removeAvatar();
      onChange(null);
      toast.success('Profile photo removed.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.avatarUploader}>
      <Avatar name={name} src={preview ?? avatarUrl} size={88} />
      <div>
        <p className={styles.avatarTitle}>Profile photo</p>
        <p className={styles.avatarHint}>
          JPEG, PNG or WebP, up to {LIMITS.AVATAR_MAX_MB} MB. A clear face photo helps people recognise you.
        </p>
        <div className={styles.avatarActions}>
          <input
            ref={inputRef}
            type="file"
            accept={AVATAR_MIME_TYPES.join(',')}
            className="sr-only"
            onChange={handleFile}
            aria-label="Choose a profile photo"
            tabIndex={-1}
          />
          <Button
            variant="secondary"
            size="sm"
            leftIcon={Upload}
            loading={busy === 'upload'}
            onClick={() => inputRef.current?.click()}
          >
            {avatarUrl ? 'Change photo' : 'Upload photo'}
          </Button>
          {avatarUrl ? (
            <Button variant="ghost" size="sm" leftIcon={Trash2} loading={busy === 'remove'} onClick={remove}>
              Remove
            </Button>
          ) : null}
        </div>
        {error ? (
          <p className={styles.avatarError} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
