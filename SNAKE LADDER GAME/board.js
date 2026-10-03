/**
 * Board Architecture & Dynamic SVG Renderer for Snakes & Ladders
 */

const LADDERS = {
  4: 14,
  9: 31,
  20: 38,
  28: 84,
  40: 59,
  51: 67,
  63: 81,
  71: 91
};

const SNAKES = {
  17: 7,
  54: 34,
  62: 19,
  64: 60,
  87: 24,
  93: 73,
  95: 75,
  99: 78
};

const POWER_UPS = {
  15: { type: 'boost', label: '+3 Boost', icon: '⚡', desc: 'Rocket forward 3 extra tiles!' },
  44: { type: 'shield', label: 'Snake Shield', icon: '🛡️', desc: 'Immunity against next snake bite!' },
  82: { type: 'warp', label: 'Cosmic Warp', icon: '🌀', desc: 'Warp jump +4 tiles ahead!' }
};

class BoardRenderer {
  constructor(boardEl, svgEl) {
    this.boardEl = boardEl;
    this.svgEl = svgEl;
    this.cells = [];
  }

  // Convert cell number 1-100 to grid row (0 at top, 9 at bottom) & col (0-9)
  static getGridCoords(cell) {
    const rFromBottom = Math.floor((cell - 1) / 10);
    const isOddRow = (rFromBottom % 2 === 1);
    const col = isOddRow ? (9 - ((cell - 1) % 10)) : ((cell - 1) % 10);
    const row = 9 - rFromBottom;
    return { row, col };
  }

  // Returns center point in 0-1000 SVG coordinates
  static getCellCenter(cell) {
    const { row, col } = BoardRenderer.getGridCoords(cell);
    return {
      x: col * 100 + 50,
      y: row * 100 + 50
    };
  }

  // Generate board HTML cells
  createGrid() {
    this.boardEl.innerHTML = '';
    this.cells = [];

    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        // Find which cell number corresponds to row r, col c
        const rFromBottom = 9 - r;
        const isOddRow = (rFromBottom % 2 === 1);
        const cellNum = isOddRow
          ? rFromBottom * 10 + (9 - c) + 1
          : rFromBottom * 10 + c + 1;

        const cellDiv = document.createElement('div');
        cellDiv.className = `board-cell cell-${cellNum} ${(r + c) % 2 === 0 ? 'cell-alt' : ''}`;
        cellDiv.dataset.cell = cellNum;
        cellDiv.setAttribute('role', 'gridcell');
        cellDiv.setAttribute('aria-label', `Tile ${cellNum}`);

        // Cell number label
        const numSpan = document.createElement('span');
        numSpan.className = 'cell-number';
        numSpan.textContent = cellNum;
        cellDiv.appendChild(numSpan);

        // Ladder Indicator
        if (LADDERS[cellNum]) {
          cellDiv.classList.add('cell-ladder-start');
          const badge = document.createElement('div');
          badge.className = 'cell-badge badge-ladder';
          badge.innerHTML = `<span>🪜</span> <span class="badge-target">➔${LADDERS[cellNum]}</span>`;
          cellDiv.appendChild(badge);
        } else if (Object.values(LADDERS).includes(cellNum)) {
          cellDiv.classList.add('cell-ladder-end');
        }

        // Snake Indicator
        if (SNAKES[cellNum]) {
          cellDiv.classList.add('cell-snake-head');
          const badge = document.createElement('div');
          badge.className = 'cell-badge badge-snake';
          badge.innerHTML = `<span>🐍</span> <span class="badge-target">➔${SNAKES[cellNum]}</span>`;
          cellDiv.appendChild(badge);
        } else if (Object.values(SNAKES).includes(cellNum)) {
          cellDiv.classList.add('cell-snake-tail');
        }

        // Power-Up Badge
        if (POWER_UPS[cellNum]) {
          cellDiv.classList.add(`cell-powerup-${POWER_UPS[cellNum].type}`);
          const pBadge = document.createElement('div');
          pBadge.className = 'cell-powerup-icon';
          pBadge.textContent = POWER_UPS[cellNum].icon;
          pBadge.title = `${POWER_UPS[cellNum].label}: ${POWER_UPS[cellNum].desc}`;
          cellDiv.appendChild(pBadge);
        }

        // Special Start and Finish markers
        if (cellNum === 1) {
          cellDiv.classList.add('cell-start');
          const startLabel = document.createElement('span');
          startLabel.className = 'cell-corner-tag';
          startLabel.textContent = 'START';
          cellDiv.appendChild(startLabel);
        } else if (cellNum === 100) {
          cellDiv.classList.add('cell-finish');
          const crown = document.createElement('span');
          crown.className = 'cell-corner-tag finish-crown';
          crown.innerHTML = '👑 GOAL';
          cellDiv.appendChild(crown);
        }

        // Interactive hover listener
        cellDiv.addEventListener('mouseenter', () => this.highlightConnections(cellNum));
        cellDiv.addEventListener('mouseleave', () => this.clearHighlights());

        this.boardEl.appendChild(cellDiv);
        this.cells[cellNum] = cellDiv;
      }
    }
  }

  // Draw SVG Snakes and Ladders
  renderOverlays() {
    this.svgEl.innerHTML = '';

    // Defs for gradients, filters, markers
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <!-- Glow filter -->
      <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="6" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <!-- Intense Snake Glow -->
      <filter id="snake-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="2" stdDeviation="5" flood-color="#ff0055" flood-opacity="0.8"/>
      </filter>

      <!-- Intense Ladder Glow -->
      <filter id="ladder-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="#00ffcc" flood-opacity="0.7"/>
      </filter>

      <!-- Gold ladder gradient -->
      <linearGradient id="ladder-gold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffe259"/>
        <stop offset="50%" stop-color="#ffa751"/>
        <stop offset="100%" stop-color="#ffd200"/>
      </linearGradient>

      <!-- Cyan high-tech ladder gradient -->
      <linearGradient id="ladder-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#00f2fe"/>
        <stop offset="100%" stop-color="#4facfe"/>
      </linearGradient>

      <!-- Snake Skin Gradients -->
      <linearGradient id="snake-crimson" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ff0844"/>
        <stop offset="50%" stop-color="#ff4e50"/>
        <stop offset="100%" stop-color="#800020"/>
      </linearGradient>

      <linearGradient id="snake-emerald" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0575e6"/>
        <stop offset="50%" stop-color="#00f260"/>
        <stop offset="100%" stop-color="#0575e6"/>
      </linearGradient>

      <linearGradient id="snake-purple" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f857a6"/>
        <stop offset="50%" stop-color="#ff5858"/>
        <stop offset="100%" stop-color="#6a0572"/>
      </linearGradient>
    `;
    this.svgEl.appendChild(defs);

    // Group for Ladders
    const laddersGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    laddersGroup.setAttribute('class', 'ladders-group');
    for (const [startStr, endNum] of Object.entries(LADDERS)) {
      const startNum = parseInt(startStr, 10);
      const ladderElem = this.createLadderElement(startNum, endNum);
      laddersGroup.appendChild(ladderElem);
    }
    this.svgEl.appendChild(laddersGroup);

    // Group for Snakes
    const snakesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    snakesGroup.setAttribute('class', 'snakes-group');
    let sIdx = 0;
    for (const [headStr, tailNum] of Object.entries(SNAKES)) {
      const headNum = parseInt(headStr, 10);
      const snakeElem = this.createSnakeElement(headNum, tailNum, sIdx++);
      snakesGroup.appendChild(snakeElem);
    }
    this.svgEl.appendChild(snakesGroup);
  }

  // Create SVG element for a ladder
  createLadderElement(startCell, endCell) {
    const p1 = BoardRenderer.getCellCenter(startCell);
    const p2 = BoardRenderer.getCellCenter(endCell);

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'svg-ladder');
    g.dataset.start = startCell;
    g.dataset.end = endCell;
    g.setAttribute('filter', 'url(#ladder-glow)');

    // Vector calculations for parallel ladder rails
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;

    // Perpendicular vector
    const px = -uy;
    const py = ux;
    const railOffset = 14; // half distance between rails

    // Rail 1
    const r1x1 = p1.x + px * railOffset;
    const r1y1 = p1.y + py * railOffset;
    const r1x2 = p2.x + px * railOffset;
    const r1y2 = p2.y + py * railOffset;

    // Rail 2
    const r2x1 = p1.x - px * railOffset;
    const r2y1 = p1.y - py * railOffset;
    const r2x2 = p2.x - px * railOffset;
    const r2y2 = p2.y - py * railOffset;

    // Rail elements
    const rail1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    rail1.setAttribute('x1', r1x1);
    rail1.setAttribute('y1', r1y1);
    rail1.setAttribute('x2', r1x2);
    rail1.setAttribute('y2', r1y2);
    rail1.setAttribute('stroke', 'url(#ladder-gold)');
    rail1.setAttribute('stroke-width', '6');
    rail1.setAttribute('stroke-linecap', 'round');
    g.appendChild(rail1);

    const rail2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    rail2.setAttribute('x1', r2x1);
    rail2.setAttribute('y1', r2y1);
    rail2.setAttribute('x2', r2x2);
    rail2.setAttribute('y2', r2y2);
    rail2.setAttribute('stroke', 'url(#ladder-gold)');
    rail2.setAttribute('stroke-width', '6');
    rail2.setAttribute('stroke-linecap', 'round');
    g.appendChild(rail2);

    // Ladder Rungs
    const numRungs = Math.max(3, Math.floor(len / 35));
    for (let i = 1; i < numRungs; i++) {
      const t = i / numRungs;
      const rungX = p1.x + dx * t;
      const rungY = p1.y + dy * t;

      const rung = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      rung.setAttribute('x1', rungX + px * railOffset);
      rung.setAttribute('y1', rungY + py * railOffset);
      rung.setAttribute('x2', rungX - px * railOffset);
      rung.setAttribute('y2', rungY - py * railOffset);
      rung.setAttribute('stroke', '#fff0a5');
      rung.setAttribute('stroke-width', '4');
      rung.setAttribute('stroke-linecap', 'round');
      g.appendChild(rung);
    }

    return g;
  }

  // Create curvy, organic SVG snake with head, eyes, and slithering body
  createSnakeElement(headCell, tailCell, colorIndex) {
    const head = BoardRenderer.getCellCenter(headCell);
    const tail = BoardRenderer.getCellCenter(tailCell);

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'svg-snake');
    g.dataset.head = headCell;
    g.dataset.tail = tailCell;
    g.setAttribute('filter', 'url(#snake-glow)');

    const dx = tail.x - head.x;
    const dy = tail.y - head.y;
    const dist = Math.hypot(dx, dy);

    // Generate natural sinusoidal control points for the snake's curves
    const nx = -dy / dist;
    const ny = dx / dist;

    // Alternate wavy bends
    const curveAmp = Math.min(55, Math.max(30, dist * 0.15));
    const cp1x = head.x + dx * 0.33 + nx * curveAmp * (colorIndex % 2 === 0 ? 1 : -1);
    const cp1y = head.y + dy * 0.33 + ny * curveAmp * (colorIndex % 2 === 0 ? 1 : -1);
    const cp2x = head.x + dx * 0.66 - nx * curveAmp * (colorIndex % 2 === 0 ? 1 : -1);
    const cp2y = head.y + dy * 0.66 - ny * curveAmp * (colorIndex % 2 === 0 ? 1 : -1);

    const pathData = `M ${head.x} ${head.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${tail.x} ${tail.y}`;

    // Gradient selector
    const gradients = ['url(#snake-crimson)', 'url(#snake-emerald)', 'url(#snake-purple)'];
    const chosenGrad = gradients[colorIndex % gradients.length];

    // Underbelly shadow
    const bodyShadow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    bodyShadow.setAttribute('d', pathData);
    bodyShadow.setAttribute('fill', 'none');
    bodyShadow.setAttribute('stroke', '#000');
    bodyShadow.setAttribute('stroke-width', '16');
    bodyShadow.setAttribute('stroke-opacity', '0.45');
    bodyShadow.setAttribute('stroke-linecap', 'round');
    g.appendChild(bodyShadow);

    // Main Snake Body
    const body = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    body.setAttribute('d', pathData);
    body.setAttribute('fill', 'none');
    body.setAttribute('stroke', chosenGrad);
    body.setAttribute('stroke-width', '12');
    body.setAttribute('stroke-linecap', 'round');
    body.setAttribute('class', 'snake-body-path');
    g.appendChild(body);

    // Spine/Pattern highlight line
    const spine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    spine.setAttribute('d', pathData);
    spine.setAttribute('fill', 'none');
    spine.setAttribute('stroke', '#ffffff');
    spine.setAttribute('stroke-width', '3');
    spine.setAttribute('stroke-dasharray', '8 12');
    spine.setAttribute('stroke-opacity', '0.7');
    spine.setAttribute('stroke-linecap', 'round');
    g.appendChild(spine);

    // Snake Tail Rattle/Tip
    const tailTip = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    tailTip.setAttribute('cx', tail.x);
    tailTip.setAttribute('cy', tail.y);
    tailTip.setAttribute('r', '6');
    tailTip.setAttribute('fill', '#ffd700');
    tailTip.setAttribute('stroke', '#333');
    tailTip.setAttribute('stroke-width', '2');
    g.appendChild(tailTip);

    // Snake Head
    const headAngle = Math.atan2(head.y - cp1y, head.x - cp1x) * (180 / Math.PI);
    const headG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    headG.setAttribute('transform', `translate(${head.x}, ${head.y}) rotate(${headAngle})`);

    // Head base (oval)
    const headShape = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    headShape.setAttribute('cx', '0');
    headShape.setAttribute('cy', '0');
    headShape.setAttribute('rx', '15');
    headShape.setAttribute('ry', '11');
    headShape.setAttribute('fill', chosenGrad);
    headShape.setAttribute('stroke', '#ffffff');
    headShape.setAttribute('stroke-width', '2');
    headG.appendChild(headShape);

    // Red glowing eyes
    const eye1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    eye1.setAttribute('cx', '5');
    eye1.setAttribute('cy', '-5');
    eye1.setAttribute('r', '3');
    eye1.setAttribute('fill', '#ffff00');
    headG.appendChild(eye1);

    const eye2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    eye2.setAttribute('cx', '5');
    eye2.setAttribute('cy', '5');
    eye2.setAttribute('r', '3');
    eye2.setAttribute('fill', '#ffff00');
    headG.appendChild(eye2);

    // Slithering Forked Tongue
    const tongue = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tongue.setAttribute('d', 'M 14 0 L 22 -4 M 14 0 L 22 4 M 14 0 L 19 0');
    tongue.setAttribute('stroke', '#ff0033');
    tongue.setAttribute('stroke-width', '2');
    tongue.setAttribute('fill', 'none');
    tongue.setAttribute('stroke-linecap', 'round');
    headG.appendChild(tongue);

    g.appendChild(headG);
    return g;
  }

  // Highlight connections when hovering on a cell
  highlightConnections(cellNum) {
    this.clearHighlights();

    // Check if it's a ladder
    const ladderStart = this.svgEl.querySelector(`[data-start="${cellNum}"]`);
    const ladderEnd = this.svgEl.querySelector(`[data-end="${cellNum}"]`);
    const targetLadder = ladderStart || ladderEnd;

    if (targetLadder) {
      targetLadder.classList.add('highlighted');
      const start = targetLadder.dataset.start;
      const end = targetLadder.dataset.end;
      if (this.cells[start]) this.cells[start].classList.add('cell-glow');
      if (this.cells[end]) this.cells[end].classList.add('cell-glow');
    }

    // Check if it's a snake
    const snakeHead = this.svgEl.querySelector(`[data-head="${cellNum}"]`);
    const snakeTail = this.svgEl.querySelector(`[data-tail="${cellNum}"]`);
    const targetSnake = snakeHead || snakeTail;

    if (targetSnake) {
      targetSnake.classList.add('highlighted');
      const head = targetSnake.dataset.head;
      const tail = targetSnake.dataset.tail;
      if (this.cells[head]) this.cells[head].classList.add('cell-glow-danger');
      if (this.cells[tail]) this.cells[tail].classList.add('cell-glow-danger');
    }
  }

  clearHighlights() {
    this.svgEl.querySelectorAll('.highlighted').forEach(el => el.classList.remove('highlighted'));
    this.boardEl.querySelectorAll('.cell-glow, .cell-glow-danger').forEach(el => {
      el.classList.remove('cell-glow', 'cell-glow-danger');
    });
  }
}

window.BoardRenderer = BoardRenderer;
window.LADDERS = LADDERS;
window.SNAKES = SNAKES;
window.POWER_UPS = POWER_UPS;
