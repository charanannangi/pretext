# Dynamic Text Layout Engine & Pretext Mechanics

This graph breaks down horizontally how the core layout loops interface with the `@chenglou/pretext` rendering API sequentially.

## The Temporal Smoothing Map

Because pixel loops return raw hardware data, analyzing bounding boxes frame-by-frame creates violent 1-2 pixel jitter resulting in entire text-blocks re-wrapping (the Waterfall Effect). The system resolves this via an Exponential Moving Average (EMA).

```mermaid
graph TD
   RawPix[Hardware Raw Pixel Bounds] -->|Frame Rendered| Buffer(rowBounds State Mutated)
   Buffer --> TargetMin[Target Min X Cache]
   Buffer --> TargetMax[Target Max X Cache]
   
   TargetMin --> DeltaMin{Calculate Gap Distance}
   TargetMax --> DeltaMax{Calculate Gap Distance}
   
   DeltaMin -->|* 0.25 Filter Rate| VisualMin[Smoothed MinX Visual Output]
   DeltaMax -->|* 0.25 Filter Rate| VisualMax[Smoothed MaxX Visual Output]
   
   VisualMin --> Pretext[Inject to Pretext layoutBounds Engine]
   VisualMax --> Pretext
```

## Wrapping Logic Sequence

```mermaid
sequenceDiagram
    participant State as System State
    participant Pretext as layoutNextLine()
    participant Layout as Canvas Layout Target
    
    State->>State: Determine available block bounds (row-by-row)
    
    alt Obstacle Left Exists (> 15px)
        State->>Pretext: Call with `width = ObstacleLeftBoundary - InitialLeftMargin`
        Pretext-->>State: Object -> { text: "Anime (Japanese: ", end: Cursor }
        State->>Layout: anchor X at right-alignment (Flush to inner contour)
    end
    
    alt Obstacle Right Exists (> 15px)
        State->>Pretext: Call with `width = InitialRightMargin - ObstacleRightBoundary`
        Pretext-->>State: Object -> { text: "originating from...", end: Cursor }
        State->>Layout: anchor X at left-alignment (Flush to inner contour)
    end
    
    note over Pretext, Layout: Because the width shrinks/grows gradually on the boundaries, Pretext dynamically adjusts the `cursor` variable down the chain, forcing the text lower perfectly without losing characters.
```
