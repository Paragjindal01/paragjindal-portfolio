import { useEffect, useRef, useState } from 'react';
import { SiteNav } from '../higgsfield/home/chrome.tsx';
import RobotVoiceGreeting from './robot/RobotVoiceGreeting.jsx';
import '../higgsfield/home/shared-chrome.css';
import './greeting-page.css';

const sceneUrl = 'https://prod.spline.design/wmlbgIVajKF3kFwY/scene.splinecode';
const posterUrl = '/assets/img/greeting-robot.webp';

export default function GreetingPage() {
  const canvasRef = useRef(null);
  const sceneCaptionRef = useRef(null);
  const splineRef = useRef(null);
  const [scene, setScene] = useState(() => (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? { status: 'paused', attempt: 0 }
      : { status: 'loading', attempt: 1 }
  ));
  const { status, attempt } = scene;
  const ready = status === 'ready';

  useEffect(() => {
    document.title = 'Interactive 3D Greeting | Parag Jindal';
  }, []);

  useEffect(() => {
    if (!attempt) return undefined;
    const canvas = canvasRef.current;
    const controller = new AbortController();
    let app;

    function release() {
      controller.abort();
      clearTimeout(timeout);
      if (splineRef.current === app) splineRef.current = null;
      app?.dispose();
      app = undefined;
    }

    function fail(event) {
      event?.preventDefault();
      if (controller.signal.aborted) return;
      release();
      setScene(current => ({ ...current, status: 'unavailable' }));
    }

    const timeout = setTimeout(fail, 15_000);
    canvas.addEventListener('webglcontextlost', fail);
    async function loadScene() {
      const { Application } = await import('@splinetool/runtime');
      if (controller.signal.aborted) return;
      app = new Application(canvas, { renderMode: 'auto' });
      await app.load(sceneUrl, undefined, { signal: controller.signal });
      if (controller.signal.aborted) return;
      clearTimeout(timeout);
      splineRef.current = app;
      if (import.meta.env.DEV) window.__splineProbe = app;
      setScene(current => ({ ...current, status: 'ready' }));
    }
    loadScene().catch(() => fail());

    return () => {
      canvas.removeEventListener('webglcontextlost', fail);
      if (!controller.signal.aborted) release();
    };
  }, [attempt]);

  function startScene() {
    sceneCaptionRef.current?.focus({ preventScroll: true });
    setScene(current => ({ status: 'loading', attempt: current.attempt + 1 }));
  }

  return (
    <div className="higgsfield-home greeting-page">
      <a className="skip-link" href="#greeting-main">Skip to greeting</a>
      <SiteNav />
      <main className="greeting-main" id="greeting-main">
        <a className="greeting-back" href="/#about"><span aria-hidden="true">←</span> Back to portfolio</a>
        <div className="greeting-layout">
          <header className="greeting-intro">
            <h1>Interactive <span>3D greeting</span></h1>
            <p>A short introduction to my work in AI and GPU infrastructure. Listen to the assistant or follow along with captions.</p>
          </header>

          <figure className="greeting-stage" aria-label="Parag’s 3D assistant">
            <div className="greeting-stage__viewport" data-scene-status={status}>
              <img alt="" className="greeting-stage__poster" src={posterUrl} width={712} height={680} />
              {attempt > 0 && <canvas aria-hidden="true" className="greeting-stage__canvas" key={attempt} ref={canvasRef} />}
            </div>
            <figcaption className="greeting-stage__caption" ref={sceneCaptionRef} tabIndex={-1}>
              {status === 'loading' && <span role="status">Loading the 3D assistant…</span>}
              {ready && <span className="greeting-stage__instruction">Move your pointer to interact</span>}
              {ready && <span className="greeting-stage__touch">3D assistant ready</span>}
              {status === 'paused' && <button type="button" onClick={startScene}>Load 3D scene</button>}
              {status === 'unavailable' && <>
                <span role="status">The 3D scene is unavailable</span>
                <button type="button" onClick={startScene}>Retry scene</button>
              </>}
            </figcaption>
          </figure>

          <div className="greeting-voice">
            <RobotVoiceGreeting splineRef={splineRef} robotLoaded={ready} />
          </div>
        </div>
      </main>
    </div>
  );
}
