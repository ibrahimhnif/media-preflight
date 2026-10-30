import { useState, type DragEvent } from 'react';
import { loadImage, loadVideo, type Design } from '../lib/image';

const IMAGE_TYPES = ['image/png', 'image/jpeg'];

export function Upload(props: { allowVideo: boolean; onLoaded: (design: Design) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);

  async function take(file: File | undefined) {
    if (!file) return;
    setError('');
    const isVideo = file.type.startsWith('video/');
    if (!IMAGE_TYPES.includes(file.type) && !(props.allowVideo && isVideo)) {
      setError(props.allowVideo ? 'Pakai file PNG, JPG, atau video.' : 'Pakai file PNG atau JPG. PDF dan AI belum didukung di v1.');
      return;
    }
    setBusy(true);
    try {
      props.onLoaded(await (isVideo ? loadVideo(file) : loadImage(file)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setOver(false);
    void take(event.dataTransfer.files[0]);
  }

  return (
    <>
      <label
        className={`dropzone${over ? ' over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <input
          type="file"
          data-testid="file-input"
          accept={props.allowVideo ? 'image/png,image/jpeg,video/*' : 'image/png,image/jpeg'}
          onChange={(e) => {
            void take(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <strong>{busy ? 'Membaca file…' : 'Pilih atau tarik file desain ke sini'}</strong>
        <span>{props.allowVideo ? 'PNG, JPG, atau video' : 'PNG atau JPG'}. File tetap di perangkat Anda dan tidak dikirim ke mana pun.</span>
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
