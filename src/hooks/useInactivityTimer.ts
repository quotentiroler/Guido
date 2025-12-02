import { useEffect } from 'react';

const useInactivityTimer = (
  timeout: number,
  onTimeout: () => void,
  onActivity: () => void
) => {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(onTimeout, timeout);
    };

    const handleUserActivity = () => {
      onActivity();
      resetTimer();
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);

    resetTimer();

    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
    };
  }, [timeout, onTimeout, onActivity]);
};

export default useInactivityTimer;