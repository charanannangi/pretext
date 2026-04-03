# Chroma Key Pixel Processing Pipeline

This document maps how the video stream is ripped, parsed, and converted into mathematical layout constraints via pixel-peeping.

## Row Bounding Strategy

To wrap the text perfectly against the curve of the Anime character, it is not enough to simply extract a generic rectangular "bounding box." The text engine needs incredibly granular rows mirroring the actual text lines.

The algorithm runs sequentially across the entire image buffer extracting **row-by-row silhouettes**.

```mermaid
stateDiagram-v2
    [*] --> ExtractVideoFrame
    ExtractVideoFrame --> Uint8ClampedArray : Canvas 2D GetImageData
    
    state "Row Parsing Loop" as RowLoop {
        state "Horizontal Scan" as HScan {
            EvaluatePixel --> ChromaCondition
            
            state ChromaCondition <<choice>>
            ChromaCondition --> Transparent : if (G > 90 & G > R*1.1 & G > B*1.1)
            ChromaCondition --> Opaque : else
            
            Transparent --> ApplyZeroAlpha
            Opaque --> IdentifyExtremes
            
            IdentifyExtremes --> MinBoundary: if (x < minX)
            IdentifyExtremes --> MaxBoundary: if (x > maxX)
            
            MinBoundary --> FlagPixelExists
            MaxBoundary --> FlagPixelExists
        }
        
    }
    
    Uint8ClampedArray --> RowLoop
    RowLoop --> UpdateOffscreenCanvas : putImageData
    UpdateOffscreenCanvas --> [*] : Video Rendered Over Text Layer
```

### Color Science Logic
The system implements a basic RGB delta comparison to detect "Green Screen" backgrounds dynamically without requiring massive shader pipelines.
1. `G > 90` -> Validates the pixel has a healthy saturation of green (filters out dark shadows).
2. `G > R*1.1` & `G > B*1.1` -> Ensures Green is mathematically the dominant color by at least a 10% margin, avoiding aggressively stripping out flesh tones or pale eye colors.
