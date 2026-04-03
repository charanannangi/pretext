# Core Animation Render Loop

This diagram maps the precise execution order inside the 60 FPS `requestAnimationFrame` cycle. Because DOM operations are too slow for real-time text manipulation, everything operates in memory and paints to Canvas directly.

## Frame Execution Pipeline

```mermaid
flowchart TD
    Start((Frame Start)) --> CheckReady{Is Video readyState >= 2?}
    
    CheckReady -- Yes --> ClearOffscreen[Clear Offscreen Canvas]
    CheckReady -- No --> RenderText
    
    subgraph Phase 1: Video Extraction Buffer
        ClearOffscreen --> DrawVid[Draw scaled video frame to offscreenCtx]
        DrawVid --> GetImgData[Extract Raw Uint8ClampedArray via getImageData]
    end
    
    GetImgData --> ScanPixels{Begin Chroma Scan Loop}
    
    subgraph Phase 2: Signal Processing & Masking
        ScanPixels --> HasGreen[Is Pixel Green (thresh > 90)?]
        HasGreen -- Yes --> SetAlpha[Set Alpha to 0]
        HasGreen -- No --> ExtractBounds[Identify non-transparent boundaries]
        ExtractBounds --> UpdateMinMax[Update rowBounds minX/maxX for current lineIndex]
        SetAlpha --> NextPixel
        UpdateMinMax --> NextPixel
    end
    
    NextPixel[Loop Through Canvas] -->|End of Array| PutImgData[Commit ImageData back to offscreenCtx]
    PutImgData --> SmoothBounds
    
    subgraph Phase 3: Mathematical Layout Pre-computation
        SmoothBounds[Calculate EMA interpolation on boundaries]
        SmoothBounds --> MapSegments[Partition each row into Left/Right dynamic blocks]
        MapSegments --> PretextMeasure[Ping Pretext engine to measure segment strings natively]
    end
    
    subgraph Phase 4: Main Paint Cycle
        RenderText[Clear Main Screen Canvas]
        PretextMeasure --> DrawText[Draw pre-computed text batches using right/left alignments]
        DrawText --> CompositeVideo[Splice transparent Offscreen character over text layer]
    end
    
    CompositeVideo --> End((Frame End))
    End -.->|requestAnimationFrame| Start
```

### Critical Flow Mechanics
- There are strictly **two canvases**. A main, visible canvas, and a hidden offscreen canvas caching the video snapshot.
- To prevent heavy memory leak allocations, `getImageData` arrays and layout array buffers are recycled linearly without triggering continuous garbage collection payload stalls.
