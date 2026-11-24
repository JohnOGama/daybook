// A short tone (and a buzz on phones) to say a timer is over. Browsers without audio just skip it.
export function chime() {
  try {
    const audio = new AudioContext();
    const tone = audio.createOscillator();
    const volume = audio.createGain();
    tone.frequency.value = 880;
    volume.gain.setValueAtTime(0.2, audio.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.5);
    tone.connect(volume).connect(audio.destination);
    tone.onended = () => void audio.close();
    tone.start();
    tone.stop(audio.currentTime + 0.5);
  } catch {
    // No audio here; the timer still ends.
  }
  navigator.vibrate?.(200);
}
