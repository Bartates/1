import { toast } from 'sonner';
import { useSoundFeedback } from '@/hooks/useSoundFeedback';
import type { SoundType } from '@/hooks/useSoundFeedback';

const soundTypeMap: Record<string, SoundType> = {
  success: 'success',
  error: 'error',
  warning: 'warning',
  info: 'notification',
};

const SPEECH_TYPES = new Set(['error', 'warning']);

function cleanForSpeech(msg: string): string {
  // Emoji ve özel karakterleri temizle (variation selector içerenler ayrı)
  return msg
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // genel emoji aralığı
    .replace(/[\u{2600}-\u{26FF}]/gu, '')    // çeşitli semboller
    .replace(/[\u{2700}-\u{27BF}]/gu, '')    // dingbats
    .replace(/\uFE0F/g, '')                  // variation selector-16
    .trim();
}

export function useToast() {
  const { playSound, speakMessage } = useSoundFeedback();

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    playSound(soundTypeMap[type]);

    if (SPEECH_TYPES.has(type)) {
      const cleaned = cleanForSpeech(message);
      if (cleaned) {
        setTimeout(() => speakMessage(cleaned), 400);
      }
    }

    if (type === 'success') toast.success(message);
    else if (type === 'error') toast.error(message);
    else if (type === 'warning') toast.warning(message);
    else toast.info(message);
  };

  return { showToast };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
