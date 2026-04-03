import './style.css';
import { prepareWithSegments, layoutNextLine, type LayoutCursor } from '@chenglou/pretext';

const CHROMA_THRESHOLD = 90; // reduced threshold mapping
const LINE_HEIGHT = 26;
const FONT = '20px "Noto Sans JP", sans-serif';
const CANVAS_WIDTH = window.innerWidth;
const CANVAS_HEIGHT = window.innerHeight;

// Fullscreen Container Constraints
const CONTAINER_WIDTH = CANVAS_WIDTH;
const CONTAINER_HEIGHT = CANVAS_HEIGHT;
const containerLeft = 0;
const containerRight = CANVAS_WIDTH;
const containerTop = 0;
const containerBottom = CANVAS_HEIGHT;

const LOREM_IPSUM = `Anime (Japanese: アニメ, IPA: [aɲime] ) is hand-drawn and computer-generated animation originating from Japan. Outside of Japan and in English, anime refers specifically to animation produced in Japan. However, in Japan and in Japanese, anime (a term derived from a shortening of the English word animation) describes all animated works, regardless of style or origin. Many works of animation with a similar style to Japanese animation are also produced outside Japan. Video games sometimes also feature themes and art styles that are sometimes labelled as "anime". 
The earliest commercial Japanese animations date to 1917. A characteristic art style emerged in the 1960s with the works of cartoonist Osamu Tezuka and spread in following decades, developing a large domestic audience. Anime is distributed theatrically, through television broadcasts, directly to home media, and over the Internet. In addition to original works, anime are often adaptations of Japanese comics (manga), light novels, or video games. It is classified into numerous genres targeting various broad and niche audiences.
Modern Japanese animation is increasingly computer-rendered, although traditional hand-drawn animation remains favored among animators. Anime is a diverse medium with distinctive production methods that have adapted in response to emergent technologies. It combines graphic art, characterization, cinematography, and other forms of imaginative and individualistic techniques. Compared to Western animation, anime production generally focuses less on movement, and more on texturing and the details of settings, as well as the use of "camera effects" such as panning, zooming, and angle shots. Diverse art styles are used, and character proportions and features can be quite varied, with a common characteristic feature being large and emotive eyes. Anime has over 400 production companies.`.repeat(12);

const preparedText = prepareWithSegments(LOREM_IPSUM, FONT);

async function init() {
  const canvas = document.getElementById('layout-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  const video = document.getElementById('anime-video') as HTMLVideoElement;
  
  // Offscreen canvas for chroma processing
  const offCanvas = document.createElement('canvas');
  offCanvas.width = CANVAS_WIDTH;
  offCanvas.height = CANVAS_HEIGHT;
  const offCtx = offCanvas.getContext('2d', { willReadFrequently: true })!;
  
  // Start video
  try {
    await video.play();
  } catch (e) {
    console.warn("Video failed to play. You may need to click the screen, or provide valid assets/character.webm.");
  }

  const linesCount = Math.ceil(CANVAS_HEIGHT / LINE_HEIGHT);
  let smoothedBounds = Array.from({ length: linesCount }, () => ({ minX: CANVAS_WIDTH / 2, maxX: CANVAS_WIDTH / 2 }));

  function render() {
    requestAnimationFrame(render);
    
    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    let rowBounds = Array.from({ length: linesCount }, () => ({ minX: CANVAS_WIDTH, maxX: 0, hasPixels: false }));

    if (video.readyState >= 2) {
      // Scale and draw video to the center so it fits within the scaled down central box
      const MAX_VID_SIZE = CONTAINER_HEIGHT * 0.95; 
      const scale = Math.min(MAX_VID_SIZE / video.videoWidth, MAX_VID_SIZE / video.videoHeight);
      const vw = video.videoWidth * scale;
      const vh = video.videoHeight * scale;
      const vx = (CANVAS_WIDTH - vw) / 2;
      const vy = (CANVAS_HEIGHT - vh) / 2;
      
      offCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      offCtx.drawImage(video, vx, vy, vw, vh);
      
      const imgData = offCtx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      const data = imgData.data;
      
      const startY = Math.max(0, Math.floor(vy));
      const endY = Math.min(CANVAS_HEIGHT, Math.ceil(vy + vh));
      const startX = Math.max(0, Math.floor(vx));
      const endX = Math.min(CANVAS_WIDTH, Math.ceil(vx + vw));
      
      for (let y = startY; y < endY; y++) {
        const lineIndex = Math.floor(y / LINE_HEIGHT);
        if (lineIndex < 0 || lineIndex >= linesCount) continue;
        
        for (let x = startX; x < endX; x++) {
          const i = (y * CANVAS_WIDTH + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Chroma Key condition (assuming green background)
          if (g > CHROMA_THRESHOLD && g > r * 1.1 && g > b * 1.1) {
            data[i + 3] = 0; // Transparent
          } else if (data[i + 3] > 0) {
            const bound = rowBounds[lineIndex];
            bound.hasPixels = true;
            if (x < bound.minX) bound.minX = x;
            if (x > bound.maxX) bound.maxX = x;
          }
        }
      }
      
      // Put chroma keyed image to main ctx (do not draw to main canvas yet!)
      offCtx.putImageData(imgData, 0, 0);
    }
    
    // Apply temporal smoothing to bounds to eliminate aggressive shaking
    for (let i = 0; i < linesCount; i++) {
        let targetMin, targetMax;
        
        if (rowBounds[i].hasPixels) {
            targetMin = rowBounds[i].minX;
            targetMax = rowBounds[i].maxX;
        } else {
            // Shrink obstacle to its center when no pixels exist to cleanly close the gap without crossing over
            const center = (smoothedBounds[i].minX + smoothedBounds[i].maxX) / 2;
            targetMin = center;
            targetMax = center;
        }
        
        // Track visual boundaries smoothly (eliminates raw pixel video noise jitter)
        smoothedBounds[i].minX += (targetMin - smoothedBounds[i].minX) * 0.25;
        smoothedBounds[i].maxX += (targetMax - smoothedBounds[i].maxX) * 0.25;
    }
    
    // Render text with PRETEXT
    ctx.font = FONT;
    ctx.fillStyle = "#000000"; // Fixed: canvas can't read CSS vars natively without computed styles
    ctx.textBaseline = "top";
    
    let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 };
    let y = containerTop;
    let isExhausted = false;
    
    while (y < containerBottom && !isExhausted) {
      const lineIndex = Math.floor(y / LINE_HEIGHT);
      const visualBound = smoothedBounds[lineIndex] || { hasPixels: false, minX: CANVAS_WIDTH, maxX: 0 };
      const padding = 5;
      
      const leftMargin = containerLeft;
      const rightMargin = containerRight;
      
      let segmentsToDraw = [];
      const visualObstacleWidth = visualBound.maxX - visualBound.minX;
      
      // If obstacle exists visually according to real-time tracked edge contour
      if (visualObstacleWidth > 1) {
         const visualObstacleLeft = Math.floor(visualBound.minX - padding);
         const visualObstacleRight = Math.floor(visualBound.maxX + padding);
         
         // Left block (Right-aligned so contour is perfectly flush with sprite inward)
         if (visualObstacleLeft - leftMargin > 15) {
            segmentsToDraw.push({ 
                x: visualObstacleLeft, 
                align: "right" as CanvasTextAlign, 
                width: visualObstacleLeft - leftMargin 
            });
         }
         
         // Right block (Left-aligned so contour is perfectly flush with sprite inward)
         if (rightMargin - visualObstacleRight > 15) {
            segmentsToDraw.push({ 
                x: visualObstacleRight, 
                align: "left" as CanvasTextAlign, 
                width: rightMargin - visualObstacleRight 
            });
         }
      } else {
         // Clear space, span whole line width (Standard Left-alignment)
         segmentsToDraw.push({ x: leftMargin, align: "left" as CanvasTextAlign, width: rightMargin - leftMargin });
      }
      
      for (const seg of segmentsToDraw) {
         if (seg.width < 15) continue;

         const line = layoutNextLine(preparedText, cursor, seg.width);
         if (line === null) {
            isExhausted = true;
            break;
         }
         
         ctx.textAlign = seg.align;
         ctx.fillText(line.text.trim(), seg.x, y);
         cursor = line.end;
      }
      
      y += LINE_HEIGHT;
    }
    
    // Finally draw character OVER the text so she naturally overlaps it
    if (video.readyState >= 2) {
      ctx.drawImage(offCanvas, 0, 0);
    }
  }

  render();
}

init();
