/**
 * Snakes & Ladders Core Game Logic & Controller
 */

class ConfettiCannon {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.animating = false;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  burst(count = 150) {
    this.resize();
    const colors = ['#ff0055', '#00ffcc', '#ffe600', '#7928ca', '#0070f3', '#ff0080', '#00dfd8'];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: this.canvas.width / 2 + (Math.random() * 200 - 100),
        y: this.canvas.height / 2 + (Math.random() * 100 - 50),
        vx: (Math.random() - 0.5) * 22,
        vy: -Math.random() * 18 - 6,
        size: Math.random() * 9 + 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 15,
        gravity: 0.45,
        opacity: 1,
        decay: Math.random() * 0.008 + 0.005
      });
    }
    if (!this.animating) {
      this.animating = true;
      this.animate();
    }
  }

  animate() {
    if (!this.animating) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rotation += p.rotationSpeed;
      p.opacity -= p.decay;

      if (p.opacity <= 0 || p.y > this.canvas.height) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.globalAlpha = Math.max(0, p.opacity);
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      this.ctx.restore();
    }

    if (this.particles.length > 0) {
      requestAnimationFrame(() => this.animate());
    } else {
      this.animating = false;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}

class GameEngine {
  constructor() {
    this.boardEl = document.getElementById('game-board');
    this.svgEl = document.getElementById('board-svg');
    this.pawnsLayer = document.getElementById('pawns-layer');
    this.diceCube = document.getElementById('dice-cube');
    this.rollBtn = document.getElementById('roll-btn');
    this.turnIndicator = document.getElementById('current-player-display');
    this.gameLog = document.getElementById('game-log-list');
    this.confetti = new ConfettiCannon(document.getElementById('confetti-canvas'));

    this.renderer = new BoardRenderer(this.boardEl, this.svgEl);

    // Default configuration
    this.stepDelay = 260; // ms per hop
    this.powerUpsEnabled = true;
    this.bounceBackEnabled = true; // bounce back if roll exceeds 100

    this.players = [
      {
        id: 0,
        name: 'Player 1',
        color: '#00ffcc',
        secondary: '#0070f3',
        avatar: '🚀',
        isAI: false,
        position: 1,
        shield: false,
        element: null,
        stats: { rolls: 0, ladders: 0, snakes: 0, powerups: 0 }
      },
      {
        id: 1,
        name: 'Cosmo Bot',
        color: '#ff007f',
        secondary: '#7928ca',
        avatar: '🤖',
        isAI: true,
        position: 1,
        shield: false,
        element: null,
        stats: { rolls: 0, ladders: 0, snakes: 0, powerups: 0 }
      }
    ];

    this.currentTurn = 0;
    this.isBusy = false;
    this.gameOver = false;
    this.consecutiveSixes = 0;

    this.init();
  }

  init() {
    this.renderer.createGrid();
    this.renderer.renderOverlays();
    this.setupPawns();
    this.bindEvents();
    this.updateUI();
    this.logEvent('System', 'Game initialized! Ready to roll.', 'info');

    // Trigger pawn placement
    this.updatePawnPositions();

    // Check if initial player is AI
    this.checkAITurn();
  }

  setupPawns() {
    this.pawnsLayer.innerHTML = '';
    this.players.forEach(p => {
      const pawn = document.createElement('div');
      pawn.className = 'game-pawn';
      pawn.id = `pawn-player-${p.id}`;
      pawn.style.setProperty('--player-color', p.color);
      pawn.style.setProperty('--player-secondary', p.secondary);
      pawn.innerHTML = `
        <div class="pawn-body">
          <span class="pawn-avatar">${p.avatar}</span>
          <div class="pawn-shield-badge ${p.shield ? 'active' : ''}">🛡️</div>
        </div>
        <div class="pawn-shadow"></div>
      `;
      this.pawnsLayer.appendChild(pawn);
      p.element = pawn;
    });
  }

  bindEvents() {
    this.rollBtn.addEventListener('click', () => this.handleRollClick());
    this.diceCube.parentElement.addEventListener('click', () => this.handleRollClick());

    // Spacebar to roll
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat && !this.isBusy && !this.gameOver) {
        // Prevent scrolling if not in a modal
        const openModal = document.querySelector('dialog[open]');
        if (!openModal) {
          e.preventDefault();
          this.handleRollClick();
        }
      }
    });

    // Resize observer to re-position pawns cleanly on screen resizing
    const ro = new ResizeObserver(() => {
      this.updatePawnPositions();
    });
    ro.observe(this.boardEl);
  }

  handleRollClick() {
    if (this.isBusy || this.gameOver) return;
    const current = this.players[this.currentTurn];
    if (current.isAI) return; // Ignore clicks during bot turn

    window.soundEngine.ensureContext();
    this.executeRoll();
  }

  async executeRoll() {
    this.isBusy = true;
    this.rollBtn.disabled = true;

    const current = this.players[this.currentTurn];
    current.stats.rolls++;

    window.soundEngine.playDiceRoll();

    // Generate random roll 1-6
    const rollValue = Math.floor(Math.random() * 6) + 1;

    // Animate 3D dice
    await this.animateDice(rollValue);

    this.logEvent(current.name, `Rolled a ${rollValue}! 🎲`, 'roll');

    // Handle 6 streak
    if (rollValue === 6) {
      this.consecutiveSixes++;
      if (this.consecutiveSixes === 3) {
        this.logEvent(current.name, `3 consecutive 6s! Turn forfeited! ❌`, 'danger');
        this.consecutiveSixes = 0;
        await this.delay(600);
        this.finishTurn(false);
        return;
      }
    } else {
      this.consecutiveSixes = 0;
    }

    // Move pawn step-by-step
    await this.movePlayerSteps(current, rollValue);

    if (this.gameOver) return;

    // Extra turn if rolled 6
    if (rollValue === 6) {
      this.logEvent(current.name, `Rolled a 6! Earns an EXTRA TURN! 🎉`, 'boost');
      window.soundEngine.playPowerUp();
      await this.delay(400);
      this.isBusy = false;
      this.rollBtn.disabled = false;
      this.updateUI();
      this.checkAITurn();
    } else {
      this.finishTurn(true);
    }
  }

  // 3D dice roll animation with exact face rotations
  animateDice(targetValue) {
    return new Promise(resolve => {
      this.diceCube.classList.add('rolling');

      // Random tumbling intermediate angles
      const extraX = 720 + Math.floor(Math.random() * 4) * 360;
      const extraY = 720 + Math.floor(Math.random() * 4) * 360;

      // Final rotations for each face
      const faceRotations = {
        1: { x: 0, y: 0 },
        2: { x: 0, y: -90 },
        3: { x: 0, y: 90 },
        4: { x: 90, y: 0 },
        5: { x: -90, y: 0 },
        6: { x: 0, y: 180 }
      };

      const target = faceRotations[targetValue];

      setTimeout(() => {
        this.diceCube.classList.remove('rolling');
        this.diceCube.style.transform = `rotateX(${target.x + extraX}deg) rotateY(${target.y + extraY}deg)`;
        setTimeout(resolve, 350);
      }, 700);
    });
  }

  // Hop step-by-step through cells
  async movePlayerSteps(player, steps) {
    let target = player.position + steps;

    // Check bounce back rule
    if (target > 100) {
      if (this.bounceBackEnabled) {
        const overflow = target - 100;
        this.logEvent(player.name, `Exceeded 100! Bouncing back ${overflow} steps! ↩️`, 'warning');
        // First hop to 100
        while (player.position < 100) {
          player.position++;
          this.updatePawnPositions();
          window.soundEngine.playHop();
          await this.delay(this.stepDelay);
        }
        // Then bounce backwards
        for (let b = 0; b < overflow; b++) {
          player.position--;
          this.updatePawnPositions();
          window.soundEngine.playHop();
          await this.delay(this.stepDelay);
        }
      } else {
        this.logEvent(player.name, `Needs exact roll to reach 100! Turn skipped.`, 'warning');
        await this.delay(400);
        return;
      }
    } else {
      // Normal forward step hops
      for (let s = 0; s < steps; s++) {
        player.position++;
        this.updatePawnPositions();
        window.soundEngine.playHop();
        await this.delay(this.stepDelay);
      }
    }

    // Check Win Condition immediately
    if (player.position === 100) {
      await this.triggerVictory(player);
      return;
    }

    // Check Special Tiles: Power-Ups, Ladders, Snakes
    await this.handleTileEvents(player);
  }

  async handleTileEvents(player) {
    const pos = player.position;

    // 1. Power-Ups
    if (this.powerUpsEnabled && window.POWER_UPS[pos]) {
      const pUp = window.POWER_UPS[pos];
      player.stats.powerups++;
      this.logEvent(player.name, `Landed on ${pUp.icon} ${pUp.label}!`, 'boost');
      window.soundEngine.playPowerUp();

      if (pUp.type === 'shield') {
        player.shield = true;
        this.updateShieldUI(player);
        await this.delay(400);
      } else if (pUp.type === 'boost') {
        await this.delay(300);
        await this.movePlayerSteps(player, 3);
        return;
      } else if (pUp.type === 'warp') {
        await this.delay(300);
        await this.movePlayerSteps(player, 4);
        return;
      }
    }

    // 2. Ladder Climb
    if (window.LADDERS[pos]) {
      const destination = window.LADDERS[pos];
      player.stats.ladders++;
      this.logEvent(player.name, `Found a LADDER at ${pos}! Climbing to ${destination}! 🪜✨`, 'ladder');

      // Highlight ladder
      this.renderer.highlightConnections(pos);
      window.soundEngine.playLadder();

      await this.delay(400);

      // Smooth slide animation up to destination
      player.position = destination;
      this.updatePawnPositions(true); // smooth glide
      await this.delay(700);
      this.renderer.clearHighlights();

      if (player.position === 100) {
        await this.triggerVictory(player);
        return;
      }
    }

    // 3. Snake Bite
    else if (window.SNAKES[pos]) {
      const destination = window.SNAKES[pos];

      // Check Shield
      if (player.shield) {
        player.shield = false;
        this.updateShieldUI(player);
        this.logEvent(player.name, `🛡️ SHIELD ABSORBED THE SNAKE BITE at ${pos}! Stayed safe!`, 'boost');
        window.soundEngine.playShield();
        await this.delay(600);
      } else {
        player.stats.snakes++;
        this.logEvent(player.name, `OH NO! Bitten by a SNAKE at ${pos}! Sliding down to ${destination}! 🐍💥`, 'snake');

        this.renderer.highlightConnections(pos);
        window.soundEngine.playSnake();

        // Screen shake
        document.body.classList.add('screen-shake');
        setTimeout(() => document.body.classList.remove('screen-shake'), 450);

        await this.delay(400);

        // Smooth slide animation down to tail
        player.position = destination;
        this.updatePawnPositions(true);
        await this.delay(700);
        this.renderer.clearHighlights();
      }
    }
  }

  updateShieldUI(player) {
    if (player.element) {
      const badge = player.element.querySelector('.pawn-shield-badge');
      if (badge) {
        if (player.shield) badge.classList.add('active');
        else badge.classList.remove('active');
      }
    }
    this.updateUI();
  }

  // Update position styles for all pawns on the board
  updatePawnPositions(smooth = false) {
    const boardRect = this.boardEl.getBoundingClientRect();
    if (boardRect.width === 0) return;

    // Group pawns by cell to offset overlaps
    const cellGroups = {};
    this.players.forEach(p => {
      if (!cellGroups[p.position]) cellGroups[p.position] = [];
      cellGroups[p.position].push(p);
    });

    for (const [cellNum, group] of Object.entries(cellGroups)) {
      const center = BoardRenderer.getCellCenter(parseInt(cellNum, 10));
      // Convert SVG 0-1000 coordinate to board percentage
      const posX = (center.x / 1000) * 100;
      const posY = (center.y / 1000) * 100;

      group.forEach((p, idx) => {
        if (!p.element) return;

        // Offset multi-pawns on the same square
        let offsetX = 0;
        let offsetY = 0;
        if (group.length > 1) {
          const offsets = [
            { x: -10, y: -10 },
            { x: 10, y: -10 },
            { x: -10, y: 10 },
            { x: 10, y: 10 }
          ];
          offsetX = offsets[idx % offsets.length].x;
          offsetY = offsets[idx % offsets.length].y;
        }

        p.element.style.transition = smooth
          ? 'left 0.65s cubic-bezier(0.25, 1, 0.5, 1), top 0.65s cubic-bezier(0.25, 1, 0.5, 1)'
          : 'left 0.22s ease-out, top 0.22s ease-out';

        p.element.style.left = `calc(${posX}% + ${offsetX}px)`;
        p.element.style.top = `calc(${posY}% + ${offsetY}px)`;
      });
    }

    this.updateUI();
  }

  finishTurn(advance = true) {
    if (advance) {
      this.currentTurn = (this.currentTurn + 1) % this.players.length;
    }

    this.isBusy = false;
    this.rollBtn.disabled = false;
    this.updateUI();

    this.checkAITurn();
  }

  async checkAITurn() {
    if (this.gameOver) return;
    const current = this.players[this.currentTurn];
    if (current.isAI) {
      this.isBusy = true;
      this.rollBtn.disabled = true;
      this.rollBtn.innerHTML = `<span>🤖 ${current.name} is thinking...</span>`;

      // Natural bot delay
      await this.delay(750 + Math.random() * 400);

      if (!this.gameOver) {
        this.executeRoll();
      }
    } else {
      this.rollBtn.disabled = false;
      this.rollBtn.innerHTML = `
        <span class="btn-icon">🎲</span>
        <span class="btn-text">Roll Dice</span>
        <span class="btn-kbd">Space</span>
      `;
    }
  }

  async triggerVictory(winner) {
    this.gameOver = true;
    this.isBusy = false;
    this.rollBtn.disabled = true;

    this.logEvent(winner.name, `👑 CHAMPION! Landed on tile 100 and won the game! 🏆🎉`, 'winner');

    window.soundEngine.playVictory();
    this.confetti.burst(200);

    // Repeat confetti burst
    setTimeout(() => this.confetti.burst(150), 600);
    setTimeout(() => this.confetti.burst(120), 1200);

    // Display Victory Dialog
    const winModal = document.getElementById('victory-dialog');
    const winnerNameEl = document.getElementById('win-player-name');
    const winnerAvatarEl = document.getElementById('win-player-avatar');
    const winStatsEl = document.getElementById('win-stats-content');

    if (winModal) {
      winnerNameEl.textContent = winner.name;
      winnerAvatarEl.textContent = winner.avatar;
      winStatsEl.innerHTML = `
        <div class="stat-pill"><strong>Rolls:</strong> ${winner.stats.rolls}</div>
        <div class="stat-pill"><strong>Ladders:</strong> ${winner.stats.ladders}</div>
        <div class="stat-pill"><strong>Snakes:</strong> ${winner.stats.snakes}</div>
        <div class="stat-pill"><strong>Power-Ups:</strong> ${winner.stats.powerups}</div>
      `;
      winModal.showModal();
    }
  }

  updateUI() {
    const current = this.players[this.currentTurn];

    // Current turn card
    if (this.turnIndicator) {
      this.turnIndicator.innerHTML = `
        <div class="turn-avatar-badge" style="background: ${current.color}33; border-color: ${current.color};">
          <span>${current.avatar}</span>
        </div>
        <div class="turn-info">
          <span class="turn-label">Current Turn</span>
          <span class="turn-player-name" style="color: ${current.color}">${current.name}</span>
        </div>
        ${current.shield ? '<span class="turn-shield-badge" title="Shield Active">🛡️ Protected</span>' : ''}
      `;
    }

    // Scoreboard list
    const scoreboardEl = document.getElementById('scoreboard-list');
    if (scoreboardEl) {
      scoreboardEl.innerHTML = '';
      // Sort copy by position descending
      const sorted = [...this.players].sort((a, b) => b.position - a.position);

      sorted.forEach((p, rank) => {
        const item = document.createElement('div');
        item.className = `score-item ${p.id === this.currentTurn ? 'is-active' : ''}`;
        item.style.setProperty('--player-accent', p.color);
        item.innerHTML = `
          <div class="score-rank">#${rank + 1}</div>
          <div class="score-avatar">${p.avatar}</div>
          <div class="score-meta">
            <div class="score-name">${p.name} ${p.isAI ? '<span class="ai-tag">BOT</span>' : ''}</div>
            <div class="score-tile">Tile <strong>${p.position}</strong> / 100</div>
          </div>
          ${p.shield ? '<div class="score-shield" title="Shield Ready">🛡️</div>' : ''}
          <div class="score-progress-bar">
            <div class="score-progress-fill" style="width: ${p.position}%; background: ${p.color};"></div>
          </div>
        `;
        scoreboardEl.appendChild(item);
      });
    }
  }

  logEvent(actor, message, type = 'info') {
    const li = document.createElement('li');
    li.className = `log-entry log-${type}`;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    li.innerHTML = `
      <span class="log-time">${time}</span>
      <span class="log-actor">${actor}</span>
      <span class="log-msg">${message}</span>
    `;

    this.gameLog.prepend(li);

    // Limit log length
    while (this.gameLog.children.length > 40) {
      this.gameLog.removeChild(this.gameLog.lastChild);
    }
  }

  resetGame() {
    this.gameOver = false;
    this.isBusy = false;
    this.currentTurn = 0;
    this.consecutiveSixes = 0;

    this.players.forEach(p => {
      p.position = 1;
      p.shield = false;
      p.stats = { rolls: 0, ladders: 0, snakes: 0, powerups: 0 };
    });

    this.updateShieldUI(this.players[0]);
    this.updateShieldUI(this.players[1]);
    this.setupPawns();
    this.updatePawnPositions();
    this.updateUI();

    this.logEvent('System', 'Game restarted! Have fun!', 'info');
    window.soundEngine.playClick();

    this.checkAITurn();
  }

  configurePlayers(newConfig) {
    this.players = newConfig.map((cfg, idx) => ({
      id: idx,
      name: cfg.name || `Player ${idx + 1}`,
      color: cfg.color,
      secondary: cfg.secondary,
      avatar: cfg.avatar,
      isAI: cfg.isAI,
      position: 1,
      shield: false,
      element: null,
      stats: { rolls: 0, ladders: 0, snakes: 0, powerups: 0 }
    }));

    this.resetGame();
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

window.GameEngine = GameEngine;
