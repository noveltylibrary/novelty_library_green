# Guest blank-page fix

The onboarding is lazy-loaded only after SplashIntro completes and is wrapped in an error boundary. If the onboarding chunk or any runtime code fails, the rest of Novelty Library remains visible instead of rendering a blank page.

The onboarding final-screen preview no longer imports ProfileCard/html-to-image on the guest shell path, reducing the chance of a browser-side module failure before the modal can render.
