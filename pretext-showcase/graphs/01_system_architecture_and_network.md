# System Architecture & Network Boot Sequence

This document maps the structural architecture of the `pretext-showcase` application and details exactly how the network behaves when a client opens the browser.

## Network Loading Sequence Map

```mermaid
sequenceDiagram
    participant Browser as Client Browser
    participant Vite as Vite Dev Server
    participant GitHub as Google Fonts API
    
    Note over Browser, Vite: 1. Initial Document Request
    Browser->>Vite: GET /index.html
    Vite-->>Browser: 200 OK (index.html)
    
    par Parallel Asset Fetching
        Browser->>Vite: GET /src/style.css
        Browser->>Vite: GET /src/main.ts (ES Module)
        Browser->>Vite: GET /public/assets/character.webm
        Browser->>GitHub: GET CSS @import (Noto Sans JP)
    end
    
    GitHub-->>Browser: Font Stylesheet
    Browser->>GitHub: GET WOFF2 Font payload
    Vite-->>Browser: 200 OK (style.css)
    
    note right of Vite: Server resolves parent directory<br>monorepo dependencies natively
    Vite-->>Browser: 200 OK (main.ts + @chenglou/pretext/dist/layout.js)
    
    note over Browser: 2. Core Execution Phase
    Browser->>Browser: DOMContentLoaded
    Browser->>Browser: Parse main.ts & Execute Text Pre-computation
    
    Vite-->>Browser: 206 Partial Content (character.webm chunks Streamed)
    Browser->>Browser: <video> element buffers enough data (readyState >= 2)
    Browser->>Browser: Triggers `requestAnimationFrame` render engine
```

## System Component Architecture

```mermaid
architecture-beta
    group App(cloud)[Browser Client Application]
    
    service DOM(database)[DOM Tree] in App
    service Canvas(database)[Main Thread Canvas] in App
    service Vid(database)[Hidden Video Element] in App
    
    service Vite(server)[Vite Dev Server]
    
    service Pretext(server)[@chenglou/pretext Library] in App
    
    Vite:L -- R:DOM
    Vid:T -- B:DOM
    Canvas:T -- B:DOM
    Pretext:R -- L:Canvas
```

### Component Breakdown
1. **Vite Dev Server:** Enabled via custom `server.fs.allow` to serve monorepo parent folders securely, delivering `.ts` files on the fly.
2. **Hidden Video Element:** Acts as the data source. Streams `.webm` chunks without ever mounting visibly to the user.
3. **Pretext Library (`layout.js`):** A zero-dependency manual text-shaping engine. Completely detached from the DOM, performing purely mathematical computations `O(N)`.
4. **Main Thread Canvas:** The singular rendering surface. Re-paints thousands of `fillTexts` synchronously at 60 FPS instead of relying on heavily optimized DOM layout trees.
