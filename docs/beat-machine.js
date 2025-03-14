class BeatMachine extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    
    // Initialize state
    this.isPlaying = false;
    this.currentStep = 0;
    this.tempo = 120; // BPM
    this.stepCount = 16; // 16 steps per pattern
    this.instruments = {}; // Will be set externally
    
    // Web Audio API context
    this.audioContext = null;
    this.nextStepTime = 0;
    this.lookahead = 25.0; // milliseconds
    this.scheduleAheadTime = 0.1; // seconds
    this.schedulerTimer = null;
    
    // Default pattern (can be updated)
    this.pattern = {};
    
    // Create shadow DOM structure
    this.render();
  }
  
  connectedCallback() {
    this.shadowRoot.querySelector('#playButton').addEventListener('click', () => {
      this.togglePlayback();
    });
    
    // Set initial BPM from attribute if provided
    if (this.hasAttribute('tempo')) {
      this.tempo = parseInt(this.getAttribute('tempo'), 10) || 120;
    }
  }
  
  disconnectedCallback() {
    this.stop();
  }
  
  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: sans-serif;
          margin-bottom: 10px;
        }
        .container {
          display: flex;
          align-items: center;
          padding: 0;
        }
        #playButton {
          min-width: 32px;
          max-width: 32px;
          height: 32px;
          border: 1px solid #ccc;
          background: #f0f0f0;
          color: #333;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          margin-right: 0;
          box-sizing: border-box;
        }
        #playButton:hover {
          background: #e0e0e0;
        }
        .step-container {
          display: flex;
          flex-grow: 1;
        }
        .step-indicators {
          display: flex;
          align-items: center;
          width: 100%;
        }
        .step {
          width: 32px;
          height: 32px;
          box-sizing: border-box;
          border: 1px solid #ccc;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          background: transparent;
          color: white;
        }
        .step.inst {
          color: black;
        }
        .step.on {
          background: black;

        }
        .step.off {
          background: white;
          color: white;
        }
        .step.active {
          background: rgba(0,0,0,0.15);
          border-color: #333;
          font-weight: bold;
        }
        .CHR .step.on,
        .OHR .step.on,
        .SNR .step.on {
          background-image: linear-gradient(90deg, #000 25%, transparent 25%, transparent 50%, #000 50%, #000 75%, transparent 75%, #fff);
          background-size: 8px;
        }
      </style>
      <div class="container">
        <button id="playButton">▶</button>
        <div class="step-container">
          <div class="step-indicators">
            ${Array(this.stepCount).fill(0).map((_, i) => 
              `<div class="step" id="step-${i}"></div>`
            ).join('')}
          </div>
        </div>
      </div>
      <div id="display"></div>
    `;
  }
  
  updateStepIndicator(step) {
    // Clear all active steps
    this.shadowRoot.querySelectorAll('.step').forEach(stepEl => {
      stepEl.classList.remove('active');
    });
    
    // Highlight current step
    const currentStepEl = this.shadowRoot.querySelector(`#step-${step}`);
    if (currentStepEl) {
      currentStepEl.classList.add('active');
    }
  }
  
  updatePattern(newPattern) {
    this.pattern = {...newPattern};
    const o = this.shadowRoot.getElementById('display')
    o.innerHTML = ''
    for (const inst of Object.keys(newPattern)) {
      o.innerHTML += `<div class="container ${inst}">
          <div class="step inst">${inst}</div>
          <div class="step-container">
            <div class="step-indicators">
              ${Array(this.stepCount).fill(0).map((_, i) => 
                `<div class="step ${newPattern[inst].includes(i+1) ? `on">${i+1}` : 'off">'}</div>`
              ).join('')}
            </div>
          </div>
        </div>
      </div>`
    }

  }
  
  scheduler() {
    // While there are notes to be played before the next interval
    while (this.nextStepTime < this.audioContext.currentTime + this.scheduleAheadTime) {
      this.scheduleStep(this.currentStep, this.nextStepTime);
      this.advanceStep();
    }
    
    // Schedule the next scheduler call
    this.schedulerTimer = setTimeout(() => this.scheduler(), this.lookahead);
  }
  
  scheduleStep(step, time) {
    // Update visual step indicator on next frame
    window.requestAnimationFrame(() => {
      this.updateStepIndicator(step);
    });
    
    // Calculate 1-based step number for pattern matching (as your pattern seems to be 0-based)
    const stepNumber = step + 1;
    
    // Play all instruments that have this step in their pattern
    Object.entries(this.pattern).forEach(([instrument, steps]) => {
      if (steps.includes(stepNumber)) {
        // Schedule the sound precisely using Web Audio API
        if (this.instruments[instrument]) {
          this.playSound(this.instruments[instrument], time);
        }
        
        // handle "rolling" instruments (smaller than 16th notes, fit to 1/16 beat)
        if (instrument.endsWith('R')) {
          // Calculate time for next step based on tempo
          const secondsPerBeat = 60.0 / this.tempo;
          const secondsPerStep = secondsPerBeat / 4; // 16th notes (4 steps per beat)
          const rollTime = secondsPerStep / 4
          const rollAmount = 4
          let i = rollAmount;
          while (i--) {
            this.playSound(this.instruments[instrument.substr(0, 2)], time + (rollTime * i));
          }
        }
      }
    });
  }
  
  playSound(audioElement, time) {
    // Create a new AudioBufferSourceNode if the audio is already loaded
    if (audioElement.audioBuffer) {
      const source = this.audioContext.createBufferSource();
      source.buffer = audioElement.audioBuffer;
      source.connect(this.audioContext.destination);
      source.start(time);
      return;
    }
    
    // If we don't have the buffer yet (first time), fall back to standard Audio
    const audio = audioElement.cloneNode();
    audio.play();
  }
  
  advanceStep() {
    // Calculate time for next step based on tempo
    const secondsPerBeat = 60.0 / this.tempo;
    const secondsPerStep = secondsPerBeat / 4; // 16th notes (4 steps per beat)
    
    // Advance time and step
    this.nextStepTime += secondsPerStep;
    this.currentStep = (this.currentStep + 1) % this.stepCount;
  }
  
  loadAudioBuffers() {
    if (!this.instruments) return;
    
    // Create AudioBuffers for each instrument to allow precise scheduling
    Object.entries(this.instruments).forEach(([key, audioElement]) => {
      // Skip if already processed
      if (audioElement.audioBuffer) return;
      
      // Get the audio file
      fetch(audioElement.src)
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => this.audioContext.decodeAudioData(arrayBuffer))
        .then(audioBuffer => {
          // Store the decoded buffer with the audio element
          audioElement.audioBuffer = audioBuffer;
        })
        .catch(e => console.error("Error loading audio buffer:", e));
    });
  }
  
  start() {
    // Initialize audio context if it doesn't exist
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.loadAudioBuffers();
    } else if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }
    
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    this.shadowRoot.querySelector('#playButton').textContent = '⏸';
    
    // Start scheduling from the current time
    this.currentStep = 0;
    this.nextStepTime = this.audioContext.currentTime;
    this.scheduler();
  }
  
  stop() {
    if (this.schedulerTimer) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    
    this.isPlaying = false;
    this.shadowRoot.querySelector('#playButton').textContent = '▶';
    
    // Reset to start
    this.currentStep = 0;
    this.updateStepIndicator(this.currentStep);
  }
  
  togglePlayback() {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.start();
    }
  }
  
  // Setter for tempo
  set tempo(value) {
    this._tempo = value;
  }
  
  // Getter for tempo
  get tempo() {
    return this._tempo;
  }
}

// Define the custom element
customElements.define('beat-machine', BeatMachine);