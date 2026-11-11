import { dockKeyframes, sourceLogoBox, fittedLogoBox, DOCK_DURATION, TAKEOFF_OFFSET } from './logo-dock.mjs?v=1';

(() => {
  const root = document.documentElement;
  const intro = document.getElementById('logo-intro');
  const video = document.getElementById('logo-intro-video');
  const content = document.getElementById('site-content');
  let finished = false;
  let watchdog;
  let frame;
  let jumping = false;
  let revealTimer;
  const jumpers = [];
  const animations = [];
  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(watchdog);
    clearTimeout(revealTimer);
    if (frame !== undefined) video.cancelVideoFrameCallback?.(frame);
    video.pause();
    animations.forEach(animation => animation.cancel());
    jumpers.forEach(element => element.remove());
    root.classList.remove("intro-landing");
    const restoreFocus = intro.contains(document.activeElement);
    content.inert = false;
    root.classList.remove('intro-pending');
    intro.remove();
    if (restoreFocus) document.querySelector('.wordmark')?.focus({preventScroll: true});
  }
  if (!root.classList.contains('intro-pending')) { finish(); return; }
  for (const asset of ['logo-dock-body.svg', 'logo-part-0.svg']) { const image = new Image(); image.src = `./assets/${asset}`; }
  content.inert = true;
  intro.focus({preventScroll: true});
  intro.addEventListener('keydown', event => { if (event.key === 'Escape') finish(); });
  video.addEventListener('ended', finish, {once: true});
  video.addEventListener('error', finish, {once: true});
  video.querySelector('source').addEventListener('error', finish, {once: true});
  function guard() { clearTimeout(watchdog); watchdog = setTimeout(finish, 8000); }
  // Continue after the sun and final head turn; don't reach the video's loop fade.
  function atOutro(time) {
    return Number.isFinite(video.duration) && time >= Math.min(4.55, Math.max(0, video.duration - 2));
  }
  function jumpToHeader() {
    if (finished || jumping) return;
    jumping = true;
    clearTimeout(watchdog);
    if (frame !== undefined) video.cancelVideoFrameCallback?.(frame);
    video.pause();
    const target = document.querySelector('.wordmark-icon');
    const box = target?.getBoundingClientRect();
    if (!box || box.top < 0 || box.bottom > innerHeight) { finish(); return; }
    const start = sourceLogoBox(video.getBoundingClientRect(), video.videoWidth, video.videoHeight);
    const destination = fittedLogoBox(box);
    const flights = [];
    // Keep the stack together; the sun retains its circular shape and catches up.
    [{ asset: 'logo-dock-body.svg', sun: false }, { asset: 'logo-part-0.svg', sun: true }].forEach(({ asset, sun }) => {
      const character = document.createElement('img');
      character.src = `./assets/${asset}`;
      character.className = 'intro-jumping-goats';
      character.alt = '';
      character.dataset.character = sun ? 'sun' : 'goat-stack';
      Object.assign(character.style, {left: start.left + 'px', top: start.top + 'px', width: start.width + 'px', height: start.height + 'px', transformOrigin: '50% 100%'});
      document.body.append(character);
      jumpers.push(character);
      const flight = character.animate(dockKeyframes(start, destination, { sun }), {duration: DOCK_DURATION, delay: sun ? 65 : 0, fill: 'both'});
      animations.push(flight);
      flights.push(flight.finished);
    });
    video.style.visibility = 'hidden';
    revealTimer = setTimeout(() => root.classList.add('intro-landing'), DOCK_DURATION * TAKEOFF_OFFSET);
    Promise.all(flights).then(finish).catch(() => {});
  }

  function checkFrame(now, metadata) {
    if (finished || jumping) return;
    if (atOutro(metadata.mediaTime)) { jumpToHeader(); return; }
    frame = video.requestVideoFrameCallback(checkFrame);
  }
  if (video.requestVideoFrameCallback) frame = video.requestVideoFrameCallback(checkFrame);
  video.addEventListener('timeupdate', () => {
    if (finished || jumping) return;
    if (atOutro(video.currentTime)) jumpToHeader();
    else guard();
  });
  guard();
  video.muted = true;
  video.play()?.catch(finish);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => { if (event.matches) finish(); });
  window.addEventListener('pagehide', finish, {once: true});
  window.addEventListener('resize', () => { if (jumping) finish(); });
})();
